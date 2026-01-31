//! Remote Port Forwarding (-R)
//!
//! Exposes a local service on a port on the remote SSH server.
//! [Remote server:remote_port] -> [SSH Tunnel] -> [Local:local_port]

use russh::client::{self, Config, Handle, Msg};
use russh::keys::key::PublicKey;
use russh::{Channel, ChannelMsg};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::sync::{mpsc, oneshot, Mutex};

use super::manager::{TunnelHandle, TunnelInfo, TunnelManager, TunnelStatus, TunnelType};
use crate::connectors::{SshAuth, SshConfig};
use crate::connectors::known_hosts::{verify_host_key, HostKeyVerification};

/// Message to handle incoming forwarded connections
struct ForwardedConnection {
    channel: Channel<Msg>,
    originator_address: String,
    originator_port: u32,
}

/// SSH handler for remote forwarding that receives forwarded-tcpip channels
struct RemoteForwardHandler {
    /// Channel to send incoming forwarded connections
    forward_tx: mpsc::UnboundedSender<ForwardedConnection>,
    host: String,
    port: u16,
}

#[async_trait::async_trait]
impl client::Handler for RemoteForwardHandler {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        server_public_key: &PublicKey,
    ) -> Result<bool, Self::Error> {
        match verify_host_key(&self.host, self.port, server_public_key) {
            HostKeyVerification::Trusted | HostKeyVerification::TrustedNewHost => Ok(true),
            HostKeyVerification::KeyMismatch { .. } => Err(russh::Error::UnknownKey),
            HostKeyVerification::Error(_) => Err(russh::Error::UnknownKey),
        }
    }

    /// Called when the server opens a forwarded-tcpip channel (incoming remote connection)
    async fn server_channel_open_forwarded_tcpip(
        &mut self,
        channel: Channel<Msg>,
        _connected_address: &str,
        _connected_port: u32,
        originator_address: &str,
        originator_port: u32,
        _session: &mut client::Session,
    ) -> Result<(), Self::Error> {
        let conn = ForwardedConnection {
            channel,
            originator_address: originator_address.to_string(),
            originator_port,
        };
        let _ = self.forward_tx.send(conn);
        Ok(())
    }
}

/// Create a new SSH session for remote forwarding
async fn create_ssh_session_for_remote(
    config: &SshConfig,
    forward_tx: mpsc::UnboundedSender<ForwardedConnection>,
) -> Result<Handle<RemoteForwardHandler>, String> {
    let ssh_config = Config::default();
    let handler = RemoteForwardHandler { 
        forward_tx,
        host: config.host.clone(),
        port: config.port,
    };

    let addr = format!("{}:{}", config.host, config.port);

    let mut session = client::connect(Arc::new(ssh_config), &addr, handler)
        .await
        .map_err(|e| format!("SSH connection failed: {}", e))?;

    // Authenticate
    let authenticated = match &config.auth {
        SshAuth::Password(password) => session
            .authenticate_password(&config.username, password)
            .await
            .map_err(|e| format!("Password auth failed: {}", e))?,
        SshAuth::KeyFile { path, passphrase } => {
            let key = russh_keys::load_secret_key(path, passphrase.as_deref())
                .map_err(|e| format!("Failed to load key: {}", e))?;
            session
                .authenticate_publickey(&config.username, Arc::new(key))
                .await
                .map_err(|e| format!("Key auth failed: {}", e))?
        }
    };

    if !authenticated {
        return Err("SSH authentication failed".to_string());
    }

    Ok(session)
}

