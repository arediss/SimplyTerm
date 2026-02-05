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
    connect_ssh, create_local_session, ssh_exec::{ssh_exec, get_server_stats, ServerStats}, SshAuth, SshConfig, FileEntry, sftp_read_file,
    check_host_key_only, HostKeyCheckResult, accept_pending_key, accept_and_update_pending_key, remove_pending_key,
    connect_telnet, connect_serial, list_serial_ports, SerialConfig, SerialPortInfo,
};
use plugins::{PluginManager, InstalledPlugin, PluginState};
use session::SessionManager;
use storage::{
    load_sessions, save_sessions, SavedSession, AuthType,
    load_settings as load_app_settings, save_settings as save_app_settings, AppSettings,
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

/// Core session response (connection info only)
/// Plugin-managed metadata (folders, tags, colors) is retrieved separately via session metadata API
#[derive(serde::Serialize)]
struct SavedSessionResponse {
    id: String,
    name: String,
    host: String,
    port: u16,
    username: String,
    auth_type: String,
    key_path: Option<String>,
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
        }
    }
}

#[tauri::command]
fn load_saved_sessions() -> Result<Vec<SavedSessionResponse>, String> {
    let sessions = load_sessions()?;
    Ok(sessions.into_iter().map(|s| s.into()).collect())
}

/// Save a session (core connection info only)
/// Plugin-managed metadata should be stored via session metadata API
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
) -> Result<(), String> {
    let state = app.state::<AppState>();

    let mut sessions = load_sessions()?;
    sessions.retain(|s| s.id != id);

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
        auth_type: auth,
        key_path,
    };

    sessions.push(session);
    save_sessions(&sessions)?;

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

/// Gets credentials for a session
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
// Plugin Commands
// ============================================================================

/// Response format for plugin list
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct PluginResponse {
    id: String,
    name: String,
    version: String,
    api_version: String,
    author: String,
    description: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    homepage: Option<String>,
    main: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    icon: Option<String>,
    status: String,
    permissions: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error_message: Option<String>,
}

impl From<InstalledPlugin> for PluginResponse {
    fn from(plugin: InstalledPlugin) -> Self {
        Self {
            id: plugin.manifest.id,
            name: plugin.manifest.name,
            version: plugin.manifest.version,
            api_version: plugin.manifest.api_version,
            author: plugin.manifest.author,
            description: plugin.manifest.description,
            homepage: plugin.manifest.homepage,
            main: plugin.manifest.main,
            icon: plugin.manifest.icon,
            status: match plugin.state {
                PluginState::Disabled => "disabled".to_string(),
                PluginState::Enabled => "enabled".to_string(),
                PluginState::Error => "error".to_string(),
            },
            permissions: plugin.manifest.permissions.iter().map(|p| {
                // Use serde serialization to get snake_case format
                serde_json::to_string(p).unwrap_or_default().trim_matches('"').to_string()
            }).collect(),
            error_message: plugin.error_message,
        }
    }
}

#[tauri::command]
fn list_plugins(app: AppHandle) -> Result<Vec<PluginResponse>, String> {
    let state = app.state::<AppState>();
    let plugins = state.plugin_manager.list_plugins()
        .map_err(|e| e.message)?;
    Ok(plugins.into_iter().map(|p| p.into()).collect())
}

#[tauri::command]
fn get_plugin_manifest(app: AppHandle, id: String) -> Result<PluginResponse, String> {
    let state = app.state::<AppState>();
    let plugin = state.plugin_manager.get_plugin(&id)
        .map_err(|e| e.message)?
        .ok_or_else(|| format!("Plugin not found: {}", id))?;
    Ok(plugin.into())
}

#[tauri::command]
fn enable_plugin(app: AppHandle, id: String) -> Result<(), String> {
    let state = app.state::<AppState>();
    state.plugin_manager.enable_plugin(&id)
        .map_err(|e| e.message)
}

#[tauri::command]
fn disable_plugin(app: AppHandle, id: String) -> Result<(), String> {
    let state = app.state::<AppState>();
    state.plugin_manager.disable_plugin(&id)
        .map_err(|e| e.message)
}

