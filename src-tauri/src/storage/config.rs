//! Session configuration storage (sessions.json)

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum AuthType {
    Password,
    Key,
}

/// Core session data (connection info only)
/// Plugin-specific metadata (folders, tags, colors) is stored separately via session_metadata API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavedSession {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_type: AuthType,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub key_path: Option<String>,
}

fn get_config_path() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Could not find home directory")?;
    let config_dir = home.join(".simplyterm");

    if !config_dir.exists() {
        fs::create_dir_all(&config_dir)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }

    Ok(config_dir.join("sessions.json"))
}

/// Loads all saved sessions
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
        // Ensure no plugin-managed fields in core session
        assert!(!json.contains("folder_id"));
        assert!(!json.contains("tags"));
        assert!(!json.contains("color"));
    }
}
