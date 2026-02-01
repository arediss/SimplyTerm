//! Tauri commands for the vault system
//!
//! All commands for interacting with the vault from the frontend.

use std::sync::Arc;
use tauri::State;

use super::fido2::{self, SecurityKeyInfo};
use super::state::VaultState;
use super::types::{BastionAuthType, BastionProfile, BastionProfileInfo, VaultCredentialType, VaultStatus};

/// Store the vault state in Tauri's managed state
pub type VaultStateHandle = Arc<VaultState>;

/// Get the current vault status
#[tauri::command]
pub fn get_vault_status(vault: State<VaultStateHandle>) -> VaultStatus {
    vault.get_status()
}

/// Create a new vault
#[tauri::command]
pub fn create_vault(
    vault: State<VaultStateHandle>,
    master_password: String,
    auto_lock_timeout: u32,
    pin: Option<String>,
) -> Result<(), String> {
    if master_password.len() < 8 {
        return Err("Master password must be at least 8 characters".to_string());
    }

    vault.create(&master_password, auto_lock_timeout, pin.as_deref())
}

/// Unlock the vault with master password
#[tauri::command]
pub fn unlock_vault_with_password(
    vault: State<VaultStateHandle>,
    password: String,
) -> Result<(), String> {
    vault.unlock_with_password(&password)
}

/// Unlock the vault with PIN
#[tauri::command]
pub fn unlock_vault_with_pin(
    vault: State<VaultStateHandle>,
    pin: String,
) -> Result<(), String> {
    vault.unlock_with_pin(&pin)
}

/// Lock the vault
#[tauri::command]
pub fn lock_vault(vault: State<VaultStateHandle>) -> Result<(), String> {
    vault.lock()
}

/// Check if the vault is unlocked
#[tauri::command]
pub fn is_vault_unlocked(vault: State<VaultStateHandle>) -> bool {
    vault.is_unlocked()
}

/// Store a credential in the vault
#[tauri::command]
pub fn vault_store_credential(
    vault: State<VaultStateHandle>,
    session_id: String,
    cred_type: String,
    value: String,
) -> Result<(), String> {
    let cred_type = VaultCredentialType::from_str(&cred_type)
        .ok_or_else(|| format!("Invalid credential type: {}", cred_type))?;

    vault.store_credential(&session_id, cred_type, &value)
}

/// Get a credential from the vault
#[tauri::command]
pub fn vault_get_credential(
    vault: State<VaultStateHandle>,
    session_id: String,
    cred_type: String,
) -> Result<Option<String>, String> {
    let cred_type = VaultCredentialType::from_str(&cred_type)
        .ok_or_else(|| format!("Invalid credential type: {}", cred_type))?;

    vault.get_credential(&session_id, cred_type)
}

/// Delete a credential from the vault
#[tauri::command]
pub fn vault_delete_credential(
    vault: State<VaultStateHandle>,
    session_id: String,
    cred_type: String,
) -> Result<bool, String> {
    let cred_type = VaultCredentialType::from_str(&cred_type)
        .ok_or_else(|| format!("Invalid credential type: {}", cred_type))?;

    vault.delete_credential(&session_id, cred_type)
}

/// Delete all credentials for a session
#[tauri::command]
pub fn vault_delete_all_credentials(
    vault: State<VaultStateHandle>,
    session_id: String,
) -> Result<(), String> {
    vault.delete_all_credentials(&session_id)
}

/// Update vault settings
#[tauri::command]
pub fn update_vault_settings(
    vault: State<VaultStateHandle>,
    auto_lock_timeout: u32,
) -> Result<(), String> {
    vault.update_settings(auto_lock_timeout)
}

/// Change the master password
#[tauri::command]
pub fn change_master_password(
    vault: State<VaultStateHandle>,
    current: String,
    new_password: String,
) -> Result<(), String> {
    if new_password.len() < 8 {
        return Err("New password must be at least 8 characters".to_string());
    }

    vault.change_master_password(&current, &new_password)
}

/// Setup or change PIN
#[tauri::command]
pub fn setup_vault_pin(
    vault: State<VaultStateHandle>,
    pin: String,
) -> Result<(), String> {
    vault.setup_pin(&pin)
}

/// Remove PIN
#[tauri::command]
pub fn remove_vault_pin(vault: State<VaultStateHandle>) -> Result<(), String> {
    vault.remove_pin()
}

