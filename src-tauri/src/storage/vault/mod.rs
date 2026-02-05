//! Vault module for secure credential storage
//!
//! Provides encrypted local storage for session credentials with multiple
//! unlock methods (master password, PIN, biometrics, FIDO2 security keys).
//!
//! ## Architecture
//!
//! - `types.rs`: Data structures for vault metadata and credentials
//! - `crypto.rs`: AES-256-GCM encryption and Argon2id key derivation
//! - `state.rs`: In-memory vault state management
//! - `commands.rs`: Tauri commands for frontend integration
//! - `fido2.rs`: FIDO2 security key support (cross-platform dispatcher)
//! - `fido2_windows.rs`: Windows WebAuthn API backend (no admin required)

mod commands;
mod crypto;
pub mod fido2;
#[cfg(windows)]
pub mod fido2_windows;
mod state;
mod types;


// Re-export types for external use
pub use commands::*;
pub use state::VaultState;
pub use types::{VaultBundle, VaultCredentialType, VaultExportResult, SyncMeta};
