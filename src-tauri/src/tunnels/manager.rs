//! Tunnel Manager - Central management for SSH port forwarding

use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tokio::sync::oneshot;
use uuid::Uuid;

/// Type of SSH tunnel
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TunnelType {
    /// Local forwarding (-L): local_port -> remote_host:remote_port via SSH
    Local,
    /// Remote forwarding (-R): remote_port on SSH server -> local_host:local_port
    Remote,
    /// Dynamic forwarding (-D): SOCKS5 proxy on local_port
    Dynamic,
}

/// Status of a tunnel
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "state", content = "message")]
pub enum TunnelStatus {
    Starting,
    Active,
    Error(String),
    Stopped,
}

/// Information about a tunnel
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TunnelInfo {
    pub id: String,
    pub session_id: String,
    pub tunnel_type: TunnelType,
    pub local_port: u16,
    pub remote_host: Option<String>,
    pub remote_port: Option<u16>,
    pub status: TunnelStatus,
    pub bytes_sent: u64,
    pub bytes_received: u64,
}

/// Handle to a running tunnel
pub struct TunnelHandle {
    pub info: TunnelInfo,
    /// Signal to stop the tunnel
    stop_tx: Option<oneshot::Sender<()>>,
    /// Shared stats counters
    bytes_sent: Arc<AtomicU64>,
    bytes_received: Arc<AtomicU64>,
}

impl TunnelHandle {
    pub fn new(info: TunnelInfo, stop_tx: oneshot::Sender<()>) -> Self {
        Self {
            info,
            stop_tx: Some(stop_tx),
            bytes_sent: Arc::new(AtomicU64::new(0)),
            bytes_received: Arc::new(AtomicU64::new(0)),
        }
    }

    pub fn bytes_sent_counter(&self) -> Arc<AtomicU64> {
        self.bytes_sent.clone()
    }

    pub fn bytes_received_counter(&self) -> Arc<AtomicU64> {
        self.bytes_received.clone()
    }

    pub fn get_info(&self) -> TunnelInfo {
        let mut info = self.info.clone();
        info.bytes_sent = self.bytes_sent.load(Ordering::Relaxed);
        info.bytes_received = self.bytes_received.load(Ordering::Relaxed);
        info
    }

    pub fn set_status(&mut self, status: TunnelStatus) {
        self.info.status = status;
    }

    pub fn stop(&mut self) {
        if let Some(tx) = self.stop_tx.take() {
            let _ = tx.send(());
        }
    }
}

/// Central manager for all SSH tunnels
pub struct TunnelManager {
    tunnels: RwLock<HashMap<String, TunnelHandle>>,
}

impl Default for TunnelManager {
    fn default() -> Self {
        Self::new()
    }
}

impl TunnelManager {
    pub fn new() -> Self {
        Self {
            tunnels: RwLock::new(HashMap::new()),
        }
    }

    /// Generate a new unique tunnel ID
    pub fn generate_id() -> String {
        Uuid::new_v4().to_string()
    }

    /// Register a new tunnel
    pub fn register(&self, handle: TunnelHandle) {
        let id = handle.info.id.clone();
        self.tunnels.write().insert(id, handle);
    }

    /// Update tunnel status
    pub fn update_status(&self, tunnel_id: &str, status: TunnelStatus) {
        if let Some(handle) = self.tunnels.write().get_mut(tunnel_id) {
            handle.set_status(status);
        }
    }

    /// Stop a tunnel
    pub fn stop(&self, tunnel_id: &str) -> Result<(), String> {
        let mut tunnels = self.tunnels.write();
        if let Some(handle) = tunnels.get_mut(tunnel_id) {
            handle.stop();
            handle.set_status(TunnelStatus::Stopped);
            Ok(())
        } else {
            Err(format!("Tunnel not found: {}", tunnel_id))
        }
    }

    /// Remove a stopped tunnel from the registry
    pub fn remove(&self, tunnel_id: &str) -> Option<TunnelHandle> {
        self.tunnels.write().remove(tunnel_id)
    }

    /// List all tunnels, optionally filtered by session_id
    pub fn list(&self, session_id: Option<&str>) -> Vec<TunnelInfo> {
        self.tunnels
            .read()
            .values()
            .filter(|h| session_id.map_or(true, |sid| h.info.session_id == sid))
            .map(|h| h.get_info())
            .collect()
    }

    /// Get info for a specific tunnel
    pub fn get(&self, tunnel_id: &str) -> Option<TunnelInfo> {
        self.tunnels.read().get(tunnel_id).map(|h| h.get_info())
    }

    /// Stop all tunnels for a specific session
    pub fn stop_session_tunnels(&self, session_id: &str) {
        let mut tunnels = self.tunnels.write();
        for handle in tunnels.values_mut() {
            if handle.info.session_id == session_id {
                handle.stop();
                handle.set_status(TunnelStatus::Stopped);
            }
        }
    }

    /// Check if a local port is already in use by a tunnel
    pub fn is_local_port_in_use(&self, port: u16) -> bool {
        self.tunnels
            .read()
            .values()
            .any(|h| h.info.local_port == port && matches!(h.info.status, TunnelStatus::Active | TunnelStatus::Starting))
    }
}
