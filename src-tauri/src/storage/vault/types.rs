//! Types for the vault system
//!
//! Defines all structures for vault metadata, data, and configuration.

use serde::{Deserialize, Serialize};
use zeroize::Zeroize;

use super::super::config::SavedSession;

/// Version of the vault format
pub const VAULT_VERSION: u32 = 1;

/// Unlock methods available for the vault
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum UnlockMethod {
    MasterPassword,
    Pin,
    Biometric,
    /// FIDO2 security key (YubiKey, SoloKey, Google Titan, etc.)
    #[serde(alias = "yubikey")] // Backward compatibility
    SecurityKey,
}

/// PIN configuration stored in vault metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PinConfig {
    /// PIN length (4-6 digits)
    pub length: u8,
    /// Maximum failed attempts before lockout
    pub max_attempts: u8,
    /// Current failed attempts count
    pub failed_attempts: u8,
    /// Master key encrypted with PIN-derived key (base64)
    pub encrypted_master_key: String,
    /// Salt for PIN key derivation (base64)
    pub pin_salt: String,
    /// Nonce for PIN encryption (base64)
    pub pin_nonce: String,
}

/// Biometric configuration stored in vault metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BiometricConfig {
    /// Biometric type (windows_hello, touch_id)
    pub biometric_type: String,
    /// Master key encrypted with biometric-protected key (base64)
    pub encrypted_master_key: String,
    /// Platform-specific key identifier
    pub key_id: String,
}

/// FIDO2 security key configuration stored in vault metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Fido2Config {
    /// Credential ID (base64 encoded)
    pub credential_id: String,
    /// Public key (base64 encoded COSE key)
    pub public_key: String,
    /// Master key encrypted with FIDO2-derived key (base64)
    pub encrypted_master_key: String,
    /// Salt for key derivation (base64)
    pub key_salt: String,
    /// Nonce for encryption (base64)
    pub nonce: String,
}

/// Legacy YubiKey configuration (for backward compatibility)
/// Will be migrated to Fido2Config on next unlock
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct YubikeyConfig {
    pub serial: String,
    pub slot: u8,
    pub encrypted_master_key: String,
    pub challenge_salt: String,
    pub nonce: String,
}

/// Vault metadata (stored unencrypted in vault.meta)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultMeta {
    /// Vault format version
    pub version: u32,
    /// Salt for master password key derivation (base64, 32 bytes)
    pub salt: String,
    /// Nonce for AES-GCM encryption (base64, 12 bytes)
    pub nonce: String,
    /// Configured unlock methods
    pub unlock_methods: Vec<UnlockMethod>,
    /// PIN configuration (if PIN is enabled)
    pub pin_config: Option<PinConfig>,
    /// Biometric configuration (if biometric is enabled)
    #[serde(default)]
    pub biometric_config: Option<BiometricConfig>,
    /// FIDO2 security key configuration (if security key is enabled)
    #[serde(default)]
    pub fido2_config: Option<Fido2Config>,
    /// Legacy YubiKey configuration (for backward compatibility, will be migrated)
    #[serde(default)]
    pub yubikey_config: Option<YubikeyConfig>,
    /// Auto-lock timeout in seconds (0 = never)
    pub auto_lock_timeout: u32,
    /// Require vault unlock on each SSH connection (maximum security)
    #[serde(default)]
    pub require_unlock_on_connect: bool,
}

impl Default for VaultMeta {
    fn default() -> Self {
        Self {
            version: VAULT_VERSION,
            salt: String::new(),
            nonce: String::new(),
            unlock_methods: vec![UnlockMethod::MasterPassword],
            pin_config: None,
            biometric_config: None,
            fido2_config: None,
            yubikey_config: None,
            auto_lock_timeout: 300, // 5 minutes default
            require_unlock_on_connect: false,
        }
    }
}

/// Type of credential stored in the vault
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum VaultCredentialType {
    Password,
    KeyPassphrase,
}

impl VaultCredentialType {
    pub fn as_str(&self) -> &'static str {
        match self {
            VaultCredentialType::Password => "password",
            VaultCredentialType::KeyPassphrase => "key_passphrase",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "password" => Some(VaultCredentialType::Password),
            "key_passphrase" => Some(VaultCredentialType::KeyPassphrase),
            _ => None,
        }
    }
}

/// A single credential stored in the vault
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultCredential {
    /// Unique identifier: "session_id:type"
    pub id: String,
    /// The secret value
    pub value: String,
    /// Creation timestamp (Unix seconds)
    pub created_at: u64,
    /// Last update timestamp (Unix seconds)
    pub updated_at: u64,
}

impl VaultCredential {
    /// Create a new credential
    pub fn new(session_id: &str, cred_type: VaultCredentialType, value: String) -> Self {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);

