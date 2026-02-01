//! SimplyTerm - Terminal moderne multi-connecteurs
//!
//! Architecture modulaire :
//! - session/ : Gestion des sessions et trait commun
//! - connectors/ : Implémentations (SSH, Local, etc.)

use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};

mod connectors;
mod edit_watcher;
mod plugins;
mod session;
mod storage;
mod tunnels;

use connectors::{
    connect_ssh, create_local_session, ssh_exec::ssh_exec, SshAuth, SshConfig, FileEntry, sftp_read_file,
    check_host_key_only, HostKeyCheckResult, accept_pending_key, accept_and_update_pending_key, remove_pending_key,
    connect_telnet, connect_serial, list_serial_ports, SerialConfig, SerialPortInfo,
};
use plugins::{PluginManager, PluginState};
use session::SessionManager;
use storage::{
    load_sessions, save_sessions, SavedSession, AuthType,
    load_recent_sessions, add_recent_session, remove_recent_session, clear_recent_sessions, RecentSession,
    load_settings as load_app_settings, save_settings as save_app_settings, AppSettings,
    load_folders, create_folder as storage_create_folder,
    update_folder as storage_update_folder, delete_folder as storage_delete_folder,
    reorder_folders as storage_reorder_folders, SessionFolder,
    VaultState, VaultCredentialType,
};

use edit_watcher::EditWatcher;
use parking_lot::Mutex;
use tunnels::{TunnelManager, TunnelInfo};

/// État global de l'application
struct AppState {
    session_manager: Arc<SessionManager>,
    plugin_manager: Arc<PluginManager>,
    vault: Arc<VaultState>,
    edit_watcher: Arc<Mutex<EditWatcher>>,
    tunnel_manager: Arc<TunnelManager>,
}

// ============================================================================
// Commandes Tauri
// ============================================================================

#[tauri::command]
async fn create_pty_session(app: AppHandle, session_id: String) -> Result<(), String> {
    let state = app.state::<AppState>();
    let output_tx = state.session_manager.output_sender();

    let app_clone = app.clone();
    let session_id_clone = session_id.clone();

    let session = create_local_session(session_id.clone(), output_tx, move || {
        let _ = app_clone.emit(&format!("pty-exit-{}", session_id_clone), ());
    })?;

    state
        .session_manager
        .register(session_id, Box::new(session));

    Ok(())
}

#[tauri::command]
async fn create_ssh_session(
    app: AppHandle,
    session_id: String,
    host: String,
    port: u16,
    username: String,
    password: Option<String>,
    key_path: Option<String>,
    key_passphrase: Option<String>,
    // Jump host parameters (optional)
    jump_host: Option<String>,
    jump_port: Option<u16>,
    jump_username: Option<String>,
    jump_password: Option<String>,
    jump_key_path: Option<String>,
    jump_key_passphrase: Option<String>,
) -> Result<(), String> {
    let state = app.state::<AppState>();
    let output_tx = state.session_manager.output_sender();

    // Déterminer la méthode d'authentification pour la destination
    let auth = if let Some(key) = key_path {
        SshAuth::KeyFile {
            path: key,
            passphrase: key_passphrase,
        }
    } else if let Some(pass) = password {
        SshAuth::Password(pass)
    } else {
        return Err("No authentication method provided".to_string());
    };

    // Configurer le jump host si spécifié
    let jump_host_config = if let Some(jh) = jump_host {
        let jump_auth = if let Some(key) = jump_key_path {
            SshAuth::KeyFile {
                path: key,
                passphrase: jump_key_passphrase,
            }
        } else if let Some(pass) = jump_password {
            SshAuth::Password(pass)
        } else {
            return Err("No authentication method provided for jump host".to_string());
        };

        Some(connectors::ssh::JumpHostConfig {
            host: jh,
            port: jump_port.unwrap_or(22),
            username: jump_username.unwrap_or_else(|| username.clone()),
            auth: jump_auth,
        })
    } else {
        None
    };

    let config = SshConfig {
        host,
        port,
        username,
        auth,
        jump_host: jump_host_config,
    };

    let app_clone = app.clone();
    let session_id_clone = session_id.clone();

    // Store config for background commands (stats, etc.)
    state.session_manager.store_ssh_config(session_id.clone(), config.clone());

    let session = connect_ssh(config, session_id.clone(), output_tx, move || {
        let _ = app_clone.emit(&format!("pty-exit-{}", session_id_clone), ());
    })
    .await?;

    state
        .session_manager
        .register(session_id, Box::new(session));

    Ok(())
}