#[tauri::command]
fn grant_plugin_permissions(app: AppHandle, id: String) -> Result<(), String> {
    let state = app.state::<AppState>();
    state.plugin_manager.grant_all_permissions(&id)
        .map_err(|e| e.message)
}

#[tauri::command]
fn uninstall_plugin(app: AppHandle, id: String) -> Result<(), String> {
    let state = app.state::<AppState>();
    state.plugin_manager.uninstall_plugin(&id)
        .map_err(|e| e.message)
}

#[tauri::command]
fn plugin_storage_read(app: AppHandle, plugin_id: String, path: String) -> Result<String, String> {
    let state = app.state::<AppState>();
    let plugin = state.plugin_manager.get_plugin(&plugin_id)
        .map_err(|e| e.message)?
        .ok_or_else(|| format!("Plugin not found: {}", plugin_id))?;

    let data_dir = state.plugin_manager.get_plugin_data_dir(&plugin_id)
        .map_err(|e| e.message)?;

    plugins::api_v1::storage::read_file(
        &plugin.granted_permissions,
        &data_dir,
        &path,
    ).map_err(|e| e.message)
}

#[tauri::command]
fn plugin_storage_write(app: AppHandle, plugin_id: String, path: String, content: String) -> Result<(), String> {
    let state = app.state::<AppState>();
    let plugin = state.plugin_manager.get_plugin(&plugin_id)
        .map_err(|e| e.message)?
        .ok_or_else(|| format!("Plugin not found: {}", plugin_id))?;

    let data_dir = state.plugin_manager.get_plugin_data_dir(&plugin_id)
        .map_err(|e| e.message)?;

    plugins::api_v1::storage::write_file(
        &plugin.granted_permissions,
        &data_dir,
        &path,
        &content,
    ).map_err(|e| e.message)
}

#[tauri::command]
fn plugin_storage_delete(app: AppHandle, plugin_id: String, path: String) -> Result<(), String> {
    let state = app.state::<AppState>();
    let plugin = state.plugin_manager.get_plugin(&plugin_id)
        .map_err(|e| e.message)?
        .ok_or_else(|| format!("Plugin not found: {}", plugin_id))?;

    let data_dir = state.plugin_manager.get_plugin_data_dir(&plugin_id)
        .map_err(|e| e.message)?;

    plugins::api_v1::storage::delete_file(
        &plugin.granted_permissions,
        &data_dir,
        &path,
    ).map_err(|e| e.message)
}

#[tauri::command]
fn plugin_storage_list(app: AppHandle, plugin_id: String, path: String) -> Result<Vec<plugins::api_v1::storage::FileEntry>, String> {
    let state = app.state::<AppState>();
    let plugin = state.plugin_manager.get_plugin(&plugin_id)
        .map_err(|e| e.message)?
        .ok_or_else(|| format!("Plugin not found: {}", plugin_id))?;

    let data_dir = state.plugin_manager.get_plugin_data_dir(&plugin_id)
        .map_err(|e| e.message)?;

    plugins::api_v1::storage::list_directory(
        &plugin.granted_permissions,
        &data_dir,
        &path,
    ).map_err(|e| e.message)
}

/// Write to terminal (for plugins)
#[tauri::command]
fn plugin_api_write_to_terminal(
    app: AppHandle,
    plugin_id: String,
    session_id: String,
    data: String,
) -> Result<(), String> {
    use plugins::manifest::Permission;

    let state = app.state::<AppState>();
    let plugin = state.plugin_manager.get_plugin(&plugin_id)
        .map_err(|e| e.message)?
        .ok_or_else(|| format!("Plugin not found: {}", plugin_id))?;

    // Check permission
    if !plugin.granted_permissions.has(Permission::TerminalWrite) {
        return Err("Permission denied: terminal_write required".to_string());
    }

    state.session_manager.write(&session_id, data.as_bytes())
}

/// Get plugin main file content (for loading in frontend)
#[tauri::command]
fn get_plugin_file(app: AppHandle, plugin_id: String, file_path: String) -> Result<String, String> {
    let state = app.state::<AppState>();
    let plugin = state.plugin_manager.get_plugin(&plugin_id)
        .map_err(|e| e.message)?
        .ok_or_else(|| format!("Plugin not found: {}", plugin_id))?;

    let full_path = plugin.install_path.join(&file_path);

    std::fs::read_to_string(&full_path)
        .map_err(|e| format!("Failed to read plugin file: {}", e))
}

