//! Module de stockage pour les sessions et credentials
//!
//! - config.rs : Gestion du fichier sessions.json (métadonnées uniquement)
//! - credentials.rs : Gestion sécurisée des mots de passe via le gestionnaire système
//! - recent.rs : Gestion des sessions récentes (historique)
//! - settings.rs : Gestion des paramètres de l'application
//! - folders.rs : Gestion des dossiers pour organiser les sessions

mod config;
mod credentials;
mod folders;
mod recent;
mod settings;

pub use config::{load_sessions, save_sessions, SavedSession, AuthType};
pub use credentials::{store_credential, get_credential, delete_credential, CredentialType};
pub use folders::{load_folders, save_folders, create_folder, update_folder, delete_folder, reorder_folders, SessionFolder};
pub use recent::{load_recent_sessions, add_recent_session, remove_recent_session, clear_recent_sessions, RecentSession};
pub use settings::{load_settings, save_settings, AppSettings};