/// Start remote port forwarding
///
/// Requests the SSH server to listen on remote_port and forward all connections
/// to local_host:local_port through the SSH tunnel.
pub async fn start_remote_forward(
    tunnel_manager: Arc<TunnelManager>,
    ssh_config: &SshConfig,
    session_id: String,
    remote_port: u16,
    local_host: String,
    local_port: u16,
) -> Result<String, String> {
    // Generate tunnel ID
    let tunnel_id = TunnelManager::generate_id();

    // Create stop channel
    let (stop_tx, mut stop_rx) = oneshot::channel();

    // Create tunnel info
    let info = TunnelInfo {
        id: tunnel_id.clone(),
        session_id: session_id.clone(),
        tunnel_type: TunnelType::Remote,
        local_port,
        remote_host: Some(local_host.clone()),
        remote_port: Some(remote_port),
        status: TunnelStatus::Starting,
        bytes_sent: 0,
        bytes_received: 0,
    };

    // Create and register tunnel handle
    let handle = TunnelHandle::new(info, stop_tx);
    let bytes_sent = handle.bytes_sent_counter();
    let bytes_received = handle.bytes_received_counter();
    tunnel_manager.register(handle);

    // Create channel for forwarded connections
    let (forward_tx, mut forward_rx) = mpsc::unbounded_channel::<ForwardedConnection>();

    // Clone config for the async task
    let config = ssh_config.clone();
    let tunnel_id_clone = tunnel_id.clone();
    let manager_clone = tunnel_manager.clone();

    // Spawn the main tunnel task
    tokio::spawn(async move {
        // Create SSH session with our custom handler
        let mut session = match create_ssh_session_for_remote(&config, forward_tx).await {
            Ok(s) => s,
            Err(e) => {
                manager_clone.update_status(&tunnel_id_clone, TunnelStatus::Error(e));
                return;
            }
        };

        // Request remote port forwarding
        // Listen on all interfaces on the remote server
        if let Err(e) = session.tcpip_forward("0.0.0.0", remote_port.into()).await {
            manager_clone.update_status(
                &tunnel_id_clone,
                TunnelStatus::Error(format!("Failed to request port forwarding: {}", e)),
            );
            return;
        }

        // Mark as active
        manager_clone.update_status(&tunnel_id_clone, TunnelStatus::Active);

        // Keep session alive and handle incoming connections
        let session = Arc::new(Mutex::new(session));
        let stop_signal = Arc::new(tokio::sync::Notify::new());

        loop {
            tokio::select! {
                // Handle incoming forwarded connection
                Some(conn) = forward_rx.recv() => {
                    let local_host = local_host.clone();
                    let bytes_sent = bytes_sent.clone();
                    let bytes_received = bytes_received.clone();
                    let stop_signal = stop_signal.clone();

                    tokio::spawn(async move {
                        if let Err(e) = handle_remote_forward_connection(
                            conn.channel,
                            &local_host,
                            local_port,
                            bytes_sent,
                            bytes_received,
                            stop_signal,
                        ).await {
                            eprintln!("Remote forward connection error: {}", e);
                        }
                    });
                }

                // Stop signal
                _ = &mut stop_rx => {
                    // Cancel the port forwarding
                    let session = session.lock().await;
                    let _ = session.cancel_tcpip_forward("0.0.0.0", remote_port.into()).await;
                    stop_signal.notify_waiters();
                    break;
                }
            }
        }

        manager_clone.update_status(&tunnel_id_clone, TunnelStatus::Stopped);
    });

    Ok(tunnel_id)
}

/// Handle a single forwarded connection from the remote server
async fn handle_remote_forward_connection(
    mut channel: Channel<Msg>,
    local_host: &str,
    local_port: u16,
    bytes_sent: Arc<AtomicU64>,
    bytes_received: Arc<AtomicU64>,
    stop_signal: Arc<tokio::sync::Notify>,
) -> Result<(), String> {
    // Connect to the local service
    let addr = format!("{}:{}", local_host, local_port);
    let mut local_stream = TcpStream::connect(&addr)
        .await
        .map_err(|e| format!("Failed to connect to local service {}: {}", addr, e))?;

    let mut stream_closed = false;
    let mut channel_closed = false;
    let mut buf = vec![0u8; 65536];

    loop {
        tokio::select! {
            // Check for stop signal
            _ = stop_signal.notified() => {
                let _ = channel.eof().await;
                break;
            }

            // Read from local socket
            result = local_stream.read(&mut buf), if !stream_closed => {
                match result {
                    Ok(0) => {
                        stream_closed = true;
                        let _ = channel.eof().await;
                        if channel_closed {
                            break;
                        }
                    }
                    Ok(n) => {
                        bytes_sent.fetch_add(n as u64, Ordering::Relaxed);
                        if channel.data(&buf[..n]).await.is_err() {
                            break;
                        }
                    }
                    Err(_) => break,
                }
            }

            // Read from SSH channel
            msg = channel.wait(), if !channel_closed => {
                match msg {
                    Some(ChannelMsg::Data { ref data }) => {
                        bytes_received.fetch_add(data.len() as u64, Ordering::Relaxed);
                        if local_stream.write_all(data).await.is_err() {
                            break;
                        }
                    }
                    Some(ChannelMsg::Eof) => {
                        channel_closed = true;
                        if stream_closed {
                            break;
                        }
                    }
                    Some(ChannelMsg::Close) | None => {
                        break;
                    }
                    _ => {}
                }
            }
        }
    }

    Ok(())
}
