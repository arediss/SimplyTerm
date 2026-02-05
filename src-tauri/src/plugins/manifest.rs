//! Plugin manifest and permission definitions

use serde::{Deserialize, Serialize};
use std::collections::HashSet;

/// Plugin manifest defining metadata and required permissions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginManifest {
    /// Unique plugin identifier (e.g., "com.example.sync-plugin")
    pub id: String,
    /// Display name
    pub name: String,
    /// Plugin version (semver)
    pub version: String,
    /// Minimum required API version
    pub api_version: String,
    /// Plugin description
    pub description: String,
    /// Author name or organization
    pub author: String,
    /// Homepage or repository URL
    #[serde(skip_serializing_if = "Option::is_none")]
    pub homepage: Option<String>,
    /// Required permissions
    pub permissions: Vec<Permission>,
    /// Plugin entry point (relative path to main JS/TS file)
    pub main: String,
    /// Optional plugin icon (relative path)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
}

/// Available permissions for plugins
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Permission {
    // Session permissions
    /// Read session list and metadata
    SessionsRead,
    /// Create, update, delete sessions
    SessionsWrite,
    /// Connect to sessions (execute connections)
    SessionsConnect,
    /// Read plugin-specific session metadata
    SessionsMetadataRead,
    /// Write plugin-specific session metadata
    SessionsMetadataWrite,

    // Folder permissions
    /// Read folder structure
    FoldersRead,
    /// Create, update, delete folders
    FoldersWrite,

    // Vault permissions
    /// Check vault lock status
    VaultStatus,
    /// Read encrypted blobs from vault
    VaultRead,
    /// Write encrypted blobs to vault
    VaultWrite,

    // Settings permissions
    /// Read application settings
    SettingsRead,
    /// Modify application settings
    SettingsWrite,

    // Recent sessions
    /// Read recent sessions history
    RecentRead,
    /// Modify recent sessions history
    RecentWrite,

    // Events
    /// Subscribe to application events
    EventsSubscribe,
    /// Emit custom events
    EventsEmit,

    // Shell/Command execution
    /// Execute shell commands (restricted)
    ShellExecute,

    // Network
    /// Make HTTP requests
    NetworkHttp,
    /// WebSocket connections
    NetworkWebSocket,

    // File system (sandboxed)
    /// Read files in plugin data directory
    FsRead,
    /// Write files in plugin data directory
    FsWrite,

    // UI
    /// Register menu items
    UiMenu,
    /// Show notifications
    UiNotifications,
    /// Register settings panel
    UiSettings,
    /// Register custom panels
    UiPanels,
    /// Register commands in palette
    UiCommands,
    /// Display modal dialogs
    UiModals,
    /// Register sidebar sections
    UiSidebar,
    /// Register context menu items
    UiContextMenu,

    // Terminal
    /// Read terminal output
    TerminalRead,
    /// Write to terminal
    TerminalWrite,

    // Clipboard
    /// Read from clipboard
    ClipboardRead,
    /// Write to clipboard
    ClipboardWrite,

    // Bastion/Jump hosts
    /// Read bastion profiles
    BastionsRead,
    /// Manage bastion profiles
    BastionsWrite,

    // Known hosts
    /// Read known hosts
    KnownHostsRead,
    /// Manage known hosts
    KnownHostsWrite,
}

