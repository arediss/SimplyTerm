//! Vault state management
//!
//! Manages the in-memory state of the vault (locked/unlocked),
//! handles persistence to disk, and auto-lock functionality.

use parking_lot::RwLock;
use std::fs;
use std::path::PathBuf;
use std::time::{Duration, Instant};

use super::crypto::{self, generate_nonce, generate_salt};
use super::fido2;
use super::types::{
    Fido2Config, MasterKey, PinConfig, SyncMeta, UnlockMethod, VaultBundle, VaultCredentialType,
    VaultData, VaultExportResult, VaultMeta, VaultStatus, VAULT_VERSION,
};

/// Detect available biometric type for this platform
fn detect_biometric() -> (bool, Option<String>) {
    #[cfg(target_os = "windows")]
    {
        // Windows Hello detection would go here
        // For now, return placeholder - actual implementation needs windows crate
        (false, Some("windows_hello".to_string()))
    }
    #[cfg(target_os = "macos")]
    {
        // Touch ID detection would go here
        // For now, return placeholder - actual implementation needs macOS APIs
        (false, Some("touch_id".to_string()))
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        (false, None)
    }
}

/// Vault state manager
pub struct VaultState {
    /// In-memory vault data (only available when unlocked)
    data: RwLock<Option<VaultData>>,
    /// Decrypted master key (only available when unlocked)
    master_key: RwLock<Option<MasterKey>>,
    /// Cached vault metadata
    meta: RwLock<Option<VaultMeta>>,
    /// Last activity timestamp for auto-lock
    last_activity: RwLock<Instant>,
    /// Config directory path
    config_dir: PathBuf,
}

impl VaultState {
    /// Create a new vault state manager
    pub fn new() -> Result<Self, String> {
        let config_dir = get_config_dir()?;
        Ok(Self {
            data: RwLock::new(None),
            master_key: RwLock::new(None),
            meta: RwLock::new(None),
            last_activity: RwLock::new(Instant::now()),
            config_dir,
        })
    }

    /// Get the vault metadata file path
    fn meta_path(&self) -> PathBuf {
        self.config_dir.join("vault.meta")
    }

    /// Get the vault data file path
    fn data_path(&self) -> PathBuf {
        self.config_dir.join("vault.enc")
    }

    /// Check if the vault exists
    pub fn exists(&self) -> bool {
        self.meta_path().exists() && self.data_path().exists()
    }

    /// Check if the vault is unlocked
    pub fn is_unlocked(&self) -> bool {
        self.master_key.read().is_some()
    }

    /// Update last activity timestamp
    fn touch(&self) {
        *self.last_activity.write() = Instant::now();
    }

    /// Check if auto-lock timeout has been reached
    pub fn should_auto_lock(&self) -> bool {
        let meta = self.meta.read();
        if let Some(ref m) = *meta {
            if m.auto_lock_timeout == 0 {
                return false; // Never auto-lock
            }
            let elapsed = self.last_activity.read().elapsed();
            return elapsed >= Duration::from_secs(m.auto_lock_timeout as u64);
        }
        false
    }

    /// Load vault metadata from disk
    fn load_meta(&self) -> Result<VaultMeta, String> {
        let path = self.meta_path();
        if !path.exists() {
            return Err("Vault does not exist".to_string());
        }

        let content = fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read vault metadata: {}", e))?;

        let meta: VaultMeta = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse vault metadata: {}", e))?;

        // Version check
        if meta.version > VAULT_VERSION {
            return Err(format!(
                "Vault version {} is not supported (max: {})",
                meta.version, VAULT_VERSION
            ));
        }

        Ok(meta)
    }

    /// Save vault metadata to disk
    fn save_meta(&self, meta: &VaultMeta) -> Result<(), String> {
        let content = serde_json::to_string_pretty(meta)
            .map_err(|e| format!("Failed to serialize vault metadata: {}", e))?;

        fs::write(self.meta_path(), content)
            .map_err(|e| format!("Failed to write vault metadata: {}", e))
    }

    /// Load and decrypt vault data from disk
    fn load_data(&self, key: &MasterKey, nonce: &str) -> Result<VaultData, String> {
        let path = self.data_path();
        if !path.exists() {
            return Ok(VaultData::default());
        }

        let ciphertext = fs::read(&path)
            .map_err(|e| format!("Failed to read vault data: {}", e))?;

        if ciphertext.is_empty() {
            return Ok(VaultData::default());
        }

        let plaintext = crypto::decrypt(&ciphertext, key, nonce)?;
        let data: VaultData = serde_json::from_slice(&plaintext)
            .map_err(|e| format!("Failed to parse vault data: {}", e))?;

        Ok(data)
    }

    /// Encrypt and save vault data to disk
    fn save_data(&self) -> Result<(), String> {
        let data = self.data.read();
        let key = self.master_key.read();
        let meta = self.meta.read();

        let data = data.as_ref().ok_or("Vault is locked")?;
        let key = key.as_ref().ok_or("Vault is locked")?;
        let meta = meta.as_ref().ok_or("Vault metadata not loaded")?;

        let plaintext = serde_json::to_vec(data)
            .map_err(|e| format!("Failed to serialize vault data: {}", e))?;

        let ciphertext = crypto::encrypt(&plaintext, key, &meta.nonce)?;

        fs::write(self.data_path(), ciphertext)
            .map_err(|e| format!("Failed to write vault data: {}", e))
    }

