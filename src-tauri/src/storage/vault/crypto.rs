//! Cryptographic operations for the vault
//!
//! Uses AES-256-GCM for encryption and Argon2id for key derivation.

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use argon2::{Argon2, Params, Version};
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use rand::RngCore;

use super::types::MasterKey;

/// Argon2id parameters (OWASP recommendations)
/// - Memory: 64 MB
/// - Iterations: 3
/// - Parallelism: 4
const ARGON2_M_COST: u32 = 65536; // 64 MB in KB
const ARGON2_T_COST: u32 = 3;     // 3 iterations
const ARGON2_P_COST: u32 = 4;     // 4 threads

/// Key length for AES-256
const KEY_LENGTH: usize = 32;

/// Nonce length for AES-GCM
const NONCE_LENGTH: usize = 12;

/// Salt length
const SALT_LENGTH: usize = 32;

/// Generate random bytes
pub fn generate_random_bytes(length: usize) -> Vec<u8> {
    let mut bytes = vec![0u8; length];
    rand::thread_rng().fill_bytes(&mut bytes);
    bytes
}

/// Generate a random salt (32 bytes, base64 encoded)
pub fn generate_salt() -> String {
    BASE64.encode(generate_random_bytes(SALT_LENGTH))
}

/// Generate a random nonce (12 bytes, base64 encoded)
pub fn generate_nonce() -> String {
    BASE64.encode(generate_random_bytes(NONCE_LENGTH))
}

/// Derive a key from a password using Argon2id
pub fn derive_key(password: &str, salt_b64: &str) -> Result<MasterKey, String> {
    let salt_bytes = BASE64.decode(salt_b64)
        .map_err(|e| format!("Failed to decode salt: {}", e))?;

    // Create Argon2id hasher with our parameters
    let params = Params::new(ARGON2_M_COST, ARGON2_T_COST, ARGON2_P_COST, Some(KEY_LENGTH))
        .map_err(|e| format!("Failed to create Argon2 params: {}", e))?;

    let argon2 = Argon2::new(argon2::Algorithm::Argon2id, Version::V0x13, params);

    // Derive the key
    let mut key = vec![0u8; KEY_LENGTH];
    argon2
        .hash_password_into(password.as_bytes(), &salt_bytes, &mut key)
        .map_err(|e| format!("Failed to derive key: {}", e))?;

    Ok(MasterKey::new(key))
}

/// Derive a key from a PIN (faster parameters for PIN)
pub fn derive_pin_key(pin: &str, salt_b64: &str) -> Result<MasterKey, String> {
    let salt_bytes = BASE64.decode(salt_b64)
        .map_err(|e| format!("Failed to decode salt: {}", e))?;

    // Lighter parameters for PIN (since PIN has limited entropy anyway)
    // - Memory: 16 MB
    // - Iterations: 2
    // - Parallelism: 2
    let params = Params::new(16384, 2, 2, Some(KEY_LENGTH))
        .map_err(|e| format!("Failed to create Argon2 params: {}", e))?;

    let argon2 = Argon2::new(argon2::Algorithm::Argon2id, Version::V0x13, params);

    let mut key = vec![0u8; KEY_LENGTH];
    argon2
        .hash_password_into(pin.as_bytes(), &salt_bytes, &mut key)
        .map_err(|e| format!("Failed to derive PIN key: {}", e))?;

    Ok(MasterKey::new(key))
}

/// Encrypt data using AES-256-GCM
pub fn encrypt(data: &[u8], key: &MasterKey, nonce_b64: &str) -> Result<Vec<u8>, String> {
    let nonce_bytes = BASE64.decode(nonce_b64)
        .map_err(|e| format!("Failed to decode nonce: {}", e))?;

    if nonce_bytes.len() != NONCE_LENGTH {
        return Err(format!("Invalid nonce length: expected {}, got {}", NONCE_LENGTH, nonce_bytes.len()));
    }

    let cipher = Aes256Gcm::new_from_slice(key.as_bytes())
        .map_err(|e| format!("Failed to create cipher: {}", e))?;

    let nonce = Nonce::from_slice(&nonce_bytes);

    cipher
        .encrypt(nonce, data)
        .map_err(|e| format!("Encryption failed: {}", e))
}

/// Decrypt data using AES-256-GCM
pub fn decrypt(ciphertext: &[u8], key: &MasterKey, nonce_b64: &str) -> Result<Vec<u8>, String> {
    let nonce_bytes = BASE64.decode(nonce_b64)
        .map_err(|e| format!("Failed to decode nonce: {}", e))?;

    if nonce_bytes.len() != NONCE_LENGTH {
        return Err(format!("Invalid nonce length: expected {}, got {}", NONCE_LENGTH, nonce_bytes.len()));
    }

    let cipher = Aes256Gcm::new_from_slice(key.as_bytes())
        .map_err(|e| format!("Failed to create cipher: {}", e))?;

    let nonce = Nonce::from_slice(&nonce_bytes);

    cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| "Decryption failed: invalid password or corrupted data".to_string())
}

