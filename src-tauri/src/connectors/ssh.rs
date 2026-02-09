//! SSH connector

use async_trait::async_trait;
use parking_lot::Mutex as SyncMutex;
use russh::client::{self, Config, Handle, Handler};
use russh::keys::key::PublicKey;
use russh::ChannelMsg;
use std::collections::HashMap;
use std::sync::Arc;
use std::sync::mpsc as std_mpsc;
use std::time::Instant;
use tokio::sync::mpsc as tokio_mpsc;

use crate::session::{OutputMessage, Session};
use super::known_hosts::{verify_host_key, HostKeyVerification, store_pending_key};

/// Jump host (bastion) configuration
#[derive(Debug, Clone)]
pub struct JumpHostConfig {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth: SshAuth,
}

/// SSH configuration
#[derive(Debug, Clone)]
pub struct SshConfig {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth: SshAuth,
    pub jump_host: Option<JumpHostConfig>,
}

/// Load an SSH private key, handling both encrypted and unencrypted keys.
/// For unencrypted keys, russh_keys requires `None` as passphrase.
/// For encrypted keys, we need the actual passphrase.
/// This function tries both approaches to handle any key type.
pub fn load_ssh_key(path: &str, passphrase: Option<&str>) -> Result<russh_keys::key::KeyPair, String> {
    // Normalize empty string to None
    let passphrase = passphrase.filter(|p| !p.is_empty());

    // First try without passphrase (works for unencrypted keys)
    match russh_keys::load_secret_key(path, None) {
        Ok(k) => Ok(k),
        Err(e) => {
            // If that failed and we have a passphrase, try with it
            if let Some(pass) = passphrase {
                russh_keys::load_secret_key(path, Some(pass))
                    .map_err(|e2| format!("Failed to load key: {}", e2))
            } else {
                Err(format!("Failed to load key: {}", e))
            }
        }
    }
}

/// SSH authentication method
#[derive(Debug, Clone)]
pub enum SshAuth {
    Password(String),
    KeyFile {
        path: String,
        passphrase: Option<String>,
    },
}

/// Result of host key check for frontend
#[derive(Debug, Clone, serde::Serialize)]
pub struct HostKeyCheckResult {
    pub status: String, // "trusted", "unknown", "mismatch", "error"
    pub host: String,
    pub port: u16,
    pub key_type: Option<String>,
    pub fingerprint: Option<String>,
    pub expected_fingerprint: Option<String>,
    pub message: Option<String>,
}

/// SSH handler — always accepts the connection but stores the host key verification result.
/// This allows us to reuse the same TCP connection regardless of whether the key is trusted.
/// No credentials are sent before the user confirms the key.
struct SshHandler {
    host: String,
    port: u16,
    key_check: Arc<SyncMutex<Option<HostKeyCheckResult>>>,
}

#[async_trait]
impl Handler for SshHandler {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        server_public_key: &PublicKey,
    ) -> Result<bool, Self::Error> {
        let result = match verify_host_key(&self.host, self.port, server_public_key) {
            HostKeyVerification::Trusted => HostKeyCheckResult {
                status: "trusted".to_string(),
                host: self.host.clone(),
                port: self.port,
                key_type: None,
                fingerprint: None,
                expected_fingerprint: None,
                message: None,
            },
            HostKeyVerification::UnknownHost { key_type, fingerprint } => {
                store_pending_key(&self.host, self.port, server_public_key);
                HostKeyCheckResult {
                    status: "unknown".to_string(),
                    host: self.host.clone(),
                    port: self.port,
                    key_type: Some(key_type),
                    fingerprint: Some(fingerprint),
                    expected_fingerprint: None,
                    message: None,
                }
            }
            HostKeyVerification::KeyMismatch { expected_fingerprint, actual_fingerprint } => {
                store_pending_key(&self.host, self.port, server_public_key);
                HostKeyCheckResult {
                    status: "mismatch".to_string(),
                    host: self.host.clone(),
                    port: self.port,
                    key_type: None,
                    fingerprint: Some(actual_fingerprint),
                    expected_fingerprint: Some(expected_fingerprint),
                    message: Some("WARNING: Host key has changed! This could indicate a man-in-the-middle attack.".to_string()),
                }
            }
            HostKeyVerification::Error(e) => HostKeyCheckResult {
                status: "error".to_string(),
                host: self.host.clone(),
                port: self.port,
                key_type: None,
                fingerprint: None,
                expected_fingerprint: None,
                message: Some(e),
            },
        };

        *self.key_check.lock() = Some(result);

        // Always accept to keep the TCP connection alive.
        // Authentication only happens AFTER the user confirms the key.
        Ok(true)
    }
}

