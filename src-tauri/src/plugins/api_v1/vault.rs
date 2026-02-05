//! Vault API for plugins
//!
//! Provides limited access to vault status and plugin-specific blob storage.
//! Plugins cannot access session credentials directly.
//! Requires: vault_status, vault_read, vault_write permissions

use crate::plugins::error::{PluginError, PluginResult};
use crate::plugins::manifest::{GrantedPermissions, Permission};
use crate::plugins::permissions::require_permission;
use crate::storage::vault::{VaultCredentialType, VaultState};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

/// Vault status information exposed to plugins
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginVaultStatus {
    pub exists: bool,
    pub is_unlocked: bool,
}

/// Gets the vault status (exists, locked/unlocked)
pub fn get_vault_status(
    permissions: &GrantedPermissions,
    vault: &Arc<VaultState>,
) -> PluginResult<PluginVaultStatus> {
    require_permission(permissions, Permission::VaultStatus)?;

    let status = vault.get_status();
    Ok(PluginVaultStatus {
        exists: status.exists,
        is_unlocked: status.is_unlocked,
    })
}

/// Plugin-specific blob storage key prefix
const PLUGIN_BLOB_PREFIX: &str = "plugin:";

/// Generates a storage key for plugin blobs
fn plugin_blob_key(plugin_id: &str, key: &str) -> String {
    format!("{}{}:{}", PLUGIN_BLOB_PREFIX, plugin_id, key)
}

/// Stores an encrypted blob in the vault for a plugin
///
/// The blob is stored under a namespaced key to prevent conflicts.
/// Plugins can only access their own blobs.
pub fn store_blob(
    permissions: &GrantedPermissions,
    vault: &Arc<VaultState>,
    plugin_id: &str,
    key: &str,
    value: &str,
) -> PluginResult<()> {
    require_permission(permissions, Permission::VaultWrite)?;

    if !vault.is_unlocked() {
        return Err(PluginError::vault_locked());
    }

    let storage_key = plugin_blob_key(plugin_id, key);

    vault
        .store_credential(&storage_key, VaultCredentialType::Password, value)
        .map_err(|e| PluginError::storage_error(e))
}

/// Reads an encrypted blob from the vault for a plugin
pub fn read_blob(
    permissions: &GrantedPermissions,
    vault: &Arc<VaultState>,
    plugin_id: &str,
    key: &str,
) -> PluginResult<Option<String>> {
    require_permission(permissions, Permission::VaultRead)?;

    if !vault.is_unlocked() {
        return Err(PluginError::vault_locked());
    }

    let storage_key = plugin_blob_key(plugin_id, key);

    vault
        .get_credential(&storage_key, VaultCredentialType::Password)
        .map_err(|e| PluginError::storage_error(e))
}

/// Deletes an encrypted blob from the vault
pub fn delete_blob(
    permissions: &GrantedPermissions,
    vault: &Arc<VaultState>,
    plugin_id: &str,
    key: &str,
) -> PluginResult<bool> {
    require_permission(permissions, Permission::VaultWrite)?;

    if !vault.is_unlocked() {
        return Err(PluginError::vault_locked());
    }

    let storage_key = plugin_blob_key(plugin_id, key);

    vault
        .delete_credential(&storage_key, VaultCredentialType::Password)
        .map_err(|e| PluginError::storage_error(e))
}

/// Lists all blob keys for a plugin
pub fn list_blob_keys(
    permissions: &GrantedPermissions,
    vault: &Arc<VaultState>,
    plugin_id: &str,
) -> PluginResult<Vec<String>> {
    require_permission(permissions, Permission::VaultRead)?;

    if !vault.is_unlocked() {
        return Err(PluginError::vault_locked());
    }

    // Since we don't have direct access to list credentials,
    // this would need to be implemented in VaultState.
    // For now, return an empty list as a placeholder.
    // TODO: Add list_plugin_blobs to VaultState

    let _ = plugin_id; // Silence unused warning for now
    Ok(Vec::new())
}