#[tauri::command]
async fn create_telnet_session(
    app: AppHandle,
    session_id: String,
    host: String,
    port: u16,
) -> Result<(), String> {
    let state = app.state::<AppState>();
    let output_tx = state.session_manager.output_sender();

    let app_clone = app.clone();
    let session_id_clone = session_id.clone();

    let session = connect_telnet(host, port, session_id.clone(), output_tx, move || {
        let _ = app_clone.emit(&format!("pty-exit-{}", session_id_clone), ());
    })
    .await?;

    state
        .session_manager
        .register(session_id, Box::new(session));

    Ok(())
}

#[tauri::command]
fn get_serial_ports() -> Result<Vec<SerialPortInfo>, String> {
    list_serial_ports()
}

#[tauri::command]
async fn create_serial_session(
    app: AppHandle,
    session_id: String,
    port: String,
    baud_rate: u32,
    data_bits: u8,
    stop_bits: u8,
    parity: String,
    flow_control: String,
) -> Result<(), String> {
    let state = app.state::<AppState>();
    let output_tx = state.session_manager.output_sender();

    let config = SerialConfig {
        port,
        baud_rate,
        data_bits,
        stop_bits,
        parity,
        flow_control,
    };

    let app_clone = app.clone();
    let session_id_clone = session_id.clone();

    let session = connect_serial(config, session_id.clone(), output_tx, move || {
        let _ = app_clone.emit(&format!("pty-exit-{}", session_id_clone), ());
    })?;

    state
        .session_manager
        .register(session_id, Box::new(session));

    Ok(())
}

// ============================================================================
// Host Key Verification Commands
// ============================================================================

#[tauri::command]
async fn check_host_key(host: String, port: u16) -> HostKeyCheckResult {
    check_host_key_only(&host, port).await
}

#[tauri::command]
async fn trust_host_key(host: String, port: u16) -> Result<(), String> {
    let pending_id = format!("{}:{}", host, port);
    accept_pending_key(&pending_id)
}

#[tauri::command]
async fn update_host_key(host: String, port: u16) -> Result<(), String> {
    let pending_id = format!("{}:{}", host, port);
    accept_and_update_pending_key(&pending_id)
}

#[tauri::command]
async fn reject_host_key(host: String, port: u16) -> Result<(), String> {
    let pending_id = format!("{}:{}", host, port);
    remove_pending_key(&pending_id);
    Ok(())
}

#[tauri::command]
async fn write_to_pty(app: AppHandle, session_id: String, data: String) -> Result<(), String> {
    let state = app.state::<AppState>();
    state.session_manager.write(&session_id, data.as_bytes())
}

#[tauri::command]
async fn resize_pty(
    app: AppHandle,
    session_id: String,
    rows: u16,
    cols: u16,
) -> Result<(), String> {
    let state = app.state::<AppState>();
    state
        .session_manager
        .resize(&session_id, cols as u32, rows as u32)
}

#[tauri::command]
async fn close_pty_session(app: AppHandle, session_id: String) -> Result<(), String> {
    let state = app.state::<AppState>();
    state.session_manager.close(&session_id)
}

/// Execute a command on an SSH session in background (doesn't pollute the visible terminal)
/// Returns the command output as a string
#[tauri::command]
async fn ssh_exec_command(app: AppHandle, session_id: String, command: String) -> Result<String, String> {
    let state = app.state::<AppState>();
    let config = state
        .session_manager
        .get_ssh_config(&session_id)
        .ok_or_else(|| "SSH session not found or not an SSH session".to_string())?;

    ssh_exec(&config, &command).await
}

// ============================================================================
// SFTP Commands
// ============================================================================

#[tauri::command]
async fn sftp_list(app: AppHandle, session_id: String, path: String) -> Result<Vec<FileEntry>, String> {
    let state = app.state::<AppState>();
    let config = state
        .session_manager
        .get_ssh_config(&session_id)
        .ok_or_else(|| "SSH session not found".to_string())?;

    connectors::sftp_list_dir(&config, &path).await
}

#[tauri::command]
async fn sftp_read(app: AppHandle, session_id: String, path: String) -> Result<Vec<u8>, String> {
    let state = app.state::<AppState>();
    let config = state
        .session_manager
        .get_ssh_config(&session_id)
        .ok_or_else(|| "SSH session not found".to_string())?;

    connectors::sftp_read_file(&config, &path).await
}

