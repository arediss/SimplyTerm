//! FIDO2 security key support for vault unlock
//!
//! Uses ctap-hid-fido2 for direct HID access to FIDO2 authenticators.
//!
//! Note: On Windows, this requires running as Administrator for HID access.
//! A future update may add native Windows WebAuthn API support.

use ctap_hid_fido2::{
    fidokey::{GetAssertionArgsBuilder, MakeCredentialArgsBuilder},
    verifier, Cfg, FidoKeyHidFactory,
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

/// Relying Party ID for SimplyTerm vault
const RP_ID: &str = "simplyterm.local";

/// Information about a detected FIDO2 security key
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SecurityKeyInfo {
    /// Device product name
    pub product_name: String,
    /// Manufacturer identifier
    pub manufacturer: String,
    /// Device path/identifier
    pub device_path: String,
    /// Whether the key has a PIN configured
    pub has_pin: bool,
}

/// Stored FIDO2 credential configuration
#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Fido2Config {
    /// Credential ID (base64 encoded)
    pub credential_id: String,
    /// Public key (base64 encoded COSE key)
    pub public_key: String,
    /// Encrypted master key (encrypted with key derived from assertion)
    pub encrypted_master_key: String,
    /// Salt for key derivation
    pub key_salt: String,
    /// Nonce for master key encryption
    pub nonce: String,
}

