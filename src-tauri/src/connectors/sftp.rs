//! SFTP operations for SSH sessions
//!
//! Provides file browser functionality over SFTP with persistent connection pooling.

use russh::client::{self, Config, Handle, Handler};
use russh::keys::key::PublicKey;
use russh_sftp::client::SftpSession;
use russh_sftp::protocol::OpenFlags;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use async_trait::async_trait;
use tokio::sync::Mutex as TokioMutex;

use super::{SshAuth, SshConfig, load_ssh_key};

/// Simple handler for SFTP connections
struct SftpHandler;

#[async_trait]
impl Handler for SftpHandler {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        _server_public_key: &PublicKey,
    ) -> Result<bool, Self::Error> {
        Ok(true)
    }
}

// ============================================================================
// Pool types
// ============================================================================

/// Holds an active SFTP session and the underlying SSH handle (must stay alive)
pub struct SftpPoolEntry {
    pub sftp: SftpSession,
    #[allow(dead_code)]
    handle: Handle<SftpHandler>,
}

/// Thread-safe pool of SFTP connections keyed by session_id.
/// Outer mutex: short lock to access the HashMap.
/// Inner mutex: held for the duration of an SFTP operation.
pub type SftpPool = Arc<TokioMutex<HashMap<String, Arc<TokioMutex<SftpPoolEntry>>>>>;

/// Create a new empty pool
pub fn new_sftp_pool() -> SftpPool {
    Arc::new(TokioMutex::new(HashMap::new()))
}

/// Establish a fresh SFTP session from an SshConfig
async fn connect_sftp(config: &SshConfig) -> Result<SftpPoolEntry, String> {
    let mut ssh_config = Config::default();
    ssh_config.inactivity_timeout = Some(Duration::from_secs(300));

    let handler = SftpHandler;
    let addr = format!("{}:{}", config.host, config.port);

    // TCP + handshake
    let mut session = client::connect(Arc::new(ssh_config), &addr, handler)
        .await
        .map_err(|e| format!("SFTP connection failed: {}", e))?;

    // Authenticate
    let authenticated = match &config.auth {
        SshAuth::Password(password) => session
            .authenticate_password(&config.username, password)
            .await
            .map_err(|e| format!("Authentication failed: {}", e))?,
        SshAuth::KeyFile { path, passphrase } => {
            let key = load_ssh_key(path, passphrase.as_deref())?;
            session
                .authenticate_publickey(&config.username, Arc::new(key))
                .await
                .map_err(|e| format!("Key authentication failed: {}", e))?
        }
    };

    if !authenticated {
        return Err("Authentication failed".to_string());
    }

    // Open SFTP channel
    let channel = session
        .channel_open_session()
        .await
        .map_err(|e| format!("Failed to open channel: {}", e))?;

    channel
        .request_subsystem(true, "sftp")
        .await
        .map_err(|e| format!("Failed to request SFTP subsystem: {}", e))?;

    let sftp = SftpSession::new(channel.into_stream())
        .await
        .map_err(|e| format!("Failed to create SFTP session: {}", e))?;

    Ok(SftpPoolEntry { sftp, handle: session })
}

/// Get an existing pooled connection or create a new one
async fn get_or_connect(
    pool: &SftpPool,
    session_id: &str,
    config: &SshConfig,
) -> Result<Arc<TokioMutex<SftpPoolEntry>>, String> {
    // Check if we already have a connection
    {
        let map = pool.lock().await;
        if let Some(entry) = map.get(session_id) {
            return Ok(entry.clone());
        }
    }

    // Create new connection
    let entry = connect_sftp(config).await?;
    let entry_arc = Arc::new(TokioMutex::new(entry));

    let mut map = pool.lock().await;
    map.insert(session_id.to_string(), entry_arc.clone());

    Ok(entry_arc)
}

/// Remove a session from the pool (dropping the entry closes the connection)
pub async fn disconnect_sftp(pool: &SftpPool, session_id: &str) {
    let mut map = pool.lock().await;
    map.remove(session_id);
}

/// Helper: execute an SFTP operation with automatic retry on stale connection
async fn with_sftp<F, Fut, T>(
    pool: &SftpPool,
    session_id: &str,
    config: &SshConfig,
    op: F,
) -> Result<T, String>
where
    F: Fn(Arc<TokioMutex<SftpPoolEntry>>) -> Fut + Send,
    Fut: std::future::Future<Output = Result<T, String>> + Send,
{
    let entry = get_or_connect(pool, session_id, config).await?;

    match op(entry).await {
        Ok(val) => Ok(val),
        Err(_) => {
            // Connection might be stale — drop it and retry once
            disconnect_sftp(pool, session_id).await;
            let entry2 = get_or_connect(pool, session_id, config).await?;
            op(entry2).await
        }
    }
}