#[tauri::command]
async fn sftp_write(app: AppHandle, session_id: String, path: String, data: Vec<u8>) -> Result<(), String> {
    let state = app.state::<AppState>();
    let config = state
        .session_manager
        .get_ssh_config(&session_id)
        .ok_or_else(|| "SSH session not found".to_string())?;

    connectors::sftp_write_file(&config, &path, data).await
}

#[tauri::command]
async fn sftp_remove(app: AppHandle, session_id: String, path: String, is_dir: bool) -> Result<(), String> {
    let state = app.state::<AppState>();
    let config = state
        .session_manager
        .get_ssh_config(&session_id)
        .ok_or_else(|| "SSH session not found".to_string())?;

    connectors::sftp_delete(&config, &path, is_dir).await
}

#[tauri::command]
async fn sftp_rename(app: AppHandle, session_id: String, old_path: String, new_path: String) -> Result<(), String> {
    let state = app.state::<AppState>();
    let config = state
        .session_manager
        .get_ssh_config(&session_id)
        .ok_or_else(|| "SSH session not found".to_string())?;

    connectors::sftp_rename(&config, &old_path, &new_path).await
}

#[tauri::command]
async fn sftp_mkdir(app: AppHandle, session_id: String, path: String) -> Result<(), String> {
    let state = app.state::<AppState>();
    let config = state
        .session_manager
        .get_ssh_config(&session_id)
        .ok_or_else(|| "SSH session not found".to_string())?;

    connectors::sftp_mkdir(&config, &path).await
}

/// Response for sftp_edit_external command
#[derive(serde::Serialize)]
struct EditExternalResponse {
    local_path: String,
    remote_path: String,
}

/// Download a remote file, open it in the default editor, and watch for changes
#[tauri::command]
async fn sftp_edit_external(
    app: AppHandle,
    session_id: String,
    remote_path: String,
) -> Result<EditExternalResponse, String> {
    let state = app.state::<AppState>();
    let config = state
        .session_manager
        .get_ssh_config(&session_id)
        .ok_or_else(|| "SSH session not found".to_string())?;

    // Get local path for this file
    let local_path = edit_watcher::get_local_edit_path(&session_id, &remote_path)?;

    // Download the file
    let content = sftp_read_file(&config, &remote_path).await?;

    // Write to local file
    std::fs::write(&local_path, &content)
        .map_err(|e| format!("Failed to write local file: {}", e))?;

    // Start tracking the file for changes
    {
        let mut watcher = state.edit_watcher.lock();
        watcher.track_file(session_id.clone(), remote_path.clone(), local_path.clone())?;
    }

    // Open with default editor
    open::that(&local_path)
        .map_err(|e| format!("Failed to open file in editor: {}", e))?;

    Ok(EditExternalResponse {
        local_path: local_path.to_string_lossy().to_string(),
        remote_path,
    })
}

/// Stop tracking a file for external editing
#[tauri::command]
async fn sftp_stop_editing(
    app: AppHandle,
    local_path: String,
) -> Result<(), String> {
    let state = app.state::<AppState>();
    let path = std::path::PathBuf::from(&local_path);

    let mut watcher = state.edit_watcher.lock();
    watcher.untrack_file(&path)?;

    // Optionally delete the local file
    let _ = std::fs::remove_file(&path);

    Ok(())
}

/// Get list of files being edited for a session
#[tauri::command]
async fn sftp_get_editing_files(
    app: AppHandle,
    session_id: String,
) -> Result<Vec<EditingFileInfo>, String> {
    let state = app.state::<AppState>();
    let watcher = state.edit_watcher.lock();

    let files = watcher.get_tracked_files(&session_id);
    Ok(files.into_iter().map(|f| EditingFileInfo {
        session_id: f.session_id,
        remote_path: f.remote_path,
        local_path: f.local_path.to_string_lossy().to_string(),
    }).collect())
}

#[derive(serde::Serialize)]
struct EditingFileInfo {
    session_id: String,
    remote_path: String,
    local_path: String,
}