    /// Get vault status
    pub fn get_status(&self) -> VaultStatus {
        let meta = self.meta.read();
        let exists = self.exists();
        let is_unlocked = self.is_unlocked();
        let (biometric_available, biometric_type) = detect_biometric();

        if let Some(ref m) = *meta {
            let pin_attempts = m.pin_config.as_ref().map(|p| p.max_attempts.saturating_sub(p.failed_attempts));
            let pin_length = m.pin_config.as_ref().map(|p| p.length);
            VaultStatus {
                exists,
                is_unlocked,
                unlock_methods: m.unlock_methods.clone(),
                auto_lock_timeout: m.auto_lock_timeout,
                pin_attempts_remaining: pin_attempts,
                pin_length,
                require_unlock_on_connect: m.require_unlock_on_connect,
                biometric_available,
                biometric_type,
            }
        } else if exists {
            // Try to load metadata
            drop(meta);
            if let Ok(m) = self.load_meta() {
                let pin_attempts = m.pin_config.as_ref().map(|p| p.max_attempts.saturating_sub(p.failed_attempts));
                let pin_length = m.pin_config.as_ref().map(|p| p.length);
                let require_unlock = m.require_unlock_on_connect;
                let status = VaultStatus {
                    exists,
                    is_unlocked,
                    unlock_methods: m.unlock_methods.clone(),
                    auto_lock_timeout: m.auto_lock_timeout,
                    pin_attempts_remaining: pin_attempts,
                    pin_length,
                    require_unlock_on_connect: require_unlock,
                    biometric_available,
                    biometric_type,
                };
                *self.meta.write() = Some(m);
                status
            } else {
                VaultStatus {
                    exists: false,
                    is_unlocked: false,
                    unlock_methods: vec![],
                    auto_lock_timeout: 0,
                    pin_attempts_remaining: None,
                    pin_length: None,
                    require_unlock_on_connect: false,
                    biometric_available,
                    biometric_type,
                }
            }
        } else {
            VaultStatus {
                exists: false,
                is_unlocked: false,
                unlock_methods: vec![],
                auto_lock_timeout: 0,
                pin_attempts_remaining: None,
                pin_length: None,
                require_unlock_on_connect: false,
                biometric_available,
                biometric_type,
            }
        }
    }

    /// Create a new vault
    pub fn create(
        &self,
        master_password: &str,
        auto_lock_timeout: u32,
        pin: Option<&str>,
    ) -> Result<(), String> {
        if self.exists() {
            return Err("Vault already exists".to_string());
        }

        // Ensure config directory exists
        if !self.config_dir.exists() {
            fs::create_dir_all(&self.config_dir)
                .map_err(|e| format!("Failed to create config directory: {}", e))?;
        }

        // Generate cryptographic parameters
        let salt = generate_salt();
        let nonce = generate_nonce();

        // Derive master key
        let master_key = crypto::derive_key(master_password, &salt)?;

        // Set up unlock methods
        let mut unlock_methods = vec![UnlockMethod::MasterPassword];

        // Set up PIN if provided
        let pin_config = if let Some(pin_str) = pin {
            if pin_str.len() < 4 || pin_str.len() > 6 || !pin_str.chars().all(|c| c.is_ascii_digit()) {
                return Err("PIN must be 4-6 digits".to_string());
            }

            unlock_methods.push(UnlockMethod::Pin);

            let pin_salt = generate_salt();
            let pin_nonce = generate_nonce();
            let encrypted_master_key =
                crypto::encrypt_master_key_with_pin(&master_key, pin_str, &pin_salt, &pin_nonce)?;

            Some(PinConfig {
                length: pin_str.len() as u8,
                max_attempts: 3,
                failed_attempts: 0,
                encrypted_master_key,
                pin_salt,
                pin_nonce,
            })
        } else {
            None
        };

        // Create metadata
        let meta = VaultMeta {
            version: VAULT_VERSION,
            salt,
            nonce,
            unlock_methods,
            pin_config,
            biometric_config: None,
            fido2_config: None,
            yubikey_config: None,
            auto_lock_timeout,
            require_unlock_on_connect: false,
        };

        // Create empty data
        let data = VaultData::default();

        // Save metadata first
        self.save_meta(&meta)?;

        // Store in memory
        *self.meta.write() = Some(meta.clone());
        *self.master_key.write() = Some(master_key);
        *self.data.write() = Some(data);

        // Save encrypted data
        self.save_data()?;
        self.touch();

        Ok(())
    }

    /// Unlock the vault with master password
    pub fn unlock_with_password(&self, password: &str) -> Result<(), String> {
        let meta = self.load_meta()?;

        // Derive key and try to decrypt
        let master_key = crypto::derive_key(password, &meta.salt)?;
        let data = self.load_data(&master_key, &meta.nonce)?;

        // Success - store in memory
        *self.meta.write() = Some(meta);
        *self.master_key.write() = Some(master_key);
        *self.data.write() = Some(data);
        self.touch();

        // Reset PIN failed attempts on successful master password unlock
        self.reset_pin_attempts()?;

        Ok(())
    }

    /// Unlock the vault with PIN
    pub fn unlock_with_pin(&self, pin: &str) -> Result<(), String> {
        let mut meta = self.load_meta()?;

        let pin_config = meta
            .pin_config
            .as_mut()
            .ok_or("PIN not configured")?;

        // Check if PIN is locked out
        if pin_config.failed_attempts >= pin_config.max_attempts {
            return Err("PIN locked. Use master password to unlock.".to_string());
        }

        // Try to decrypt master key with PIN
        let result = crypto::decrypt_master_key_with_pin(
            &pin_config.encrypted_master_key,
            pin,
            &pin_config.pin_salt,
            &pin_config.pin_nonce,
        );

        match result {
            Ok(master_key) => {
                // Try to decrypt vault data to verify the key is correct
                match self.load_data(&master_key, &meta.nonce) {
                    Ok(data) => {
                        // Success - reset failed attempts and store in memory
                        pin_config.failed_attempts = 0;
                        self.save_meta(&meta)?;

                        *self.meta.write() = Some(meta);
                        *self.master_key.write() = Some(master_key);
                        *self.data.write() = Some(data);
                        self.touch();
                        Ok(())
                    }
                    Err(e) => {
                        // Key was wrong (shouldn't happen if PIN decryption succeeded)
                        pin_config.failed_attempts += 1;
                        self.save_meta(&meta)?;
                        Err(e)
                    }
                }
            }
            Err(_) => {
                // Wrong PIN
                pin_config.failed_attempts += 1;
                let remaining = pin_config.max_attempts.saturating_sub(pin_config.failed_attempts);
                self.save_meta(&meta)?;

                if remaining == 0 {
                    Err("PIN locked. Use master password to unlock.".to_string())
                } else {
                    Err(format!("Invalid PIN. {} attempts remaining.", remaining))
                }
            }
        }
    }

