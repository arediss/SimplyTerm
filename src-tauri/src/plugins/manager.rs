//! Plugin discovery, loading, and lifecycle management

use super::manifest::{PluginManifest, PluginState, PluginStatus};
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;

/// Plugin manager handles discovery, loading, and lifecycle of plugins
pub struct PluginManager {
    /// Discovered plugins (id -> state)
    plugins: RwLock<HashMap<String, PluginState>>,
    /// Path to plugins directory
    plugins_dir: PathBuf,
    /// Path to plugin settings file
    settings_path: PathBuf,
}

/// Persistent plugin settings
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct PluginSettings {
    /// Enabled plugin IDs
    enabled: Vec<String>,
}

impl PluginManager {
    /// Create a new plugin manager
    pub fn new() -> Result<Self, String> {
        let plugins_dir = Self::get_plugins_dir()?;
        let settings_path = Self::get_settings_path()?;

        // Ensure plugins directory exists
        if !plugins_dir.exists() {
            std::fs::create_dir_all(&plugins_dir)
                .map_err(|e| format!("Failed to create plugins directory: {}", e))?;
        }

        let manager = Self {
            plugins: RwLock::new(HashMap::new()),
            plugins_dir,
            settings_path,
        };

        // Discover plugins on startup
        manager.discover_plugins()?;

        // Load settings and enable previously enabled plugins
        manager.load_settings()?;

        Ok(manager)
    }

    /// Get plugins directory path (~/.simplyterm/plugins/)
    fn get_plugins_dir() -> Result<PathBuf, String> {
        let home = dirs::home_dir().ok_or("Could not determine home directory")?;
        Ok(home.join(".simplyterm").join("plugins"))
    }

    /// Get settings file path (~/.simplyterm/plugin-settings.json)
    fn get_settings_path() -> Result<PathBuf, String> {
        let home = dirs::home_dir().ok_or("Could not determine home directory")?;
        let config_dir = home.join(".simplyterm");
        if !config_dir.exists() {
            std::fs::create_dir_all(&config_dir)
                .map_err(|e| format!("Failed to create config directory: {}", e))?;
        }
        Ok(config_dir.join("plugin-settings.json"))
    }

    /// Discover all plugins in the plugins directory
    pub fn discover_plugins(&self) -> Result<(), String> {
        let mut plugins = self.plugins.write();
        plugins.clear();

        if !self.plugins_dir.exists() {
            return Ok(()); // No plugins directory yet
        }

        let entries = std::fs::read_dir(&self.plugins_dir)
            .map_err(|e| format!("Failed to read plugins directory: {}", e))?;

        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }

            let manifest_path = path.join("manifest.json");
            if !manifest_path.exists() {
                continue;
            }