// ============================================================================
// Session cache — keeps TCP connections alive while waiting for user confirmation
// ============================================================================

struct CachedSshConnection {
    session: Handle<SshHandler>,
    _jump_session: Option<Handle<SshHandler>>,
    config: SshConfig,
    created_at: Instant,
}

lazy_static::lazy_static! {
    static ref SSH_SESSION_CACHE: SyncMutex<HashMap<String, CachedSshConnection>> =
        SyncMutex::new(HashMap::new());
}

/// Maximum time a cached session can wait for user confirmation (2 minutes)
const CACHE_TTL_SECS: u64 = 120;

fn cache_session(cache_id: String, conn: CachedSshConnection) {
    let mut cache = SSH_SESSION_CACHE.lock();
    // Evict expired entries while we're at it
    cache.retain(|_, v| v.created_at.elapsed().as_secs() < CACHE_TTL_SECS);
    cache.insert(cache_id, conn);
}

fn take_cached_session(cache_id: &str) -> Option<CachedSshConnection> {
    let mut cache = SSH_SESSION_CACHE.lock();
    let conn = cache.remove(cache_id)?;
    if conn.created_at.elapsed().as_secs() >= CACHE_TTL_SECS {
        // Expired — drop it
        None
    } else {
        Some(conn)
    }
}

pub fn drop_cached_session(cache_id: &str) {
    SSH_SESSION_CACHE.lock().remove(cache_id);
}

/// Result returned by `prepare_ssh_connection`
#[derive(Debug, Clone, serde::Serialize)]
#[serde(tag = "type")]
pub enum SshConnectionResult {
    /// Key was trusted, session is fully connected (PTY ready)
    Connected,
    /// Key needs user confirmation — session is cached under `cache_id`
    HostKeyCheck {
        #[serde(flatten)]
        check: HostKeyCheckResult,
        cache_id: String,
    },
}

/// Commandes envoyées à la session SSH
#[derive(Debug)]
enum SshCommand {
    Data(Vec<u8>),
    Resize { cols: u32, rows: u32 },
    Close,
}

/// Session SSH
pub struct SshSession {
    cmd_tx: SyncMutex<tokio_mpsc::UnboundedSender<SshCommand>>,
}

impl std::fmt::Debug for SshSession {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("SshSession")
            .field("type", &"ssh")
            .finish()
    }
}

impl Session for SshSession {
    fn write(&self, data: &[u8]) -> Result<(), String> {
        self.cmd_tx
            .lock()
            .send(SshCommand::Data(data.to_vec()))
            .map_err(|e| format!("Write failed: {}", e))
    }

    fn resize(&self, cols: u32, rows: u32) -> Result<(), String> {
        self.cmd_tx
            .lock()
            .send(SshCommand::Resize { cols, rows })
            .map_err(|e| format!("Resize failed: {}", e))
    }

    fn session_type(&self) -> &'static str {
        "ssh"
    }

    fn close(&self) -> Result<(), String> {
        // Send close command to gracefully shut down the SSH session
        let _ = self.cmd_tx.lock().send(SshCommand::Close);
        Ok(())
    }
}

/// Authentifie une session SSH
async fn authenticate_session<H: Handler + Send>(
    session: &mut Handle<H>,
    username: &str,
    auth: &SshAuth,
) -> Result<(), String> {
    let authenticated = match auth {
        SshAuth::Password(password) => session
            .authenticate_password(username, password)
            .await
            .map_err(|e| format!("Authentication failed: {}", e))?,
        SshAuth::KeyFile { path, passphrase } => {
            let key = load_ssh_key(path, passphrase.as_deref())?;
            session
                .authenticate_publickey(username, Arc::new(key))
                .await
                .map_err(|e| format!("Key authentication failed: {}", e))?
        }
    };

    if !authenticated {
        return Err("Authentication failed".to_string());
    }

    Ok(())
}

