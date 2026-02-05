//! Events API for plugins
//!
//! Provides event subscription and emission capabilities.
//! Plugins can listen to application events and emit custom events.
//! Requires: events_subscribe, events_emit permissions

use crate::plugins::error::PluginResult;
use crate::plugins::manifest::{GrantedPermissions, Permission};
use crate::plugins::permissions::require_permission;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use parking_lot::RwLock;

/// Application events that plugins can subscribe to
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AppEvent {
    /// Session connected
    SessionConnected,
    /// Session disconnected
    SessionDisconnected,
    /// Vault locked
    VaultLocked,
    /// Vault unlocked
    VaultUnlocked,
    /// Settings changed
    SettingsChanged,
    /// Theme changed
    ThemeChanged,
    /// Session created
    SessionCreated,
    /// Session updated
    SessionUpdated,
    /// Session deleted
    SessionDeleted,
    /// Folder created
    FolderCreated,
    /// Folder updated
    FolderUpdated,
    /// Folder deleted
    FolderDeleted,
    /// Tab opened
    TabOpened,
    /// Tab closed
    TabClosed,
    /// Tab switched
    TabSwitched,
}

impl AppEvent {
    /// Get all available events
    pub fn all() -> Vec<AppEvent> {
        vec![
            AppEvent::SessionConnected,
            AppEvent::SessionDisconnected,
            AppEvent::VaultLocked,
            AppEvent::VaultUnlocked,
            AppEvent::SettingsChanged,
            AppEvent::ThemeChanged,
            AppEvent::SessionCreated,
            AppEvent::SessionUpdated,
            AppEvent::SessionDeleted,
            AppEvent::FolderCreated,
            AppEvent::FolderUpdated,
            AppEvent::FolderDeleted,
            AppEvent::TabOpened,
            AppEvent::TabClosed,
            AppEvent::TabSwitched,
        ]
    }
}

/// Event data payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventPayload {
    /// Event type
    pub event: String,
    /// Event source (plugin ID or "app")
    pub source: String,
    /// Event timestamp (Unix milliseconds)
    pub timestamp: u64,
    /// Event-specific data
    pub data: serde_json::Value,
}

/// Event subscription
#[derive(Debug, Clone)]
pub struct EventSubscription {
    pub plugin_id: String,
    pub events: Vec<AppEvent>,
}

/// Event manager for handling subscriptions and emissions
pub struct EventManager {
    subscriptions: RwLock<HashMap<String, EventSubscription>>,
    pending_events: RwLock<HashMap<String, Vec<EventPayload>>>,
}

impl EventManager {
    pub fn new() -> Self {
        Self {
            subscriptions: RwLock::new(HashMap::new()),
            pending_events: RwLock::new(HashMap::new()),
        }
    }

    /// Subscribe a plugin to events
    pub fn subscribe(&self, plugin_id: &str, events: Vec<AppEvent>) {
        let mut subs = self.subscriptions.write();
        subs.insert(
            plugin_id.to_string(),
            EventSubscription {
                plugin_id: plugin_id.to_string(),
                events,
            },
        );

        // Ensure pending events queue exists
        let mut pending = self.pending_events.write();
        pending.entry(plugin_id.to_string()).or_insert_with(Vec::new);
    }

    /// Unsubscribe a plugin from all events
    pub fn unsubscribe(&self, plugin_id: &str) {
        let mut subs = self.subscriptions.write();
        subs.remove(plugin_id);

        let mut pending = self.pending_events.write();
        pending.remove(plugin_id);
    }

    /// Emit an application event to all subscribed plugins
    pub fn emit_app_event(&self, event: AppEvent, data: serde_json::Value) {
        let subs = self.subscriptions.read();
        let mut pending = self.pending_events.write();

        let payload = EventPayload {
            event: format!("{:?}", event).to_lowercase(),
            source: "app".to_string(),
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0),
            data,
        };

        for (plugin_id, sub) in subs.iter() {
            if sub.events.contains(&event) {
                if let Some(queue) = pending.get_mut(plugin_id) {
                    queue.push(payload.clone());
                }
            }
        }
    }

    /// Emit a custom event from a plugin
    pub fn emit_plugin_event(&self, source_plugin: &str, event_name: &str, data: serde_json::Value) {
        let mut pending = self.pending_events.write();

        let payload = EventPayload {
            event: format!("plugin:{}", event_name),
            source: source_plugin.to_string(),
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0),
            data,
        };

        // Deliver to all subscribed plugins except the source
        for (plugin_id, queue) in pending.iter_mut() {
            if plugin_id != source_plugin {
                queue.push(payload.clone());
            }
        }
    }

    /// Get pending events for a plugin
    pub fn get_pending_events(&self, plugin_id: &str) -> Vec<EventPayload> {
        let mut pending = self.pending_events.write();
        pending
            .get_mut(plugin_id)
            .map(|queue| std::mem::take(queue))
            .unwrap_or_default()
    }
}

impl Default for EventManager {
    fn default() -> Self {
        Self::new()
    }
}

// Global event manager instance
lazy_static::lazy_static! {
    pub static ref EVENT_MANAGER: EventManager = EventManager::new();
}

/// Subscribe to application events
pub fn subscribe_events(
    permissions: &GrantedPermissions,
    plugin_id: &str,
    events: Vec<AppEvent>,
) -> PluginResult<()> {
    require_permission(permissions, Permission::EventsSubscribe)?;

    EVENT_MANAGER.subscribe(plugin_id, events);
    Ok(())
}

/// Unsubscribe from all events
pub fn unsubscribe_events(
    permissions: &GrantedPermissions,
    plugin_id: &str,
) -> PluginResult<()> {
    require_permission(permissions, Permission::EventsSubscribe)?;

    EVENT_MANAGER.unsubscribe(plugin_id);
    Ok(())
}

/// Emit a custom plugin event
pub fn emit_event(
    permissions: &GrantedPermissions,
    plugin_id: &str,
    event_name: &str,
    data: serde_json::Value,
) -> PluginResult<()> {
    require_permission(permissions, Permission::EventsEmit)?;

    EVENT_MANAGER.emit_plugin_event(plugin_id, event_name, data);
    Ok(())
}

/// Get pending events for a plugin
pub fn get_pending_events(
    permissions: &GrantedPermissions,
    plugin_id: &str,
) -> PluginResult<Vec<EventPayload>> {
    require_permission(permissions, Permission::EventsSubscribe)?;

    Ok(EVENT_MANAGER.get_pending_events(plugin_id))
}

/// List available application events
pub fn list_available_events(
    permissions: &GrantedPermissions,
) -> PluginResult<Vec<String>> {
    require_permission(permissions, Permission::EventsSubscribe)?;

    Ok(AppEvent::all()
        .into_iter()
        .map(|e| format!("{:?}", e).to_lowercase())
        .collect())
}
