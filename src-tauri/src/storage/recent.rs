//! Gestion des sessions récentes
//!
//! Stocke les 10 dernières connexions (métadonnées uniquement, pas de credentials)
//! Les sessions récentes permettent de retrouver rapidement une connexion
//! sans avoir à la sauvegarder explicitement.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

const MAX_RECENT_SESSIONS: usize = 10;

/// Session récente (métadonnées uniquement)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentSession {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_type: String,
    /// Chemin vers la clé SSH (pas un secret)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub key_path: Option<String>,
    /// Timestamp de la dernière connexion
    pub last_used: u64,
}

/// Récupère le chemin du fichier des sessions récentes
fn get_recent_path() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Could not find home directory")?;
    let config_dir = home.join(".simplyterm");

    if !config_dir.exists() {
        fs::create_dir_all(&config_dir)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }

    Ok(config_dir.join("recent.json"))
}

/// Charge les sessions récentes
pub fn load_recent_sessions() -> Result<Vec<RecentSession>, String> {
    let path = get_recent_path()?;

    if !path.exists() {
        return Ok(Vec::new());
    }

    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read recent sessions file: {}", e))?;

    if content.trim().is_empty() {
        return Ok(Vec::new());
    }

    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse recent sessions file: {}", e))
}

/// Sauvegarde les sessions récentes
fn save_recent_sessions(sessions: &[RecentSession]) -> Result<(), String> {
    let path = get_recent_path()?;

    let content = serde_json::to_string_pretty(sessions)
        .map_err(|e| format!("Failed to serialize recent sessions: {}", e))?;

    fs::write(&path, content)
        .map_err(|e| format!("Failed to write recent sessions file: {}", e))
}

/// Ajoute ou met à jour une session dans l'historique récent
pub fn add_recent_session(session: RecentSession) -> Result<(), String> {
    let mut sessions = load_recent_sessions()?;

    // Supprimer si déjà présente (on va la remettre en haut)
    sessions.retain(|s| !(s.host == session.host && s.username == session.username && s.port == session.port));

    // Ajouter en premier
    sessions.insert(0, session);

    // Limiter à MAX_RECENT_SESSIONS
    sessions.truncate(MAX_RECENT_SESSIONS);

    save_recent_sessions(&sessions)
}

/// Supprime une session de l'historique récent
pub fn remove_recent_session(id: &str) -> Result<(), String> {
    let mut sessions = load_recent_sessions()?;
    sessions.retain(|s| s.id != id);
    save_recent_sessions(&sessions)
}

/// Vide l'historique des sessions récentes
pub fn clear_recent_sessions() -> Result<(), String> {
    save_recent_sessions(&[])
}