/// Refresh plugins list (scan for new/updated plugins)
#[tauri::command]
fn refresh_plugins(app: AppHandle) -> Result<Vec<PluginResponse>, String> {
    let state = app.state::<AppState>();

    println!("[refresh_plugins] Called, scanning plugins...");

    // Scan plugins directory for new plugins
    match state.plugin_manager.scan_plugins() {
        Ok(discovered) => println!("[refresh_plugins] Discovered {} new plugins", discovered.len()),
        Err(e) => println!("[refresh_plugins] Scan error: {}", e.message),
    }

    // Return updated list
    let plugins = state.plugin_manager.list_plugins()
        .map_err(|e| e.message)?;
    println!("[refresh_plugins] Returning {} plugins", plugins.len());
    Ok(plugins.into_iter().map(|p| p.into()).collect())
}

/// Get the plugins directory path
#[tauri::command]
fn get_plugins_dir(app: AppHandle) -> Result<String, String> {
    let state = app.state::<AppState>();
    Ok(state.plugin_manager.plugins_dir().to_string_lossy().to_string())
}

// ============================================================================
// Plugin API v1 - Sessions
// ============================================================================

#[tauri::command]
fn plugin_api_list_sessions(app: AppHandle, plugin_id: String) -> Result<Vec<SavedSessionResponse>, String> {
    use plugins::manifest::Permission;

    let state = app.state::<AppState>();
    let plugin = state.plugin_manager.get_plugin(&plugin_id)
        .map_err(|e| e.message)?
        .ok_or_else(|| format!("Plugin not found: {}", plugin_id))?;

    if !plugin.granted_permissions.has(Permission::SessionsRead) {
        return Err("Permission denied: sessions_read required".to_string());
    }

    let sessions = load_sessions()?;
    Ok(sessions.into_iter().map(|s| s.into()).collect())
}

#[tauri::command]
fn plugin_api_get_session(app: AppHandle, plugin_id: String, id: String) -> Result<Option<SavedSessionResponse>, String> {
    use plugins::manifest::Permission;

    let state = app.state::<AppState>();
    let plugin = state.plugin_manager.get_plugin(&plugin_id)
        .map_err(|e| e.message)?
        .ok_or_else(|| format!("Plugin not found: {}", plugin_id))?;

    if !plugin.granted_permissions.has(Permission::SessionsRead) {
        return Err("Permission denied: sessions_read required".to_string());
    }

    let sessions = load_sessions()?;
    Ok(sessions.into_iter().find(|s| s.id == id).map(|s| s.into()))
}

/// Create a new session (core connection info only)
/// Plugin-managed metadata should be stored via session metadata API
#[tauri::command]
fn plugin_api_create_session(
    app: AppHandle,
    plugin_id: String,
    name: String,
    host: String,
    port: u16,
    username: String,
    auth_type: String,
    key_path: Option<String>,
) -> Result<SavedSessionResponse, String> {
    use plugins::manifest::Permission;

    let state = app.state::<AppState>();
    let plugin = state.plugin_manager.get_plugin(&plugin_id)
        .map_err(|e| e.message)?
        .ok_or_else(|| format!("Plugin not found: {}", plugin_id))?;

    if !plugin.granted_permissions.has(Permission::SessionsWrite) {
        return Err("Permission denied: sessions_write required".to_string());
    }

    let id = uuid::Uuid::new_v4().to_string();
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
        auth_type: auth,
        key_path,
    };

    let mut sessions = load_sessions()?;
    sessions.push(session.clone());
    save_sessions(&sessions)?;

    Ok(session.into())
}

