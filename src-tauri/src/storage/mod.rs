//! Storage module for sessions and credentials
//!
//! - config.rs: Core session file management (sessions.json - connection info only)
//! - sessions.rs: CRUD operations for individual sessions
//! - vault/: Encrypted vault for secure credential storage
//! - settings.rs: Application settings management
//!
//! Note: Folders, tags, and recent sessions are now managed by plugins
//! via the session metadata API.

pub mod config;
pub mod sessions;
pub mod settings;
pub mod vault;

// Core exports
pub use config::{load_sessions, save_sessions, SavedSession, AuthType};
pub use settings::{load_settings, save_settings, AppSettings};
pub use vault::{VaultState, VaultCredentialType};