/// Delete the vault entirely
#[tauri::command]
pub fn delete_vault(
    vault: State<VaultStateHandle>,
    master_password: String,
) -> Result<(), String> {
    vault.delete(&master_password)
}

/// Check if auto-lock should be triggered (called periodically from frontend)
#[tauri::command]
pub fn check_vault_auto_lock(vault: State<VaultStateHandle>) -> Result<bool, String> {
    if vault.should_auto_lock() && vault.is_unlocked() {
        vault.lock()?;
        Ok(true)
    } else {
        Ok(false)
    }
}

/// Set whether vault unlock is required on each SSH connection
#[tauri::command]
pub fn set_vault_require_unlock_on_connect(
    vault: State<VaultStateHandle>,
    require: bool,
) -> Result<(), String> {
    vault.set_require_unlock_on_connect(require)
}

/// Check if vault unlock is required for connections
#[tauri::command]
pub fn get_vault_require_unlock_on_connect(vault: State<VaultStateHandle>) -> bool {
    vault.requires_unlock_on_connect()
}

// ============================================================================
// FIDO2 Security Key Commands
// ============================================================================

/// Check if FIDO2 security keys are available
#[tauri::command]
pub fn is_security_key_available() -> bool {
    fido2::is_fido2_available()
}

/// Detect connected FIDO2 security keys
#[tauri::command]
pub fn detect_security_keys() -> Result<Vec<SecurityKeyInfo>, String> {
    fido2::detect_security_keys()
}

/// Setup a security key for vault unlock
/// The user will need to touch their key during this process
#[tauri::command]
pub fn setup_vault_security_key(
    vault: State<VaultStateHandle>,
    pin: Option<String>,
) -> Result<(), String> {
    vault.setup_security_key(pin.as_deref())
}

/// Unlock the vault with a security key
/// The user will need to touch their key
#[tauri::command]
pub fn unlock_vault_with_security_key(
    vault: State<VaultStateHandle>,
    pin: Option<String>,
) -> Result<(), String> {
    vault.unlock_with_security_key(pin.as_deref())
}

/// Remove security key configuration
#[tauri::command]
pub fn remove_vault_security_key(vault: State<VaultStateHandle>) -> Result<(), String> {
    vault.remove_security_key()
}

// ============================================================================
// Bastion Profile Commands
// ============================================================================

/// List all bastion profiles (without sensitive data)
#[tauri::command]
pub fn list_bastions(vault: State<VaultStateHandle>) -> Result<Vec<BastionProfileInfo>, String> {
    vault.list_bastions()
}

/// Get a bastion profile by ID (without sensitive data)
#[tauri::command]
pub fn get_bastion(vault: State<VaultStateHandle>, id: String) -> Result<Option<BastionProfileInfo>, String> {
    vault.get_bastion_info(&id)
}

/// Get full bastion profile including credentials (for connection use)
#[tauri::command]
pub fn get_bastion_credentials(vault: State<VaultStateHandle>, id: String) -> Result<Option<BastionProfile>, String> {
    vault.get_bastion_with_credentials(&id)
}

/// Create a new bastion profile
#[tauri::command]
pub fn create_bastion(
    vault: State<VaultStateHandle>,
    name: String,
    host: String,
    port: u16,
    username: String,
    auth_type: String,
    password: Option<String>,
    key_path: Option<String>,
    key_passphrase: Option<String>,
) -> Result<BastionProfileInfo, String> {
    let auth = match auth_type.as_str() {
        "password" => BastionAuthType::Password,
        "key" => BastionAuthType::Key,
        _ => return Err(format!("Invalid auth type: {}", auth_type)),
    };

    vault.create_bastion(name, host, port, username, auth, password, key_path, key_passphrase)
}

/// Update a bastion profile
#[tauri::command]
pub fn update_bastion(
    vault: State<VaultStateHandle>,
    id: String,
    name: Option<String>,
    host: Option<String>,
    port: Option<u16>,
    username: Option<String>,
    auth_type: Option<String>,
    password: Option<String>,
    key_path: Option<String>,
    key_passphrase: Option<String>,
) -> Result<bool, String> {
    let auth = auth_type.map(|t| match t.as_str() {
        "password" => BastionAuthType::Password,
        _ => BastionAuthType::Key,
    });

    vault.update_bastion(&id, name, host, port, username, auth, password, key_path, key_passphrase)
}

/// Delete a bastion profile
#[tauri::command]
pub fn delete_bastion(vault: State<VaultStateHandle>, id: String) -> Result<bool, String> {
    vault.delete_bastion(&id)
}
