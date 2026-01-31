//! Plugin API - functions exposed to plugins from the backend
//!
//! This module provides the sandboxed API that plugins can call through
//! the `invokeBackend()` mechanism.

use super::manifest::Permission;
use super::sandbox::PermissionValidator;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;

/// Plugin API context for a specific plugin
pub struct PluginApi {
    /// Plugin ID
    #[allow(dead_code)]
    plugin_id: String,
    /// Permission validator
    validator: PermissionValidator,
    /// Storage directory for this plugin
    storage_dir: PathBuf,
}

/// Session info exposed to plugins
#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionInfo {
    pub id: String,
    pub session_type: String,
    pub host: Option<String>,
    pub port: Option<u16>,
    pub username: Option<String>,
    pub status: String,
}

/// Result of a backend API call
#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ApiResult {
    Success(serde_json::Value),
    Error { error: String },
}

impl PluginApi {
    /// Create a new API context for a plugin
    pub fn new(plugin_id: String, permissions: Vec<Permission>) -> Result<Self, String> {
        let storage_dir = Self::get_storage_dir(&plugin_id)?;

        // Ensure storage directory exists
        if !storage_dir.exists() {
            std::fs::create_dir_all(&storage_dir)
                .map_err(|e| format!("Failed to create plugin storage: {}", e))?;
        }

        Ok(Self {
            plugin_id,
            validator: PermissionValidator::new(permissions),
            storage_dir,
        })
    }

    /// Get storage directory for a plugin
    fn get_storage_dir(plugin_id: &str) -> Result<PathBuf, String> {
        let home = dirs::home_dir().ok_or("Could not determine home directory")?;
        Ok(home
            .join(".simplyterm")
            .join("plugin-data")
            .join(plugin_id))
    }

    /// Check if plugin has a permission
    #[allow(dead_code)]
    pub fn has_permission(&self, permission: &Permission) -> bool {
        self.validator.has_permission(permission)
    }

    /// Get plugin storage value
    pub fn storage_get(&self, key: &str) -> Result<Option<serde_json::Value>, String> {
        self.validator.require(&Permission::StorageRead)?;

        let file_path = self.storage_dir.join(format!("{}.json", sanitize_key(key)));

        if !file_path.exists() {
            return Ok(None);
        }

        let content = std::fs::read_to_string(&file_path)
            .map_err(|e| format!("Failed to read storage: {}", e))?;

        serde_json::from_str(&content)
            .map(Some)
            .map_err(|e| format!("Failed to parse storage value: {}", e))
    }

    /// Set plugin storage value
    pub fn storage_set(&self, key: &str, value: serde_json::Value) -> Result<(), String> {
        self.validator.require(&Permission::StorageWrite)?;

        let file_path = self.storage_dir.join(format!("{}.json", sanitize_key(key)));

        let content = serde_json::to_string_pretty(&value)
            .map_err(|e| format!("Failed to serialize value: {}", e))?;

        std::fs::write(&file_path, content).map_err(|e| format!("Failed to write storage: {}", e))
    }

    /// Delete plugin storage value
    pub fn storage_delete(&self, key: &str) -> Result<(), String> {
        self.validator.require(&Permission::StorageWrite)?;

        let file_path = self.storage_dir.join(format!("{}.json", sanitize_key(key)));

        if file_path.exists() {
            std::fs::remove_file(&file_path)
                .map_err(|e| format!("Failed to delete storage: {}", e))?;
        }

        Ok(())
    }

    /// Invoke a backend command (sandboxed)
    pub fn invoke(
        &self,
        command: &str,
        args: HashMap<String, serde_json::Value>,
    ) -> Result<serde_json::Value, String> {
        // Validate permission
        self.validator.require(&Permission::BackendExec)?;

        // Validate command is whitelisted
        match command {
            "get_session_info" => {
                // This would need access to session manager
                // For now, return placeholder
                Ok(serde_json::json!({
                    "error": "Not implemented yet"
                }))
            }
            "exec_ssh_command" => {
                // Validate required args
                let _session_id = args
                    .get("session_id")
                    .and_then(|v| v.as_str())
                    .ok_or("Missing session_id")?;
                let _command = args
                    .get("command")
                    .and_then(|v| v.as_str())
                    .ok_or("Missing command")?;

                // This would execute command on SSH session
                Ok(serde_json::json!({
                    "error": "Not implemented yet"
                }))
            }
            _ => Err(format!("Unknown command: {}", command)),
        }
    }
}

/// Sanitize storage key to be safe for filenames
fn sanitize_key(key: &str) -> String {
    key.chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect()
}

/// Plugin API registry - manages API instances for multiple plugins
#[allow(dead_code)]
pub struct PluginApiRegistry {
    apis: parking_lot::RwLock<HashMap<String, Arc<PluginApi>>>,
}

#[allow(dead_code)]
impl PluginApiRegistry {
    pub fn new() -> Self {
        Self {
            apis: parking_lot::RwLock::new(HashMap::new()),
        }
    }

    /// Get or create API instance for a plugin
    pub fn get_or_create(
        &self,
        plugin_id: &str,
        permissions: Vec<Permission>,
    ) -> Result<Arc<PluginApi>, String> {
        // Check if already exists
        {
            let apis = self.apis.read();
            if let Some(api) = apis.get(plugin_id) {
                return Ok(Arc::clone(api));
            }
        }

        // Create new
        let api = Arc::new(PluginApi::new(plugin_id.to_string(), permissions)?);

        {
            let mut apis = self.apis.write();
            apis.insert(plugin_id.to_string(), Arc::clone(&api));
        }

        Ok(api)
    }

    /// Remove API instance when plugin is disabled
    pub fn remove(&self, plugin_id: &str) {
        let mut apis = self.apis.write();
        apis.remove(plugin_id);
    }
}

impl Default for PluginApiRegistry {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_key() {
        assert_eq!(sanitize_key("simple"), "simple");
        assert_eq!(sanitize_key("with spaces"), "with_spaces");
        assert_eq!(sanitize_key("path/to/key"), "path_to_key");
        assert_eq!(sanitize_key("key-123_test"), "key-123_test");
    }

    #[test]
    fn test_api_permissions() {
        let api = PluginApi::new(
            "test".to_string(),
            vec![Permission::StorageRead, Permission::StorageWrite],
        )
        .unwrap();

        assert!(api.has_permission(&Permission::StorageRead));
        assert!(!api.has_permission(&Permission::BackendExec));
    }
}