/// Register SSH config for SFTP-only use (no terminal session)
#[tauri::command]
async fn register_sftp_session(
    app: AppHandle,
    session_id: String,
    host: String,
    port: u16,
    username: String,
    password: Option<String>,
    key_path: Option<String>,
    key_passphrase: Option<String>,
) -> Result<(), String> {
    let state = app.state::<AppState>();

    let auth = if let Some(key) = key_path {
        SshAuth::KeyFile {
            path: key,
            passphrase: key_passphrase,
        }
    } else if let Some(pass) = password {
        SshAuth::Password(pass)
    } else {
        return Err("No authentication method provided".to_string());
    };

    let config = SshConfig {
        host,
        port,
        username,
        auth,
        jump_host: None, // SFTP doesn't support jump host for now
    };

    // Just store the config, don't create a session
    state.session_manager.store_ssh_config(session_id, config);
    Ok(())
}

#[tauri::command]
fn get_home_dir() -> Result<String, String> {
    std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|_| "Could not determine home directory".to_string())
}

// ============================================================================
// Commandes Storage (Sessions sauvegardées)
// ============================================================================

/// Structure pour la réponse frontend (inclut les métadonnées uniquement)
#[derive(serde::Serialize)]
struct SavedSessionResponse {
    id: String,
    name: String,
    host: String,
    port: u16,
    username: String,
    auth_type: String,
    key_path: Option<String>,
    folder_id: Option<String>,
    tags: Vec<String>,
    color: Option<String>,
}

impl From<SavedSession> for SavedSessionResponse {
    fn from(s: SavedSession) -> Self {
        Self {
            id: s.id,
            name: s.name,
            host: s.host,
            port: s.port,
            username: s.username,
            auth_type: match s.auth_type {
                AuthType::Password => "password".to_string(),
                AuthType::Key => "key".to_string(),
            },
            key_path: s.key_path,
            folder_id: s.folder_id,
            tags: s.tags,
            color: s.color,
        }
    }
}

#[tauri::command]
fn load_saved_sessions() -> Result<Vec<SavedSessionResponse>, String> {
    let sessions = load_sessions()?;
    Ok(sessions.into_iter().map(|s| s.into()).collect())
}

#[tauri::command]
fn save_session(
    app: AppHandle,
    id: String,
    name: String,
    host: String,
    port: u16,
    username: String,
    auth_type: String,
    key_path: Option<String>,
    password: Option<String>,
    key_passphrase: Option<String>,
    folder_id: Option<String>,
    tags: Option<Vec<String>>,
    color: Option<String>,
) -> Result<(), String> {
    let state = app.state::<AppState>();

    // Charger les sessions existantes
    let mut sessions = load_sessions()?;

    // Supprimer l'ancienne session si elle existe
    sessions.retain(|s| s.id != id);

    // Créer la nouvelle session
    let auth = match auth_type.as_str() {
        "key" => AuthType::Key,
        _ => AuthType::Password,
    };

    let session = SavedSession {
        id: id.clone(),
        name,
        host,
        port,
        username,
        auth_type: auth.clone(),
        key_path,
        folder_id,
        tags: tags.unwrap_or_default(),
        color,
    };

    sessions.push(session);

    // Sauvegarder le fichier JSON
    save_sessions(&sessions)?;

    // Stocker les credentials dans le vault (si déverrouillé)
    if state.vault.is_unlocked() {
        if let Some(pwd) = password {
            if !pwd.is_empty() {
                state.vault.store_credential(&id, VaultCredentialType::Password, &pwd)?;
            }
        }

        if let Some(passphrase) = key_passphrase {
            if !passphrase.is_empty() {
                state.vault.store_credential(&id, VaultCredentialType::KeyPassphrase, &passphrase)?;
            }
        }
    }

    Ok(())
}

#[tauri::command]
fn delete_saved_session(app: AppHandle, id: String) -> Result<(), String> {
    let state = app.state::<AppState>();

    // Charger les sessions
    let mut sessions = load_sessions()?;

    // Supprimer la session
    sessions.retain(|s| s.id != id);

    // Sauvegarder
    save_sessions(&sessions)?;

    // Supprimer les credentials du vault (si déverrouillé)
    if state.vault.is_unlocked() {
        let _ = state.vault.delete_all_credentials(&id);
    }

    Ok(())
}

/// Récupère les credentials pour une session (pour connexion)
#[tauri::command]
fn get_session_credentials(app: AppHandle, id: String) -> Result<SessionCredentials, String> {
    let state = app.state::<AppState>();

    if !state.vault.is_unlocked() {
        return Err("Vault is locked".to_string());
    }

    let password = state.vault.get_credential(&id, VaultCredentialType::Password)?;
    let key_passphrase = state.vault.get_credential(&id, VaultCredentialType::KeyPassphrase)?;

    Ok(SessionCredentials {
        password,
        key_passphrase,
    })
}

