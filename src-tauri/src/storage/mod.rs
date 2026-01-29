//! Module de stockage pour les sessions et credentials
//!
//! - config.rs : Gestion du fichier sessions.json (métadonnées uniquement)
//! - credentials.rs : Gestion sécurisée des mots de passe via le gestionnaire système
//! - recent.rs : Gestion des sessions récentes (historique)

mod config;
mod credentials;
mod recent;

pub use config::{load_sessions, save_sessions, SavedSession, AuthType};
pub use credentials::{store_credential, get_credential, delete_credential, CredentialType};
pub use recent::{load_recent_sessions, add_recent_session, remove_recent_session, clear_recent_sessions, RecentSession};
