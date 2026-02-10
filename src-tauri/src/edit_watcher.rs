//! File watcher for external editing with auto-upload
//!
//! This module handles watching locally edited files and automatically
//! uploading them back to the remote server via SFTP when they change.

use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use parking_lot::RwLock;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc;

use crate::connectors::sftp_write_file;
use crate::session::SessionManager;

/// Tracks files being edited externally
#[derive(Debug, Clone)]
pub struct EditedFile {
    pub session_id: String,
    pub remote_path: String,
    pub local_path: PathBuf,
    pub last_upload: Option<Instant>,
}

/// Event emitted when a file is uploaded
#[derive(serde::Serialize, Clone)]
pub struct FileUploadedEvent {
    pub session_id: String,
    pub remote_path: String,
    pub local_path: String,
    pub success: bool,
    pub error: Option<String>,
}

/// Manages file watching for external editing
pub struct EditWatcher {
    /// Maps local file paths to their remote counterparts
    tracked_files: Arc<RwLock<HashMap<PathBuf, EditedFile>>>,
    /// The file watcher instance
    watcher: Option<RecommendedWatcher>,
    /// Channel to send watch events
    event_tx: Option<mpsc::UnboundedSender<PathBuf>>,
    /// Reference to session manager for getting SSH configs
    session_manager: Arc<SessionManager>,
    /// Tauri app handle for emitting events
    app_handle: AppHandle,
    /// Debounce duration to avoid multiple uploads on rapid saves
    debounce_duration: Duration,
}

impl EditWatcher {
    /// Create a new EditWatcher
    pub fn new(session_manager: Arc<SessionManager>, app_handle: AppHandle) -> Self {
        Self {
            tracked_files: Arc::new(RwLock::new(HashMap::new())),
            watcher: None,
            event_tx: None,
            session_manager,
            app_handle,
            debounce_duration: Duration::from_millis(500),
        }
    }

    /// Initialize the file watcher
    pub fn init(&mut self) -> Result<(), String> {
        let (tx, mut rx) = mpsc::unbounded_channel::<PathBuf>();
        self.event_tx = Some(tx.clone());

        let tracked_files = self.tracked_files.clone();
        let session_manager = self.session_manager.clone();
        let app_handle = self.app_handle.clone();
        let debounce = self.debounce_duration;

        // Spawn async task to handle file change events
        tokio::spawn(async move {
            while let Some(path) = rx.recv().await {
                // Extract all needed data from the lock, then release it
                let file_info = {
                    let files = tracked_files.read();
                    if let Some(edited_file) = files.get(&path) {
                        // Check debounce
                        if let Some(last_upload) = edited_file.last_upload {
                            if last_upload.elapsed() < debounce {
                                continue;
                            }
                        }
                        Some((
                            edited_file.session_id.clone(),
                            edited_file.remote_path.clone(),
                            edited_file.local_path.clone(),
                        ))
                    } else {
                        None
                    }
                }; // Lock released here

                let (session_id, remote_path, local_path) = match file_info {
                    Some(info) => info,
                    None => continue,
                };

                // Get SSH config
                let config = match session_manager.get_ssh_config(&session_id) {
                    Some(c) => c,
                    None => {
                        eprintln!("[EditWatcher] Session not found: {}", session_id);
                        continue;
                    }
                };

                // Read local file
                let data = match std::fs::read(&local_path) {
                    Ok(d) => d,
                    Err(e) => {
                        eprintln!("[EditWatcher] Failed to read local file: {}", e);
                        let _ = app_handle.emit("sftp-file-uploaded", FileUploadedEvent {
                            session_id: session_id.clone(),
                            remote_path: remote_path.clone(),
                            local_path: local_path.to_string_lossy().to_string(),
                            success: false,
                            error: Some(format!("Failed to read local file: {}", e)),
                        });
                        continue;
                    }
                };

                // Upload to remote via pool
                let pool = session_manager.sftp_pool();
                match sftp_write_file(pool, &session_id, &config, &remote_path, data).await {
                    Ok(_) => {
                        println!("[EditWatcher] Uploaded {} -> {}", local_path.display(), remote_path);

                        // Update last upload time
                        {
                            let mut files = tracked_files.write();
                            if let Some(f) = files.get_mut(&path) {
                                f.last_upload = Some(Instant::now());
                            }
                        }

                        let _ = app_handle.emit("sftp-file-uploaded", FileUploadedEvent {
                            session_id: session_id.clone(),
                            remote_path: remote_path.clone(),
                            local_path: local_path.to_string_lossy().to_string(),
                            success: true,
                            error: None,
                        });
                    }
                    Err(e) => {
                        eprintln!("[EditWatcher] Upload failed: {}", e);
                        let _ = app_handle.emit("sftp-file-uploaded", FileUploadedEvent {
                            session_id: session_id.clone(),
                            remote_path: remote_path.clone(),
                            local_path: local_path.to_string_lossy().to_string(),
                            success: false,
                            error: Some(e),
                        });
                    }
                }
            }
        });

        // Create file watcher
        let tx_clone = tx;
        let watcher = RecommendedWatcher::new(
            move |res: Result<Event, notify::Error>| {
                if let Ok(event) = res {
                    // Only handle modify events
                    if event.kind.is_modify() {
                        for path in event.paths {
                            let _ = tx_clone.send(path);
                        }
                    }
                }
            },
            Config::default().with_poll_interval(Duration::from_secs(1)),
        )
        .map_err(|e| format!("Failed to create file watcher: {}", e))?;

        self.watcher = Some(watcher);
        Ok(())
    }

