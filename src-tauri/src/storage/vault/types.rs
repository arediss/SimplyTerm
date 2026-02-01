//! Types for the vault system
//!
//! Defines all structures for vault metadata, data, and configuration.

use serde::{Deserialize, Serialize};
use zeroize::Zeroize;

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

    /// Get the session ID from the credential ID
    #[allow(dead_code)]
    pub fn session_id(&self) -> Option<&str> {
        self.id.split(':').next()
    }

    /// Get the credential type from the credential ID
    #[allow(dead_code)]
    pub fn credential_type(&self) -> Option<VaultCredentialType> {
        self.id.split(':').nth(1).and_then(VaultCredentialType::from_str)
    }
}

/// Authentication method for bastion profiles
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BastionAuthType {
    Password,
    Key,
}

/// A bastion/jump host profile stored in the vault
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BastionProfile {
    /// Unique identifier (UUID)
    pub id: String,
    /// Display name for the profile
    pub name: String,
    /// Bastion host address
    pub host: String,
    /// SSH port (default: 22)
    pub port: u16,
    /// Username for authentication
    pub username: String,
    /// Authentication type
    pub auth_type: BastionAuthType,
    /// Password (if auth_type is Password)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub password: Option<String>,
    /// Path to SSH key file (if auth_type is Key)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub key_path: Option<String>,
    /// Passphrase for encrypted key (if auth_type is Key)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub key_passphrase: Option<String>,
    /// Creation timestamp (Unix seconds)
    pub created_at: u64,
    /// Last update timestamp (Unix seconds)
    pub updated_at: u64,
}

impl BastionProfile {
    /// Create a new bastion profile
    pub fn new(
        name: String,
        host: String,
        port: u16,
        username: String,
        auth_type: BastionAuthType,
        password: Option<String>,
        key_path: Option<String>,
        key_passphrase: Option<String>,
    ) -> Self {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);

        Self {
            id: uuid::Uuid::new_v4().to_string(),
            name,
            host,
            port,
            username,
            auth_type,
            password,
            key_path,
            key_passphrase,
            created_at: now,
            updated_at: now,
        }
    }
}

impl Drop for BastionProfile {
    fn drop(&mut self) {
        // Zeroize sensitive fields
        if let Some(ref mut pwd) = self.password {
            pwd.zeroize();
        }
        if let Some(ref mut passphrase) = self.key_passphrase {
            passphrase.zeroize();
        }
    }
}

/// Partial update for bastion profiles
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct BastionProfileUpdate {
    pub name: Option<String>,
    pub host: Option<String>,
    pub port: Option<u16>,
    pub username: Option<String>,
    pub auth_type: Option<BastionAuthType>,
    pub password: Option<String>,
    pub key_path: Option<String>,
    pub key_passphrase: Option<String>,
}

/// Bastion profile info for frontend (without sensitive data)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BastionProfileInfo {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_type: BastionAuthType,
    pub has_password: bool,
    pub key_path: Option<String>,
    pub has_key_passphrase: bool,
    pub created_at: u64,
    pub updated_at: u64,
}

impl From<&BastionProfile> for BastionProfileInfo {
    fn from(profile: &BastionProfile) -> Self {
        Self {
            id: profile.id.clone(),
            name: profile.name.clone(),
            host: profile.host.clone(),
            port: profile.port,
            username: profile.username.clone(),
            auth_type: profile.auth_type.clone(),
            has_password: profile.password.is_some(),
            key_path: profile.key_path.clone(),
            has_key_passphrase: profile.key_passphrase.is_some(),
            created_at: profile.created_at,
            updated_at: profile.updated_at,
        }
    }
}

/// Vault data (stored encrypted in vault.enc)
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct VaultData {
    /// All stored credentials
    pub credentials: Vec<VaultCredential>,
    /// Bastion/jump host profiles
    #[serde(default)]
    pub bastions: Vec<BastionProfile>,
}

impl Drop for VaultData {
    fn drop(&mut self) {
        // Manually zeroize all credential values
        for cred in &mut self.credentials {
            cred.value.zeroize();
        }
        // Bastions are zeroized via their own Drop impl
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

    /// Get all bastion profiles
    pub fn get_bastions(&self) -> &[BastionProfile] {
        &self.bastions
    }

    /// Get a bastion profile by ID
    pub fn get_bastion(&self, id: &str) -> Option<&BastionProfile> {
        self.bastions.iter().find(|b| b.id == id)
    }

    /// Store a new bastion profile
    pub fn store_bastion(&mut self, bastion: BastionProfile) {
        // Remove existing if updating
        self.bastions.retain(|b| b.id != bastion.id);
        self.bastions.push(bastion);
    }

    /// Update an existing bastion profile
    pub fn update_bastion(&mut self, id: &str, updates: BastionProfileUpdate) -> bool {
        if let Some(bastion) = self.bastions.iter_mut().find(|b| b.id == id) {
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0);

            if let Some(name) = updates.name {
                bastion.name = name;
            }
            if let Some(host) = updates.host {
                bastion.host = host;
            }
            if let Some(port) = updates.port {
                bastion.port = port;
            }
            if let Some(username) = updates.username {
                bastion.username = username;
            }
            if let Some(auth_type) = updates.auth_type {
                bastion.auth_type = auth_type;
            }
            if updates.password.is_some() {
                bastion.password = updates.password;
            }
            if updates.key_path.is_some() {
                bastion.key_path = updates.key_path;
            }
            if updates.key_passphrase.is_some() {
                bastion.key_passphrase = updates.key_passphrase;
            }
            bastion.updated_at = now;
            true
        } else {
            false
        }
    }

    /// Delete a bastion profile
    pub fn delete_bastion(&mut self, id: &str) -> bool {
        let len_before = self.bastions.len();
        self.bastions.retain(|b| b.id != id);
        self.bastions.len() < len_before
    }
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