#[derive(serde::Serialize)]
struct SessionCredentials {
    password: Option<String>,
    key_passphrase: Option<String>,
}

// ============================================================================
// Commandes Storage (Dossiers)
// ============================================================================

#[derive(serde::Serialize)]
struct FolderResponse {
    id: String,
    name: String,
    color: Option<String>,
    parent_id: Option<String>,
    order: i32,
    expanded: bool,
}

impl From<SessionFolder> for FolderResponse {
    fn from(f: SessionFolder) -> Self {
        Self {
            id: f.id,
            name: f.name,
            color: f.color,
            parent_id: f.parent_id,
            order: f.order,
            expanded: f.expanded,
        }
    }
}

#[tauri::command]
fn get_folders() -> Result<Vec<FolderResponse>, String> {
    let folders = load_folders()?;
    Ok(folders.into_iter().map(|f| f.into()).collect())
}

#[tauri::command]
fn create_folder(name: String, color: Option<String>, parent_id: Option<String>) -> Result<FolderResponse, String> {
    let folder = storage_create_folder(name, color, parent_id)?;
    Ok(folder.into())
}

#[tauri::command]
fn update_folder(
    id: String,
    name: Option<String>,
    color: Option<String>,
    parent_id: Option<Option<String>>,
    expanded: Option<bool>,
) -> Result<FolderResponse, String> {
    let folder = storage_update_folder(id, name, color, parent_id, expanded)?;
    Ok(folder.into())
}

#[tauri::command]
fn delete_folder(id: String) -> Result<(), String> {
    // Déplacer les sessions du dossier à la racine
    let mut sessions = load_sessions()?;
    for session in sessions.iter_mut() {
        if session.folder_id.as_ref() == Some(&id) {
            session.folder_id = None;
        }
    }
    save_sessions(&sessions)?;

    // Supprimer le dossier
    storage_delete_folder(id)?;
    Ok(())
}

#[tauri::command]
fn reorder_folders(folder_ids: Vec<String>, parent_id: Option<String>) -> Result<(), String> {
    storage_reorder_folders(folder_ids, parent_id)
}

/// Met à jour le dossier d'une session
#[tauri::command]
fn update_session_folder(session_id: String, folder_id: Option<String>) -> Result<(), String> {
    let mut sessions = load_sessions()?;

    if let Some(session) = sessions.iter_mut().find(|s| s.id == session_id) {
        session.folder_id = folder_id;
    } else {
        return Err(format!("Session not found: {}", session_id));
    }

    save_sessions(&sessions)
}

/// Met à jour les tags d'une session
#[tauri::command]
fn update_session_tags(session_id: String, tags: Vec<String>) -> Result<(), String> {
    let mut sessions = load_sessions()?;

    if let Some(session) = sessions.iter_mut().find(|s| s.id == session_id) {
        session.tags = tags;
    } else {
        return Err(format!("Session not found: {}", session_id));
    }

    save_sessions(&sessions)
}

/// Met à jour la couleur d'une session
#[tauri::command]
fn update_session_color(session_id: String, color: Option<String>) -> Result<(), String> {
    let mut sessions = load_sessions()?;

    if let Some(session) = sessions.iter_mut().find(|s| s.id == session_id) {
        session.color = color;
    } else {
        return Err(format!("Session not found: {}", session_id));
    }

    save_sessions(&sessions)
}

// ============================================================================
// Commandes Storage (Sessions récentes)
// ============================================================================

#[derive(serde::Serialize)]
struct RecentSessionResponse {
    id: String,
    name: String,
    host: String,
    port: u16,
    username: String,
    auth_type: String,
    key_path: Option<String>,
    last_used: u64,
}

impl From<RecentSession> for RecentSessionResponse {
    fn from(s: RecentSession) -> Self {
        Self {
            id: s.id,
            name: s.name,
            host: s.host,
            port: s.port,
            username: s.username,
            auth_type: s.auth_type,
            key_path: s.key_path,
            last_used: s.last_used,
        }
    }
}

#[tauri::command]
fn get_recent_sessions() -> Result<Vec<RecentSessionResponse>, String> {
    let sessions = load_recent_sessions()?;
    Ok(sessions.into_iter().map(|s| s.into()).collect())
}