/// Update session (core connection info only)
/// Plugin-managed metadata should be stored via session metadata API
#[tauri::command]
fn plugin_api_update_session(
    app: AppHandle,
    plugin_id: String,
    id: String,
    name: Option<String>,
    host: Option<String>,
    port: Option<u16>,
    username: Option<String>,
    auth_type: Option<String>,
    key_path: Option<Option<String>>,
) -> Result<SavedSessionResponse, String> {
    use plugins::manifest::Permission;

    let state = app.state::<AppState>();
    let plugin = state.plugin_manager.get_plugin(&plugin_id)
        .map_err(|e| e.message)?
        .ok_or_else(|| format!("Plugin not found: {}", plugin_id))?;

    if !plugin.granted_permissions.has(Permission::SessionsWrite) {
        return Err("Permission denied: sessions_write required".to_string());
    }

    let mut sessions = load_sessions()?;
    let session = sessions.iter_mut()
        .find(|s| s.id == id)
        .ok_or_else(|| format!("Session not found: {}", id))?;

    if let Some(n) = name { session.name = n; }
    if let Some(h) = host { session.host = h; }
    if let Some(p) = port { session.port = p; }
    if let Some(u) = username { session.username = u; }
    if let Some(at) = auth_type {
        session.auth_type = match at.as_str() {
            "key" => AuthType::Key,
            _ => AuthType::Password,
        };
    }
    if let Some(kp) = key_path { session.key_path = kp; }

    let updated = session.clone();
    save_sessions(&sessions)?;

    Ok(updated.into())
}

#[tauri::command]
fn plugin_api_delete_session(app: AppHandle, plugin_id: String, id: String) -> Result<(), String> {
    use plugins::manifest::Permission;

    let state = app.state::<AppState>();
    let plugin = state.plugin_manager.get_plugin(&plugin_id)
        .map_err(|e| e.message)?
        .ok_or_else(|| format!("Plugin not found: {}", plugin_id))?;

    if !plugin.granted_permissions.has(Permission::SessionsWrite) {
        return Err("Permission denied: sessions_write required".to_string());
    }

    let mut sessions = load_sessions()?;
    sessions.retain(|s| s.id != id);
    save_sessions(&sessions)
}

// ============================================================================
// Plugin API v1 - Session Metadata
// ============================================================================

#[tauri::command]
fn plugin_api_get_session_metadata(
    app: AppHandle,
    plugin_id: String,
    session_id: String,
) -> Result<Option<serde_json::Value>, String> {
    let state = app.state::<AppState>();
    let plugin = state.plugin_manager.get_plugin(&plugin_id)
        .map_err(|e| e.message)?
        .ok_or_else(|| format!("Plugin not found: {}", plugin_id))?;

    let data_dir = state.plugin_manager.get_plugin_data_dir(&plugin_id)
        .map_err(|e| e.message)?;

    plugins::api_v1::session_metadata::get_session_metadata(
        &plugin.granted_permissions,
        &data_dir,
        &session_id,
    ).map_err(|e| e.message)
}

#[tauri::command]
fn plugin_api_get_all_session_metadata(
    app: AppHandle,
    plugin_id: String,
) -> Result<std::collections::HashMap<String, serde_json::Value>, String> {
    let state = app.state::<AppState>();
    let plugin = state.plugin_manager.get_plugin(&plugin_id)
        .map_err(|e| e.message)?
        .ok_or_else(|| format!("Plugin not found: {}", plugin_id))?;

    let data_dir = state.plugin_manager.get_plugin_data_dir(&plugin_id)
        .map_err(|e| e.message)?;

    plugins::api_v1::session_metadata::get_all_session_metadata(
        &plugin.granted_permissions,
        &data_dir,
    ).map_err(|e| e.message)
}

#[tauri::command]
fn plugin_api_set_session_metadata(
    app: AppHandle,
    plugin_id: String,
    session_id: String,
    metadata: serde_json::Value,
) -> Result<(), String> {
    let state = app.state::<AppState>();
    let plugin = state.plugin_manager.get_plugin(&plugin_id)
        .map_err(|e| e.message)?
        .ok_or_else(|| format!("Plugin not found: {}", plugin_id))?;

    let data_dir = state.plugin_manager.get_plugin_data_dir(&plugin_id)
        .map_err(|e| e.message)?;

    plugins::api_v1::session_metadata::set_session_metadata(
        &plugin.granted_permissions,
        &data_dir,
        &session_id,
        metadata,
    ).map_err(|e| e.message)
}