    /// Reset PIN failed attempts (called after successful master password unlock)
    fn reset_pin_attempts(&self) -> Result<(), String> {
        let mut meta = self.meta.write();
        if let Some(ref mut m) = *meta {
            if let Some(ref mut pin_config) = m.pin_config {
                if pin_config.failed_attempts > 0 {
                    pin_config.failed_attempts = 0;
                    drop(meta);
                    let m = self.meta.read();
                    if let Some(ref m) = *m {
                        self.save_meta(m)?;
                    }
                }
            }
        }
        Ok(())
    }

    /// Lock the vault
    pub fn lock(&self) -> Result<(), String> {
        // Save any pending changes
        if self.is_unlocked() {
            self.save_data()?;
        }

        // Clear sensitive data from memory
        *self.data.write() = None;
        *self.master_key.write() = None;

        Ok(())
    }

    /// Store a credential in the vault
    pub fn store_credential(
        &self,
        session_id: &str,
        cred_type: VaultCredentialType,
        value: &str,
    ) -> Result<(), String> {
        if !self.is_unlocked() {
            return Err("Vault is locked".to_string());
        }

        {
            let mut data = self.data.write();
            let data = data.as_mut().ok_or("Vault data not loaded")?;
            data.store_credential(session_id, cred_type, value.to_string());
        }

        self.save_data()?;
        self.touch();
        Ok(())
    }

    /// Get a credential from the vault
    pub fn get_credential(
        &self,
        session_id: &str,
        cred_type: VaultCredentialType,
    ) -> Result<Option<String>, String> {
        if !self.is_unlocked() {
            return Err("Vault is locked".to_string());
        }

        let data = self.data.read();
        let data = data.as_ref().ok_or("Vault data not loaded")?;

        self.touch();
        Ok(data.get_credential(session_id, cred_type).map(|c| c.value.clone()))
    }

    /// Delete a credential from the vault
    pub fn delete_credential(
        &self,
        session_id: &str,
        cred_type: VaultCredentialType,
    ) -> Result<bool, String> {
        if !self.is_unlocked() {
            return Err("Vault is locked".to_string());
        }

        let deleted = {
            let mut data = self.data.write();
            let data = data.as_mut().ok_or("Vault data not loaded")?;
            data.delete_credential(session_id, cred_type)
        };

        if deleted {
            self.save_data()?;
        }

        self.touch();
        Ok(deleted)
    }

    /// Delete all credentials for a session
    pub fn delete_all_credentials(&self, session_id: &str) -> Result<(), String> {
        if !self.is_unlocked() {
            return Err("Vault is locked".to_string());
        }

        {
            let mut data = self.data.write();
            let data = data.as_mut().ok_or("Vault data not loaded")?;
            data.delete_all_credentials(session_id);
        }

        self.save_data()?;
        self.touch();
        Ok(())
    }

    // ========================================================================
    // Encrypted Export/Import (for sync & backup)
    // ========================================================================

    /// Get or create a persistent device ID (UUID v4) stored in ~/.simplyterm/device_id
    fn get_or_create_device_id(&self) -> Result<String, String> {
        let path = self.config_dir.join("device_id");
        if path.exists() {
            let id = fs::read_to_string(&path)
                .map_err(|e| format!("Failed to read device_id: {}", e))?;
            let id = id.trim().to_string();
            if !id.is_empty() {
                return Ok(id);
            }
        }

        let id = uuid::Uuid::new_v4().to_string();
        fs::write(&path, &id)
            .map_err(|e| format!("Failed to write device_id: {}", e))?;
        Ok(id)
    }

    /// Export the encrypted vault as a bundle (vault.meta + vault.enc) with sync metadata.
    ///
    /// Does NOT require the vault to be unlocked — reads raw files from disk.
    /// The bundle contains only encrypted data, no plaintext is ever exposed.
    pub fn export_encrypted(&self) -> Result<VaultExportResult, String> {
        if !self.exists() {
            return Err("Vault does not exist".to_string());
        }

        // Read raw files
        let meta_json = fs::read_to_string(self.meta_path())
            .map_err(|e| format!("Failed to read vault.meta: {}", e))?;

        let enc_bytes = fs::read(self.data_path())
            .map_err(|e| format!("Failed to read vault.enc: {}", e))?;

        // Parse meta to get vault format version
        let meta: VaultMeta = serde_json::from_str(&meta_json)
            .map_err(|e| format!("Failed to parse vault.meta: {}", e))?;

        // Base64-encode the encrypted blob for JSON transport
        use base64::Engine;
        let enc_b64 = base64::engine::general_purpose::STANDARD.encode(&enc_bytes);

        // Compute SHA-256 over the concatenation of meta + enc (raw bytes)
        use sha2::{Digest, Sha256};
        let mut hasher = Sha256::new();
        hasher.update(meta_json.as_bytes());
        hasher.update(&enc_bytes);
        let hash = hasher.finalize();
        let blob_sha256 = hex::encode(hash);

        // Timestamp
        let updated_at = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);

        // Device ID
        let device_id = self.get_or_create_device_id()?;

