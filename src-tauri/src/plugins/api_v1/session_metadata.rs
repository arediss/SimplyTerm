//! Session Metadata API for plugins
//!
//! Allows plugins to store and retrieve custom metadata for sessions.
//! Each plugin has isolated storage - plugins cannot access other plugins' metadata.
//! Requires: sessions_metadata_read, sessions_metadata_write permissions

use crate::plugins::error::{PluginError, PluginResult};
use crate::plugins::manifest::{GrantedPermissions, Permission};
use crate::plugins::permissions::require_permission;
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

/// Session metadata storage file name
const METADATA_FILE: &str = "session-metadata.json";

/// Session metadata structure (all sessions for a plugin)
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SessionMetadataStore {
    /// Map of session_id -> metadata JSON object
    pub sessions: HashMap<String, JsonValue>,
}

/// Gets the metadata file path for a plugin
fn get_metadata_path(data_dir: &PathBuf) -> PathBuf {
    data_dir.join(METADATA_FILE)
}

/// Loads the metadata store from disk
fn load_metadata_store(data_dir: &PathBuf) -> PluginResult<SessionMetadataStore> {
    let path = get_metadata_path(data_dir);

    if !path.exists() {
        return Ok(SessionMetadataStore::default());
    }

    let content = fs::read_to_string(&path)
        .map_err(|e| PluginError::storage_error(format!("Failed to read metadata file: {}", e)))?;

    if content.trim().is_empty() {
        return Ok(SessionMetadataStore::default());
    }

    serde_json::from_str(&content)
        .map_err(|e| PluginError::storage_error(format!("Failed to parse metadata file: {}", e)))
}

/// Saves the metadata store to disk
fn save_metadata_store(data_dir: &PathBuf, store: &SessionMetadataStore) -> PluginResult<()> {
    // Ensure data directory exists
    if !data_dir.exists() {
        fs::create_dir_all(data_dir)
            .map_err(|e| PluginError::storage_error(format!("Failed to create data directory: {}", e)))?;
    }

    let path = get_metadata_path(data_dir);
    let content = serde_json::to_string_pretty(store)
        .map_err(|e| PluginError::storage_error(format!("Failed to serialize metadata: {}", e)))?;

    fs::write(&path, content)
        .map_err(|e| PluginError::storage_error(format!("Failed to write metadata file: {}", e)))
}

/// Gets metadata for a specific session
///
/// Returns None if no metadata exists for this session
pub fn get_session_metadata(
    permissions: &GrantedPermissions,
    data_dir: &PathBuf,
    session_id: &str,
) -> PluginResult<Option<JsonValue>> {
    require_permission(permissions, Permission::SessionsMetadataRead)?;

    let store = load_metadata_store(data_dir)?;
    Ok(store.sessions.get(session_id).cloned())
}

/// Gets metadata for all sessions
///
/// Returns a map of session_id -> metadata
pub fn get_all_session_metadata(
    permissions: &GrantedPermissions,
    data_dir: &PathBuf,
) -> PluginResult<HashMap<String, JsonValue>> {
    require_permission(permissions, Permission::SessionsMetadataRead)?;

    let store = load_metadata_store(data_dir)?;
    Ok(store.sessions)
}

/// Sets metadata for a specific session
///
/// Overwrites any existing metadata for this session
pub fn set_session_metadata(
    permissions: &GrantedPermissions,
    data_dir: &PathBuf,
    session_id: &str,
    metadata: JsonValue,
) -> PluginResult<()> {
    require_permission(permissions, Permission::SessionsMetadataWrite)?;

    let mut store = load_metadata_store(data_dir)?;
    store.sessions.insert(session_id.to_string(), metadata);
    save_metadata_store(data_dir, &store)
}

/// Updates specific fields in session metadata (merge)
///
/// Only updates the specified fields, preserving other existing fields
pub fn update_session_metadata(
    permissions: &GrantedPermissions,
    data_dir: &PathBuf,
    session_id: &str,
    updates: JsonValue,
) -> PluginResult<JsonValue> {
    require_permission(permissions, Permission::SessionsMetadataWrite)?;

    let mut store = load_metadata_store(data_dir)?;

    let existing = store.sessions.get(session_id).cloned().unwrap_or(JsonValue::Object(Default::default()));

    // Merge updates into existing
    let merged = if let (JsonValue::Object(mut existing_obj), JsonValue::Object(updates_obj)) = (existing, updates) {
        for (key, value) in updates_obj {
            existing_obj.insert(key, value);
        }
        JsonValue::Object(existing_obj)
    } else {
        return Err(PluginError::invalid_input("Metadata must be a JSON object"));
    };

    store.sessions.insert(session_id.to_string(), merged.clone());
    save_metadata_store(data_dir, &store)?;

    Ok(merged)
}

