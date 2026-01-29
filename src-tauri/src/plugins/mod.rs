//! Plugin system for SimplyTerm
//!
//! This module provides a secure, extensible plugin architecture that allows
//! the community to add features like server stats, SFTP viewer, themes, etc.
//! while keeping the core app lightweight.

mod api;
mod manager;
pub mod manifest;
mod sandbox;

pub use api::PluginApi;
pub use manager::PluginManager;
pub use manifest::{
    CommandConfig, PanelConfig, PanelPosition, Permission, PluginManifest, PluginState,
    PluginStatus,
};
