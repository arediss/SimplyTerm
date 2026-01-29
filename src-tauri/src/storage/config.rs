//! Gestion du fichier de configuration sessions.json
//!
//! Ce fichier contient uniquement les métadonnées des sessions (host, port, user, etc.)
//! Les credentials sensibles sont stockés séparément via le module credentials.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

/// Type d'authentification pour une session SSH
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum AuthType {
    Password,
    Key,
}

/// Session sauvegardée (sans données sensibles)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavedSession {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_type: AuthType,
    /// Chemin vers la clé SSH (pas un secret, OK en JSON)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub key_path: Option<String>,
    /// ID du dossier parent (None = racine)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub folder_id: Option<String>,
    /// Tags associés à la session
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tags: Vec<String>,
    /// Couleur personnalisée (format hex: #RRGGBB)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
}

/// Récupère le chemin du fichier de configuration
fn get_config_path() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Could not find home directory")?;
    let config_dir = home.join(".simplyterm");

    // Créer le répertoire si nécessaire
    if !config_dir.exists() {
        fs::create_dir_all(&config_dir)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }

    Ok(config_dir.join("sessions.json"))
}

/// Charge toutes les sessions sauvegardées
pub fn load_sessions() -> Result<Vec<SavedSession>, String> {
    let path = get_config_path()?;

    if !path.exists() {
        return Ok(Vec::new());
    }

    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read sessions file: {}", e))?;

    if content.trim().is_empty() {
        return Ok(Vec::new());
    }

    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse sessions file: {}", e))
}

/// Sauvegarde toutes les sessions
pub fn save_sessions(sessions: &[SavedSession]) -> Result<(), String> {
    let path = get_config_path()?;

    let content = serde_json::to_string_pretty(sessions)
        .map_err(|e| format!("Failed to serialize sessions: {}", e))?;

    fs::write(&path, content)
        .map_err(|e| format!("Failed to write sessions file: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_auth_type_serialization() {
        let session = SavedSession {
            id: "test".to_string(),
            name: "Test".to_string(),
            host: "localhost".to_string(),
            port: 22,
            username: "user".to_string(),
            auth_type: AuthType::Password,
            key_path: None,
        };

        let json = serde_json::to_string(&session).unwrap();
        assert!(json.contains("\"auth_type\":\"password\""));
    }
}