        Self {
            id: format!("{}:{}", session_id, cred_type.as_str()),
            value,
            created_at: now,
            updated_at: now,
        }
    }

}

/// An SSH key profile stored in the vault
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SshKeyProfile {
    /// Unique identifier (UUID)
    pub id: String,
    /// Display name for the profile
    pub name: String,
    /// Path to the SSH key file
    pub key_path: String,
    /// Passphrase for encrypted key (if stored)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub passphrase: Option<String>,
    /// Whether to prompt for passphrase on every connection
    #[serde(default)]
    pub require_passphrase_prompt: bool,
    /// Folder ID (optional)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub folder_id: Option<String>,
    /// Creation timestamp (Unix seconds)
    pub created_at: u64,
    /// Last update timestamp (Unix seconds)
    pub updated_at: u64,
}

impl SshKeyProfile {
    pub fn new(
        name: String,
        key_path: String,
        passphrase: Option<String>,
        require_passphrase_prompt: bool,
    ) -> Self {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);

        Self {
            id: uuid::Uuid::new_v4().to_string(),
            name,
            key_path,
            passphrase,
            require_passphrase_prompt,
            folder_id: None,
            created_at: now,
            updated_at: now,
        }
    }
}

impl Drop for SshKeyProfile {
    fn drop(&mut self) {
        if let Some(ref mut passphrase) = self.passphrase {
            passphrase.zeroize();
        }
    }
}

/// Partial update for SSH key profiles
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SshKeyProfileUpdate {
    pub name: Option<String>,
    pub key_path: Option<String>,
    pub passphrase: Option<String>,
    pub require_passphrase_prompt: Option<bool>,
}

/// SSH key profile info for frontend (without sensitive data)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SshKeyProfileInfo {
    pub id: String,
    pub name: String,
    pub key_path: String,
    pub has_passphrase: bool,
    pub require_passphrase_prompt: bool,
    pub folder_id: Option<String>,
    pub created_at: u64,
    pub updated_at: u64,
}

impl From<&SshKeyProfile> for SshKeyProfileInfo {
    fn from(profile: &SshKeyProfile) -> Self {
        Self {
            id: profile.id.clone(),
            name: profile.name.clone(),
            key_path: profile.key_path.clone(),
            has_passphrase: profile.passphrase.is_some(),
            require_passphrase_prompt: profile.require_passphrase_prompt,
            folder_id: profile.folder_id.clone(),
            created_at: profile.created_at,
            updated_at: profile.updated_at,
        }
    }
}

/// A folder for organizing vault items
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultFolder {
    /// Unique identifier (UUID)
    pub id: String,
    /// Display name
    pub name: String,
    /// Creation timestamp (Unix seconds)
    pub created_at: u64,
}

/// Vault data (stored encrypted in vault.enc)
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct VaultData {
    /// All stored credentials
    pub credentials: Vec<VaultCredential>,
    /// SSH key profiles
    #[serde(default)]
    pub ssh_keys: Vec<SshKeyProfile>,
    /// Folders for organizing items
    #[serde(default)]
    pub folders: Vec<VaultFolder>,
}

impl Drop for VaultData {
    fn drop(&mut self) {
        // Manually zeroize all credential values
        for cred in &mut self.credentials {
            cred.value.zeroize();
        }
        // SSH keys are zeroized via their own Drop impl
    }
}

impl VaultData {
    /// Find a credential by session ID and type
    pub fn get_credential(&self, session_id: &str, cred_type: VaultCredentialType) -> Option<&VaultCredential> {
        let id = format!("{}:{}", session_id, cred_type.as_str());
        self.credentials.iter().find(|c| c.id == id)
    }

    /// Store or update a credential
    pub fn store_credential(&mut self, session_id: &str, cred_type: VaultCredentialType, value: String) {
        let id = format!("{}:{}", session_id, cred_type.as_str());
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);