/// Establish a TCP+SSH connection (handles jump hosts) without authenticating.
/// Returns the session handle, jump session handle, and the host key check result.
async fn establish_connection(
    config: &SshConfig,
) -> Result<(Handle<SshHandler>, Option<Handle<SshHandler>>, HostKeyCheckResult), String> {
    let ssh_config = Arc::new(Config::default());
    let key_check = Arc::new(SyncMutex::new(None));

    let (session, jump_session) = if let Some(ref jump) = config.jump_host {
        // Jump host connection — the jump host key is verified strictly
        let jump_key_check = Arc::new(SyncMutex::new(None));
        let jump_handler = SshHandler {
            host: jump.host.clone(),
            port: jump.port,
            key_check: jump_key_check.clone(),
        };
        let jump_addr = format!("{}:{}", jump.host, jump.port);

        let mut jump_sess = client::connect(ssh_config.clone(), &jump_addr, jump_handler)
            .await
            .map_err(|e| format!("Jump host connection failed: {}", e))?;

        // Check jump host key — must be trusted (we don't show modal for jump hosts)
        if let Some(ref check) = *jump_key_check.lock() {
            if check.status != "trusted" {
                return Err(format!("Jump host key not trusted: {}", check.status));
            }
        }

        authenticate_session(&mut jump_sess, &jump.username, &jump.auth).await
            .map_err(|e| format!("Jump host auth failed: {}", e))?;

        let channel = jump_sess
            .channel_open_direct_tcpip(&config.host, config.port as u32, "127.0.0.1", 0)
            .await
            .map_err(|e| format!("Failed to open tunnel through jump host: {}", e))?;

        let stream = channel.into_stream();

        let dest_handler = SshHandler {
            host: config.host.clone(),
            port: config.port,
            key_check: key_check.clone(),
        };

        let dest_session = client::connect_stream(ssh_config.clone(), stream, dest_handler)
            .await
            .map_err(|e| format!("Destination connection through jump host failed: {}", e))?;

        (dest_session, Some(jump_sess))
    } else {
        // Direct connection
        let handler = SshHandler {
            host: config.host.clone(),
            port: config.port,
            key_check: key_check.clone(),
        };
        let addr = format!("{}:{}", config.host, config.port);

        let sess = client::connect(ssh_config, &addr, handler)
            .await
            .map_err(|e| format!("Connection failed: {}", e))?;

        (sess, None)
    };

    let check_result = key_check.lock().take().unwrap_or_else(|| HostKeyCheckResult {
        status: "error".to_string(),
        host: config.host.clone(),
        port: config.port,
        key_type: None,
        fingerprint: None,
        expected_fingerprint: None,
        message: Some("Failed to retrieve host key".to_string()),
    });

    Ok((session, jump_session, check_result))
}

