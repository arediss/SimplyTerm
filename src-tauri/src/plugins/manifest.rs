//! Plugin manifest parsing and types
//!
//! Defines the structure of manifest.json files that describe plugins.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Plugin permission types
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Permission {
    /// Read terminal output
    #[serde(rename = "terminal:read")]
    TerminalRead,
    /// Write to terminal
    #[serde(rename = "terminal:write")]
    TerminalWrite,
    /// Register UI panels
    #[serde(rename = "panel:register")]
    PanelRegister,
    /// Register commands
    #[serde(rename = "command:register")]
    CommandRegister,
    /// Call backend functions (sandboxed)
    #[serde(rename = "backend:exec")]
    BackendExec,
    /// Read from plugin storage
    #[serde(rename = "storage:read")]
    StorageRead,
    /// Write to plugin storage
    #[serde(rename = "storage:write")]
    StorageWrite,
    /// Access session info (host, user, etc.)
    #[serde(rename = "session:info")]
    SessionInfo,
}

impl std::fmt::Display for Permission {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Permission::TerminalRead => write!(f, "terminal:read"),
            Permission::TerminalWrite => write!(f, "terminal:write"),
            Permission::PanelRegister => write!(f, "panel:register"),
            Permission::CommandRegister => write!(f, "command:register"),
            Permission::BackendExec => write!(f, "backend:exec"),
            Permission::StorageRead => write!(f, "storage:read"),
            Permission::StorageWrite => write!(f, "storage:write"),
            Permission::SessionInfo => write!(f, "session:info"),
        }
    }
}

/// Panel position in the UI
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "kebab-case")]
pub enum PanelPosition {
    #[default]
    Right,
    Left,
    Bottom,
    FloatingLeft,
    FloatingRight,
}

/// Panel configuration from manifest
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PanelConfig {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub icon: Option<String>,
    #[serde(default)]
    pub position: PanelPosition,
}

/// Command configuration from manifest
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandConfig {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub shortcut: Option<String>,
}

/// Plugin manifest (manifest.json)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginManifest {
    /// Unique plugin identifier (e.g., "server-stats")
    pub id: String,
    /// Display name
    pub name: String,
    /// Semantic version
    pub version: String,
    /// Author name or handle
    #[serde(default)]
    pub author: Option<String>,
    /// Plugin description
    #[serde(default)]
    pub description: Option<String>,
    /// Main entry point (JS file)
    #[serde(default = "default_main")]
    pub main: String,
    /// Required permissions
    #[serde(default)]
    pub permissions: Vec<Permission>,
    /// Panel configurations
    #[serde(default)]
    pub panels: Vec<PanelConfig>,
    /// Command configurations
    #[serde(default)]
    pub commands: Vec<CommandConfig>,
}

fn default_main() -> String {
    "index.js".to_string()
}

impl PluginManifest {
    /// Parse manifest from JSON string
    pub fn from_json(json: &str) -> Result<Self, String> {
        serde_json::from_str(json).map_err(|e| format!("Failed to parse manifest: {}", e))
    }

    /// Load manifest from file path
    pub fn from_file(path: &PathBuf) -> Result<Self, String> {
        let content =
            std::fs::read_to_string(path).map_err(|e| format!("Failed to read manifest: {}", e))?;
        Self::from_json(&content)
    }

    /// Check if plugin has a specific permission
    pub fn has_permission(&self, permission: &Permission) -> bool {
        self.permissions.contains(permission)
    }
}

/// Plugin runtime status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PluginStatus {
    /// Plugin is discovered but not loaded
    Disabled,
    /// Plugin is loaded and running
    Enabled,
    /// Plugin failed to load
    Error,
}

/// Complete plugin state (manifest + runtime info)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginState {
    /// Parsed manifest
    pub manifest: PluginManifest,
    /// Path to plugin directory
    pub path: PathBuf,
    /// Current status
    pub status: PluginStatus,
    /// Error message if status is Error
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl PluginState {
    pub fn new(manifest: PluginManifest, path: PathBuf) -> Self {
        Self {
            manifest,
            path,
            status: PluginStatus::Disabled,
            error: None,
        }
    }

    pub fn with_error(mut self, error: String) -> Self {
        self.status = PluginStatus::Error;
        self.error = Some(error);
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_manifest() {
        let json = r#"{
            "id": "test-plugin",
            "name": "Test Plugin",
            "version": "1.0.0",
            "author": "Test Author",
            "description": "A test plugin",
            "permissions": ["terminal:read", "panel:register"],
            "panels": [{
                "id": "test-panel",
                "title": "Test",
                "position": "right"
            }]
        }"#;

        let manifest = PluginManifest::from_json(json).unwrap();
        assert_eq!(manifest.id, "test-plugin");
        assert_eq!(manifest.permissions.len(), 2);
        assert!(manifest.has_permission(&Permission::TerminalRead));
        assert!(!manifest.has_permission(&Permission::TerminalWrite));
    }
}
