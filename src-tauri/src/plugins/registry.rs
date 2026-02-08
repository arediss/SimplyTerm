//! Plugin registry - fetch, search, download, and install plugins from remote registries

use super::error::{PluginError, PluginResult};
use super::manifest::PluginManifest;
use super::manager::PluginManager;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{Cursor, Read};
use std::path::PathBuf;

/// Default official registry URL
pub const DEFAULT_REGISTRY_URL: &str =
    "https://arediss.github.io/simplyterm-plugin-registry/plugins.json";

// ============================================================================
// Types
// ============================================================================

/// A configured plugin registry source
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegistrySource {
    /// Display name
    pub name: String,
    /// URL to the plugins.json index
    pub url: String,
    /// Whether this registry is enabled
    #[serde(default = "default_true")]
    pub enabled: bool,
}

fn default_true() -> bool {
    true
}

impl Default for RegistrySource {
    fn default() -> Self {
        Self {
            name: "Official".to_string(),
            url: DEFAULT_REGISTRY_URL.to_string(),
            enabled: true,
        }
    }
}

/// A plugin entry in the remote registry index
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegistryPlugin {
    /// Unique plugin identifier
    pub id: String,
    /// Display name
    pub name: String,
    /// Latest version
    pub version: String,
    /// Minimum required SimplyTerm API version
    pub api_version: String,
    /// Short description
    pub description: String,
    /// Author name
    pub author: String,
    /// Homepage URL
    #[serde(skip_serializing_if = "Option::is_none")]
    pub homepage: Option<String>,
    /// Source repository URL
    #[serde(skip_serializing_if = "Option::is_none")]
    pub repository: Option<String>,
    /// License identifier
    #[serde(skip_serializing_if = "Option::is_none")]
    pub license: Option<String>,
    /// Category
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
    /// Keywords for search
    #[serde(default)]
    pub keywords: Vec<String>,
    /// Required permissions
    #[serde(default)]
    pub permissions: Vec<String>,
    /// Download URL for the plugin zip
    pub download_url: String,
    /// SHA256 checksum of the zip file
    #[serde(skip_serializing_if = "Option::is_none")]
    pub checksum: Option<String>,
    /// Download count (informational)
    #[serde(default)]
    pub downloads: u64,
    /// Registry source name (filled client-side)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub registry: Option<String>,
}

/// The full registry index (plugins.json)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegistryIndex {
    /// Schema version for forward compatibility
    #[serde(default = "default_schema_version")]
    pub schema_version: u32,
    /// List of available plugins
    pub plugins: Vec<RegistryPlugin>,
    /// Last updated timestamp (ISO 8601)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
}

fn default_schema_version() -> u32 {
    1
}

