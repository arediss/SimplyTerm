//! SSH Port Forwarding (Tunnels)
//!
//! Supports:
//! - Local forwarding (-L): Forward local port to remote host via SSH
//! - Remote forwarding (-R): Expose local service on remote server
//! - Dynamic forwarding (-D): SOCKS5 proxy via SSH

pub mod manager;
pub mod local_forward;
pub mod remote_forward;
pub mod dynamic_forward;

pub use manager::{TunnelManager, TunnelInfo};
