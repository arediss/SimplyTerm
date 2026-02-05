//! SSH command execution (background, without PTY)
//!
//! Used for running quick commands like system stats without
//! polluting the visible terminal.
//!
//! SECURITY: Host key verification is enforced. Only hosts that have been
//! previously trusted (via the main SSH connection flow) will be accepted.

use russh::client::{self, Config, Handler};
use russh::keys::key::PublicKey;
use russh::ChannelMsg;
use std::sync::Arc;
use async_trait::async_trait;

use super::{SshAuth, SshConfig};
use super::known_hosts::{verify_host_key, HostKeyVerification};

/// Handler for exec connections with host key verification
struct ExecHandler {
    host: String,
    port: u16,
}

#[async_trait]
impl Handler for ExecHandler {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        server_public_key: &PublicKey,
    ) -> Result<bool, Self::Error> {
        // SECURITY: Only accept hosts that have been previously trusted
        match verify_host_key(&self.host, self.port, server_public_key) {
            HostKeyVerification::Trusted => Ok(true),
            HostKeyVerification::UnknownHost { .. } => {
                // Host not in known_hosts - reject
                // User must first connect via the main SSH flow to trust the host
                Ok(false)
            }
            HostKeyVerification::KeyMismatch { .. } => {
                // Key has changed - reject for security
                Ok(false)
            }
            HostKeyVerification::Error(_) => {
                // Error checking - reject
                Ok(false)
            }
        }
    }
}

/// Execute a command on an SSH server and return the output
///
/// SECURITY: This function only works with hosts that have been previously
/// trusted via the main SSH connection flow. Unknown or mismatched host keys
/// will cause the connection to fail.
pub async fn ssh_exec(config: &SshConfig, command: &str) -> Result<String, String> {
    let ssh_config = Config::default();
    let handler = ExecHandler {
        host: config.host.clone(),
        port: config.port,
    };

    let addr = format!("{}:{}", config.host, config.port);

    // Connect
    let mut session = client::connect(Arc::new(ssh_config), &addr, handler)
        .await
        .map_err(|e| format!("Connection failed: {}", e))?;

    // Authenticate
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

    // Open exec channel (not PTY)
    let mut channel = session
        .channel_open_session()
        .await
        .map_err(|e| format!("Failed to open channel: {}", e))?;

    // Execute command
    channel
        .exec(true, command)
        .await
        .map_err(|e| format!("Failed to exec: {}", e))?;

    // Collect output
    let mut output = Vec::new();

    loop {
        match channel.wait().await {
            Some(ChannelMsg::Data { data }) => {
                output.extend_from_slice(&data);
            }
            Some(ChannelMsg::ExtendedData { data, .. }) => {
                output.extend_from_slice(&data);
            }
            Some(ChannelMsg::Eof) | Some(ChannelMsg::Close) | None => {
                break;
            }
            _ => {}
        }
    }

    String::from_utf8(output).map_err(|e| format!("Invalid UTF-8: {}", e))
}

/// Server statistics exposed to plugins
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, Default)]
pub struct ServerStats {
    pub cpu_percent: f32,
    pub memory_percent: f32,
    pub memory_used_mb: f32,
    pub memory_total_mb: f32,
    pub disk_percent: f32,
    pub load_avg: String,
    pub uptime: String,
    pub net_rx_bytes: u64,
    pub net_tx_bytes: u64,
}

/// Fetch server stats via SSH (used by ssh-monitor plugin)
pub async fn get_server_stats(config: &SshConfig) -> Result<ServerStats, String> {
    // Combined command to get all stats at once
    // CPU uses vmstat with a 1-second sample for accurate real-time usage
    // (top -bn1 only gives since-boot averages which are near 0%)
    let command = r#"
        CPU_VAL=$(vmstat 1 2 2>/dev/null | tail -1 | awk '{print 100-$15}')
        echo "CPU:${CPU_VAL:-0}"
        echo "MEM_USED:$(free -m 2>/dev/null | awk 'NR==2{print $3}' || echo '0')"
        echo "MEM_TOTAL:$(free -m 2>/dev/null | awk 'NR==2{print $2}' || echo '1')"
        echo "DISK:$(df -h / 2>/dev/null | awk 'NR==2{print $5}' | tr -d '%' || echo '0')"
        echo "LOAD:$(cat /proc/loadavg 2>/dev/null | awk '{print $1, $2, $3}' || echo '0')"
        echo "UPTIME:$(uptime -p 2>/dev/null || uptime | sed 's/.*up //' | sed 's/,.*//' || echo 'unknown')"
        echo "NET_RX:$(cat /sys/class/net/$(ip route 2>/dev/null | grep default | awk '{print $5}' | head -1)/statistics/rx_bytes 2>/dev/null || echo '0')"
        echo "NET_TX:$(cat /sys/class/net/$(ip route 2>/dev/null | grep default | awk '{print $5}' | head -1)/statistics/tx_bytes 2>/dev/null || echo '0')"
    "#;

    let output = ssh_exec(config, command).await?;

    let mut stats = ServerStats::default();

    for line in output.lines() {
        let line = line.trim();
        if let Some(val) = line.strip_prefix("CPU:") {
            stats.cpu_percent = val.trim().parse().unwrap_or(0.0);
        } else if let Some(val) = line.strip_prefix("MEM_USED:") {
            stats.memory_used_mb = val.trim().parse().unwrap_or(0.0);
        } else if let Some(val) = line.strip_prefix("MEM_TOTAL:") {
            stats.memory_total_mb = val.trim().parse().unwrap_or(1.0);
        } else if let Some(val) = line.strip_prefix("DISK:") {
            stats.disk_percent = val.trim().parse().unwrap_or(0.0);
        } else if let Some(val) = line.strip_prefix("LOAD:") {
            stats.load_avg = val.trim().to_string();
        } else if let Some(val) = line.strip_prefix("UPTIME:") {
            stats.uptime = val.trim().to_string();
        } else if let Some(val) = line.strip_prefix("NET_RX:") {
            stats.net_rx_bytes = val.trim().parse().unwrap_or(0);
        } else if let Some(val) = line.strip_prefix("NET_TX:") {
            stats.net_tx_bytes = val.trim().parse().unwrap_or(0);
        }
    }

    // Calculate memory percent
    if stats.memory_total_mb > 0.0 {
        stats.memory_percent = (stats.memory_used_mb / stats.memory_total_mb) * 100.0;
    }

    Ok(stats)
}