            match PluginManifest::from_file(&manifest_path) {
                Ok(manifest) => {
                    let id = manifest.id.clone();
                    let state = PluginState::new(manifest, path);
                    plugins.insert(id, state);
                }
                Err(e) => {
                    // Log error but continue with other plugins
                    eprintln!(
                        "Failed to load plugin manifest from {:?}: {}",
                        manifest_path, e
                    );
                }
            }
        }

        Ok(())
    }

    /// Load and apply plugin settings
    fn load_settings(&self) -> Result<(), String> {
        if !self.settings_path.exists() {
            return Ok(());
        }

        let content = std::fs::read_to_string(&self.settings_path)
            .map_err(|e| format!("Failed to read plugin settings: {}", e))?;

        let settings: PluginSettings = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse plugin settings: {}", e))?;

        // Enable previously enabled plugins
        let mut plugins = self.plugins.write();
        for id in settings.enabled {
            if let Some(plugin) = plugins.get_mut(&id) {
                plugin.status = PluginStatus::Enabled;
            }
        }

        Ok(())
    }

    /// Save current plugin settings
    fn save_settings(&self) -> Result<(), String> {
        let plugins = self.plugins.read();
        let enabled: Vec<String> = plugins
            .iter()
            .filter(|(_, state)| state.status == PluginStatus::Enabled)
            .map(|(id, _)| id.clone())
            .collect();

        let settings = PluginSettings { enabled };
        let content = serde_json::to_string_pretty(&settings)
            .map_err(|e| format!("Failed to serialize settings: {}", e))?;

        std::fs::write(&self.settings_path, content)
            .map_err(|e| format!("Failed to write settings: {}", e))?;

        Ok(())
    }

    /// Get all discovered plugins
    pub fn list_plugins(&self) -> Vec<PluginState> {
        self.plugins.read().values().cloned().collect()
    }

    /// Get a specific plugin by ID
    pub fn get_plugin(&self, id: &str) -> Option<PluginState> {
        self.plugins.read().get(id).cloned()
    }

    /// Get plugin manifest by ID
    pub fn get_manifest(&self, id: &str) -> Option<PluginManifest> {
        self.plugins.read().get(id).map(|s| s.manifest.clone())
    }

    /// Enable a plugin
    pub fn enable_plugin(&self, id: &str) -> Result<(), String> {
        {
            let mut plugins = self.plugins.write();
            let plugin = plugins
                .get_mut(id)
                .ok_or_else(|| format!("Plugin not found: {}", id))?;

            // Validate plugin can be enabled
            let main_path = plugin.path.join(&plugin.manifest.main);
            if !main_path.exists() {
                return Err(format!(
                    "Plugin main file not found: {}",
                    plugin.manifest.main
                ));
            }

            plugin.status = PluginStatus::Enabled;
            plugin.error = None;
        }

        self.save_settings()?;
        Ok(())
    }

    /// Disable a plugin
    pub fn disable_plugin(&self, id: &str) -> Result<(), String> {
        {
            let mut plugins = self.plugins.write();
            let plugin = plugins
                .get_mut(id)
                .ok_or_else(|| format!("Plugin not found: {}", id))?;

            plugin.status = PluginStatus::Disabled;
        }

        self.save_settings()?;
        Ok(())
    }

    /// Get a file from a plugin directory
    pub fn get_plugin_file(&self, plugin_id: &str, file_path: &str) -> Result<String, String> {
        let plugins = self.plugins.read();
        let plugin = plugins
            .get(plugin_id)
            .ok_or_else(|| format!("Plugin not found: {}", plugin_id))?;

        // Security: prevent path traversal
        let normalized_path = PathBuf::from(file_path);
        if normalized_path
            .components()
            .any(|c| matches!(c, std::path::Component::ParentDir))
        {
            return Err("Path traversal not allowed".to_string());
        }

        let full_path = plugin.path.join(file_path);

        // Ensure file is within plugin directory
        if !full_path.starts_with(&plugin.path) {
            return Err("File path outside plugin directory".to_string());
        }

        std::fs::read_to_string(&full_path)
            .map_err(|e| format!("Failed to read file {}: {}", file_path, e))
    }

    /// Get all enabled plugins
    pub fn get_enabled_plugins(&self) -> Vec<PluginState> {
        self.plugins
            .read()
            .values()
            .filter(|s| s.status == PluginStatus::Enabled)
            .cloned()
            .collect()
    }

    /// Re-scan plugins directory for new/removed plugins
    pub fn refresh(&self) -> Result<(), String> {
        // Remember which plugins were enabled
        let enabled_ids: Vec<String> = self
            .plugins
            .read()
            .iter()
            .filter(|(_, s)| s.status == PluginStatus::Enabled)
            .map(|(id, _)| id.clone())
            .collect();

        // Rediscover plugins
        self.discover_plugins()?;

        // Re-enable previously enabled plugins
        for id in enabled_ids {
            if self.plugins.read().contains_key(&id) {
                let _ = self.enable_plugin(&id);
            }
        }

        Ok(())
    }
}

impl Default for PluginManager {
    fn default() -> Self {
        Self::new().unwrap_or_else(|e| {
            eprintln!("Failed to initialize plugin manager: {}", e);
            Self {
                plugins: RwLock::new(HashMap::new()),
                plugins_dir: PathBuf::new(),
                settings_path: PathBuf::new(),
            }
        })
    }
}

/// Thread-safe wrapper for use in Tauri state
pub type SharedPluginManager = Arc<PluginManager>;

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::TempDir;

    fn create_test_plugin(dir: &TempDir, id: &str) -> PathBuf {
        let plugin_dir = dir.path().join(id);
        std::fs::create_dir_all(&plugin_dir).unwrap();

        let manifest = format!(
            r#"{{
            "id": "{}",
            "name": "Test Plugin",
            "version": "1.0.0",
            "permissions": ["terminal:read"]
        }}"#,
            id
        );

        let manifest_path = plugin_dir.join("manifest.json");
        let mut file = std::fs::File::create(&manifest_path).unwrap();
        file.write_all(manifest.as_bytes()).unwrap();

        // Create index.js
        let main_path = plugin_dir.join("index.js");
        std::fs::write(&main_path, "export default function(api) {}").unwrap();

        plugin_dir
    }

    #[test]
    fn test_plugin_discovery() {
        // This test would need a mock filesystem setup
        // For now, we just verify the basic structure compiles
    }
}