/// Result of checking for updates
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginUpdate {
    /// Plugin ID
    pub id: String,
    /// Currently installed version
    pub current_version: String,
    /// Latest available version
    pub latest_version: String,
    /// Download URL for the update
    pub download_url: String,
    /// SHA256 checksum of the zip
    #[serde(skip_serializing_if = "Option::is_none")]
    pub checksum: Option<String>,
    /// Changelog/description
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

// ============================================================================
// Registry operations
// ============================================================================

/// Fetches the plugin index from a registry URL
pub async fn fetch_registry(url: &str) -> PluginResult<RegistryIndex> {
    let response = reqwest::get(url)
        .await
        .map_err(|e| PluginError::internal(format!("Failed to fetch registry: {}", e)))?;

    if !response.status().is_success() {
        return Err(PluginError::internal(format!(
            "Registry returned HTTP {}",
            response.status()
        )));
    }

    let index: RegistryIndex = response
        .json()
        .await
        .map_err(|e| PluginError::internal(format!("Failed to parse registry JSON: {}", e)))?;

    Ok(index)
}

/// Fetches plugins from all enabled registries
pub async fn fetch_all_registries(
    registries: &[RegistrySource],
) -> PluginResult<Vec<RegistryPlugin>> {
    let mut all_plugins = Vec::new();
    let mut last_error: Option<PluginError> = None;

    println!("[Registry] Fetching from {} registries", registries.len());

    for registry in registries {
        if !registry.enabled {
            println!("[Registry] Skipping disabled registry: {}", registry.name);
            continue;
        }

        println!("[Registry] Fetching from {} ({})", registry.name, registry.url);

        match fetch_registry(&registry.url).await {
            Ok(index) => {
                println!("[Registry] Got {} plugins from {}", index.plugins.len(), registry.name);
                for mut plugin in index.plugins {
                    plugin.registry = Some(registry.name.clone());
                    all_plugins.push(plugin);
                }
            }
            Err(e) => {
                println!("[Registry] ERROR from {}: {}", registry.name, e);
                last_error = Some(e);
            }
        }
    }

    // If we got no plugins and had errors, propagate the last error
    if all_plugins.is_empty() {
        if let Some(e) = last_error {
            return Err(e);
        }
    }

    Ok(all_plugins)
}

/// Searches plugins by query string (matches name, description, keywords, category)
pub fn search_plugins(plugins: &[RegistryPlugin], query: &str) -> Vec<RegistryPlugin> {
    let query_lower = query.to_lowercase();
    let terms: Vec<&str> = query_lower.split_whitespace().collect();

    plugins
        .iter()
        .filter(|p| {
            terms.iter().all(|term| {
                p.name.to_lowercase().contains(term)
                    || p.description.to_lowercase().contains(term)
                    || p.author.to_lowercase().contains(term)
                    || p.category
                        .as_ref()
                        .map_or(false, |c| c.to_lowercase().contains(term))
                    || p.keywords.iter().any(|k| k.to_lowercase().contains(term))
            })
        })
        .cloned()
        .collect()
}

/// Checks for available updates for installed plugins
pub fn check_updates(
    installed: &[super::manager::InstalledPlugin],
    registry_plugins: &[RegistryPlugin],
) -> Vec<PluginUpdate> {
    let mut updates = Vec::new();

    for installed_plugin in installed {
        if let Some(registry_plugin) = registry_plugins.iter().find(|r| r.id == installed_plugin.manifest.id) {
            if is_newer_version(&installed_plugin.manifest.version, &registry_plugin.version) {
                updates.push(PluginUpdate {
                    id: installed_plugin.manifest.id.clone(),
                    current_version: installed_plugin.manifest.version.clone(),
                    latest_version: registry_plugin.version.clone(),
                    download_url: registry_plugin.download_url.clone(),
                    checksum: registry_plugin.checksum.clone(),
                    description: Some(registry_plugin.description.clone()),
                });
            }
        }
    }

    updates
}

/// Simple semver comparison: returns true if `latest` is newer than `current`
fn is_newer_version(current: &str, latest: &str) -> bool {
    let parse = |v: &str| -> (u64, u64, u64) {
        let parts: Vec<&str> = v.split('-').next().unwrap_or(v).split('.').collect();
        (
            parts.first().and_then(|p| p.parse().ok()).unwrap_or(0),
            parts.get(1).and_then(|p| p.parse().ok()).unwrap_or(0),
            parts.get(2).and_then(|p| p.parse().ok()).unwrap_or(0),
        )
    };

    parse(latest) > parse(current)
}

/// Downloads and installs a plugin from a registry entry.
/// Returns the installed plugin's ID (from its manifest, which may differ from registry).
pub async fn download_and_install(
    plugin: &RegistryPlugin,
    plugin_manager: &PluginManager,
) -> PluginResult<String> {
    let plugins_dir = plugin_manager.plugins_dir();
    let plugin_dir = plugins_dir.join(&plugin.id);

    // Download the zip
    let response = reqwest::get(&plugin.download_url)
        .await
        .map_err(|e| PluginError::internal(format!("Failed to download plugin: {}", e)))?;

    if !response.status().is_success() {
        return Err(PluginError::internal(format!(
            "Download failed with HTTP {}",
            response.status()
        )));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| PluginError::internal(format!("Failed to read download: {}", e)))?;

    // Verify checksum (required for registry installs)
    match &plugin.checksum {
        Some(expected) => {
            let actual = sha256_hex(&bytes);
            if actual != *expected {
                return Err(PluginError::internal(format!(
                    "Checksum mismatch: expected {}, got {}. The plugin zip may have been tampered with.",
                    expected, actual
                )));
            }
        }
        None => {
            return Err(PluginError::internal(
                "Plugin has no checksum. Cannot verify integrity. Aborting install.".to_string(),
            ));
        }
    }

    // Remove existing plugin directory if present
    if plugin_dir.exists() {
        fs::remove_dir_all(&plugin_dir)
            .map_err(|e| PluginError::storage_error(format!("Failed to remove old plugin: {}", e)))?;
    }

    // Extract zip
    fs::create_dir_all(&plugin_dir)
        .map_err(|e| PluginError::storage_error(format!("Failed to create plugin dir: {}", e)))?;

    extract_zip(&bytes, &plugin_dir)?;

    // Read manifest from extracted files and install
    let manifest_path = plugin_dir.join("manifest.json");
    if !manifest_path.exists() {
        // Clean up and fail
        let _ = fs::remove_dir_all(&plugin_dir);
        return Err(PluginError::internal(
            "Downloaded plugin does not contain a manifest.json".to_string(),
        ));
    }

    let manifest_content = fs::read_to_string(&manifest_path)
        .map_err(|e| PluginError::storage_error(format!("Failed to read manifest: {}", e)))?;

    let manifest: PluginManifest = serde_json::from_str(&manifest_content)
        .map_err(|e| PluginError::internal(format!("Failed to parse manifest: {}", e)))?;

    let installed_id = manifest.id.clone();

    // Register with plugin manager
    plugin_manager.install_plugin(manifest, plugin_dir)?;

    Ok(installed_id)
}

// Zip bomb protection limits
const MAX_ZIP_FILES: usize = 100;
const MAX_FILE_SIZE: u64 = 10 * 1024 * 1024; // 10 MB per file
const MAX_TOTAL_SIZE: u64 = 50 * 1024 * 1024; // 50 MB total decompressed

/// Extracts a zip archive to a target directory with zip bomb protection
fn extract_zip(data: &[u8], target_dir: &PathBuf) -> PluginResult<()> {
    let cursor = Cursor::new(data);
    let mut archive = zip::ZipArchive::new(cursor)
        .map_err(|e| PluginError::internal(format!("Failed to open zip: {}", e)))?;

    // Security: limit number of entries
    if archive.len() > MAX_ZIP_FILES {
        return Err(PluginError::internal(format!(
            "Zip contains too many files ({}, max {}). Possible zip bomb.",
            archive.len(), MAX_ZIP_FILES
        )));
    }

    let mut total_size: u64 = 0;

    for i in 0..archive.len() {
        let mut file = archive
            .by_index(i)
            .map_err(|e| PluginError::internal(format!("Failed to read zip entry: {}", e)))?;

        let name = file.name().to_string();

        // Security: reject path traversal and absolute paths
        if name.contains("..") || name.starts_with('/') || name.starts_with('\\') {
            continue;
        }

        // Security: check declared uncompressed size before extracting
        let file_size = file.size();
        if file_size > MAX_FILE_SIZE {
            return Err(PluginError::internal(format!(
                "File '{}' is too large ({:.1} MB, max {} MB). Possible zip bomb.",
                name, file_size as f64 / 1_048_576.0, MAX_FILE_SIZE / 1_048_576
            )));
        }

        total_size += file_size;
        if total_size > MAX_TOTAL_SIZE {
            // Clean up what we've already extracted
            let _ = fs::remove_dir_all(target_dir);
            return Err(PluginError::internal(format!(
                "Total decompressed size exceeds {} MB. Possible zip bomb.",
                MAX_TOTAL_SIZE / 1_048_576
            )));
        }

        let out_path = target_dir.join(&name);

        // Security: verify resolved path stays inside target_dir
        let normalized = out_path.components().collect::<std::path::PathBuf>();
        let target_normalized = target_dir.components().collect::<std::path::PathBuf>();
        if !normalized.starts_with(&target_normalized) {
            continue;
        }

        if file.is_dir() {
            fs::create_dir_all(&out_path).map_err(|e| {
                PluginError::storage_error(format!("Failed to create dir {}: {}", name, e))
            })?;
        } else {
            // Ensure parent dir exists
            if let Some(parent) = out_path.parent() {
                fs::create_dir_all(parent).map_err(|e| {
                    PluginError::storage_error(format!("Failed to create parent dir: {}", e))
                })?;
            }

            let mut outfile = fs::File::create(&out_path).map_err(|e| {
                PluginError::storage_error(format!("Failed to create file {}: {}", name, e))
            })?;

            // Security: use limited copy instead of unbounded copy
            // This catches zip bombs where declared size is small but actual data is huge
            let mut limited = (&mut file).take(MAX_FILE_SIZE + 1);
            let copied = std::io::copy(&mut limited, &mut outfile)
                .map_err(|e| {
                    PluginError::storage_error(format!("Failed to write file {}: {}", name, e))
                })?;

            if copied > MAX_FILE_SIZE {
                let _ = fs::remove_dir_all(target_dir);
                return Err(PluginError::internal(format!(
                    "File '{}' exceeded max size during extraction. Possible zip bomb.",
                    name
                )));
            }
        }
    }

    Ok(())
}

/// Computes SHA256 hex digest
fn sha256_hex(data: &[u8]) -> String {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(data);
    hex::encode(hasher.finalize())
}