        if let Some(cred) = self.credentials.iter_mut().find(|c| c.id == id) {
            cred.value = value;
            cred.updated_at = now;
        } else {
            self.credentials.push(VaultCredential::new(session_id, cred_type, value));
        }
    }

    /// Delete a credential
    pub fn delete_credential(&mut self, session_id: &str, cred_type: VaultCredentialType) -> bool {
        let id = format!("{}:{}", session_id, cred_type.as_str());
        let len_before = self.credentials.len();
        self.credentials.retain(|c| c.id != id);
        self.credentials.len() < len_before
    }

    /// Delete all credentials for a session
    pub fn delete_all_credentials(&mut self, session_id: &str) {
        let prefix = format!("{}:", session_id);
        self.credentials.retain(|c| !c.id.starts_with(&prefix));
    }

    /// Get all SSH key profiles
    pub fn get_ssh_keys(&self) -> &[SshKeyProfile] {
        &self.ssh_keys
    }

    /// Get an SSH key profile by ID
    pub fn get_ssh_key(&self, id: &str) -> Option<&SshKeyProfile> {
        self.ssh_keys.iter().find(|k| k.id == id)
    }

    /// Store a new SSH key profile
    pub fn store_ssh_key(&mut self, key: SshKeyProfile) {
        self.ssh_keys.retain(|k| k.id != key.id);
        self.ssh_keys.push(key);
    }

    /// Update an existing SSH key profile
    pub fn update_ssh_key(&mut self, id: &str, updates: SshKeyProfileUpdate) -> bool {
        if let Some(key) = self.ssh_keys.iter_mut().find(|k| k.id == id) {
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0);

            if let Some(name) = updates.name {
                key.name = name;
            }
            if let Some(key_path) = updates.key_path {
                key.key_path = key_path;
            }
            if updates.passphrase.is_some() {
                key.passphrase = updates.passphrase;
            }
            if let Some(require_prompt) = updates.require_passphrase_prompt {
                key.require_passphrase_prompt = require_prompt;
            }
            key.updated_at = now;
            true
        } else {
            false
        }
    }

    /// Delete an SSH key profile
    pub fn delete_ssh_key(&mut self, id: &str) -> bool {
        let len_before = self.ssh_keys.len();
        self.ssh_keys.retain(|k| k.id != id);
        self.ssh_keys.len() < len_before
    }
}

/// Encrypted vault bundle for sync/backup (no plaintext)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultBundle {
    /// Raw vault.meta JSON content
    pub vault_meta: String,
    /// Base64-encoded vault.enc content
    pub vault_enc_b64: String,
}

/// Sync metadata for conflict detection and diagnostics
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncMeta {
    /// Version of this sync meta schema
    pub format_version: u32,
    /// Vault format version (from VaultMeta.version)
    pub vault_format: u32,
    /// SHA-256 hash of the bundle (vault_meta + vault_enc concatenated)
    pub blob_sha256: String,
    /// Unix timestamp of the export
    pub updated_at: u64,
    /// UUID of the device that produced this export
    pub device_id: String,
}

/// Combined export result: bundle + sync metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultExportResult {
    pub bundle: VaultBundle,
    pub sync_meta: SyncMeta,
}

/// Vault status for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultStatus {
    /// Whether the vault exists
    pub exists: bool,
    /// Whether the vault is currently unlocked
    pub is_unlocked: bool,
    /// Configured unlock methods
    pub unlock_methods: Vec<UnlockMethod>,
    /// Auto-lock timeout in seconds
    pub auto_lock_timeout: u32,
    /// Remaining PIN attempts (if PIN is configured and locked)
    pub pin_attempts_remaining: Option<u8>,
    /// PIN length (if PIN is configured)
    pub pin_length: Option<u8>,
    /// Require vault unlock on each SSH connection
    pub require_unlock_on_connect: bool,
    /// Whether biometric is available on this platform
    pub biometric_available: bool,
    /// Type of biometric available (windows_hello, touch_id, none)
    pub biometric_type: Option<String>,
}

/// Master key wrapper with automatic zeroization
#[derive(Clone)]
pub struct MasterKey(pub Vec<u8>);

impl Drop for MasterKey {
    fn drop(&mut self) {
        self.0.zeroize();
    }
}

impl MasterKey {
    pub fn new(key: Vec<u8>) -> Self {
        Self(key)
    }

    pub fn as_bytes(&self) -> &[u8] {
        &self.0
    }
}

impl std::fmt::Debug for MasterKey {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("MasterKey").field("0", &"[REDACTED]").finish()
    }
}

// ============================================================================
// Selective Export / Import Types
// ============================================================================

/// Selective export file format (.stvault)
#[derive(Debug, Serialize, Deserialize)]
pub struct SelectiveExportFile {
    pub version: u32,
    /// Base64-encoded Argon2id salt
    pub salt: String,
    /// Base64-encoded AES-GCM nonce
    pub nonce: String,
    /// Base64-encoded encrypted payload
    pub encrypted_data: String,
}

/// Decrypted payload inside a selective export file
#[derive(Debug, Serialize, Deserialize)]
pub struct SelectiveExportPayload {
    pub folders: Vec<VaultFolder>,
    pub sessions: Vec<SavedSession>,
    pub credentials: Vec<VaultCredential>,
    pub ssh_keys: Vec<SshKeyProfile>,
    pub exported_at: u64,
}

/// Preview of an import file (no sensitive data)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportPreview {
    pub folders: Vec<String>,
    pub sessions: Vec<String>,
    pub ssh_keys: Vec<String>,
    pub exported_at: u64,
}

/// Result counters after an import
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportResult {
    pub folders_added: u32,
    pub sessions_added: u32,
    pub credentials_added: u32,
    pub ssh_keys_added: u32,
    pub duplicates_skipped: u32,
}
