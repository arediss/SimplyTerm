//! Settings API for plugins
//!
//! Provides read/write access to application settings.
//! Requires: settings_read, settings_write permissions

use crate::plugins::error::{PluginError, PluginResult};
use crate::plugins::manifest::{GrantedPermissions, Permission};
use crate::plugins::permissions::require_permission;
use crate::storage::settings::{self, AppSettings};
use serde::{Deserialize, Serialize};

/// Settings exposed to plugins
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginSettings {
    pub terminal: PluginTerminalSettings,
    pub appearance: PluginAppearanceSettings,
    pub ui: PluginUiSettings,
}

/// Terminal settings
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginTerminalSettings {
    pub font_size: u32,
    pub font_family: String,
    pub cursor_style: String,
    pub cursor_blink: bool,
    pub scrollback: u32,
}

/// Appearance settings
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginAppearanceSettings {
    pub theme: String,
    pub accent_color: String,
}

/// UI settings
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginUiSettings {
    pub status_bar_visible: bool,
}

impl From<AppSettings> for PluginSettings {
    fn from(settings: AppSettings) -> Self {
        Self {
            terminal: PluginTerminalSettings {
                font_size: settings.terminal.font_size,
                font_family: settings.terminal.font_family,
                cursor_style: settings.terminal.cursor_style,
                cursor_blink: settings.terminal.cursor_blink,
                scrollback: settings.terminal.scrollback,
            },
            appearance: PluginAppearanceSettings {
                theme: settings.appearance.theme,
                accent_color: settings.appearance.accent_color,
            },
            ui: PluginUiSettings {
                status_bar_visible: settings.ui.status_bar_visible,
            },
        }
    }
}

/// Gets all application settings
pub fn get_settings(permissions: &GrantedPermissions) -> PluginResult<PluginSettings> {
    require_permission(permissions, Permission::SettingsRead)?;

    let settings = settings::load_settings()
        .map_err(|e| PluginError::storage_error(e))?;

    Ok(PluginSettings::from(settings))
}

/// Gets a specific setting value by path
pub fn get_setting(
    permissions: &GrantedPermissions,
    path: &str,
) -> PluginResult<serde_json::Value> {
    require_permission(permissions, Permission::SettingsRead)?;

    let settings = settings::load_settings()
        .map_err(|e| PluginError::storage_error(e))?;

    let json = serde_json::to_value(&settings)
        .map_err(|e| PluginError::internal(format!("Failed to serialize settings: {}", e)))?;

    // Navigate the path
    let parts: Vec<&str> = path.split('.').collect();
    let mut current = &json;

    for part in parts {
        current = current.get(part)
            .ok_or_else(|| PluginError::not_found(format!("Setting not found: {}", path)))?;
    }

    Ok(current.clone())
}

/// Updates terminal settings
pub fn update_terminal_settings(
    permissions: &GrantedPermissions,
    font_size: Option<u32>,
    font_family: Option<String>,
    cursor_style: Option<String>,
    cursor_blink: Option<bool>,
    scrollback: Option<u32>,
) -> PluginResult<PluginTerminalSettings> {
    require_permission(permissions, Permission::SettingsWrite)?;

    let mut settings = settings::load_settings()
        .map_err(|e| PluginError::storage_error(e))?;

    if let Some(size) = font_size {
        settings.terminal.font_size = size;
    }
    if let Some(family) = font_family {
        settings.terminal.font_family = family;
    }
    if let Some(style) = cursor_style {
        settings.terminal.cursor_style = style;
    }
    if let Some(blink) = cursor_blink {
        settings.terminal.cursor_blink = blink;
    }
    if let Some(lines) = scrollback {
        settings.terminal.scrollback = lines;
    }

    settings::save_settings(&settings)
        .map_err(|e| PluginError::storage_error(e))?;

    Ok(PluginTerminalSettings {
        font_size: settings.terminal.font_size,
        font_family: settings.terminal.font_family,
        cursor_style: settings.terminal.cursor_style,
        cursor_blink: settings.terminal.cursor_blink,
        scrollback: settings.terminal.scrollback,
    })
}

/// Updates appearance settings
pub fn update_appearance_settings(
    permissions: &GrantedPermissions,
    theme: Option<String>,
    accent_color: Option<String>,
) -> PluginResult<PluginAppearanceSettings> {
    require_permission(permissions, Permission::SettingsWrite)?;

    let mut settings = settings::load_settings()
        .map_err(|e| PluginError::storage_error(e))?;

    if let Some(t) = theme {
        settings.appearance.theme = t;
    }
    if let Some(color) = accent_color {
        settings.appearance.accent_color = color;
    }

    settings::save_settings(&settings)
        .map_err(|e| PluginError::storage_error(e))?;

    Ok(PluginAppearanceSettings {
        theme: settings.appearance.theme,
        accent_color: settings.appearance.accent_color,
    })
}

/// Updates UI settings
pub fn update_ui_settings(
    permissions: &GrantedPermissions,
    status_bar_visible: Option<bool>,
) -> PluginResult<PluginUiSettings> {
    require_permission(permissions, Permission::SettingsWrite)?;

    let mut settings = settings::load_settings()
        .map_err(|e| PluginError::storage_error(e))?;

    if let Some(visible) = status_bar_visible {
        settings.ui.status_bar_visible = visible;
    }

    settings::save_settings(&settings)
        .map_err(|e| PluginError::storage_error(e))?;

    Ok(PluginUiSettings {
        status_bar_visible: settings.ui.status_bar_visible,
    })
}
