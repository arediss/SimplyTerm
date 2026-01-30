//! Local Port Forwarding (-L)
//!
//! Forwards a local port to a remote host through the SSH connection.
//! local_port -> [SSH Tunnel] -> remote_host:remote_port

use russh::client::Handle;
use russh::ChannelMsg;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::oneshot;

use super::manager::{TunnelHandle, TunnelInfo, TunnelManager, TunnelStatus, TunnelType};
use crate::connectors::{SshAuth, SshConfig};

/// Create a new SSH session for the tunnel (separate from the terminal session)
async fn create_ssh_session(config: &SshConfig) -> Result<Handle<TunnelHandler>, String> {
    use russh::client::{self, Config};
    
    let ssh_config = Config::default();
    let handler = TunnelHandler;
    
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

/// SSH handler for tunnel connections
struct TunnelHandler;

#[async_trait::async_trait]
impl russh::client::Handler for TunnelHandler {
    type Error = russh::Error;
    
    async fn check_server_key(
        &mut self,
        _server_public_key: &russh::keys::key::PublicKey,
    ) -> Result<bool, Self::Error> {
        // TODO: Proper host key verification
        Ok(true)
    }
}

/// Start local port forwarding
///
/// Binds to local_port and forwards all connections to remote_host:remote_port
/// through the SSH session.
pub async fn start_local_forward(
    tunnel_manager: Arc<TunnelManager>,
    ssh_config: &SshConfig,
    session_id: String,
    local_port: u16,
    remote_host: String,
    remote_port: u16,
) -> Result<String, String> {
    // Check if port is already in use
    if tunnel_manager.is_local_port_in_use(local_port) {
        return Err(format!("Local port {} is already in use by another tunnel", local_port));
    }
    
    // Generate tunnel ID
    let tunnel_id = TunnelManager::generate_id();
    
    // Create stop channel
    let (stop_tx, stop_rx) = oneshot::channel();
    
    // Create tunnel info
    let info = TunnelInfo {
        id: tunnel_id.clone(),
        session_id: session_id.clone(),
        tunnel_type: TunnelType::Local,
        local_port,
        remote_host: Some(remote_host.clone()),
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
    
    // Bind to local port
    let listener = TcpListener::bind(format!("127.0.0.1:{}", local_port))
        .await
        .map_err(|e| {
            tunnel_manager.update_status(&tunnel_id, TunnelStatus::Error(e.to_string()));
            format!("Failed to bind to port {}: {}", local_port, e)
        })?;
    
    // Clone config for the async task
    let config = ssh_config.clone();
    let tunnel_id_clone = tunnel_id.clone();
    let manager_clone = tunnel_manager.clone();
    
    // Spawn the main tunnel task
    tokio::spawn(async move {
        // Mark as active
        manager_clone.update_status(&tunnel_id_clone, TunnelStatus::Active);
        
        // Create shared stop signal for child tasks
        let stop_signal = Arc::new(tokio::sync::Notify::new());
        let mut stop_rx = stop_rx;
        
        loop {
            tokio::select! {
                // Accept new connections
                result = listener.accept() => {
                    match result {
                        Ok((stream, peer_addr)) => {
                            let config = config.clone();
                            let remote_host = remote_host.clone();
                            let bytes_sent = bytes_sent.clone();
                            let bytes_received = bytes_received.clone();
                            let stop_signal = stop_signal.clone();
                            
                            // Spawn a task to handle this connection
                            tokio::spawn(async move {
                                if let Err(e) = handle_local_forward_connection(
                                    &config,
                                    stream,
                                    peer_addr.to_string(),
                                    peer_addr.port(),
                                    &remote_host,
                                    remote_port,
                                    bytes_sent,
                                    bytes_received,
                                    stop_signal,
                                ).await {
                                    eprintln!("Local forward connection error: {}", e);
                                }
                            });
                        }
                        Err(e) => {
                            eprintln!("Accept error: {}", e);
                        }
                    }
                }
                // Stop signal
                _ = &mut stop_rx => {
                    // Signal all child tasks to stop
                    stop_signal.notify_waiters();
                    break;
                }
            }
        }
        
        manager_clone.update_status(&tunnel_id_clone, TunnelStatus::Stopped);
    });
    
    Ok(tunnel_id)
}

/// Handle a single forwarded connection
async fn handle_local_forward_connection(
    config: &SshConfig,
    mut local_stream: TcpStream,
    originator_ip: String,
    originator_port: u16,
    remote_host: &str,
    remote_port: u16,
    bytes_sent: Arc<AtomicU64>,
    bytes_received: Arc<AtomicU64>,
    stop_signal: Arc<tokio::sync::Notify>,
) -> Result<(), String> {
    // Create a new SSH session for this connection
    let session = create_ssh_session(config).await?;
    
    // Open direct-tcpip channel to remote destination
    let mut channel = session
        .channel_open_direct_tcpip(
            remote_host.to_string(),
            remote_port.into(),
            originator_ip,
            originator_port.into(),
        )
        .await
        .map_err(|e| format!("Failed to open direct-tcpip channel: {}", e))?;
    
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
