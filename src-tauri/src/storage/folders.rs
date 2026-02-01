//! Session folder storage

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionFolder {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_id: Option<String>,
    #[serde(default)]
    pub order: i32,
    #[serde(default = "default_expanded")]
    pub expanded: bool,
}

fn default_expanded() -> bool {
    true
}

fn get_folders_path() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Could not find home directory")?;
    let config_dir = home.join(".simplyterm");

    if !config_dir.exists() {
        fs::create_dir_all(&config_dir)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }

    Ok(config_dir.join("folders.json"))
}

/// Loads all folders
pub fn load_folders() -> Result<Vec<SessionFolder>, String> {
    let path = get_folders_path()?;

    if !path.exists() {
        return Ok(Vec::new());
    }

    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read folders file: {}", e))?;

    if content.trim().is_empty() {
        return Ok(Vec::new());
    }

    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse folders file: {}", e))
}

/// Sauvegarde tous les dossiers
pub fn save_folders(folders: &[SessionFolder]) -> Result<(), String> {
    let path = get_folders_path()?;

    let content = serde_json::to_string_pretty(folders)
        .map_err(|e| format!("Failed to serialize folders: {}", e))?;

    fs::write(&path, content)
        .map_err(|e| format!("Failed to write folders file: {}", e))
}

/// Crée un nouveau dossier
pub fn create_folder(name: String, color: Option<String>, parent_id: Option<String>) -> Result<SessionFolder, String> {
    let mut folders = load_folders()?;

    // Calculer l'ordre (dernier + 1)
    let max_order = folders.iter()
        .filter(|f| f.parent_id == parent_id)
        .map(|f| f.order)
        .max()
        .unwrap_or(-1);

    let folder = SessionFolder {
        id: format!("folder-{}-{}", chrono::Utc::now().timestamp_millis(), rand::random::<u32>() % 10000),
        name,
        color,
        parent_id,
        order: max_order + 1,
        expanded: true,
    };

    folders.push(folder.clone());
    save_folders(&folders)?;

    Ok(folder)
}

/// Met à jour un dossier existant
pub fn update_folder(id: String, name: Option<String>, color: Option<String>, parent_id: Option<Option<String>>, expanded: Option<bool>) -> Result<SessionFolder, String> {
    let mut folders = load_folders()?;

    let folder = folders.iter_mut()
        .find(|f| f.id == id)
        .ok_or_else(|| format!("Folder not found: {}", id))?;

    if let Some(n) = name {
        folder.name = n;
    }
    if let Some(c) = color {
        folder.color = Some(c);
    }
    if let Some(p) = parent_id {
        folder.parent_id = p;
    }
    if let Some(e) = expanded {
        folder.expanded = e;
    }

    let updated = folder.clone();
    save_folders(&folders)?;

    Ok(updated)
}

/// Supprime un dossier (les sessions à l'intérieur sont déplacées à la racine)
pub fn delete_folder(id: String) -> Result<(), String> {
    let mut folders = load_folders()?;

    // Supprimer le dossier
    folders.retain(|f| f.id != id);

    // Déplacer les sous-dossiers à la racine (ou au parent du dossier supprimé)
    for folder in folders.iter_mut() {
        if folder.parent_id.as_ref() == Some(&id) {
            folder.parent_id = None;
        }
    }

    save_folders(&folders)?;
    Ok(())
}

/// Réordonne les dossiers dans un parent
pub fn reorder_folders(folder_ids: Vec<String>, parent_id: Option<String>) -> Result<(), String> {
    let mut folders = load_folders()?;

    for (index, id) in folder_ids.iter().enumerate() {
        if let Some(folder) = folders.iter_mut().find(|f| &f.id == id) {
            folder.order = index as i32;
            folder.parent_id = parent_id.clone();
        }
    }

    save_folders(&folders)?;
    Ok(())
}
