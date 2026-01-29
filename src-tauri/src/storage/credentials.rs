//! Gestion sécurisée des credentials via le gestionnaire système
//!
//! Utilise :
//! - Windows : Credential Manager
//! - macOS : Keychain
//! - Linux : Secret Service (libsecret)

use keyring::Entry;

const SERVICE_NAME: &str = "simplyterm";

/// Type de credential stocké
#[derive(Debug, Clone, Copy)]
pub enum CredentialType {
    Password,
    KeyPassphrase,
}

impl CredentialType {
    fn as_suffix(&self) -> &'static str {
        match self {
            CredentialType::Password => "password",
            CredentialType::KeyPassphrase => "key_passphrase",
        }
    }
}

/// Génère la clé unique pour un credential
fn make_key(session_id: &str, cred_type: CredentialType) -> String {
    format!("{}:{}", session_id, cred_type.as_suffix())
}

/// Stocke un credential de manière sécurisée
pub fn store_credential(
    session_id: &str,
    cred_type: CredentialType,
    value: &str,
) -> Result<(), String> {
    let key = make_key(session_id, cred_type);
    let entry = Entry::new(SERVICE_NAME, &key)
        .map_err(|e| format!("Failed to create keyring entry: {}", e))?;

    entry
        .set_password(value)
        .map_err(|e| format!("Failed to store credential: {}", e))
}

/// Récupère un credential
pub fn get_credential(session_id: &str, cred_type: CredentialType) -> Result<Option<String>, String> {
    let key = make_key(session_id, cred_type);
    let entry = Entry::new(SERVICE_NAME, &key)
        .map_err(|e| format!("Failed to create keyring entry: {}", e))?;

    match entry.get_password() {
        Ok(password) => Ok(Some(password)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("Failed to retrieve credential: {}", e)),
    }
}

/// Supprime un credential
pub fn delete_credential(session_id: &str, cred_type: CredentialType) -> Result<(), String> {
    let key = make_key(session_id, cred_type);
    let entry = Entry::new(SERVICE_NAME, &key)
        .map_err(|e| format!("Failed to create keyring entry: {}", e))?;

    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()), // Already deleted, that's fine
        Err(e) => Err(format!("Failed to delete credential: {}", e)),
    }
}

/// Supprime tous les credentials associés à une session
pub fn delete_all_credentials(session_id: &str) -> Result<(), String> {
    // Essayer de supprimer les deux types, ignorer les erreurs NoEntry
    let _ = delete_credential(session_id, CredentialType::Password);
    let _ = delete_credential(session_id, CredentialType::KeyPassphrase);
    Ok(())
}
