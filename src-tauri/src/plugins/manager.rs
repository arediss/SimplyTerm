//! Plugin lifecycle management

use super::error::{PluginError, PluginResult};
use super::manifest::{GrantedPermissions, Permission, PluginManifest, is_api_compatible, API_VERSION};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, RwLock};

/// Plugin state
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PluginState {
    /// Plugin is installed but not enabled
    Disabled,
    /// Plugin is enabled and running
    Enabled,
    /// Plugin encountered an error
    Error,
}

/// Installed plugin information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstalledPlugin {
    pub manifest: PluginManifest,
    pub state: PluginState,
    pub granted_permissions: GrantedPermissions,
    pub install_path: PathBuf,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_message: Option<String>,
}

/// Plugin registry persisted to disk
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct PluginRegistry {
    plugins: HashMap<String, InstalledPlugin>,
}

/// Plugin manager handles installation, activation, and lifecycle
pub struct PluginManager {
    plugins: Arc<RwLock<HashMap<String, InstalledPlugin>>>,
    plugins_dir: PathBuf,
    registry_path: PathBuf,
}

impl PluginManager {
    /// Creates a new plugin manager using the application data directory
    /// This is the preferred method - plugins are stored with the app
    pub fn with_app_dir(app_data_dir: PathBuf) -> PluginResult<Self> {
        let plugins_dir = app_data_dir.join("plugins");
        let registry_path = app_data_dir.join("plugin-registry.json");

        // Ensure directories exist
        if !plugins_dir.exists() {
            fs::create_dir_all(&plugins_dir)
                .map_err(|e| PluginError::storage_error(format!("Failed to create plugins directory: {}", e)))?;
        }

        let manager = Self {
            plugins: Arc::new(RwLock::new(HashMap::new())),
            plugins_dir,
            registry_path,
        };

        // Load existing registry
        manager.load_registry()?;

        Ok(manager)
    }

    /// Creates a new plugin manager (fallback to user directory)
    /// Prefer using `with_app_dir` when app handle is available
    pub fn new() -> PluginResult<Self> {
        let home = dirs::home_dir()
            .ok_or_else(|| PluginError::internal("Could not find home directory"))?;

        // Fallback to user directory (for testing or when app dir not available)
        let app_data_dir = home.join(".simplyterm").join("app_data");
        Self::with_app_dir(app_data_dir)
    }

    /// Loads the plugin registry from disk
    fn load_registry(&self) -> PluginResult<()> {
        if !self.registry_path.exists() {
            return Ok(());
        }

        let content = fs::read_to_string(&self.registry_path)
            .map_err(|e| PluginError::storage_error(format!("Failed to read plugin registry: {}", e)))?;

        if content.trim().is_empty() {
            return Ok(());
        }

        let registry: PluginRegistry = serde_json::from_str(&content)
            .map_err(|e| PluginError::storage_error(format!("Failed to parse plugin registry: {}", e)))?;

        let mut plugins = self.plugins.write()
            .map_err(|_| PluginError::internal("Failed to acquire lock"))?;
        *plugins = registry.plugins;

        Ok(())
    }

    /// Saves the plugin registry to disk
    fn save_registry(&self) -> PluginResult<()> {
        let plugins = self.plugins.read()
            .map_err(|_| PluginError::internal("Failed to acquire lock"))?;

        let registry = PluginRegistry {
            plugins: plugins.clone(),
        };

        let content = serde_json::to_string_pretty(&registry)
            .map_err(|e| PluginError::storage_error(format!("Failed to serialize plugin registry: {}", e)))?;

        fs::write(&self.registry_path, content)
            .map_err(|e| PluginError::storage_error(format!("Failed to write plugin registry: {}", e)))?;

        Ok(())
    }

    /// Returns the plugin directory path
    pub fn plugins_dir(&self) -> &PathBuf {
        &self.plugins_dir
    }

