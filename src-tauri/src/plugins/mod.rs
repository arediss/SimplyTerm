//! Plugin system for SimplyTerm
//!
//! This module provides a versioned, permission-based plugin API that allows
//! third-party plugins to extend SimplyTerm's functionality.
//!
//! # Architecture
//!
//! - Plugins are frontend-only (JavaScript/TypeScript) with access to backend APIs
//! - Each plugin declares required permissions in its manifest
//! - Users must grant permissions before plugins can access protected APIs
//! - API is versioned (api_v1) for stability and backward compatibility
//!
//! # Example Plugin Manifest
//!
//! ```json
//! {
//!   "id": "com.example.my-plugin",
//!   "name": "My Plugin",
//!   "version": "1.0.0",
//!   "api_version": "1.0.0",
//!   "description": "Example plugin",
//!   "author": "Developer",
//!   "permissions": ["sessions_read", "vault_status"],
//!   "main": "index.js"
//! }
//! ```

// Plugin system public API - may not be used internally yet
#![allow(unused_imports)]
#![allow(dead_code)]

pub mod api_v1;
pub mod error;
pub mod manager;
pub mod manifest;
pub mod permissions;

// Re-exports for convenience
pub use error::{PluginError, PluginErrorCode, PluginResult};
pub use manager::{InstalledPlugin, PluginManager, PluginState};
pub use manifest::{GrantedPermissions, Permission, PermissionRisk, PluginManifest, API_VERSION};
pub use permissions::{require_permission, require_all_permissions, require_any_permission, PermissionGuard};