#[tauri::command]
fn plugin_api_update_session_metadata(
    app: AppHandle,
    plugin_id: String,
    session_id: String,
    updates: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let state = app.state::<AppState>();
    let plugin = state.plugin_manager.get_plugin(&plugin_id)
        .map_err(|e| e.message)?
        .ok_or_else(|| format!("Plugin not found: {}", plugin_id))?;

    let data_dir = state.plugin_manager.get_plugin_data_dir(&plugin_id)
        .map_err(|e| e.message)?;

    plugins::api_v1::session_metadata::update_session_metadata(
        &plugin.granted_permissions,
        &data_dir,
        &session_id,
        updates,
    ).map_err(|e| e.message)
}

#[tauri::command]
fn plugin_api_delete_session_metadata(
    app: AppHandle,
    plugin_id: String,
    session_id: String,
) -> Result<bool, String> {
    let state = app.state::<AppState>();
    let plugin = state.plugin_manager.get_plugin(&plugin_id)
        .map_err(|e| e.message)?
        .ok_or_else(|| format!("Plugin not found: {}", plugin_id))?;

    let data_dir = state.plugin_manager.get_plugin_data_dir(&plugin_id)
        .map_err(|e| e.message)?;

    plugins::api_v1::session_metadata::delete_session_metadata(
        &plugin.granted_permissions,
        &data_dir,
        &session_id,
    ).map_err(|e| e.message)
}

// ============================================================================
// Plugin API v1 - Settings
// ============================================================================

#[tauri::command]
fn plugin_api_get_settings(app: AppHandle, plugin_id: String) -> Result<AppSettings, String> {
    use plugins::manifest::Permission;

    let state = app.state::<AppState>();
    let plugin = state.plugin_manager.get_plugin(&plugin_id)
        .map_err(|e| e.message)?
        .ok_or_else(|| format!("Plugin not found: {}", plugin_id))?;

    if !plugin.granted_permissions.has(Permission::SettingsRead) {
        return Err("Permission denied: settings_read required".to_string());
    }

    load_app_settings()
}

// ============================================================================
// Plugin API v1 - Vault
// ============================================================================

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct PluginVaultStatus {
    exists: bool,
    is_unlocked: bool,
}

#[tauri::command]
fn plugin_api_vault_status(app: AppHandle, plugin_id: String) -> Result<PluginVaultStatus, String> {
    use plugins::manifest::Permission;

    let state = app.state::<AppState>();
    let plugin = state.plugin_manager.get_plugin(&plugin_id)
        .map_err(|e| e.message)?
        .ok_or_else(|| format!("Plugin not found: {}", plugin_id))?;

    if !plugin.granted_permissions.has(Permission::VaultStatus) {
        return Err("Permission denied: vault_status required".to_string());
    }

    Ok(PluginVaultStatus {
        exists: state.vault.exists(),
        is_unlocked: state.vault.is_unlocked(),
    })
}

#[tauri::command]
fn plugin_api_vault_store(
    app: AppHandle,
    plugin_id: String,
    key: String,
    value: String,
) -> Result<(), String> {
    use plugins::manifest::Permission;

    let state = app.state::<AppState>();
    let plugin = state.plugin_manager.get_plugin(&plugin_id)
        .map_err(|e| e.message)?
        .ok_or_else(|| format!("Plugin not found: {}", plugin_id))?;

    if !plugin.granted_permissions.has(Permission::VaultWrite) {
        return Err("Permission denied: vault_write required".to_string());
    }

    if !state.vault.is_unlocked() {
        return Err("Vault is locked".to_string());
    }

    // Use credentials system with namespaced session_id
    // Format: "plugin:plugin_id:key" as session_id, Password as type
    let namespaced_id = format!("plugin:{}:{}", plugin_id, key);
    state.vault.store_credential(&namespaced_id, VaultCredentialType::Password, &value)
}

#[tauri::command]
fn plugin_api_vault_read(
    app: AppHandle,
    plugin_id: String,
    key: String,
) -> Result<Option<String>, String> {
    use plugins::manifest::Permission;

    let state = app.state::<AppState>();
    let plugin = state.plugin_manager.get_plugin(&plugin_id)
        .map_err(|e| e.message)?
        .ok_or_else(|| format!("Plugin not found: {}", plugin_id))?;

    if !plugin.granted_permissions.has(Permission::VaultRead) {
        return Err("Permission denied: vault_read required".to_string());
    }

    if !state.vault.is_unlocked() {
        return Err("Vault is locked".to_string());
    }

    let namespaced_id = format!("plugin:{}:{}", plugin_id, key);
    state.vault.get_credential(&namespaced_id, VaultCredentialType::Password)
}

