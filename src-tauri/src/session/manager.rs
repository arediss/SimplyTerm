//! Centralized session manager with output batching

use parking_lot::Mutex;
use std::collections::HashMap;
use std::sync::mpsc::{self, Sender};
use std::sync::Arc;
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

use super::traits::Session;
use crate::connectors::{SshConfig, SftpPool, new_sftp_pool, disconnect_sftp};

const BATCH_INTERVAL_MS: u64 = 16; // ~60fps
const BATCH_MAX_SIZE: usize = 64 * 1024; // 64KB max before forced flush

pub struct OutputMessage {
    pub session_id: String,
    pub data: Vec<u8>,
}

pub struct SessionManager {
    sessions: Mutex<HashMap<String, Box<dyn Session>>>,
    ssh_configs: Mutex<HashMap<String, SshConfig>>,
    output_tx: Sender<OutputMessage>,
    sftp_pool: SftpPool,
}

impl SessionManager {
    pub fn new(app: AppHandle) -> Arc<Self> {
        let (output_tx, output_rx) = mpsc::channel();

        let manager = Arc::new(Self {
            sessions: Mutex::new(HashMap::new()),
            ssh_configs: Mutex::new(HashMap::new()),
            output_tx,
            sftp_pool: new_sftp_pool(),
        });

        Self::spawn_batch_worker(app, output_rx);

        manager
    }

    fn spawn_batch_worker(app: AppHandle, output_rx: mpsc::Receiver<OutputMessage>) {
        thread::spawn(move || {
            let mut buffers: HashMap<String, Vec<u8>> = HashMap::new();
            let batch_duration = Duration::from_millis(BATCH_INTERVAL_MS);

            loop {
                match output_rx.recv_timeout(batch_duration) {
                    Ok(msg) => {
                        let buffer = buffers.entry(msg.session_id.clone()).or_default();
                        buffer.extend(msg.data);

                        if buffer.len() >= BATCH_MAX_SIZE {
                            Self::flush_buffer(&app, &msg.session_id, buffer);
                        }
                    }
                    Err(mpsc::RecvTimeoutError::Timeout) => {
                        for (session_id, buffer) in buffers.iter_mut() {
                            if !buffer.is_empty() {
                                Self::flush_buffer(&app, session_id, buffer);
                            }
                        }
                    }
                    Err(mpsc::RecvTimeoutError::Disconnected) => break,
                }
            }
        });
    }

    fn flush_buffer(app: &AppHandle, session_id: &str, buffer: &mut Vec<u8>) {
        if buffer.is_empty() {
            return;
        }

        let data = std::mem::take(buffer);
        let text = String::from_utf8_lossy(&data).to_string();
        let _ = app.emit(&format!("pty-output-{}", session_id), text);
    }

    pub fn output_sender(&self) -> Sender<OutputMessage> {
        self.output_tx.clone()
    }

    /// Access the SFTP connection pool
    pub fn sftp_pool(&self) -> &SftpPool {
        &self.sftp_pool
    }

    /// Registers a new session
    pub fn register(&self, session_id: String, session: Box<dyn Session>) {
        self.sessions.lock().insert(session_id, session);
    }

    /// Supprime une session
    pub fn unregister(&self, session_id: &str) -> Option<Box<dyn Session>> {
        self.sessions.lock().remove(session_id)
    }

    /// Écrit des données vers une session
    pub fn write(&self, session_id: &str, data: &[u8]) -> Result<(), String> {
        let sessions = self.sessions.lock();
        if let Some(session) = sessions.get(session_id) {
            session.write(data)
        } else {
            Err("Session not found".to_string())
        }
    }

    /// Redimensionne une session
    pub fn resize(&self, session_id: &str, cols: u32, rows: u32) -> Result<(), String> {
        let sessions = self.sessions.lock();
        if let Some(session) = sessions.get(session_id) {
            session.resize(cols, rows)
        } else {
            Ok(()) // Ignorer silencieusement si session pas encore prête
        }
    }

    /// Ferme une session
    pub fn close(&self, session_id: &str) -> Result<(), String> {
        // Also remove SSH config
        self.ssh_configs.lock().remove(session_id);

        // Clean up SFTP pool entry for this session
        let pool = self.sftp_pool.clone();
        let sid = session_id.to_string();
        tokio::spawn(async move {
            disconnect_sftp(&pool, &sid).await;
        });

        if let Some(session) = self.unregister(session_id) {
            session.close()
        } else {
            Ok(())
        }
    }

    /// Store SSH config for a session (for background commands)
    pub fn store_ssh_config(&self, session_id: String, config: SshConfig) {
        self.ssh_configs.lock().insert(session_id, config);
    }

    /// Get SSH config for a session
    pub fn get_ssh_config(&self, session_id: &str) -> Option<SshConfig> {
        self.ssh_configs.lock().get(session_id).cloned()
    }
}
