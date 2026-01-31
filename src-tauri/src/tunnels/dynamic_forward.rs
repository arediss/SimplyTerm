//! Dynamic Port Forwarding (-D) - SOCKS5 Proxy
//!
//! Creates a SOCKS5 proxy that forwards connections through the SSH tunnel.
//! [App] -> [SOCKS5 Proxy:local_port] -> [SSH Tunnel] -> [Destination]

use russh::client::{self, Config, Handle};
use russh::keys::key::PublicKey;
use russh::ChannelMsg;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::oneshot;

use super::manager::{TunnelHandle, TunnelInfo, TunnelManager, TunnelStatus, TunnelType};
use crate::connectors::{SshAuth, SshConfig};
use crate::connectors::known_hosts::{verify_host_key, HostKeyVerification};

// SOCKS5 Protocol Constants
const SOCKS5_VERSION: u8 = 0x05;
const SOCKS5_AUTH_NONE: u8 = 0x00;
const SOCKS5_CMD_CONNECT: u8 = 0x01;
const SOCKS5_ADDR_IPV4: u8 = 0x01;
const SOCKS5_ADDR_DOMAIN: u8 = 0x03;
const SOCKS5_ADDR_IPV6: u8 = 0x04;
const SOCKS5_REPLY_SUCCESS: u8 = 0x00;
const SOCKS5_REPLY_GENERAL_FAILURE: u8 = 0x01;
const SOCKS5_REPLY_CONNECTION_REFUSED: u8 = 0x05;
const SOCKS5_REPLY_CMD_NOT_SUPPORTED: u8 = 0x07;
const SOCKS5_REPLY_ADDR_NOT_SUPPORTED: u8 = 0x08;

/// SSH handler for SOCKS5 proxy connections
struct Socks5Handler {
    host: String,
    port: u16,
}

#[async_trait::async_trait]
impl client::Handler for Socks5Handler {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        server_public_key: &PublicKey,
    ) -> Result<bool, Self::Error> {
        match verify_host_key(&self.host, self.port, server_public_key) {
            HostKeyVerification::Trusted => Ok(true),
            HostKeyVerification::UnknownHost { .. } => Err(russh::Error::UnknownKey),
            HostKeyVerification::KeyMismatch { .. } => Err(russh::Error::UnknownKey),
            HostKeyVerification::Error(_) => Err(russh::Error::UnknownKey),
        }
    }
}