#[tauri::command]
fn plugin_api_vault_delete(
    app: AppHandle,
    plugin_id: String,
    key: String,
) -> Result<bool, String> {
    use plugins::manifest::Permission;

    let state = app.state::<AppState>();
    let plugin = state.plugin_manager.get_plugin(&plugin_id)
        .map_err(|e| e.message)?
        .ok_or_else(|| format!("Plugin not found: {}", plugin_id))?;

    if !plugin.granted_permissions.has(Permission::VaultWrite) {
        return Err("Permission denied: vault_write required".to_string());
    }

    if !state.vault.is_unlocked() {
        return Err("Vault is locked".to_string());
    }

    let namespaced_id = format!("plugin:{}:{}", plugin_id, key);
    state.vault.delete_credential(&namespaced_id, VaultCredentialType::Password)
}

// ============================================================================
// Plugin API v1 - Vault Sync (Encrypted Export/Import)
// ============================================================================

#[tauri::command]
fn plugin_api_vault_export_encrypted(
    app: AppHandle,
    plugin_id: String,
) -> Result<storage::vault::VaultExportResult, String> {
    use plugins::manifest::Permission;

    let state = app.state::<AppState>();
    let plugin = state.plugin_manager.get_plugin(&plugin_id)
        .map_err(|e| e.message)?
        .ok_or_else(|| format!("Plugin not found: {}", plugin_id))?;

    if !plugin.granted_permissions.has(Permission::VaultExportEncrypted) {
        return Err("Permission denied: vault_export_encrypted required".to_string());
    }

    state.vault.export_encrypted()
}

#[tauri::command]
fn plugin_api_vault_import_encrypted(
    app: AppHandle,
    plugin_id: String,
    bundle: storage::vault::VaultBundle,
) -> Result<storage::vault::SyncMeta, String> {
    use plugins::manifest::Permission;

    let state = app.state::<AppState>();
    let plugin = state.plugin_manager.get_plugin(&plugin_id)
        .map_err(|e| e.message)?
        .ok_or_else(|| format!("Plugin not found: {}", plugin_id))?;

    if !plugin.granted_permissions.has(Permission::VaultImportEncrypted) {
        return Err("Permission denied: vault_import_encrypted required".to_string());
    }

    state.vault.import_encrypted(bundle)
}

// ============================================================================
// Plugin API v1 - Server Stats
// ============================================================================

#[tauri::command]
async fn plugin_api_get_server_stats(
    app: AppHandle,
    plugin_id: String,
    session_id: String,
) -> Result<ServerStats, String> {
    use plugins::manifest::Permission;

    let state = app.state::<AppState>();
    let plugin = state.plugin_manager.get_plugin(&plugin_id)
        .map_err(|e| e.message)?
        .ok_or_else(|| format!("Plugin not found: {}", plugin_id))?;

    if !plugin.granted_permissions.has(Permission::SessionsConnect) {
        return Err("Permission denied: sessions_connect required".to_string());
    }

    let config = state
        .session_manager
        .get_ssh_config(&session_id)
        .ok_or_else(|| "SSH session not found or not an SSH session".to_string())?;

    get_server_stats(&config).await
}

// ============================================================================
// Plugin API v1 - HTTP Proxy (bypasses CORS)
// ============================================================================

#[derive(Debug, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct PluginHttpRequest {
    method: String,
    url: String,
    headers: Option<std::collections::HashMap<String, String>>,
    body: Option<String>,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct PluginHttpResponse {
    status: u16,
    status_text: String,
    headers: std::collections::HashMap<String, String>,
    body: String,
}

