//! Storage API for plugins
//!
//! Provides sandboxed file system access for plugins.
//! Each plugin has its own data directory that it cannot escape from.
//! Requires: fs_read, fs_write permissions

use crate::plugins::error::{PluginError, PluginResult};
use crate::plugins::manifest::{GrantedPermissions, Permission};
use crate::plugins::permissions::require_permission;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

/// File entry information
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub name: String,
    pub is_directory: bool,
    pub size: u64,
    pub modified: u64,
}

/// Validates and resolves a path within the plugin's sandbox
fn resolve_sandboxed_path(data_dir: &PathBuf, relative_path: &str) -> PluginResult<PathBuf> {
    // Ensure data directory exists
    if !data_dir.exists() {
        fs::create_dir_all(data_dir)
            .map_err(|e| PluginError::storage_error(format!("Failed to create data directory: {}", e)))?;
    }

    // Check for path traversal attempts
    if relative_path.contains("..") {
        return Err(PluginError::permission_denied("Path escapes plugin sandbox"));
    }

    // Normalize the path
    let resolved = data_dir.join(relative_path);

    // Canonicalize both paths for proper comparison
    let canonical_data_dir = data_dir.canonicalize()
        .map_err(|e| PluginError::storage_error(format!("Failed to resolve data directory: {}", e)))?;

    // For the resolved path, if it doesn't exist yet, check the parent
    let canonical = if resolved.exists() {
        resolved.canonicalize().unwrap_or(resolved.clone())
    } else {
        // For new files, verify the parent directory is within sandbox
        if let Some(parent) = resolved.parent() {
            if parent.exists() {
                let canonical_parent = parent.canonicalize().unwrap_or(parent.to_path_buf());
                if !canonical_parent.starts_with(&canonical_data_dir) {
                    return Err(PluginError::permission_denied("Path escapes plugin sandbox"));
                }
            }
        }
        resolved.clone()
    };

    // Check if the path is within the sandbox
    if resolved.exists() && !canonical.starts_with(&canonical_data_dir) {
        return Err(PluginError::permission_denied("Path escapes plugin sandbox"));
    }

    Ok(resolved)
}

/// Reads a file from the plugin's data directory
pub fn read_file(
    permissions: &GrantedPermissions,
    data_dir: &PathBuf,
    relative_path: &str,
) -> PluginResult<String> {
    require_permission(permissions, Permission::FsRead)?;

    let path = resolve_sandboxed_path(data_dir, relative_path)?;

    fs::read_to_string(&path)
        .map_err(|e| PluginError::storage_error(format!("Failed to read file: {}", e)))
}

/// Reads a binary file from the plugin's data directory
pub fn read_file_binary(
    permissions: &GrantedPermissions,
    data_dir: &PathBuf,
    relative_path: &str,
) -> PluginResult<Vec<u8>> {
    require_permission(permissions, Permission::FsRead)?;

    let path = resolve_sandboxed_path(data_dir, relative_path)?;

    fs::read(&path)
        .map_err(|e| PluginError::storage_error(format!("Failed to read file: {}", e)))
}

/// Writes a file to the plugin's data directory
pub fn write_file(
    permissions: &GrantedPermissions,
    data_dir: &PathBuf,
    relative_path: &str,
    content: &str,
) -> PluginResult<()> {
    require_permission(permissions, Permission::FsWrite)?;

    let path = resolve_sandboxed_path(data_dir, relative_path)?;

    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| PluginError::storage_error(format!("Failed to create directory: {}", e)))?;
        }
    }

    fs::write(&path, content)
        .map_err(|e| PluginError::storage_error(format!("Failed to write file: {}", e)))
}

/// Writes a binary file to the plugin's data directory
pub fn write_file_binary(
    permissions: &GrantedPermissions,
    data_dir: &PathBuf,
    relative_path: &str,
    content: &[u8],
) -> PluginResult<()> {
    require_permission(permissions, Permission::FsWrite)?;

    let path = resolve_sandboxed_path(data_dir, relative_path)?;

    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| PluginError::storage_error(format!("Failed to create directory: {}", e)))?;
        }
    }

    fs::write(&path, content)
        .map_err(|e| PluginError::storage_error(format!("Failed to write file: {}", e)))
}

/// Deletes a file from the plugin's data directory
pub fn delete_file(
    permissions: &GrantedPermissions,
    data_dir: &PathBuf,
    relative_path: &str,
) -> PluginResult<()> {
    require_permission(permissions, Permission::FsWrite)?;

    let path = resolve_sandboxed_path(data_dir, relative_path)?;

    if path.is_dir() {
        fs::remove_dir_all(&path)
            .map_err(|e| PluginError::storage_error(format!("Failed to delete directory: {}", e)))
    } else {
        fs::remove_file(&path)
            .map_err(|e| PluginError::storage_error(format!("Failed to delete file: {}", e)))
    }
}

/// Lists files in a directory within the plugin's data directory
pub fn list_directory(
    permissions: &GrantedPermissions,
    data_dir: &PathBuf,
    relative_path: &str,
) -> PluginResult<Vec<FileEntry>> {
    require_permission(permissions, Permission::FsRead)?;

    let path = if relative_path.is_empty() || relative_path == "." {
        data_dir.clone()
    } else {
        resolve_sandboxed_path(data_dir, relative_path)?
    };

    if !path.exists() {
        return Ok(Vec::new());
    }

    if !path.is_dir() {
        return Err(PluginError::invalid_input("Path is not a directory"));
    }

    let entries = fs::read_dir(&path)
        .map_err(|e| PluginError::storage_error(format!("Failed to read directory: {}", e)))?;

    let mut result = Vec::new();

    for entry in entries {
        let entry = entry
            .map_err(|e| PluginError::storage_error(format!("Failed to read entry: {}", e)))?;

        let metadata = entry.metadata()
            .map_err(|e| PluginError::storage_error(format!("Failed to read metadata: {}", e)))?;

        let modified = metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs())
            .unwrap_or(0);

        result.push(FileEntry {
            name: entry.file_name().to_string_lossy().to_string(),
            is_directory: metadata.is_dir(),
            size: metadata.len(),
            modified,
        });
    }

    Ok(result)
}

/// Creates a directory in the plugin's data directory
pub fn create_directory(
    permissions: &GrantedPermissions,
    data_dir: &PathBuf,
    relative_path: &str,
) -> PluginResult<()> {
    require_permission(permissions, Permission::FsWrite)?;

    let path = resolve_sandboxed_path(data_dir, relative_path)?;

    fs::create_dir_all(&path)
        .map_err(|e| PluginError::storage_error(format!("Failed to create directory: {}", e)))
}

/// Checks if a file or directory exists
pub fn exists(
    permissions: &GrantedPermissions,
    data_dir: &PathBuf,
    relative_path: &str,
) -> PluginResult<bool> {
    require_permission(permissions, Permission::FsRead)?;

    let path = resolve_sandboxed_path(data_dir, relative_path)?;
    Ok(path.exists())
}
