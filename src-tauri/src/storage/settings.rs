//! App settings persistence
//!
//! Saves and loads user settings to ~/.simplyterm/settings.json

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

/// Terminal settings
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalSettings {
    pub font_size: u32,
    pub font_family: String,
    pub cursor_style: String,
    pub cursor_blink: bool,
    pub scrollback: u32,
}

/// Appearance settings
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppearanceSettings {
    pub theme: String,
    pub accent_color: String,
    /// Window blur effect: "none", "acrylic", "mica"
    #[serde(default)]
    pub window_effect: String,
}

/// UI settings
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UiSettings {
    pub status_bar_visible: bool,
}

impl Default for UiSettings {
    fn default() -> Self {
        Self {
            status_bar_visible: false,
        }
    }
}

/// Security settings
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SecuritySettings {
    pub vault_setup_skipped: bool,
}

impl Default for SecuritySettings {
    fn default() -> Self {
        Self {
            vault_setup_skipped: false,
        }
    }
}

/// A configured plugin registry source (persisted in settings)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegistrySourceConfig {
    pub name: String,
    pub url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enabled: Option<bool>,
}

/// Developer settings
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeveloperSettings {
    pub enabled: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dev_plugins_path: Option<String>,
}

impl Default for DeveloperSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            dev_plugins_path: None,
        }
    }
}

/// Full app settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub terminal: TerminalSettings,
    pub appearance: AppearanceSettings,
    #[serde(default)]
    pub ui: UiSettings,
    #[serde(default)]
    pub security: SecuritySettings,
    /// Plugin registry sources (optional, defaults to official registry)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub plugin_registries: Option<Vec<RegistrySourceConfig>>,
    #[serde(default)]
    pub developer: DeveloperSettings,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            terminal: TerminalSettings {
                font_size: 13,
                font_family: "JetBrains Mono".to_string(),
                cursor_style: "bar".to_string(),
                cursor_blink: true,
                scrollback: 10000,
            },
            appearance: AppearanceSettings {
                theme: "dark".to_string(),
                accent_color: "#7DA6E8".to_string(),
                window_effect: "none".to_string(),
            },
            ui: UiSettings::default(),
            security: SecuritySettings::default(),
            plugin_registries: None,
            developer: DeveloperSettings::default(),
        }
    }
}

/// Get the settings file path
fn get_settings_path() -> Result<PathBuf, String> {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|_| "Could not determine home directory")?;

    let config_dir = PathBuf::from(home).join(".simplyterm");

    // Create directory if it doesn't exist
    if !config_dir.exists() {
        fs::create_dir_all(&config_dir)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }

    Ok(config_dir.join("settings.json"))
}

/// Load settings from disk
pub fn load_settings() -> Result<AppSettings, String> {
    let path = get_settings_path()?;

    if !path.exists() {
        return Ok(AppSettings::default());
    }

    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read settings: {}", e))?;

    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse settings: {}", e))
}

/// Save settings to disk
pub fn save_settings(settings: &AppSettings) -> Result<(), String> {
    let path = get_settings_path()?;

    let content = serde_json::to_string_pretty(settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;

    fs::write(&path, content)
        .map_err(|e| format!("Failed to write settings: {}", e))
}
