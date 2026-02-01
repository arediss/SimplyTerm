//! Trait définissant l'interface commune pour tous les connecteurs (SSH, Local, Serial, etc.)

use std::fmt::Debug;

/// Trait que tous les connecteurs doivent implémenter
pub trait Session: Send + Sync + Debug {
    /// Écrit des données vers la session
    fn write(&self, data: &[u8]) -> Result<(), String>;

    /// Redimensionne le terminal
    fn resize(&self, cols: u32, rows: u32) -> Result<(), String>;

    /// Retourne le type de session pour le logging/debug
    #[allow(dead_code)]
    fn session_type(&self) -> &'static str;

    /// Closes the session
    fn close(&self) -> Result<(), String> {
        Ok(())
    }
}
