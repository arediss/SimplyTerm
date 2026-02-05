//! Plugin error types

use serde::Serialize;
use std::fmt;

#[derive(Debug, Clone, Serialize)]
pub struct PluginError {
    pub code: PluginErrorCode,
    pub message: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum PluginErrorCode {
    PermissionDenied,
    NotFound,
    InvalidInput,
    StorageError,
    VaultLocked,
    InternalError,
}

impl PluginError {
    pub fn permission_denied(msg: impl Into<String>) -> Self {
        Self {
            code: PluginErrorCode::PermissionDenied,
            message: msg.into(),
        }
    }

    pub fn not_found(msg: impl Into<String>) -> Self {
        Self {
            code: PluginErrorCode::NotFound,
            message: msg.into(),
        }
    }

    pub fn invalid_input(msg: impl Into<String>) -> Self {
        Self {
            code: PluginErrorCode::InvalidInput,
            message: msg.into(),
        }
    }

    pub fn storage_error(msg: impl Into<String>) -> Self {
        Self {
            code: PluginErrorCode::StorageError,
            message: msg.into(),
        }
    }

    pub fn vault_locked() -> Self {
        Self {
            code: PluginErrorCode::VaultLocked,
            message: "Vault is locked".into(),
        }
    }

    pub fn internal(msg: impl Into<String>) -> Self {
        Self {
            code: PluginErrorCode::InternalError,
            message: msg.into(),
        }
    }
}

impl fmt::Display for PluginError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{:?}: {}", self.code, self.message)
    }
}

impl std::error::Error for PluginError {}

impl From<std::io::Error> for PluginError {
    fn from(e: std::io::Error) -> Self {
        Self::storage_error(e.to_string())
    }
}

impl From<serde_json::Error> for PluginError {
    fn from(e: serde_json::Error) -> Self {
        Self::invalid_input(e.to_string())
    }
}

pub type PluginResult<T> = Result<T, PluginError>;