        Ok(VaultExportResult {
            bundle: VaultBundle {
                vault_meta: meta_json,
                vault_enc_b64: enc_b64,
            },
            sync_meta: SyncMeta {
                format_version: 1,
                vault_format: meta.version,
                blob_sha256,
                updated_at,
                device_id,
            },
        })
    }

    /// Import an encrypted vault bundle, replacing the current vault files.
    ///
    /// Uses atomic write (temp file + rename) to prevent corruption.
    /// After import, the vault is locked and the user must re-unlock with their master password.
    /// Does NOT require the vault to be unlocked.
    pub fn import_encrypted(&self, bundle: VaultBundle) -> Result<SyncMeta, String> {
        // Validate the meta JSON is parseable
        let meta: VaultMeta = serde_json::from_str(&bundle.vault_meta)
            .map_err(|e| format!("Invalid vault metadata in bundle: {}", e))?;

        // Version check
        if meta.version > VAULT_VERSION {
            return Err(format!(
                "Vault version {} is not supported (max: {}). Update SimplyTerm first.",
                meta.version, VAULT_VERSION
            ));
        }

        // Decode the encrypted data
        use base64::Engine;
        let enc_bytes = base64::engine::general_purpose::STANDARD
            .decode(&bundle.vault_enc_b64)
            .map_err(|e| format!("Invalid base64 in vault bundle: {}", e))?;

        // Validate that enc_bytes is not empty
        if enc_bytes.is_empty() {
            return Err("Vault encrypted data is empty".to_string());
        }

        // Ensure config directory exists
        if !self.config_dir.exists() {
            fs::create_dir_all(&self.config_dir)
                .map_err(|e| format!("Failed to create config directory: {}", e))?;
        }

        // Compute SHA-256 for the sync meta response
        use sha2::{Digest, Sha256};
        let mut hasher = Sha256::new();
        hasher.update(bundle.vault_meta.as_bytes());
        hasher.update(&enc_bytes);
        let hash = hasher.finalize();
        let blob_sha256 = hex::encode(hash);

        // Atomic write: write to temp files, then rename
        let meta_tmp = self.config_dir.join("vault.meta.tmp");
        let enc_tmp = self.config_dir.join("vault.enc.tmp");

        // Write temp files
        fs::write(&meta_tmp, &bundle.vault_meta)
            .map_err(|e| format!("Failed to write temp vault.meta: {}", e))?;
        fs::write(&enc_tmp, &enc_bytes)
            .map_err(|e| {
                let _ = fs::remove_file(&meta_tmp); // Cleanup on failure
                format!("Failed to write temp vault.enc: {}", e)
            })?;

        // Rename atomically (on most filesystems)
        fs::rename(&meta_tmp, self.meta_path())
            .map_err(|e| {
                let _ = fs::remove_file(&meta_tmp);
                let _ = fs::remove_file(&enc_tmp);
                format!("Failed to replace vault.meta: {}", e)
            })?;
        fs::rename(&enc_tmp, self.data_path())
            .map_err(|e| {
                let _ = fs::remove_file(&enc_tmp);
                format!("Failed to replace vault.enc: {}", e)
            })?;

        // Lock vault: clear all in-memory state
        *self.data.write() = None;
        *self.master_key.write() = None;
        *self.meta.write() = None;

        let updated_at = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);

        let device_id = self.get_or_create_device_id()?;

        Ok(SyncMeta {
            format_version: 1,
            vault_format: meta.version,
            blob_sha256,
            updated_at,
            device_id,
        })
    }

    // ========================================================================
    // SSH Key Profile Methods
    // ========================================================================

    /// List all SSH key profiles (info only, no credentials)
    pub fn list_ssh_keys(&self) -> Result<Vec<super::types::SshKeyProfileInfo>, String> {
        if !self.is_unlocked() {
            return Err("Vault is locked".to_string());
        }

        let data = self.data.read();
        let data = data.as_ref().ok_or("Vault data not loaded")?;

        Ok(data.get_ssh_keys().iter().map(|k| k.into()).collect())
    }

    /// Get an SSH key profile info (without sensitive data)
    pub fn get_ssh_key_info(&self, id: &str) -> Result<Option<super::types::SshKeyProfileInfo>, String> {
        if !self.is_unlocked() {
            return Err("Vault is locked".to_string());
        }

        let data = self.data.read();
        let data = data.as_ref().ok_or("Vault data not loaded")?;

        Ok(data.get_ssh_key(id).map(|k| k.into()))
    }

    /// Get an SSH key profile with credentials (for actual connection use)
    pub fn get_ssh_key_with_credentials(&self, id: &str) -> Result<Option<super::types::SshKeyProfile>, String> {
        if !self.is_unlocked() {
            return Err("Vault is locked".to_string());
        }

        let data = self.data.read();
        let data = data.as_ref().ok_or("Vault data not loaded")?;

        self.touch();
        Ok(data.get_ssh_key(id).cloned())
    }

    /// Create a new SSH key profile
    pub fn create_ssh_key(
        &self,
        name: String,
        key_path: String,
        passphrase: Option<String>,
        require_passphrase_prompt: bool,
    ) -> Result<super::types::SshKeyProfileInfo, String> {
        if !self.is_unlocked() {
            return Err("Vault is locked".to_string());
        }

        let key = super::types::SshKeyProfile::new(
            name,
            key_path,
            passphrase,
            require_passphrase_prompt,
        );
        let info: super::types::SshKeyProfileInfo = (&key).into();

        {
            let mut data = self.data.write();
            let data = data.as_mut().ok_or("Vault data not loaded")?;
            data.store_ssh_key(key);
        }

        self.save_data()?;
        self.touch();
        Ok(info)
    }

    /// Update an existing SSH key profile
    pub fn update_ssh_key(
        &self,
        id: &str,
        name: Option<String>,
        key_path: Option<String>,
        passphrase: Option<String>,
        require_passphrase_prompt: Option<bool>,
    ) -> Result<bool, String> {
        if !self.is_unlocked() {
            return Err("Vault is locked".to_string());
        }

        let updated = {
            let mut data = self.data.write();
            let data = data.as_mut().ok_or("Vault data not loaded")?;
            data.update_ssh_key(
                id,
                super::types::SshKeyProfileUpdate {
                    name,
                    key_path,
                    passphrase,
                    require_passphrase_prompt,
                },
            )
        };

        if updated {
            self.save_data()?;
        }
        self.touch();
        Ok(updated)
    }

    /// Delete an SSH key profile
    pub fn delete_ssh_key(&self, id: &str) -> Result<bool, String> {
        if !self.is_unlocked() {
            return Err("Vault is locked".to_string());
        }

        let deleted = {
            let mut data = self.data.write();
            let data = data.as_mut().ok_or("Vault data not loaded")?;
            data.delete_ssh_key(id)
        };

        if deleted {
            self.save_data()?;
        }
        self.touch();
        Ok(deleted)
    }

    // ============================================================================
    // Folder Operations
    // ============================================================================

    /// Create a new folder
    pub fn create_folder(&self, name: &str) -> Result<super::types::VaultFolder, String> {
        if !self.is_unlocked() {
            return Err("Vault is locked".to_string());
        }

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);

        let folder = super::types::VaultFolder {
            id: uuid::Uuid::new_v4().to_string(),
            name: name.to_string(),
            created_at: now,
        };

        {
            let mut data = self.data.write();
            let data = data.as_mut().ok_or("Vault data not loaded")?;
            data.folders.push(folder.clone());
        }

        self.save_data()?;
        self.touch();
        Ok(folder)
    }

    /// Rename an existing folder
    pub fn rename_folder(&self, id: &str, name: &str) -> Result<bool, String> {
        if !self.is_unlocked() {
            return Err("Vault is locked".to_string());
        }

        let found = {
            let mut data = self.data.write();
            let data = data.as_mut().ok_or("Vault data not loaded")?;
            if let Some(folder) = data.folders.iter_mut().find(|f| f.id == id) {
                folder.name = name.to_string();
                true
            } else {
                false
            }
        };

        if found {
            self.save_data()?;
        }
        self.touch();
        Ok(found)
    }

    /// Delete a folder and unassign items that referenced it
    pub fn delete_folder(&self, id: &str) -> Result<bool, String> {
        if !self.is_unlocked() {
            return Err("Vault is locked".to_string());
        }

        let deleted = {
            let mut data = self.data.write();
            let data = data.as_mut().ok_or("Vault data not loaded")?;

            let len_before = data.folders.len();
            data.folders.retain(|f| f.id != id);
            let was_deleted = data.folders.len() < len_before;

            if was_deleted {
                // Unassign items that referenced this folder
                for ssh_key in &mut data.ssh_keys {
                    if ssh_key.folder_id.as_deref() == Some(id) {
                        ssh_key.folder_id = None;
                    }
                }
            }

            was_deleted
        };

        if deleted {
            self.save_data()?;
        }
        self.touch();
        Ok(deleted)
    }

    /// Set the folder for an SSH key profile
    pub fn set_ssh_key_folder(&self, id: &str, folder_id: Option<String>) -> Result<bool, String> {
        if !self.is_unlocked() {
            return Err("Vault is locked".to_string());
        }

        let found = {
            let mut data = self.data.write();
            let data = data.as_mut().ok_or("Vault data not loaded")?;

            if let Some(ssh_key) = data.ssh_keys.iter_mut().find(|k| k.id == id) {
                ssh_key.folder_id = folder_id;
                true
            } else {
                false
            }
        };

        if found {
            self.save_data()?;
        }
        self.touch();
        Ok(found)
    }

    /// List all folders
    pub fn list_folders(&self) -> Result<Vec<super::types::VaultFolder>, String> {
        if !self.is_unlocked() {
            return Err("Vault is locked".to_string());
        }

        let data = self.data.read();
        let data = data.as_ref().ok_or("Vault data not loaded")?;
        Ok(data.folders.clone())
    }

    // ============================================================================
    // Selective Export / Import
    // ============================================================================

    /// Export selected items encrypted with a dedicated password
    pub fn selective_export(
        &self,
        folder_ids: &[String],
        session_ids: &[String],
        ssh_key_ids: &[String],
        export_password: &str,
    ) -> Result<Vec<u8>, String> {
        use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};

        if !self.is_unlocked() {
            return Err("Vault is locked".to_string());
        }

        let data = self.data.read();
        let data = data.as_ref().ok_or("Vault data not loaded")?;

        // Collect selected folders
        let selected_folders: Vec<super::types::VaultFolder> = data
            .folders
            .iter()
            .filter(|f| folder_ids.contains(&f.id))
            .cloned()
            .collect();

        // Build set of IDs explicitly selected + IDs in selected folders
        let mut ssh_key_id_set: std::collections::HashSet<String> =
            ssh_key_ids.iter().cloned().collect();
        let mut session_id_set: std::collections::HashSet<String> =
            session_ids.iter().cloned().collect();

        // If a folder is selected, include all items in that folder
        for folder_id in folder_ids {
            for k in &data.ssh_keys {
                if k.folder_id.as_deref() == Some(folder_id) {
                    ssh_key_id_set.insert(k.id.clone());
                }
            }
        }

        // Collect selected SSH keys
        let selected_ssh_keys: Vec<super::types::SshKeyProfile> = data
            .ssh_keys
            .iter()
            .filter(|k| ssh_key_id_set.contains(&k.id))
            .cloned()
            .collect();

        // Load sessions from sessions.json
        let all_sessions = super::super::sessions::load_sessions()
            .unwrap_or_default();

        // Include sessions in selected folders
        for folder_id in folder_ids {
            for s in &all_sessions {
                if s.folder_id.as_deref() == Some(folder_id) {
                    session_id_set.insert(s.id.clone());
                }
            }
        }

        let selected_sessions: Vec<super::super::config::SavedSession> = all_sessions
            .into_iter()
            .filter(|s| session_id_set.contains(&s.id))
            .collect();

        // Collect credentials for selected sessions
        let selected_credentials: Vec<super::types::VaultCredential> = data
            .credentials
            .iter()
            .filter(|c| {
                if let Some(sid) = c.id.split(':').next() {
                    session_id_set.contains(sid)
                } else {
                    false
                }
            })
            .cloned()
            .collect();

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);

        let payload = super::types::SelectiveExportPayload {
            folders: selected_folders,
            sessions: selected_sessions,
            credentials: selected_credentials,
            ssh_keys: selected_ssh_keys,
            exported_at: now,
        };

        // Serialize payload
        let json = serde_json::to_vec(&payload)
            .map_err(|e| format!("Failed to serialize export payload: {}", e))?;

        // Encrypt with export password
        let salt = crypto::generate_salt();
        let nonce = crypto::generate_nonce();
        let key = crypto::derive_key(export_password, &salt)?;
        let encrypted = crypto::encrypt(&json, &key, &nonce)?;

        let export_file = super::types::SelectiveExportFile {
            version: 1,
            salt,
            nonce,
            encrypted_data: BASE64.encode(encrypted),
        };

        serde_json::to_vec_pretty(&export_file)
            .map_err(|e| format!("Failed to serialize export file: {}", e))
    }

    /// Preview a selective import file (decrypt and return names only)
    pub fn selective_import_preview(
        file_path: &str,
        import_password: &str,
    ) -> Result<super::types::ImportPreview, String> {
        let payload = Self::decrypt_export_file(file_path, import_password)?;

        Ok(super::types::ImportPreview {
            folders: payload.folders.iter().map(|f| f.name.clone()).collect(),
            sessions: payload.sessions.iter().map(|s| s.name.clone()).collect(),
            ssh_keys: payload.ssh_keys.iter().map(|k| k.name.clone()).collect(),
            exported_at: payload.exported_at,
        })
    }

    /// Execute a selective import (merge into current vault)
    pub fn selective_import_execute(
        &self,
        file_path: &str,
        import_password: &str,
    ) -> Result<super::types::ImportResult, String> {
        if !self.is_unlocked() {
            return Err("Vault is locked".to_string());
        }

        let payload = Self::decrypt_export_file(file_path, import_password)?;
        let mut result = super::types::ImportResult {
            folders_added: 0,
            sessions_added: 0,
            credentials_added: 0,
            ssh_keys_added: 0,
            duplicates_skipped: 0,
        };

        // Build ID remap tables
        let mut folder_remap: std::collections::HashMap<String, String> = std::collections::HashMap::new();
        let mut session_remap: std::collections::HashMap<String, String> = std::collections::HashMap::new();
        let mut ssh_key_remap: std::collections::HashMap<String, String> = std::collections::HashMap::new();

        // Load existing sessions for dedup
        let mut all_sessions = super::super::sessions::load_sessions().unwrap_or_default();

        {
            let mut data = self.data.write();
            let data = data.as_mut().ok_or("Vault data not loaded")?;

            // 1. Import folders (dedup by name)
            for folder in &payload.folders {
                if let Some(existing) = data.folders.iter().find(|f| f.name == folder.name) {
                    // Folder exists — remap to existing ID
                    folder_remap.insert(folder.id.clone(), existing.id.clone());
                    result.duplicates_skipped += 1;
                } else {
                    let new_id = uuid::Uuid::new_v4().to_string();
                    folder_remap.insert(folder.id.clone(), new_id.clone());
                    data.folders.push(super::types::VaultFolder {
                        id: new_id,
                        name: folder.name.clone(),
                        created_at: folder.created_at,
                    });
                    result.folders_added += 1;
                }
            }

            // 2. Import SSH keys (dedup by name + key_path)
            for ssh_key in &payload.ssh_keys {
                let is_dup = data.ssh_keys.iter().any(|k| k.name == ssh_key.name && k.key_path == ssh_key.key_path);
                if is_dup {
                    result.duplicates_skipped += 1;
                } else {
                    let new_id = uuid::Uuid::new_v4().to_string();
                    ssh_key_remap.insert(ssh_key.id.clone(), new_id.clone());
                    let mut new_key = ssh_key.clone();
                    new_key.id = new_id;
                    // Remap folder_id
                    new_key.folder_id = ssh_key.folder_id.as_ref().and_then(|fid| folder_remap.get(fid).cloned());
                    data.ssh_keys.push(new_key);
                    result.ssh_keys_added += 1;
                }
            }

            // 3. Import sessions (dedup by name + host + port + username)
            for session in &payload.sessions {
                let is_dup = all_sessions.iter().any(|s| {
                    s.name == session.name
                        && s.host == session.host
                        && s.port == session.port
                        && s.username == session.username
                });
                if is_dup {
                    result.duplicates_skipped += 1;
                } else {
                    let new_id = uuid::Uuid::new_v4().to_string();
                    session_remap.insert(session.id.clone(), new_id.clone());
                    let mut new_session = session.clone();
                    new_session.id = new_id;
                    // Remap folder_id
                    new_session.folder_id = session.folder_id.as_ref().and_then(|fid| folder_remap.get(fid).cloned());
                    // Remap ssh_key_id
                    new_session.ssh_key_id = session.ssh_key_id.as_ref().and_then(|kid| ssh_key_remap.get(kid).cloned());
                    all_sessions.push(new_session);
                    result.sessions_added += 1;
                }
            }

            // 4. Import credentials (remap session IDs)
            for cred in &payload.credentials {
                // Parse old session_id from credential ID (format: "session_id:type")
                let parts: Vec<&str> = cred.id.splitn(2, ':').collect();
                if parts.len() != 2 {
                    continue;
                }
                let old_session_id = parts[0];
                let cred_type = parts[1];

                if let Some(new_session_id) = session_remap.get(old_session_id) {
                    let new_cred_id = format!("{}:{}", new_session_id, cred_type);
                    // Only add if not already present
                    if !data.credentials.iter().any(|c| c.id == new_cred_id) {
                        let mut new_cred = cred.clone();
                        new_cred.id = new_cred_id;
                        data.credentials.push(new_cred);
                        result.credentials_added += 1;
                    }
                }
            }
        }

        // Save vault data and sessions
        self.save_data()?;
        super::super::sessions::save_sessions(&all_sessions)?;
        self.touch();

        Ok(result)
    }

    /// Helper: decrypt a selective export file
    fn decrypt_export_file(
        file_path: &str,
        password: &str,
    ) -> Result<super::types::SelectiveExportPayload, String> {
        use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};

        let content = std::fs::read_to_string(file_path)
            .map_err(|e| format!("Failed to read export file: {}", e))?;

        let export_file: super::types::SelectiveExportFile = serde_json::from_str(&content)
            .map_err(|e| format!("Invalid export file format: {}", e))?;

        if export_file.version != 1 {
            return Err(format!("Unsupported export version: {}", export_file.version));
        }

        let encrypted = BASE64.decode(&export_file.encrypted_data)
            .map_err(|e| format!("Failed to decode encrypted data: {}", e))?;

        let key = crypto::derive_key(password, &export_file.salt)?;
        let plaintext = crypto::decrypt(&encrypted, &key, &export_file.nonce)?;

        serde_json::from_slice(&plaintext)
            .map_err(|e| format!("Failed to parse decrypted payload: {}", e))
    }

    /// Update vault settings
    pub fn update_settings(&self, auto_lock_timeout: u32) -> Result<(), String> {
        if !self.is_unlocked() {
            return Err("Vault is locked".to_string());
        }

        let meta_clone = {
            let mut meta = self.meta.write();
            let meta = meta.as_mut().ok_or("Vault metadata not loaded")?;
            meta.auto_lock_timeout = auto_lock_timeout;
            meta.clone()
        };

        self.save_meta(&meta_clone)?;
        self.touch();
        Ok(())
    }

    /// Update require unlock on connect setting
    pub fn set_require_unlock_on_connect(&self, require: bool) -> Result<(), String> {
        if !self.is_unlocked() {
            return Err("Vault is locked".to_string());
        }

        let meta_clone = {
            let mut meta = self.meta.write();
            let meta = meta.as_mut().ok_or("Vault metadata not loaded")?;
            meta.require_unlock_on_connect = require;
            meta.clone()
        };

        self.save_meta(&meta_clone)?;
        self.touch();
        Ok(())
    }

    /// Check if vault unlock is required for connections
    pub fn requires_unlock_on_connect(&self) -> bool {
        let meta = self.meta.read();
        meta.as_ref().map(|m| m.require_unlock_on_connect).unwrap_or(false)
    }

    /// Change the master password
    pub fn change_master_password(&self, current: &str, new_password: &str) -> Result<(), String> {
        // Verify current password
        let mut meta = self.load_meta()?;
        let current_key = crypto::derive_key(current, &meta.salt)?;
        let data = self.load_data(&current_key, &meta.nonce)?;

        // Generate new cryptographic parameters
        let new_salt = generate_salt();
        let new_nonce = generate_nonce();
        let new_key = crypto::derive_key(new_password, &new_salt)?;

        // Re-encrypt PIN config if present
        if meta.pin_config.is_some() {
            // We need to re-encrypt the master key with the existing PIN
            // But we don't know the PIN, so we need to preserve the old encrypted key
            // Actually, we should update the encrypted master key with the new key
            // But we can't do that without the PIN...

            // The solution is to disable PIN and require the user to set it up again
            // Or we could ask for the PIN here, but that complicates the API

            // For now, just invalidate the PIN config and require re-setup
            meta.pin_config = None;
            meta.unlock_methods.retain(|m| *m != UnlockMethod::Pin);
        }

        // Update metadata
        meta.salt = new_salt;
        meta.nonce = new_nonce;

        // Save new metadata
        self.save_meta(&meta)?;

        // Update in-memory state
        *self.meta.write() = Some(meta);
        *self.master_key.write() = Some(new_key);
        *self.data.write() = Some(data);

        // Save data with new encryption
        self.save_data()?;
        self.touch();

        Ok(())
    }

    /// Setup or change PIN
    pub fn setup_pin(&self, pin: &str) -> Result<(), String> {
        if !self.is_unlocked() {
            return Err("Vault is locked".to_string());
        }

        if pin.len() < 4 || pin.len() > 6 || !pin.chars().all(|c| c.is_ascii_digit()) {
            return Err("PIN must be 4-6 digits".to_string());
        }

        let master_key = self.master_key.read();
        let master_key = master_key.as_ref().ok_or("Vault is locked")?;

        let pin_salt = generate_salt();
        let pin_nonce = generate_nonce();
        let encrypted_master_key =
            crypto::encrypt_master_key_with_pin(master_key, pin, &pin_salt, &pin_nonce)?;

        let meta_clone = {
            let mut meta = self.meta.write();
            let meta = meta.as_mut().ok_or("Vault metadata not loaded")?;

            meta.pin_config = Some(PinConfig {
                length: pin.len() as u8,
                max_attempts: 3,
                failed_attempts: 0,
                encrypted_master_key,
                pin_salt,
                pin_nonce,
            });

            if !meta.unlock_methods.contains(&UnlockMethod::Pin) {
                meta.unlock_methods.push(UnlockMethod::Pin);
            }

            meta.clone()
        };

        self.save_meta(&meta_clone)?;
        self.touch();

        Ok(())
    }

    /// Remove PIN
    pub fn remove_pin(&self) -> Result<(), String> {
        if !self.is_unlocked() {
            return Err("Vault is locked".to_string());
        }

        let meta_clone = {
            let mut meta = self.meta.write();
            let meta = meta.as_mut().ok_or("Vault metadata not loaded")?;

            meta.pin_config = None;
            meta.unlock_methods.retain(|m| *m != UnlockMethod::Pin);
            meta.clone()
        };

        self.save_meta(&meta_clone)?;
        self.touch();

        Ok(())
    }

    /// Setup FIDO2 security key for vault unlock
    ///
    /// Requires the vault to be unlocked. The user will need to touch their security key.
    pub fn setup_security_key(&self, pin: Option<&str>) -> Result<(), String> {
        if !self.is_unlocked() {
            return Err("Vault is locked".to_string());
        }

        // Register the security key - user will need to touch it twice
        let (credential_id, assertion_data) = fido2::register_security_key(pin)
            .map_err(|e| format!("Security key registration failed: {}", e))?;

        // Generate salt for key derivation
        let key_salt = generate_salt();

        // Derive encryption key from the assertion
        let derived_key = fido2::derive_key_from_assertion(&assertion_data, key_salt.as_bytes())
            .map_err(|e| format!("Key derivation failed: {}", e))?;

        // Encrypt the master key
        let master_key = self.master_key.read();
        let master_key = master_key.as_ref().ok_or("Vault is locked")?;

        let nonce = generate_nonce();
        let encrypted_master_key =
            crypto::encrypt_raw(master_key.as_bytes(), &derived_key, &nonce)?;

        let meta_clone = {
            let mut meta = self.meta.write();
            let meta = meta.as_mut().ok_or("Vault metadata not loaded")?;

            use base64::Engine;
            meta.fido2_config = Some(Fido2Config {
                credential_id: base64::engine::general_purpose::STANDARD.encode(&credential_id),
                public_key: String::new(), // Not needed for our use case
                encrypted_master_key: base64::engine::general_purpose::STANDARD
                    .encode(&encrypted_master_key),
                key_salt,
                nonce,
            });

            // Remove legacy yubikey config if present
            meta.yubikey_config = None;

            if !meta.unlock_methods.contains(&UnlockMethod::SecurityKey) {
                meta.unlock_methods.push(UnlockMethod::SecurityKey);
            }

            meta.clone()
        };

        self.save_meta(&meta_clone)?;
        self.touch();

        Ok(())
    }

    /// Unlock the vault with a FIDO2 security key
    ///
    /// The user will need to touch their security key.
    pub fn unlock_with_security_key(&self, pin: Option<&str>) -> Result<(), String> {
        let meta = self.load_meta()?;

        let fido2_config = meta
            .fido2_config
            .as_ref()
            .ok_or("Security key not configured")?;

        use base64::Engine;

        // Decode the credential ID
        let credential_id = base64::engine::general_purpose::STANDARD
            .decode(&fido2_config.credential_id)
            .map_err(|e| format!("Invalid credential ID: {}", e))?;

        // Authenticate with the security key - user will need to touch it
        let assertion_data = fido2::authenticate_with_security_key(&credential_id, pin)
            .map_err(|e| format!("Security key authentication failed: {}", e))?;

        // Derive the key from the assertion
        let derived_key =
            fido2::derive_key_from_assertion(&assertion_data, fido2_config.key_salt.as_bytes())
                .map_err(|e| format!("Key derivation failed: {}", e))?;

        // Decrypt the master key
        let encrypted_master_key = base64::engine::general_purpose::STANDARD
            .decode(&fido2_config.encrypted_master_key)
            .map_err(|e| format!("Invalid encrypted master key: {}", e))?;

        let master_key_bytes = crypto::decrypt_raw(
            &encrypted_master_key,
            &derived_key,
            &fido2_config.nonce,
        )
        .map_err(|_| "Failed to decrypt. Touch your security key again or use master password.")?;

        let master_key = MasterKey::new(master_key_bytes);

        // Try to load vault data to verify the key is correct
        let data = self.load_data(&master_key, &meta.nonce)?;

        // Success - store in memory
        *self.meta.write() = Some(meta);
        *self.master_key.write() = Some(master_key);
        *self.data.write() = Some(data);
        self.touch();

        Ok(())
    }

    /// Remove security key configuration
    pub fn remove_security_key(&self) -> Result<(), String> {
        if !self.is_unlocked() {
            return Err("Vault is locked".to_string());
        }

        let meta_clone = {
            let mut meta = self.meta.write();
            let meta = meta.as_mut().ok_or("Vault metadata not loaded")?;

            meta.fido2_config = None;
            meta.yubikey_config = None; // Also remove legacy config
            meta.unlock_methods.retain(|m| *m != UnlockMethod::SecurityKey);
            meta.clone()
        };

        self.save_meta(&meta_clone)?;
        self.touch();

        Ok(())
    }

    /// Delete the vault entirely
    pub fn delete(&self, master_password: &str) -> Result<(), String> {
        // Verify master password
        let meta = self.load_meta()?;
        let key = crypto::derive_key(master_password, &meta.salt)?;

        // Try to decrypt to verify password
        let _ = self.load_data(&key, &meta.nonce)?;

        // Clear in-memory state
        *self.data.write() = None;
        *self.master_key.write() = None;
        *self.meta.write() = None;

        // Delete files
        let _ = fs::remove_file(self.meta_path());
        let _ = fs::remove_file(self.data_path());

        Ok(())
    }
}

/// Get the config directory path
fn get_config_dir() -> Result<PathBuf, String> {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|_| "Could not determine home directory")?;

    Ok(PathBuf::from(home).join(".simplyterm"))
}
