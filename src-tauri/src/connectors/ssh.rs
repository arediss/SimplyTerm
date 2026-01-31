//! Connecteur SSH

use async_trait::async_trait;
use parking_lot::Mutex as SyncMutex;
use russh::client::{self, Config, Handler};
use russh::keys::key::PublicKey;
use russh::ChannelMsg;
use std::sync::Arc;
use std::sync::mpsc as std_mpsc;
use tokio::sync::mpsc as tokio_mpsc;

use crate::session::{OutputMessage, Session};
use super::known_hosts::{verify_host_key, HostKeyVerification};

/// Configuration SSH
#[derive(Debug, Clone)]
pub struct SshConfig {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth: SshAuth,
}

/// Méthode d'authentification SSH
#[derive(Debug, Clone)]
pub enum SshAuth {
    Password(String),
    KeyFile {
        path: String,
        passphrase: Option<String>,
    },
}

/// Handler SSH (gestion des événements de connexion)
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
            HostKeyVerification::TrustedNewHost => {
                // TOFU: First connection, key has been stored
                Ok(true)
            }
            HostKeyVerification::KeyMismatch { expected: _, actual: _ } => {
                // SECURITY: Key mismatch - potential MITM attack!
                // Reject the connection
                Err(russh::Error::UnknownKey)
            }
            HostKeyVerification::Error(e) => {
                eprintln!("Host key verification error: {}", e);
                // On error, reject for safety
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

/// Connecte une session SSH
pub async fn connect_ssh(
    config: SshConfig,
    session_id: String,
    output_tx: std_mpsc::Sender<OutputMessage>,
    on_exit: impl FnOnce() + Send + 'static,
) -> Result<SshSession, String> {
    let ssh_config = Config::default();
    let handler = SshHandler {
        host: config.host.clone(),
        port: config.port,
    };

    let addr = format!("{}:{}", config.host, config.port);

    let mut session = client::connect(Arc::new(ssh_config), &addr, handler)
        .await
        .map_err(|e| format!("Connection failed: {}", e))?;

    // Authentification
    let authenticated = match &config.auth {
        SshAuth::Password(password) => session
            .authenticate_password(&config.username, password)
            .await
            .map_err(|e| format!("Authentication failed: {}", e))?,
        SshAuth::KeyFile { path, passphrase } => {
            let key = russh_keys::load_secret_key(path, passphrase.as_deref())
                .map_err(|e| format!("Failed to load key: {}", e))?;
            session
                .authenticate_publickey(&config.username, Arc::new(key))
                .await
                .map_err(|e| format!("Key authentication failed: {}", e))?
        }
    };

    if !authenticated {
        return Err("Authentication failed".to_string());
    }

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
