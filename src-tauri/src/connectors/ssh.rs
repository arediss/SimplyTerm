//! SSH connector

use async_trait::async_trait;
use parking_lot::Mutex as SyncMutex;
use russh::client::{self, Config, Handle, Handler};
use russh::keys::key::PublicKey;
use russh::ChannelMsg;
use std::sync::Arc;
use std::sync::mpsc as std_mpsc;
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

/// Handler for checking host key only (no full connection)
struct KeyCheckHandler {
    host: String,
    port: u16,
    result: Arc<SyncMutex<Option<HostKeyCheckResult>>>,
}

#[async_trait]
impl Handler for KeyCheckHandler {
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
                // Store the key for later acceptance
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
                // Store the key for later acceptance (if user chooses to update)
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

        *self.result.lock() = Some(result.clone());

        // Always return true to allow the connection to proceed for key checking
        // We'll disconnect right after
        Ok(true)
    }
}

/// Check host key before establishing a full connection
pub async fn check_host_key_only(host: &str, port: u16) -> HostKeyCheckResult {
    let result = Arc::new(SyncMutex::new(None));
    let handler = KeyCheckHandler {
        host: host.to_string(),
        port,
        result: result.clone(),
    };

    let ssh_config = Config::default();
    let addr = format!("{}:{}", host, port);

    // Try to connect just to get the host key
    match client::connect(Arc::new(ssh_config), &addr, handler).await {
        Ok(_session) => {
            // Connection succeeded (at least TCP + key exchange)
            // The handler should have stored the result
            if let Some(r) = result.lock().take() {
                r
            } else {
                HostKeyCheckResult {
                    status: "error".to_string(),
                    host: host.to_string(),
                    port,
                    key_type: None,
                    fingerprint: None,
                    expected_fingerprint: None,
                    message: Some("Failed to retrieve host key".to_string()),
                }
            }
        }
        Err(e) => {
            // Check if we got the result before the error
            if let Some(r) = result.lock().take() {
                r
            } else {
                HostKeyCheckResult {
                    status: "error".to_string(),
                    host: host.to_string(),
                    port,
                    key_type: None,
                    fingerprint: None,
                    expected_fingerprint: None,
                    message: Some(format!("Connection failed: {}", e)),
                }
            }
        }
    }
}

/// SSH handler - trusts known hosts only
struct SshHandler {
    host: String,
    port: u16,
}

#[async_trait]
impl Handler for SshHandler {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        server_public_key: &PublicKey,
    ) -> Result<bool, Self::Error> {
        match verify_host_key(&self.host, self.port, server_public_key) {
            HostKeyVerification::Trusted => Ok(true),
            HostKeyVerification::UnknownHost { .. } => {
                // Host key should have been pre-approved via check_host_key
                Err(russh::Error::UnknownKey)
            }
            HostKeyVerification::KeyMismatch { .. } => {
                // Key mismatch - potential MITM attack!
                Err(russh::Error::UnknownKey)
            }
            HostKeyVerification::Error(e) => {
                eprintln!("Host key verification error: {}", e);
                Err(russh::Error::UnknownKey)
            }
        }
    }
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

/// Connecte une session SSH (avec support jump host optionnel)
pub async fn connect_ssh(
    config: SshConfig,
    session_id: String,
    output_tx: std_mpsc::Sender<OutputMessage>,
    on_exit: impl FnOnce() + Send + 'static,
) -> Result<SshSession, String> {
    let ssh_config = Arc::new(Config::default());

    let _jump_session: Option<Handle<SshHandler>>;

    let mut session = if let Some(ref jump) = config.jump_host {
        // Connect via jump host
        let jump_handler = SshHandler {
            host: jump.host.clone(),
            port: jump.port,
        };
        let jump_addr = format!("{}:{}", jump.host, jump.port);

        let mut jump_sess = client::connect(ssh_config.clone(), &jump_addr, jump_handler)
            .await
            .map_err(|e| format!("Jump host connection failed: {}", e))?;

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
        };

        let dest_session = client::connect_stream(ssh_config.clone(), stream, dest_handler)
            .await
            .map_err(|e| format!("Destination connection through jump host failed: {}", e))?;

        _jump_session = Some(jump_sess);

        dest_session
    } else {
        // Direct connection
        let handler = SshHandler {
            host: config.host.clone(),
            port: config.port,
        };
        let addr = format!("{}:{}", config.host, config.port);

        _jump_session = None;

        client::connect(ssh_config, &addr, handler)
            .await
            .map_err(|e| format!("Connection failed: {}", e))?
    };

    // Authentification sur le serveur destination
    authenticate_session(&mut session, &config.username, &config.auth).await?;

    // Ouvrir un channel et demander un PTY
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

    // Channel pour les commandes (tokio car utilisé dans tokio::spawn)
    let (cmd_tx, mut cmd_rx) = tokio_mpsc::unbounded_channel::<SshCommand>();

    // Task principale SSH
    tokio::spawn(async move {
        let _session = session; // Garde la session en vie
        let _jump = _jump_session; // Garde la session jump host en vie (si utilisée)

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
                            // Close the channel gracefully
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