/// Authenticate an established session and set up PTY + I/O task.
async fn setup_pty_session(
    mut session: Handle<SshHandler>,
    jump_session: Option<Handle<SshHandler>>,
    config: &SshConfig,
    session_id: String,
    output_tx: std_mpsc::Sender<OutputMessage>,
    on_exit: impl FnOnce() + Send + 'static,
) -> Result<SshSession, String> {
    authenticate_session(&mut session, &config.username, &config.auth).await?;

    let mut channel = session
        .channel_open_session()
        .await
        .map_err(|e| format!("Failed to open channel: {}", e))?;

    channel
        .request_pty(false, "xterm-256color", 80, 24, 0, 0, &[])
        .await
        .map_err(|e| format!("Failed to request PTY: {}", e))?;

    channel
        .request_shell(false)
        .await
        .map_err(|e| format!("Failed to request shell: {}", e))?;

    let (cmd_tx, mut cmd_rx) = tokio_mpsc::unbounded_channel::<SshCommand>();

    tokio::spawn(async move {
        let _session = session;
        let _jump = jump_session;

        loop {
            tokio::select! {
                msg = channel.wait() => {
                    match msg {
                        Some(ChannelMsg::Data { data }) => {
                            let _ = output_tx.send(OutputMessage {
                                session_id: session_id.clone(),
                                data: data.to_vec(),
                            });
                        }
                        Some(ChannelMsg::ExtendedData { data, .. }) => {
                            let _ = output_tx.send(OutputMessage {
                                session_id: session_id.clone(),
                                data: data.to_vec(),
                            });
                        }
                        Some(ChannelMsg::Eof) | Some(ChannelMsg::Close) | None => {
                            break;
                        }
                        _ => {}
                    }
                }
                Some(cmd) = cmd_rx.recv() => {
                    match cmd {
                        SshCommand::Data(data) => {
                            if channel.data(&data[..]).await.is_err() {
                                break;
                            }
                        }
                        SshCommand::Resize { cols, rows } => {
                            let _ = channel.window_change(cols, rows, 0, 0).await;
                        }
                        SshCommand::Close => {
                            let _ = channel.eof().await;
                            let _ = channel.close().await;
                            break;
                        }
                    }
                }
            }
        }

        on_exit();
    });

    Ok(SshSession {
        cmd_tx: SyncMutex::new(cmd_tx),
    })
}

/// Connect SSH — single TCP connection. Returns immediately if host key is trusted,
/// or caches the session and returns the key check result for user confirmation.
pub async fn connect_ssh(
    config: SshConfig,
    session_id: String,
    output_tx: std_mpsc::Sender<OutputMessage>,
    on_exit: impl FnOnce() + Send + 'static,
) -> Result<(SshConnectionResult, Option<SshSession>), String> {
    let (session, jump_session, check_result) = establish_connection(&config).await?;

    if check_result.status == "trusted" {
        // Key is trusted → authenticate and set up PTY on the same connection
        let ssh_session = setup_pty_session(
            session, jump_session, &config, session_id, output_tx, on_exit,
        ).await?;
        Ok((SshConnectionResult::Connected, Some(ssh_session)))
    } else if check_result.status == "unknown" || check_result.status == "mismatch" {
        // Key needs user confirmation → cache the live connection
        let cache_id = format!("{}:{}", config.host, config.port);
        cache_session(cache_id.clone(), CachedSshConnection {
            session,
            _jump_session: jump_session,
            config,
            created_at: Instant::now(),
        });
        Ok((SshConnectionResult::HostKeyCheck { check: check_result, cache_id }, None))
    } else {
        // Error during key check
        Err(check_result.message.unwrap_or_else(|| "Host key verification failed".to_string()))
    }
}

/// Lightweight host key check — opens a temporary connection to verify the server key.
/// Used for SFTP/tunnel pre-checks (flows that don't use `create_ssh_session`).
pub async fn check_host_key_only(host: &str, port: u16) -> HostKeyCheckResult {
    let ssh_config = Arc::new(Config::default());
    let key_check = Arc::new(SyncMutex::new(None));
    let handler = SshHandler {
        host: host.to_string(),
        port,
        key_check: key_check.clone(),
    };
    let addr = format!("{}:{}", host, port);

    // Connect just to capture the key check result, then drop the session
    let _ = client::connect(ssh_config, &addr, handler).await;

    let result = key_check.lock().take().unwrap_or_else(|| HostKeyCheckResult {
        status: "error".to_string(),
        host: host.to_string(),
        port,
        key_type: None,
        fingerprint: None,
        expected_fingerprint: None,
        message: Some("Failed to retrieve host key".to_string()),
    });
    result
}

/// Finalize a cached SSH connection after the user accepted the host key.
pub async fn finalize_cached_ssh(
    cache_id: &str,
    session_id: String,
    output_tx: std_mpsc::Sender<OutputMessage>,
    on_exit: impl FnOnce() + Send + 'static,
) -> Result<SshSession, String> {
    let cached = take_cached_session(cache_id)
        .ok_or_else(|| "Cached session expired or not found. Please reconnect.".to_string())?;

    setup_pty_session(
        cached.session,
        cached._jump_session,
        &cached.config,
        session_id,
        output_tx,
        on_exit,
    ).await
}
