//! Session helper functions
//!
//! Provides CRUD operations for individual sessions using the config storage.
//! Note: folder_id, tags, color are now managed by plugins via session metadata API.

pub use super::config::{SavedSession, AuthType};
use super::config::{load_sessions as load_all, save_sessions as save_all};

/// Re-export save_sessions for use by vault import
pub fn save_sessions(sessions: &[SavedSession]) -> Result<(), String> {
    save_all(sessions)
}

/// Loads all saved sessions
pub fn load_sessions() -> Result<Vec<SavedSession>, String> {
    load_all()
}

/// Saves a new session (core connection info only)
pub fn save_session(
    name: String,
    host: String,
    port: u16,
    username: String,
    auth_type: String,
    key_path: Option<String>,
) -> Result<SavedSession, String> {
    let mut sessions = load_all()?;

    let auth = match auth_type.to_lowercase().as_str() {
        "password" => AuthType::Password,
        "key" => AuthType::Key,
        _ => return Err(format!("Invalid auth type: {}", auth_type)),
    };

    let session = SavedSession {
        id: format!("session-{}-{}", chrono::Utc::now().timestamp_millis(), rand::random::<u32>() % 10000),
        name,
        host,
        port,
        username,
        auth_type: auth,
        key_path,
        ssh_key_id: None,
        folder_id: None,
    };

    sessions.push(session.clone());
    save_all(&sessions)?;

    Ok(session)
}

/// Updates an existing session (core connection info only)
pub fn update_session(
    id: String,
    name: Option<String>,
    host: Option<String>,
    port: Option<u16>,
    username: Option<String>,
    auth_type: Option<String>,
    key_path: Option<Option<String>>,
) -> Result<SavedSession, String> {
    let mut sessions = load_all()?;

    let session = sessions.iter_mut()
        .find(|s| s.id == id)
        .ok_or_else(|| format!("Session not found: {}", id))?;

    if let Some(n) = name {
        session.name = n;
    }
    if let Some(h) = host {
        session.host = h;
    }
    if let Some(p) = port {
        session.port = p;
    }
    if let Some(u) = username {
        session.username = u;
    }
    if let Some(at) = auth_type {
        session.auth_type = match at.to_lowercase().as_str() {
            "password" => AuthType::Password,
            "key" => AuthType::Key,
            _ => return Err(format!("Invalid auth type: {}", at)),
        };
    }
    if let Some(kp) = key_path {
        session.key_path = kp;
    }

    let updated = session.clone();
    save_all(&sessions)?;

    Ok(updated)
}

/// Deletes a session by ID
pub fn delete_session(id: &str) -> Result<(), String> {
    let mut sessions = load_all()?;
    sessions.retain(|s| s.id != id);
    save_all(&sessions)
}