#[tauri::command]
async fn plugin_api_http_request(
    app: AppHandle,
    plugin_id: String,
    request: PluginHttpRequest,
) -> Result<PluginHttpResponse, String> {
    use plugins::manifest::Permission;

    let state = app.state::<AppState>();
    let plugin = state.plugin_manager.get_plugin(&plugin_id)
        .map_err(|e| e.message)?
        .ok_or_else(|| format!("Plugin not found: {}", plugin_id))?;

    if !plugin.granted_permissions.has(Permission::NetworkHttp) {
        return Err("Permission denied: network_http required".to_string());
    }

    let client = reqwest::Client::new();

    let method = request.method.to_uppercase();
    let mut req = match method.as_str() {
        "GET" => client.get(&request.url),
        "PUT" => client.put(&request.url),
        "POST" => client.post(&request.url),
        "DELETE" => client.delete(&request.url),
        "PROPFIND" => client.request(reqwest::Method::from_bytes(b"PROPFIND").unwrap(), &request.url),
        "MKCOL" => client.request(reqwest::Method::from_bytes(b"MKCOL").unwrap(), &request.url),
        "OPTIONS" => client.request(reqwest::Method::OPTIONS, &request.url),
        _ => return Err(format!("Unsupported HTTP method: {}", method)),
    };

    if let Some(headers) = request.headers {
        for (key, value) in headers {
            req = req.header(&key, &value);
        }
    }

    if let Some(body) = request.body {
        req = req.body(body);
    }

    let resp = req.send().await.map_err(|e| format!("HTTP request failed: {}", e))?;

    let status = resp.status().as_u16();
    let status_text = resp.status().canonical_reason().unwrap_or("").to_string();
    let mut headers = std::collections::HashMap::new();
    for (key, value) in resp.headers() {
        if let Ok(v) = value.to_str() {
            headers.insert(key.to_string(), v.to_string());
        }
    }
    let body = resp.text().await.map_err(|e| format!("Failed to read response: {}", e))?;

    Ok(PluginHttpResponse {
        status,
        status_text,
        headers,
        body,
    })
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

            // Plugins are stored with the app (removed with app uninstall)
            // In dev mode: uses project root/plugins
            // In production: uses app installation directory/plugins
            let plugins_base_dir = if cfg!(debug_assertions) {
                // In dev mode, use CARGO_MANIFEST_DIR (src-tauri/) and go up one level to project root
                let manifest_dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
                manifest_dir.parent()
                    .map(|p| p.to_path_buf())
                    .unwrap_or(manifest_dir)
            } else {
                // In production, use the resource directory (app install folder)
                app.path().resource_dir()
                    .expect("Failed to get resource directory")
            };

            let plugin_manager = Arc::new(
                PluginManager::with_app_dir(plugins_base_dir)
                    .expect("Failed to initialize plugin manager")
            );

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
            // Saved sessions (core only - plugin metadata via session_metadata API)
            load_saved_sessions,
            save_session,
            delete_saved_session,
            get_session_credentials,
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
            get_plugin_file,
            refresh_plugins,
            get_plugins_dir,
            enable_plugin,
            disable_plugin,
            grant_plugin_permissions,
            uninstall_plugin,
            plugin_storage_read,
            plugin_storage_write,
            plugin_storage_delete,
            plugin_storage_list,
            // Plugin API v1 - Core
            plugin_api_write_to_terminal,
            plugin_api_list_sessions,
            plugin_api_get_session,
            plugin_api_create_session,
            plugin_api_update_session,
            plugin_api_delete_session,
            // Plugin API v1 - Session Metadata
            plugin_api_get_session_metadata,
            plugin_api_get_all_session_metadata,
            plugin_api_set_session_metadata,
            plugin_api_update_session_metadata,
            plugin_api_delete_session_metadata,
            // Plugin API v1 - Settings
            plugin_api_get_settings,
            plugin_api_vault_status,
            plugin_api_vault_store,
            plugin_api_vault_read,
            plugin_api_vault_delete,
            // Plugin API v1 - Vault Sync
            plugin_api_vault_export_encrypted,
            plugin_api_vault_import_encrypted,
            // Plugin API v1 - Server Stats
            plugin_api_get_server_stats,
            // Plugin API v1 - HTTP Proxy
            plugin_api_http_request,
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
            // Vault Sync
            storage::vault::vault_export_encrypted,
            storage::vault::vault_import_encrypted,
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