/// Check if running with elevated privileges (Windows only)
#[cfg(windows)]
fn is_elevated() -> bool {
    use std::process::Command;

    // Try to run a command that requires admin privileges
    Command::new("net")
        .args(["session"])
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

#[cfg(not(windows))]
fn is_elevated() -> bool {
    true // Not needed on other platforms
}

/// Check if FIDO2 security keys are available
pub fn is_fido2_available() -> bool {
    // On Windows, check if we have admin privileges
    #[cfg(windows)]
    {
        if !is_elevated() {
            // Can't access HID without admin on Windows
            // Return true anyway so user sees the option, but setup will explain
            return true;
        }
    }

    // Try to create a device connection
    FidoKeyHidFactory::create(&Cfg::init()).is_ok()
}

/// Detect connected FIDO2 security keys
pub fn detect_security_keys() -> Result<Vec<SecurityKeyInfo>, String> {
    // On Windows, check privileges first
    #[cfg(windows)]
    {
        if !is_elevated() {
            return Err(
                "Sur Windows, l'accès aux clés FIDO2 nécessite les droits administrateur.\n\
                 Relancez SimplyTerm en tant qu'administrateur pour configurer votre clé."
                    .to_string(),
            );
        }
    }

    let devices = ctap_hid_fido2::get_fidokey_devices();

    if devices.is_empty() {
        return Ok(vec![]);
    }

    let keys = devices
        .into_iter()
        .map(|device| {
            let device_id = format!("{:04x}:{:04x}", device.vid, device.pid);
            SecurityKeyInfo {
                product_name: device.product_string.clone(),
                manufacturer: format!("VID:{:04x}", device.vid),
                device_path: device_id,
                has_pin: false,
            }
        })
        .collect();

    Ok(keys)
}

/// Create a FIDO2 credential for vault unlock
///
/// Returns (credential_id, assertion_data_for_key_derivation)
pub fn register_security_key(pin: Option<&str>) -> Result<(Vec<u8>, Vec<u8>), String> {
    // On Windows, check privileges first
    #[cfg(windows)]
    {
        if !is_elevated() {
            return Err(
                "Sur Windows, la configuration FIDO2 nécessite les droits administrateur.\n\
                 Relancez SimplyTerm en tant qu'administrateur."
                    .to_string(),
            );
        }
    }

    let device = FidoKeyHidFactory::create(&Cfg::init())
        .map_err(|e| format!("Impossible d'ouvrir la clé de sécurité: {:?}", e))?;

    // Create challenge for registration
    let challenge = verifier::create_challenge();

    // Build credential creation args
    let mut args_builder = MakeCredentialArgsBuilder::new(RP_ID, &challenge);
    if let Some(p) = pin {
        args_builder = args_builder.pin(p);
    }
    let args = args_builder.build();

    // Register - user will touch the key
    let attestation = device
        .make_credential_with_args(&args)
        .map_err(|e| format!("Enregistrement échoué (touchez votre clé): {:?}", e))?;

    // Verify attestation
    let verify_result = verifier::verify_attestation(RP_ID, &challenge, &attestation);
    if !verify_result.is_success {
        return Err("Vérification de l'attestation échouée".to_string());
    }

    let credential_id = verify_result.credential_id;

    // Get assertion for key derivation
    let auth_challenge = derive_challenge_from_credential(&credential_id);

    let mut auth_args_builder =
        GetAssertionArgsBuilder::new(RP_ID, &auth_challenge).credential_id(&credential_id);
    if let Some(p) = pin {
        auth_args_builder = auth_args_builder.pin(p);
    }
    let auth_args = auth_args_builder.build();

    let assertions = device
        .get_assertion_with_args(&auth_args)
        .map_err(|e| format!("Authentification échouée (touchez votre clé): {:?}", e))?;

    if assertions.is_empty() {
        return Err("Aucune assertion retournée".to_string());
    }

    Ok((credential_id, assertions[0].signature.clone()))
}

/// Authenticate with a FIDO2 security key
///
/// Returns data that can be used to derive the vault encryption key
pub fn authenticate_with_security_key(
    credential_id: &[u8],
    pin: Option<&str>,
) -> Result<Vec<u8>, String> {
    // On Windows, check privileges first
    #[cfg(windows)]
    {
        if !is_elevated() {
            return Err(
                "Sur Windows, l'authentification FIDO2 nécessite les droits administrateur.\n\
                 Relancez SimplyTerm en tant qu'administrateur."
                    .to_string(),
            );
        }
    }

    let device = FidoKeyHidFactory::create(&Cfg::init())
        .map_err(|e| format!("Impossible d'ouvrir la clé de sécurité: {:?}", e))?;

    // Deterministic challenge from credential_id
    let challenge = derive_challenge_from_credential(credential_id);

    let mut args_builder =
        GetAssertionArgsBuilder::new(RP_ID, &challenge).credential_id(credential_id);
    if let Some(p) = pin {
        args_builder = args_builder.pin(p);
    }
    let args = args_builder.build();

    // User will touch the key
    let assertions = device
        .get_assertion_with_args(&args)
        .map_err(|e| format!("Authentification échouée (touchez votre clé): {:?}", e))?;

    if assertions.is_empty() {
        return Err("Aucune assertion retournée".to_string());
    }

    Ok(assertions[0].signature.clone())
}

/// Derive a deterministic challenge from the credential ID
fn derive_challenge_from_credential(credential_id: &[u8]) -> Vec<u8> {
    let mut hasher = Sha256::new();
    hasher.update(b"simplyterm-vault-challenge-v1");
    hasher.update(credential_id);
    hasher.finalize().to_vec()
}

/// Derive a 32-byte encryption key from FIDO2 assertion data
pub fn derive_key_from_assertion(assertion_data: &[u8], salt: &[u8]) -> Result<Vec<u8>, String> {
    use hkdf::Hkdf;

    let hkdf = Hkdf::<Sha256>::new(Some(salt), assertion_data);
    let mut okm = vec![0u8; 32];
    hkdf.expand(b"simplyterm-fido2-vault-key", &mut okm)
        .map_err(|_| "HKDF expansion failed")?;

    Ok(okm)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_challenge_derivation_is_deterministic() {
        let cred_id = b"test-credential-id";
        let challenge1 = derive_challenge_from_credential(cred_id);
        let challenge2 = derive_challenge_from_credential(cred_id);
        assert_eq!(challenge1, challenge2);
    }

    #[test]
    fn test_key_derivation() {
        let assertion_data = b"test-assertion-signature";
        let salt = b"test-salt-value";

        let key1 = derive_key_from_assertion(assertion_data, salt).unwrap();
        let key2 = derive_key_from_assertion(assertion_data, salt).unwrap();

        assert_eq!(key1.len(), 32);
        assert_eq!(key1, key2);
    }
}