/// Deletes metadata for a specific session
///
/// Returns true if metadata existed and was deleted
pub fn delete_session_metadata(
    permissions: &GrantedPermissions,
    data_dir: &PathBuf,
    session_id: &str,
) -> PluginResult<bool> {
    require_permission(permissions, Permission::SessionsMetadataWrite)?;

    let mut store = load_metadata_store(data_dir)?;
    let existed = store.sessions.remove(session_id).is_some();

    if existed {
        save_metadata_store(data_dir, &store)?;
    }

    Ok(existed)
}

/// Deletes a specific field from session metadata
pub fn delete_session_metadata_field(
    permissions: &GrantedPermissions,
    data_dir: &PathBuf,
    session_id: &str,
    field: &str,
) -> PluginResult<bool> {
    require_permission(permissions, Permission::SessionsMetadataWrite)?;

    let mut store = load_metadata_store(data_dir)?;

    if let Some(JsonValue::Object(ref mut obj)) = store.sessions.get_mut(session_id) {
        let existed = obj.remove(field).is_some();
        if existed {
            save_metadata_store(data_dir, &store)?;
        }
        Ok(existed)
    } else {
        Ok(false)
    }
}

/// Lists all session IDs that have metadata
pub fn list_sessions_with_metadata(
    permissions: &GrantedPermissions,
    data_dir: &PathBuf,
) -> PluginResult<Vec<String>> {
    require_permission(permissions, Permission::SessionsMetadataRead)?;

    let store = load_metadata_store(data_dir)?;
    Ok(store.sessions.keys().cloned().collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn create_test_permissions(read: bool, write: bool) -> GrantedPermissions {
        let mut perms = GrantedPermissions::new();
        if read {
            perms.grant(Permission::SessionsMetadataRead);
        }
        if write {
            perms.grant(Permission::SessionsMetadataWrite);
        }
        perms
    }

    #[test]
    fn test_get_nonexistent_metadata() {
        let dir = tempdir().unwrap();
        let perms = create_test_permissions(true, false);

        let result = get_session_metadata(&perms, &dir.path().to_path_buf(), "test-session");
        assert!(result.is_ok());
        assert!(result.unwrap().is_none());
    }

    #[test]
    fn test_set_and_get_metadata() {
        let dir = tempdir().unwrap();
        let perms = create_test_permissions(true, true);
        let data_dir = dir.path().to_path_buf();

        let metadata = serde_json::json!({
            "folder_id": "folder-1",
            "color": "#ff0000"
        });

        set_session_metadata(&perms, &data_dir, "session-1", metadata.clone()).unwrap();

        let result = get_session_metadata(&perms, &data_dir, "session-1").unwrap();
        assert!(result.is_some());
        assert_eq!(result.unwrap(), metadata);
    }

    #[test]
    fn test_update_metadata_merges() {
        let dir = tempdir().unwrap();
        let perms = create_test_permissions(true, true);
        let data_dir = dir.path().to_path_buf();

        let initial = serde_json::json!({
            "folder_id": "folder-1",
            "color": "#ff0000"
        });
        set_session_metadata(&perms, &data_dir, "session-1", initial).unwrap();

        let updates = serde_json::json!({
            "color": "#00ff00",
            "tags": ["prod", "db"]
        });
        let result = update_session_metadata(&perms, &data_dir, "session-1", updates).unwrap();

        assert_eq!(result["folder_id"], "folder-1");
        assert_eq!(result["color"], "#00ff00");
        assert_eq!(result["tags"], serde_json::json!(["prod", "db"]));
    }

    #[test]
    fn test_delete_metadata() {
        let dir = tempdir().unwrap();
        let perms = create_test_permissions(true, true);
        let data_dir = dir.path().to_path_buf();

        let metadata = serde_json::json!({"test": "value"});
        set_session_metadata(&perms, &data_dir, "session-1", metadata).unwrap();

        let deleted = delete_session_metadata(&perms, &data_dir, "session-1").unwrap();
        assert!(deleted);

        let result = get_session_metadata(&perms, &data_dir, "session-1").unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn test_permission_denied_without_read() {
        let dir = tempdir().unwrap();
        let perms = create_test_permissions(false, true);

        let result = get_session_metadata(&perms, &dir.path().to_path_buf(), "test");
        assert!(result.is_err());
    }

    #[test]
    fn test_permission_denied_without_write() {
        let dir = tempdir().unwrap();
        let perms = create_test_permissions(true, false);

        let result = set_session_metadata(
            &perms,
            &dir.path().to_path_buf(),
            "test",
            serde_json::json!({}),
        );
        assert!(result.is_err());
    }
}