/// Create a new SSH session for SOCKS5 proxy
async fn create_ssh_session(config: &SshConfig) -> Result<Handle<Socks5Handler>, String> {
    let ssh_config = Config::default();
    let handler = Socks5Handler {
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

/// Start dynamic (SOCKS5) port forwarding
///
/// Creates a SOCKS5 proxy server on local_port that forwards all connections
/// through the SSH tunnel to their destinations.
pub async fn start_dynamic_forward(
    tunnel_manager: Arc<TunnelManager>,
    ssh_config: &SshConfig,
    session_id: String,
    local_port: u16,
) -> Result<String, String> {
    // Check if port is already in use
    if tunnel_manager.is_local_port_in_use(local_port) {
        return Err(format!(
            "Local port {} is already in use by another tunnel",
            local_port
        ));
    }

    // Generate tunnel ID
    let tunnel_id = TunnelManager::generate_id();

    // Create stop channel
    let (stop_tx, stop_rx) = oneshot::channel();

    // Create tunnel info
    let info = TunnelInfo {
        id: tunnel_id.clone(),
        session_id: session_id.clone(),
        tunnel_type: TunnelType::Dynamic,
        local_port,
        remote_host: None,
        remote_port: None,
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
                            let bytes_sent = bytes_sent.clone();
                            let bytes_received = bytes_received.clone();
                            let stop_signal = stop_signal.clone();

                            // Spawn a task to handle this SOCKS5 connection
                            tokio::spawn(async move {
                                if let Err(e) = handle_socks5_connection(
                                    &config,
                                    stream,
                                    peer_addr.to_string(),
                                    peer_addr.port(),
                                    bytes_sent,
                                    bytes_received,
                                    stop_signal,
                                ).await {
                                    eprintln!("SOCKS5 connection error: {}", e);
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

/// Handle a single SOCKS5 connection
async fn handle_socks5_connection(
    config: &SshConfig,
    mut stream: TcpStream,
    originator_ip: String,
    originator_port: u16,
    bytes_sent: Arc<AtomicU64>,
    bytes_received: Arc<AtomicU64>,
    stop_signal: Arc<tokio::sync::Notify>,
) -> Result<(), String> {
    // SOCKS5 handshake - read version and auth methods
    let mut buf = [0u8; 2];
    stream
        .read_exact(&mut buf)
        .await
        .map_err(|e| format!("Failed to read SOCKS5 greeting: {}", e))?;

    if buf[0] != SOCKS5_VERSION {
        return Err("Invalid SOCKS version".to_string());
    }

    let nmethods = buf[1] as usize;
    let mut methods = vec![0u8; nmethods];
    stream
        .read_exact(&mut methods)
        .await
        .map_err(|e| format!("Failed to read auth methods: {}", e))?;

    // We only support no authentication
    if !methods.contains(&SOCKS5_AUTH_NONE) {
        // Send auth failure
        stream
            .write_all(&[SOCKS5_VERSION, 0xFF])
            .await
            .map_err(|e| format!("Failed to send auth failure: {}", e))?;
        return Err("No supported auth method".to_string());
    }

    // Send auth response (no auth required)
    stream
        .write_all(&[SOCKS5_VERSION, SOCKS5_AUTH_NONE])
        .await
        .map_err(|e| format!("Failed to send auth response: {}", e))?;

    // Read connection request
    let mut header = [0u8; 4];
    stream
        .read_exact(&mut header)
        .await
        .map_err(|e| format!("Failed to read request header: {}", e))?;

    if header[0] != SOCKS5_VERSION {
        return Err("Invalid SOCKS version in request".to_string());
    }

    let cmd = header[1];
    let addr_type = header[3];

    // We only support CONNECT command
    if cmd != SOCKS5_CMD_CONNECT {
        send_socks5_reply(&mut stream, SOCKS5_REPLY_CMD_NOT_SUPPORTED).await?;
        return Err(format!("Unsupported SOCKS5 command: {}", cmd));
    }

    // Parse destination address
    let (dest_host, dest_port) = match addr_type {
        SOCKS5_ADDR_IPV4 => {
            let mut addr = [0u8; 4];
            stream
                .read_exact(&mut addr)
                .await
                .map_err(|e| format!("Failed to read IPv4 address: {}", e))?;
            let host = format!("{}.{}.{}.{}", addr[0], addr[1], addr[2], addr[3]);
            let mut port_bytes = [0u8; 2];
            stream
                .read_exact(&mut port_bytes)
                .await
                .map_err(|e| format!("Failed to read port: {}", e))?;
            let port = u16::from_be_bytes(port_bytes);
            (host, port)
        }
        SOCKS5_ADDR_DOMAIN => {
            let mut len = [0u8; 1];
            stream
                .read_exact(&mut len)
                .await
                .map_err(|e| format!("Failed to read domain length: {}", e))?;
            let mut domain = vec![0u8; len[0] as usize];
            stream
                .read_exact(&mut domain)
                .await
                .map_err(|e| format!("Failed to read domain: {}", e))?;
            let host = String::from_utf8(domain)
                .map_err(|e| format!("Invalid domain name: {}", e))?;
            let mut port_bytes = [0u8; 2];
            stream
                .read_exact(&mut port_bytes)
                .await
                .map_err(|e| format!("Failed to read port: {}", e))?;
            let port = u16::from_be_bytes(port_bytes);
            (host, port)
        }
        SOCKS5_ADDR_IPV6 => {
            let mut addr = [0u8; 16];
            stream
                .read_exact(&mut addr)
                .await
                .map_err(|e| format!("Failed to read IPv6 address: {}", e))?;
            let segments: Vec<String> = addr
                .chunks(2)
                .map(|c| format!("{:02x}{:02x}", c[0], c[1]))
                .collect();
            let host = segments.join(":");
            let mut port_bytes = [0u8; 2];
            stream
                .read_exact(&mut port_bytes)
                .await
                .map_err(|e| format!("Failed to read port: {}", e))?;
            let port = u16::from_be_bytes(port_bytes);
            (host, port)
        }
        _ => {
            send_socks5_reply(&mut stream, SOCKS5_REPLY_ADDR_NOT_SUPPORTED).await?;
            return Err(format!("Unsupported address type: {}", addr_type));
        }
    };

    // Create SSH session and open direct-tcpip channel
    let session = match create_ssh_session(config).await {
        Ok(s) => s,
        Err(e) => {
            send_socks5_reply(&mut stream, SOCKS5_REPLY_GENERAL_FAILURE).await?;
            return Err(e);
        }
    };

    let channel_result = session
        .channel_open_direct_tcpip(
            dest_host.clone(),
            dest_port.into(),
            originator_ip,
            originator_port.into(),
        )
        .await;

    let mut channel = match channel_result {
        Ok(c) => c,
        Err(e) => {
            send_socks5_reply(&mut stream, SOCKS5_REPLY_CONNECTION_REFUSED).await?;
            return Err(format!("Failed to open channel to {}:{}: {}", dest_host, dest_port, e));
        }
    };

    // Send success reply
    send_socks5_reply(&mut stream, SOCKS5_REPLY_SUCCESS).await?;

    // Now proxy data between the SOCKS client and the SSH channel
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

            // Read from SOCKS client
            result = stream.read(&mut buf), if !stream_closed => {
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
                        if stream.write_all(data).await.is_err() {
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

/// Send a SOCKS5 reply to the client
async fn send_socks5_reply(stream: &mut TcpStream, status: u8) -> Result<(), String> {
    // Reply format: VER | REP | RSV | ATYP | BND.ADDR | BND.PORT
    // We bind to 0.0.0.0:0 since we don't have a real bound address
    let reply = [
        SOCKS5_VERSION,
        status,
        0x00,            // Reserved
        SOCKS5_ADDR_IPV4,
        0, 0, 0, 0,      // Bind address (0.0.0.0)
        0, 0,            // Bind port (0)
    ];
    stream
        .write_all(&reply)
        .await
        .map_err(|e| format!("Failed to send SOCKS5 reply: {}", e))
}