    /// Start tracking a file for external editing
    pub fn track_file(
        &mut self,
        session_id: String,
        remote_path: String,
        local_path: PathBuf,
    ) -> Result<(), String> {
        // Initialize watcher if not already done
        if self.watcher.is_none() {
            self.init()?;
        }

        // Add to tracked files
        let edited_file = EditedFile {
            session_id,
            remote_path,
            local_path: local_path.clone(),
            last_upload: None,
        };

        self.tracked_files.write().insert(local_path.clone(), edited_file);

        // Start watching the file
        if let Some(watcher) = &mut self.watcher {
            watcher
                .watch(&local_path, RecursiveMode::NonRecursive)
                .map_err(|e| format!("Failed to watch file: {}", e))?;
        }

        Ok(())
    }

    /// Stop tracking a file
    pub fn untrack_file(&mut self, local_path: &PathBuf) -> Result<(), String> {
        self.tracked_files.write().remove(local_path);

        if let Some(watcher) = &mut self.watcher {
            let _ = watcher.unwatch(local_path);
        }

        Ok(())
    }

    /// Get all tracked files for a session
    pub fn get_tracked_files(&self, session_id: &str) -> Vec<EditedFile> {
        self.tracked_files
            .read()
            .values()
            .filter(|f| f.session_id == session_id)
            .cloned()
            .collect()
    }

    /// Check if a file is being tracked
    #[allow(dead_code)]
    pub fn is_tracking(&self, local_path: &PathBuf) -> bool {
        self.tracked_files.read().contains_key(local_path)
    }
}

/// Get the temp directory for edited files
pub fn get_edit_temp_dir() -> Result<PathBuf, String> {
    let temp_dir = std::env::temp_dir().join("simplyterm-edit");
    if !temp_dir.exists() {
        std::fs::create_dir_all(&temp_dir)
            .map_err(|e| format!("Failed to create temp directory: {}", e))?;
    }
    Ok(temp_dir)
}

/// Get the local path for a remote file being edited
pub fn get_local_edit_path(session_id: &str, remote_path: &str) -> Result<PathBuf, String> {
    let temp_dir = get_edit_temp_dir()?;
    let session_dir = temp_dir.join(session_id);

    if !session_dir.exists() {
        std::fs::create_dir_all(&session_dir)
            .map_err(|e| format!("Failed to create session directory: {}", e))?;
    }

    // Use the filename from remote path, but sanitize it
    let filename = std::path::Path::new(remote_path)
        .file_name()
        .ok_or_else(|| "Invalid remote path".to_string())?
        .to_string_lossy()
        .to_string();

    // Add a hash of the full path to avoid collisions
    let path_hash = format!("{:x}", md5_hash(remote_path));
    let local_filename = format!("{}_{}", &path_hash[..8], filename);

    Ok(session_dir.join(local_filename))
}

/// Simple hash function for path deduplication
fn md5_hash(s: &str) -> u64 {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    s.hash(&mut hasher);
    hasher.finish()
}
