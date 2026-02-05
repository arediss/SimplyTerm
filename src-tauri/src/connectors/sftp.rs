//! SFTP operations for SSH sessions
//!
//! Provides file browser functionality over SFTP

use russh::client::{self, Config, Handler};
use russh::keys::key::PublicKey;
use russh_sftp::client::SftpSession;
use std::sync::Arc;
use async_trait::async_trait;

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
pub async fn sftp_list_dir(config: &SshConfig, path: &str) -> Result<Vec<FileEntry>, String> {
    let ssh_config = Config::default();
    let handler = SftpHandler;

    let addr = format!("{}:{}", config.host, config.port);

    // Connect
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

    // List directory
    let entries = sftp
        .read_dir(path)
        .await
        .map_err(|e| format!("Failed to read directory: {}", e))?;

    let mut result = Vec::new();
    for entry in entries {
        let name = entry.file_name();
        // Skip . and ..
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

        let attrs = entry.metadata();
        let is_dir = attrs.is_dir();
        let size = attrs.size.unwrap_or(0);
        let modified = attrs.mtime.map(|t| t as u64);

        // Convert permissions to string like "rwxr-xr-x"
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

    // Sort: directories first, then alphabetically
    result.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    Ok(result)
}

/// Read file contents via SFTP
pub async fn sftp_read_file(config: &SshConfig, path: &str) -> Result<Vec<u8>, String> {
    let ssh_config = Config::default();
    let handler = SftpHandler;

    let addr = format!("{}:{}", config.host, config.port);

    let mut session = client::connect(Arc::new(ssh_config), &addr, handler)
        .await
        .map_err(|e| format!("SFTP connection failed: {}", e))?;

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

    // Read file
    let data = sftp
        .read(path)
        .await
        .map_err(|e| format!("Failed to read file: {}", e))?;

    Ok(data)
}

/// Write file contents via SFTP
pub async fn sftp_write_file(config: &SshConfig, path: &str, data: Vec<u8>) -> Result<(), String> {
    let ssh_config = Config::default();
    let handler = SftpHandler;

    let addr = format!("{}:{}", config.host, config.port);

    let mut session = client::connect(Arc::new(ssh_config), &addr, handler)
        .await
        .map_err(|e| format!("SFTP connection failed: {}", e))?;

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

    // Write file
    sftp.write(path, &data)
        .await
        .map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(())
}

/// Delete a file or directory via SFTP
pub async fn sftp_delete(config: &SshConfig, path: &str, is_dir: bool) -> Result<(), String> {
    let ssh_config = Config::default();
    let handler = SftpHandler;

    let addr = format!("{}:{}", config.host, config.port);

    let mut session = client::connect(Arc::new(ssh_config), &addr, handler)
        .await
        .map_err(|e| format!("SFTP connection failed: {}", e))?;

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

    if is_dir {
        sftp.remove_dir(path)
            .await
            .map_err(|e| format!("Failed to remove directory: {}", e))?;
    } else {
        sftp.remove_file(path)
            .await
            .map_err(|e| format!("Failed to remove file: {}", e))?;
    }

    Ok(())
}

/// Rename/move a file or directory via SFTP
pub async fn sftp_rename(config: &SshConfig, old_path: &str, new_path: &str) -> Result<(), String> {
    let ssh_config = Config::default();
    let handler = SftpHandler;

    let addr = format!("{}:{}", config.host, config.port);

    let mut session = client::connect(Arc::new(ssh_config), &addr, handler)
        .await
        .map_err(|e| format!("SFTP connection failed: {}", e))?;

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

    sftp.rename(old_path, new_path)
        .await
        .map_err(|e| format!("Failed to rename: {}", e))?;

    Ok(())
}

/// Create a directory via SFTP
pub async fn sftp_mkdir(config: &SshConfig, path: &str) -> Result<(), String> {
    let ssh_config = Config::default();
    let handler = SftpHandler;

    let addr = format!("{}:{}", config.host, config.port);

    let mut session = client::connect(Arc::new(ssh_config), &addr, handler)
        .await
        .map_err(|e| format!("SFTP connection failed: {}", e))?;

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

    sftp.create_dir(path)
        .await
        .map_err(|e| format!("Failed to create directory: {}", e))?;

    Ok(())
}