// ============================================================================
// Public SFTP operations
// ============================================================================

/// File entry returned by list_dir
#[derive(Debug, Clone, serde::Serialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: Option<u64>,
    pub permissions: Option<String>,
}

/// List directory contents via SFTP
pub async fn sftp_list_dir(
    pool: &SftpPool,
    session_id: &str,
    config: &SshConfig,
    path: &str,
) -> Result<Vec<FileEntry>, String> {
    let path = path.to_string();
    with_sftp(pool, session_id, config, |entry| {
        let path = path.clone();
        async move {
            let guard = entry.lock().await;
            let entries = guard.sftp
                .read_dir(&path)
                .await
                .map_err(|e| format!("Failed to read directory: {}", e))?;

            let mut result = Vec::new();
            for dir_entry in entries {
                let name = dir_entry.file_name();
                if name == "." || name == ".." {
                    continue;
                }

                let file_path = if path == "/" || path.is_empty() {
                    format!("/{}", name)
                } else if path.ends_with('/') {
                    format!("{}{}", path, name)
                } else {
                    format!("{}/{}", path, name)
                };

                let attrs = dir_entry.metadata();
                let is_dir = attrs.is_dir();
                let size = attrs.size.unwrap_or(0);
                let modified = attrs.mtime.map(|t| t as u64);

                let permissions = attrs.permissions.map(|p| {
                    let mode = p & 0o777;
                    format!(
                        "{}{}{}{}{}{}{}{}{}",
                        if mode & 0o400 != 0 { 'r' } else { '-' },
                        if mode & 0o200 != 0 { 'w' } else { '-' },
                        if mode & 0o100 != 0 { 'x' } else { '-' },
                        if mode & 0o040 != 0 { 'r' } else { '-' },
                        if mode & 0o020 != 0 { 'w' } else { '-' },
                        if mode & 0o010 != 0 { 'x' } else { '-' },
                        if mode & 0o004 != 0 { 'r' } else { '-' },
                        if mode & 0o002 != 0 { 'w' } else { '-' },
                        if mode & 0o001 != 0 { 'x' } else { '-' },
                    )
                });

                result.push(FileEntry {
                    name,
                    path: file_path,
                    is_dir,
                    size,
                    modified,
                    permissions,
                });
            }

            result.sort_by(|a, b| {
                match (a.is_dir, b.is_dir) {
                    (true, false) => std::cmp::Ordering::Less,
                    (false, true) => std::cmp::Ordering::Greater,
                    _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
                }
            });

            Ok(result)
        }
    })
    .await
}

/// Read file contents via SFTP
pub async fn sftp_read_file(
    pool: &SftpPool,
    session_id: &str,
    config: &SshConfig,
    path: &str,
) -> Result<Vec<u8>, String> {
    let path = path.to_string();
    with_sftp(pool, session_id, config, |entry| {
        let path = path.clone();
        async move {
            let guard = entry.lock().await;
            guard.sftp
                .read(&path)
                .await
                .map_err(|e| format!("Failed to read file: {}", e))
        }
    })
    .await
}

/// Write file contents via SFTP
pub async fn sftp_write_file(
    pool: &SftpPool,
    session_id: &str,
    config: &SshConfig,
    path: &str,
    data: Vec<u8>,
) -> Result<(), String> {
    let path = path.to_string();
    with_sftp(pool, session_id, config, |entry| {
        let path = path.clone();
        let data = data.clone();
        async move {
            let guard = entry.lock().await;
            guard.sftp
                .write(&path, &data)
                .await
                .map_err(|e| format!("Failed to write file: {}", e))
        }
    })
    .await
}

/// Delete a file or directory via SFTP (recursive for non-empty dirs)
pub async fn sftp_delete(
    pool: &SftpPool,
    session_id: &str,
    config: &SshConfig,
    path: &str,
    is_dir: bool,
) -> Result<(), String> {
    if is_dir {
        sftp_delete_recursive(pool, session_id, config, path).await
    } else {
        let path = path.to_string();
        with_sftp(pool, session_id, config, |entry| {
            let path = path.clone();
            async move {
                let guard = entry.lock().await;
                guard.sftp
                    .remove_file(&path)
                    .await
                    .map_err(|e| format!("Failed to remove file: {}", e))
            }
        })
        .await
    }
}