    /// Scans the plugins directory for new plugins and adds them to the registry
    pub fn scan_plugins(&self) -> PluginResult<Vec<InstalledPlugin>> {
        let mut discovered = Vec::new();

        println!("[PluginManager] Scanning plugins directory: {:?}", self.plugins_dir);

        // Read all subdirectories in plugins_dir
        let entries = fs::read_dir(&self.plugins_dir)
            .map_err(|e| PluginError::storage_error(format!("Failed to read plugins directory {:?}: {}", self.plugins_dir, e)))?;

        for entry in entries {
            let entry = match entry {
                Ok(e) => e,
                Err(_) => continue,
            };

            let path = entry.path();
            if !path.is_dir() {
                continue;
            }

            // Look for manifest.json
            let manifest_path = path.join("manifest.json");
            if !manifest_path.exists() {
                continue;
            }

            // Read and parse manifest
            let manifest_content = match fs::read_to_string(&manifest_path) {
                Ok(c) => c,
                Err(e) => {
                    eprintln!("Failed to read manifest at {:?}: {}", manifest_path, e);
                    continue;
                }
            };

            let manifest: PluginManifest = match serde_json::from_str::<PluginManifest>(&manifest_content) {
                Ok(m) => m,
                Err(e) => {
                    eprintln!("[PluginManager] Failed to parse manifest at {:?}: {}", manifest_path, e);
                    continue;
                }
            };
            println!("[PluginManager] Found plugin: {} ({})", manifest.name, manifest.id);

            // Check if already in registry
            {
                let plugins = self.plugins.read()
                    .map_err(|_| PluginError::internal("Failed to acquire lock"))?;
                if plugins.contains_key(&manifest.id) {
                    // Already registered, skip
                    continue;
                }
            }

            // Install the discovered plugin
            match self.install_plugin(manifest, path.clone()) {
                Ok(plugin) => discovered.push(plugin),
                Err(e) => {
                    eprintln!("Failed to install plugin from {:?}: {}", path, e);
                }
            }
        }

        Ok(discovered)
    }

    /// Lists all installed plugins
    pub fn list_plugins(&self) -> PluginResult<Vec<InstalledPlugin>> {
        let plugins = self.plugins.read()
            .map_err(|_| PluginError::internal("Failed to acquire lock"))?;
        Ok(plugins.values().cloned().collect())
    }

    /// Gets a specific plugin by ID
    pub fn get_plugin(&self, id: &str) -> PluginResult<Option<InstalledPlugin>> {
        let plugins = self.plugins.read()
            .map_err(|_| PluginError::internal("Failed to acquire lock"))?;
        Ok(plugins.get(id).cloned())
    }

    /// Installs a plugin from a manifest
    pub fn install_plugin(&self, manifest: PluginManifest, install_path: PathBuf) -> PluginResult<InstalledPlugin> {
        // Validate API version compatibility
        if !is_api_compatible(&manifest.api_version) {
            return Err(PluginError::invalid_input(format!(
                "Plugin requires API version {} but current version is {}",
                manifest.api_version, API_VERSION
            )));
        }

        let plugin = InstalledPlugin {
            manifest: manifest.clone(),
            state: PluginState::Disabled,
            granted_permissions: GrantedPermissions::new(),
            install_path,
            error_message: None,
        };

        let mut plugins = self.plugins.write()
            .map_err(|_| PluginError::internal("Failed to acquire lock"))?;

        plugins.insert(manifest.id.clone(), plugin.clone());
        drop(plugins);

        self.save_registry()?;

        Ok(plugin)
    }

    /// Uninstalls a plugin
    pub fn uninstall_plugin(&self, id: &str) -> PluginResult<()> {
        let mut plugins = self.plugins.write()
            .map_err(|_| PluginError::internal("Failed to acquire lock"))?;

        let plugin = plugins.remove(id)
            .ok_or_else(|| PluginError::not_found(format!("Plugin not found: {}", id)))?;

        // Remove plugin directory
        if plugin.install_path.exists() {
            fs::remove_dir_all(&plugin.install_path)
                .map_err(|e| PluginError::storage_error(format!("Failed to remove plugin directory: {}", e)))?;
        }

        drop(plugins);
        self.save_registry()?;

        Ok(())
    }

    /// Enables a plugin
    pub fn enable_plugin(&self, id: &str) -> PluginResult<()> {
        let mut plugins = self.plugins.write()
            .map_err(|_| PluginError::internal("Failed to acquire lock"))?;

        let plugin = plugins.get_mut(id)
            .ok_or_else(|| PluginError::not_found(format!("Plugin not found: {}", id)))?;

        plugin.state = PluginState::Enabled;
        plugin.error_message = None;

        drop(plugins);
        self.save_registry()?;

        Ok(())
    }

