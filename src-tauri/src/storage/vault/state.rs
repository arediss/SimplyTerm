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
    Fido2Config, MasterKey, PinConfig, UnlockMethod, VaultCredentialType, VaultData, VaultMeta,
    VaultStatus, VAULT_VERSION,
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
        if let Some(ref mut pin_config) = meta.pin_config {
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