impl Permission {
    /// Returns a human-readable description of the permission
    pub fn description(&self) -> &'static str {
        match self {
            Permission::SessionsRead => "Read saved sessions and their configuration",
            Permission::SessionsWrite => "Create, modify, and delete saved sessions",
            Permission::SessionsConnect => "Initiate connections to remote hosts",
            Permission::SessionsMetadataRead => "Read plugin-specific session metadata",
            Permission::SessionsMetadataWrite => "Write plugin-specific session metadata",
            Permission::FoldersRead => "Read folder organization structure",
            Permission::FoldersWrite => "Create, modify, and delete folders",
            Permission::VaultStatus => "Check if the secure vault is locked or unlocked",
            Permission::VaultRead => "Read encrypted data from the secure vault",
            Permission::VaultWrite => "Store encrypted data in the secure vault",
            Permission::SettingsRead => "Read application settings and preferences",
            Permission::SettingsWrite => "Modify application settings and preferences",
            Permission::RecentRead => "Read recently used sessions history",
            Permission::RecentWrite => "Modify recently used sessions history",
            Permission::EventsSubscribe => "Listen to application events",
            Permission::EventsEmit => "Send custom events to other plugins",
            Permission::ShellExecute => "Execute shell commands on the local system",
            Permission::NetworkHttp => "Make HTTP/HTTPS requests to remote servers",
            Permission::NetworkWebSocket => "Establish WebSocket connections",
            Permission::FsRead => "Read files from plugin data directory",
            Permission::FsWrite => "Write files to plugin data directory",
            Permission::UiMenu => "Add items to application menus",
            Permission::UiNotifications => "Display system notifications",
            Permission::UiSettings => "Add a settings panel in preferences",
            Permission::UiPanels => "Register custom panels in the interface",
            Permission::UiCommands => "Register commands in the command palette",
            Permission::UiModals => "Display modal dialogs",
            Permission::UiSidebar => "Register sections in the sidebar",
            Permission::UiContextMenu => "Add items to context menus",
            Permission::TerminalRead => "Read terminal output",
            Permission::TerminalWrite => "Write data to terminal sessions",
            Permission::ClipboardRead => "Read content from system clipboard",
            Permission::ClipboardWrite => "Write content to system clipboard",
            Permission::BastionsRead => "Read bastion/jump host profiles",
            Permission::BastionsWrite => "Create, modify, and delete bastion profiles",
            Permission::KnownHostsRead => "Read SSH known hosts entries",
            Permission::KnownHostsWrite => "Manage SSH known hosts entries",
        }
    }

    /// Returns the risk level of the permission
    pub fn risk_level(&self) -> PermissionRisk {
        match self {
            // Low risk - read-only, non-sensitive
            Permission::SessionsRead
            | Permission::SessionsMetadataRead
            | Permission::FoldersRead
            | Permission::VaultStatus
            | Permission::SettingsRead
            | Permission::RecentRead
            | Permission::EventsSubscribe
            | Permission::FsRead
            | Permission::BastionsRead
            | Permission::KnownHostsRead => PermissionRisk::Low,

            // Medium risk - write access or network
            Permission::SessionsWrite
            | Permission::SessionsMetadataWrite
            | Permission::FoldersWrite
            | Permission::SettingsWrite
            | Permission::RecentWrite
            | Permission::EventsEmit
            | Permission::NetworkHttp
            | Permission::NetworkWebSocket
            | Permission::FsWrite
            | Permission::UiMenu
            | Permission::UiNotifications
            | Permission::UiSettings
            | Permission::UiPanels
            | Permission::UiCommands
            | Permission::UiModals
            | Permission::UiSidebar
            | Permission::UiContextMenu
            | Permission::TerminalRead
            | Permission::ClipboardRead
            | Permission::ClipboardWrite
            | Permission::BastionsWrite
            | Permission::KnownHostsWrite => PermissionRisk::Medium,

            // High risk - sensitive data or system access
            Permission::SessionsConnect
            | Permission::VaultRead
            | Permission::VaultWrite
            | Permission::ShellExecute
            | Permission::TerminalWrite => PermissionRisk::High,
        }
    }
}

/// Risk level for permissions
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PermissionRisk {
    Low,
    Medium,
    High,
}

/// Granted permissions for a plugin
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct GrantedPermissions {
    permissions: HashSet<Permission>,
}

impl GrantedPermissions {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn from_manifest(manifest: &PluginManifest) -> Self {
        Self {
            permissions: manifest.permissions.iter().copied().collect(),
        }
    }

    pub fn grant(&mut self, permission: Permission) {
        self.permissions.insert(permission);
    }

    pub fn revoke(&mut self, permission: Permission) {
        self.permissions.remove(&permission);
    }

    pub fn has(&self, permission: Permission) -> bool {
        self.permissions.contains(&permission)
    }

    pub fn all(&self) -> impl Iterator<Item = &Permission> {
        self.permissions.iter()
    }
}

/// Current API version
pub const API_VERSION: &str = "1.0.0";

/// Check if an API version is compatible with the current version
pub fn is_api_compatible(requested: &str) -> bool {
    // For now, just check major version
    let current_major: u32 = API_VERSION.split('.').next()
        .and_then(|s| s.parse().ok())
        .unwrap_or(1);

    let requested_major: u32 = requested.split('.').next()
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);

    current_major == requested_major
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_api_compatibility() {
        assert!(is_api_compatible("1.0.0"));
        assert!(is_api_compatible("1.5.0"));
        assert!(!is_api_compatible("2.0.0"));
        assert!(!is_api_compatible("0.9.0"));
    }

    #[test]
    fn test_granted_permissions() {
        let mut perms = GrantedPermissions::new();
        assert!(!perms.has(Permission::SessionsRead));

        perms.grant(Permission::SessionsRead);
        assert!(perms.has(Permission::SessionsRead));

        perms.revoke(Permission::SessionsRead);
        assert!(!perms.has(Permission::SessionsRead));
    }
}