    /// Disables a plugin
    pub fn disable_plugin(&self, id: &str) -> PluginResult<()> {
        let mut plugins = self.plugins.write()
            .map_err(|_| PluginError::internal("Failed to acquire lock"))?;

        let plugin = plugins.get_mut(id)
            .ok_or_else(|| PluginError::not_found(format!("Plugin not found: {}", id)))?;

        plugin.state = PluginState::Disabled;

        drop(plugins);
        self.save_registry()?;

        Ok(())
    }

    /// Grants a permission to a plugin
    pub fn grant_permission(&self, id: &str, permission: Permission) -> PluginResult<()> {
        let mut plugins = self.plugins.write()
            .map_err(|_| PluginError::internal("Failed to acquire lock"))?;

        let plugin = plugins.get_mut(id)
            .ok_or_else(|| PluginError::not_found(format!("Plugin not found: {}", id)))?;

        // Check if permission is in manifest
        if !plugin.manifest.permissions.contains(&permission) {
            return Err(PluginError::invalid_input(format!(
                "Permission {:?} is not declared in plugin manifest",
                permission
            )));
        }

        plugin.granted_permissions.grant(permission);

        drop(plugins);
        self.save_registry()?;

        Ok(())
    }

    /// Grants all requested permissions to a plugin
    pub fn grant_all_permissions(&self, id: &str) -> PluginResult<()> {
        let mut plugins = self.plugins.write()
            .map_err(|_| PluginError::internal("Failed to acquire lock"))?;

        let plugin = plugins.get_mut(id)
            .ok_or_else(|| PluginError::not_found(format!("Plugin not found: {}", id)))?;

        for permission in &plugin.manifest.permissions {
            plugin.granted_permissions.grant(*permission);
        }

        drop(plugins);
        self.save_registry()?;

        Ok(())
    }

    /// Revokes a permission from a plugin
    pub fn revoke_permission(&self, id: &str, permission: Permission) -> PluginResult<()> {
        let mut plugins = self.plugins.write()
            .map_err(|_| PluginError::internal("Failed to acquire lock"))?;

        let plugin = plugins.get_mut(id)
            .ok_or_else(|| PluginError::not_found(format!("Plugin not found: {}", id)))?;

        plugin.granted_permissions.revoke(permission);

        drop(plugins);
        self.save_registry()?;

        Ok(())
    }

    /// Gets the granted permissions for a plugin
    pub fn get_permissions(&self, id: &str) -> PluginResult<GrantedPermissions> {
        let plugins = self.plugins.read()
            .map_err(|_| PluginError::internal("Failed to acquire lock"))?;

        let plugin = plugins.get(id)
            .ok_or_else(|| PluginError::not_found(format!("Plugin not found: {}", id)))?;

        Ok(plugin.granted_permissions.clone())
    }

    /// Sets an error state for a plugin
    pub fn set_plugin_error(&self, id: &str, message: String) -> PluginResult<()> {
        let mut plugins = self.plugins.write()
            .map_err(|_| PluginError::internal("Failed to acquire lock"))?;

        let plugin = plugins.get_mut(id)
            .ok_or_else(|| PluginError::not_found(format!("Plugin not found: {}", id)))?;

        plugin.state = PluginState::Error;
        plugin.error_message = Some(message);

        drop(plugins);
        self.save_registry()?;

        Ok(())
    }

    /// Gets the data directory for a plugin (for sandboxed file access)
    pub fn get_plugin_data_dir(&self, id: &str) -> PluginResult<PathBuf> {
        let data_dir = self.plugins_dir.join("data").join(id);

        if !data_dir.exists() {
            fs::create_dir_all(&data_dir)
                .map_err(|e| PluginError::storage_error(format!("Failed to create plugin data directory: {}", e)))?;
        }

        Ok(data_dir)
    }
}

impl Default for PluginManager {
    fn default() -> Self {
        Self::new().expect("Failed to create plugin manager")
    }
}