#[tauri::command]
fn add_to_recent(
    name: String,
    host: String,
    port: u16,
    username: String,
    auth_type: String,
    key_path: Option<String>,
) -> Result<(), String> {
    let session = RecentSession {
        id: format!("recent-{}-{}", host, std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0)),
        name,
        host,
        port,
        username,
        auth_type,
        key_path,
        last_used: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0),
    };

    add_recent_session(session)
}

#[tauri::command]
fn remove_from_recent(id: String) -> Result<(), String> {
    remove_recent_session(&id)
}

#[tauri::command]
fn clear_recent() -> Result<(), String> {
    clear_recent_sessions()
}

// ============================================================================
// Settings Commands
// ============================================================================

#[tauri::command]
fn load_settings() -> Result<AppSettings, String> {
    load_app_settings()
}

#[tauri::command]
fn save_settings(settings: AppSettings) -> Result<(), String> {
    save_app_settings(&settings)
}

// ============================================================================
// Tunnel Commands (SSH Port Forwarding)
// ============================================================================

/// Create a new SSH tunnel (local, remote, or dynamic forwarding)
#[tauri::command]
async fn tunnel_create(
    app: AppHandle,
    session_id: String,
    tunnel_type: String, // "local" | "remote" | "dynamic"
    local_port: u16,
    remote_host: Option<String>,
    remote_port: Option<u16>,
) -> Result<TunnelInfo, String> {
    let state = app.state::<AppState>();
    
    // Get SSH config for this session
    let ssh_config = state
        .session_manager
        .get_ssh_config(&session_id)
        .ok_or_else(|| "SSH session not found".to_string())?;
    
    let tunnel_id = match tunnel_type.as_str() {
        "local" => {
            let remote_host = remote_host.ok_or("remote_host is required for local forwarding")?;
            let remote_port = remote_port.ok_or("remote_port is required for local forwarding")?;
            tunnels::local_forward::start_local_forward(
                state.tunnel_manager.clone(),
                &ssh_config,
                session_id,
                local_port,
                remote_host,
                remote_port,
            ).await?
        }
        "remote" => {
            let local_host = remote_host.unwrap_or_else(|| "127.0.0.1".to_string());
            let remote_port = remote_port.ok_or("remote_port is required for remote forwarding")?;
            tunnels::remote_forward::start_remote_forward(
                state.tunnel_manager.clone(),
                &ssh_config,
                session_id,
                remote_port,
                local_host,
                local_port,
            ).await?
        }
        "dynamic" => {
            tunnels::dynamic_forward::start_dynamic_forward(
                state.tunnel_manager.clone(),
                &ssh_config,
                session_id,
                local_port,
            ).await?
        }
        _ => return Err(format!("Invalid tunnel type: {}", tunnel_type)),
    };
    
    // Return the tunnel info
    state.tunnel_manager.get(&tunnel_id)
        .ok_or_else(|| "Failed to get tunnel info".to_string())
}

/// Stop a tunnel
#[tauri::command]
async fn tunnel_stop(app: AppHandle, tunnel_id: String) -> Result<(), String> {
    let state = app.state::<AppState>();
    state.tunnel_manager.stop(&tunnel_id)
}

/// List all tunnels, optionally filtered by session_id
#[tauri::command]
async fn tunnel_list(app: AppHandle, session_id: Option<String>) -> Result<Vec<TunnelInfo>, String> {
    let state = app.state::<AppState>();
    Ok(state.tunnel_manager.list(session_id.as_deref()))
}

/// Get info for a specific tunnel
#[tauri::command]
async fn tunnel_get(app: AppHandle, tunnel_id: String) -> Result<TunnelInfo, String> {
    let state = app.state::<AppState>();
    state.tunnel_manager.get(&tunnel_id)
        .ok_or_else(|| format!("Tunnel not found: {}", tunnel_id))
}

/// Remove a stopped tunnel from the list
#[tauri::command]
async fn tunnel_remove(app: AppHandle, tunnel_id: String) -> Result<(), String> {
    let state = app.state::<AppState>();
    state.tunnel_manager.remove(&tunnel_id);
    Ok(())
}

// ============================================================================
// Commandes Plugins
// ============================================================================

/// Response format for plugin list
#[derive(serde::Serialize)]
struct PluginResponse {
    id: String,
    name: String,
    version: String,
    author: Option<String>,
    description: Option<String>,
    status: String,
    permissions: Vec<String>,
    panels: Vec<PanelResponse>,
    commands: Vec<CommandResponse>,
}