/// Recursively delete a directory and all its contents
async fn sftp_delete_recursive(
    pool: &SftpPool,
    session_id: &str,
    config: &SshConfig,
    dir_path: &str,
) -> Result<(), String> {
    // List contents first
    let entries = sftp_list_dir(pool, session_id, config, dir_path).await?;

    // Delete children (files first, then subdirs)
    for entry in &entries {
        if entry.is_dir {
            // Use Box::pin for recursive async
            Box::pin(sftp_delete_recursive(pool, session_id, config, &entry.path)).await?;
        } else {
            let path = entry.path.clone();
            with_sftp(pool, session_id, config, |e| {
                let path = path.clone();
                async move {
                    let guard = e.lock().await;
                    guard.sftp
                        .remove_file(&path)
                        .await
                        .map_err(|e| format!("Failed to remove file: {}", e))
                }
            })
            .await?;
        }
    }

    // Now remove the empty directory
    let dir_path = dir_path.to_string();
    with_sftp(pool, session_id, config, |entry| {
        let dir_path = dir_path.clone();
        async move {
            let guard = entry.lock().await;
            guard.sftp
                .remove_dir(&dir_path)
                .await
                .map_err(|e| format!("Failed to remove directory: {}", e))
        }
    })
    .await
}

/// Rename/move a file or directory via SFTP
pub async fn sftp_rename(
    pool: &SftpPool,
    session_id: &str,
    config: &SshConfig,
    old_path: &str,
    new_path: &str,
) -> Result<(), String> {
    let old_path = old_path.to_string();
    let new_path = new_path.to_string();
    with_sftp(pool, session_id, config, |entry| {
        let old_path = old_path.clone();
        let new_path = new_path.clone();
        async move {
            let guard = entry.lock().await;
            guard.sftp
                .rename(&old_path, &new_path)
                .await
                .map_err(|e| format!("Failed to rename: {}", e))
        }
    })
    .await
}

/// Create a directory via SFTP
pub async fn sftp_mkdir(
    pool: &SftpPool,
    session_id: &str,
    config: &SshConfig,
    path: &str,
) -> Result<(), String> {
    let path = path.to_string();
    with_sftp(pool, session_id, config, |entry| {
        let path = path.clone();
        async move {
            let guard = entry.lock().await;
            guard.sftp
                .create_dir(&path)
                .await
                .map_err(|e| format!("Failed to create directory: {}", e))
        }
    })
    .await
}

// ============================================================================
// Upload with progress
// ============================================================================

/// Progress event emitted during upload
#[derive(Debug, Clone, serde::Serialize)]
pub struct SftpUploadProgress {
    pub session_id: String,
    pub file_name: String,
    pub bytes_sent: u64,
    pub total_bytes: u64,
    pub file_index: u32,
    pub total_files: u32,
    pub done: bool,
    pub error: Option<String>,
}

/// Upload a file via SFTP (uses pool), emitting progress events
pub async fn sftp_upload_file(
    pool: &SftpPool,
    session_id: &str,
    config: &SshConfig,
    remote_path: &str,
    data: Vec<u8>,
    file_name: String,
    file_index: u32,
    total_files: u32,
    app_handle: &tauri::AppHandle,
) -> Result<(), String> {
    use tauri::Emitter;

    let total_bytes = data.len() as u64;
    let session_id_str = session_id.to_string();
    let remote_path = remote_path.to_string();

    // Emit start progress
    let _ = app_handle.emit("sftp-upload-progress", SftpUploadProgress {
        session_id: session_id_str.clone(),
        file_name: file_name.clone(),
        bytes_sent: 0,
        total_bytes,
        file_index,
        total_files,
        done: false,
        error: None,
    });

    let result = with_sftp(pool, &session_id_str, config, |entry| {
        let remote_path = remote_path.clone();
        let data = data.clone();
        async move {
            use tokio::io::AsyncWriteExt;
            let guard = entry.lock().await;
            let mut file = guard.sftp
                .open_with_flags(
                    &remote_path,
                    OpenFlags::CREATE | OpenFlags::TRUNCATE | OpenFlags::WRITE,
                )
                .await
                .map_err(|e| format!("Failed to create remote file: {}", e))?;
            file.write_all(&data)
                .await
                .map_err(|e| format!("Failed to write data: {}", e))?;
            file.flush()
                .await
                .map_err(|e| format!("Failed to flush: {}", e))?;
            file.shutdown()
                .await
                .map_err(|e| format!("Failed to close file: {}", e))?;
            Ok(())
        }
    })
    .await;

    match &result {
        Ok(_) => {
            let _ = app_handle.emit("sftp-upload-progress", SftpUploadProgress {
                session_id: session_id_str,
                file_name,
                bytes_sent: total_bytes,
                total_bytes,
                file_index,
                total_files,
                done: true,
                error: None,
            });
        }
        Err(e) => {
            let _ = app_handle.emit("sftp-upload-progress", SftpUploadProgress {
                session_id: session_id_str,
                file_name,
                bytes_sent: 0,
                total_bytes,
                file_index,
                total_files,
                done: true,
                error: Some(e.clone()),
            });
        }
    }

    result
}
