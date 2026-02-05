//! Sessions API for plugins
//!
//! Provides read/write access to saved sessions (core connection info only).
//! Plugin-specific metadata (folders, tags, colors) should use session_metadata API.
//! Requires: sessions_read, sessions_write permissions

use crate::plugins::error::{PluginError, PluginResult};
use crate::plugins::manifest::{GrantedPermissions, Permission};
use crate::plugins::permissions::require_permission;
use crate::storage::sessions::{self, SavedSession};
use serde::{Deserialize, Serialize};

/// Session information exposed to plugins (core connection info only)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginSession {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub key_path: Option<String>,
}

impl From<SavedSession> for PluginSession {
    fn from(session: SavedSession) -> Self {
        Self {
            id: session.id,
            name: session.name,
            host: session.host,
            port: session.port,
            username: session.username,
            auth_type: match session.auth_type {
                crate::storage::sessions::AuthType::Password => "password".to_string(),
                crate::storage::sessions::AuthType::Key => "key".to_string(),
            },
            key_path: session.key_path,
        }
    }
}

/// Lists all saved sessions
pub fn list_sessions(permissions: &GrantedPermissions) -> PluginResult<Vec<PluginSession>> {
    require_permission(permissions, Permission::SessionsRead)?;

    let sessions = sessions::load_sessions()
        .map_err(|e| PluginError::storage_error(e))?;

    Ok(sessions.into_iter().map(PluginSession::from).collect())
}

/// Gets a session by ID
pub fn get_session(permissions: &GrantedPermissions, id: &str) -> PluginResult<Option<PluginSession>> {
    require_permission(permissions, Permission::SessionsRead)?;

    let sessions = sessions::load_sessions()
        .map_err(|e| PluginError::storage_error(e))?;

    Ok(sessions.into_iter()
        .find(|s| s.id == id)
        .map(PluginSession::from))
}

/// Creates a new session (core connection info only)
pub fn create_session(
    permissions: &GrantedPermissions,
    name: String,
    host: String,
    port: u16,
    username: String,
    auth_type: String,
    key_path: Option<String>,
) -> PluginResult<PluginSession> {
    require_permission(permissions, Permission::SessionsWrite)?;

    let session = sessions::save_session(
        name,
        host,
        port,
        username,
        auth_type,
        key_path,
    ).map_err(|e| PluginError::storage_error(e))?;

    Ok(PluginSession::from(session))
}

/// Updates an existing session (core connection info only)
pub fn update_session(
    permissions: &GrantedPermissions,
    id: String,
    name: Option<String>,
    host: Option<String>,
    port: Option<u16>,
    username: Option<String>,
    auth_type: Option<String>,
    key_path: Option<Option<String>>,
) -> PluginResult<PluginSession> {
    require_permission(permissions, Permission::SessionsWrite)?;

    let session = sessions::update_session(
        id,
        name,
        host,
        port,
        username,
        auth_type,
        key_path,
    ).map_err(|e| PluginError::storage_error(e))?;

    Ok(PluginSession::from(session))
}

/// Deletes a session
pub fn delete_session(permissions: &GrantedPermissions, id: &str) -> PluginResult<()> {
    require_permission(permissions, Permission::SessionsWrite)?;

    sessions::delete_session(id)
        .map_err(|e| PluginError::storage_error(e))
}