#[derive(serde::Serialize)]
struct PanelResponse {
    id: String,
    title: String,
    icon: Option<String>,
    position: String,
}

#[derive(serde::Serialize)]
struct CommandResponse {
    id: String,
    title: String,
    shortcut: Option<String>,
}

impl From<PluginState> for PluginResponse {
    fn from(state: PluginState) -> Self {
        Self {
            id: state.manifest.id,
            name: state.manifest.name,
            version: state.manifest.version,
            author: state.manifest.author,
            description: state.manifest.description,
            status: match state.status {
                plugins::PluginStatus::Disabled => "disabled".to_string(),
                plugins::PluginStatus::Enabled => "enabled".to_string(),
                plugins::PluginStatus::Error => "error".to_string(),
            },
            permissions: state.manifest.permissions.iter().map(|p| p.to_string()).collect(),
            panels: state.manifest.panels.into_iter().map(|p| PanelResponse {
                id: p.id,
                title: p.title,
                icon: p.icon,
                position: match p.position {
                    plugins::PanelPosition::Right => "right".to_string(),
                    plugins::PanelPosition::Left => "left".to_string(),
                    plugins::PanelPosition::Bottom => "bottom".to_string(),
                    plugins::PanelPosition::FloatingLeft => "floating-left".to_string(),
                    plugins::PanelPosition::FloatingRight => "floating-right".to_string(),
                },
            }).collect(),
            commands: state.manifest.commands.into_iter().map(|c| CommandResponse {
                id: c.id,
                title: c.title,
                shortcut: c.shortcut,
            }).collect(),
        }
    }
}

#[tauri::command]
fn list_plugins(app: AppHandle) -> Result<Vec<PluginResponse>, String> {
    let state = app.state::<AppState>();
    let plugins = state.plugin_manager.list_plugins();
    Ok(plugins.into_iter().map(|p| p.into()).collect())
}

#[tauri::command]
fn get_plugin_manifest(app: AppHandle, id: String) -> Result<PluginResponse, String> {
    let state = app.state::<AppState>();
    let plugin = state.plugin_manager.get_plugin(&id)
        .ok_or_else(|| format!("Plugin not found: {}", id))?;
    Ok(plugin.into())
}

#[tauri::command]
fn enable_plugin(app: AppHandle, id: String) -> Result<(), String> {
    let state = app.state::<AppState>();
    state.plugin_manager.enable_plugin(&id)
}

#[tauri::command]
fn disable_plugin(app: AppHandle, id: String) -> Result<(), String> {
    let state = app.state::<AppState>();
    state.plugin_manager.disable_plugin(&id)
}

#[tauri::command]
fn get_plugin_file(app: AppHandle, plugin_id: String, file_path: String) -> Result<String, String> {
    let state = app.state::<AppState>();
    state.plugin_manager.get_plugin_file(&plugin_id, &file_path)
}

#[tauri::command]
fn refresh_plugins(app: AppHandle) -> Result<Vec<PluginResponse>, String> {
    let state = app.state::<AppState>();
    state.plugin_manager.refresh()?;
    let plugins = state.plugin_manager.list_plugins();
    Ok(plugins.into_iter().map(|p| p.into()).collect())
}

#[tauri::command]
fn plugin_storage_get(app: AppHandle, plugin_id: String, key: String) -> Result<Option<serde_json::Value>, String> {
    let state = app.state::<AppState>();
    let plugin = state.plugin_manager.get_plugin(&plugin_id)
        .ok_or_else(|| format!("Plugin not found: {}", plugin_id))?;

    let api = plugins::PluginApi::new(plugin_id, plugin.manifest.permissions)?;
    api.storage_get(&key)
}

#[tauri::command]
fn plugin_storage_set(app: AppHandle, plugin_id: String, key: String, value: serde_json::Value) -> Result<(), String> {
    let state = app.state::<AppState>();
    let plugin = state.plugin_manager.get_plugin(&plugin_id)
        .ok_or_else(|| format!("Plugin not found: {}", plugin_id))?;

    let api = plugins::PluginApi::new(plugin_id, plugin.manifest.permissions)?;
    api.storage_set(&key, value)
}