/// Encrypt data using AES-256-GCM with raw key and nonce bytes
/// Used for YubiKey-derived key encryption
pub fn encrypt_raw(data: &[u8], key: &[u8], nonce_b64: &str) -> Result<Vec<u8>, String> {
    let nonce_bytes = BASE64.decode(nonce_b64)
        .map_err(|e| format!("Failed to decode nonce: {}", e))?;

    if nonce_bytes.len() != NONCE_LENGTH {
        return Err(format!("Invalid nonce length: expected {}, got {}", NONCE_LENGTH, nonce_bytes.len()));
    }

    if key.len() != KEY_LENGTH {
        return Err(format!("Invalid key length: expected {}, got {}", KEY_LENGTH, key.len()));
    }

    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|e| format!("Failed to create cipher: {}", e))?;

    let nonce = Nonce::from_slice(&nonce_bytes);

    cipher
        .encrypt(nonce, data)
        .map_err(|e| format!("Encryption failed: {}", e))
}

/// Decrypt data using AES-256-GCM with raw key and nonce bytes
/// Used for YubiKey-derived key decryption
pub fn decrypt_raw(ciphertext: &[u8], key: &[u8], nonce_b64: &str) -> Result<Vec<u8>, String> {
    let nonce_bytes = BASE64.decode(nonce_b64)
        .map_err(|e| format!("Failed to decode nonce: {}", e))?;

    if nonce_bytes.len() != NONCE_LENGTH {
        return Err(format!("Invalid nonce length: expected {}, got {}", NONCE_LENGTH, nonce_bytes.len()));
    }

    if key.len() != KEY_LENGTH {
        return Err(format!("Invalid key length: expected {}, got {}", KEY_LENGTH, key.len()));
    }

    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|e| format!("Failed to create cipher: {}", e))?;

    let nonce = Nonce::from_slice(&nonce_bytes);

    cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| "Decryption failed: invalid key or corrupted data".to_string())
}

/// Encrypt the master key with a PIN-derived key
pub fn encrypt_master_key_with_pin(
    master_key: &MasterKey,
    pin: &str,
    pin_salt: &str,
    pin_nonce: &str,
) -> Result<String, String> {
    let pin_key = derive_pin_key(pin, pin_salt)?;
    let encrypted = encrypt(master_key.as_bytes(), &pin_key, pin_nonce)?;
    Ok(BASE64.encode(encrypted))
}

/// Decrypt the master key with a PIN-derived key
pub fn decrypt_master_key_with_pin(
    encrypted_master_key_b64: &str,
    pin: &str,
    pin_salt: &str,
    pin_nonce: &str,
) -> Result<MasterKey, String> {
    let encrypted = BASE64.decode(encrypted_master_key_b64)
        .map_err(|e| format!("Failed to decode encrypted master key: {}", e))?;

    let pin_key = derive_pin_key(pin, pin_salt)?;
    let decrypted = decrypt(&encrypted, &pin_key, pin_nonce)?;

    Ok(MasterKey::new(decrypted))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_key_derivation() {
        let salt = generate_salt();
        let key1 = derive_key("password123", &salt).unwrap();
        let key2 = derive_key("password123", &salt).unwrap();
        let key3 = derive_key("different", &salt).unwrap();

        // Same password + salt = same key
        assert_eq!(key1.as_bytes(), key2.as_bytes());
        // Different password = different key
        assert_ne!(key1.as_bytes(), key3.as_bytes());
    }

    #[test]
    fn test_encryption_roundtrip() {
        let salt = generate_salt();
        let nonce = generate_nonce();
        let key = derive_key("password123", &salt).unwrap();

        let plaintext = b"Hello, vault!";
        let ciphertext = encrypt(plaintext, &key, &nonce).unwrap();
        let decrypted = decrypt(&ciphertext, &key, &nonce).unwrap();

        assert_eq!(plaintext.as_slice(), decrypted.as_slice());
    }

    #[test]
    fn test_pin_key_encryption() {
        let pin_salt = generate_salt();
        let pin_nonce = generate_nonce();
        let master_salt = generate_salt();
        let master_key = derive_key("master_password", &master_salt).unwrap();

        let encrypted = encrypt_master_key_with_pin(&master_key, "1234", &pin_salt, &pin_nonce).unwrap();
        let decrypted = decrypt_master_key_with_pin(&encrypted, "1234", &pin_salt, &pin_nonce).unwrap();

        assert_eq!(master_key.as_bytes(), decrypted.as_bytes());
    }
}