#[tauri::command]
fn plugin_storage_delete(app: AppHandle, plugin_id: String, key: String) -> Result<(), String> {
    let state = app.state::<AppState>();
    let plugin = state.plugin_manager.get_plugin(&plugin_id)
        .ok_or_else(|| format!("Plugin not found: {}", plugin_id))?;

    let api = plugins::PluginApi::new(plugin_id, plugin.manifest.permissions)?;
    api.storage_delete(&key)
}

#[tauri::command]
fn plugin_invoke(
    app: AppHandle,
    plugin_id: String,
    command: String,
    args: std::collections::HashMap<String, serde_json::Value>,
) -> Result<serde_json::Value, String> {
    let state = app.state::<AppState>();
    let plugin = state.plugin_manager.get_plugin(&plugin_id)
        .ok_or_else(|| format!("Plugin not found: {}", plugin_id))?;

    let api = plugins::PluginApi::new(plugin_id, plugin.manifest.permissions)?;
    api.invoke(&command, args)
}

// ============================================================================
// Point d'entrée
// ============================================================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let session_manager = SessionManager::new(app.handle().clone());
            let plugin_manager = Arc::new(PluginManager::default());
            let vault = Arc::new(VaultState::new().expect("Failed to initialize vault"));
            let edit_watcher = Arc::new(Mutex::new(EditWatcher::new(
                session_manager.clone(),
                app.handle().clone(),
            )));
            let tunnel_manager = Arc::new(TunnelManager::new());
            app.manage(AppState {
                session_manager,
                plugin_manager,
                vault: vault.clone(),
                edit_watcher,
                tunnel_manager,
            });
            // Also manage vault directly for vault commands
            app.manage(vault);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            create_pty_session,
            create_ssh_session,
            // Telnet & Serial
            create_telnet_session,
            get_serial_ports,
            create_serial_session,
            // Host key verification
            check_host_key,
            trust_host_key,
            update_host_key,
            reject_host_key,
            write_to_pty,
            resize_pty,
            close_pty_session,
            ssh_exec_command,
            get_home_dir,
            // SFTP
            register_sftp_session,
            sftp_list,
            sftp_read,
            sftp_write,
            sftp_remove,
            sftp_rename,
            sftp_mkdir,
            sftp_edit_external,
            sftp_stop_editing,
            sftp_get_editing_files,
            // Saved sessions
            load_saved_sessions,
            save_session,
            delete_saved_session,
            get_session_credentials,
            // Folders
            get_folders,
            create_folder,
            update_folder,
            delete_folder,
            reorder_folders,
            update_session_folder,
            update_session_tags,
            update_session_color,
            // Recent sessions
            get_recent_sessions,
            add_to_recent,
            remove_from_recent,
            clear_recent,
            // Settings
            load_settings,
            save_settings,
            // Tunnels (SSH Port Forwarding)
            tunnel_create,
            tunnel_stop,
            tunnel_list,
            tunnel_get,
            tunnel_remove,
            // Plugins
            list_plugins,
            get_plugin_manifest,
            enable_plugin,
            disable_plugin,
            get_plugin_file,
            refresh_plugins,
            plugin_storage_get,
            plugin_storage_set,
            plugin_storage_delete,
            plugin_invoke,
            // Vault
            storage::vault::get_vault_status,
            storage::vault::create_vault,
            storage::vault::unlock_vault_with_password,
            storage::vault::unlock_vault_with_pin,
            storage::vault::lock_vault,
            storage::vault::is_vault_unlocked,
            storage::vault::vault_store_credential,
            storage::vault::vault_get_credential,
            storage::vault::vault_delete_credential,
            storage::vault::vault_delete_all_credentials,
            storage::vault::update_vault_settings,
            storage::vault::change_master_password,
            storage::vault::setup_vault_pin,
            storage::vault::remove_vault_pin,
            storage::vault::delete_vault,
            storage::vault::check_vault_auto_lock,
            storage::vault::set_vault_require_unlock_on_connect,
            storage::vault::get_vault_require_unlock_on_connect,
            // FIDO2 Security Keys
            storage::vault::is_security_key_available,
            storage::vault::detect_security_keys,
            storage::vault::setup_vault_security_key,
            storage::vault::unlock_vault_with_security_key,
            storage::vault::remove_vault_security_key,
            // Bastion Profiles
            storage::vault::list_bastions,
            storage::vault::get_bastion,
            storage::vault::get_bastion_credentials,
            storage::vault::create_bastion,
            storage::vault::update_bastion,
            storage::vault::delete_bastion,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
