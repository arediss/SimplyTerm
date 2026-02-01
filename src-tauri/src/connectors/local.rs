//! Connecteur PTY local

use parking_lot::Mutex;
use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use std::fmt;
use std::io::{Read, Write};
use std::sync::Arc;
use std::thread;
use std::sync::mpsc;

use crate::session::{OutputMessage, Session};

/// Session PTY locale
pub struct LocalSession {
    writer: Mutex<Box<dyn Write + Send>>,
    master: Arc<Mutex<Box<dyn MasterPty + Send>>>,
}

impl fmt::Debug for LocalSession {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("LocalSession")
            .field("type", &"local")
            .finish()
    }
}

impl Session for LocalSession {
    fn write(&self, data: &[u8]) -> Result<(), String> {
        let mut writer = self.writer.lock();
        writer.write_all(data).map_err(|e| e.to_string())?;
        writer.flush().map_err(|e| e.to_string())
    }

    fn resize(&self, cols: u32, rows: u32) -> Result<(), String> {
        self.master
            .lock()
            .resize(PtySize {
                rows: rows as u16,
                cols: cols as u16,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| e.to_string())
    }

    fn session_type(&self) -> &'static str {
        "local"
    }
}

/// Crée une nouvelle session PTY locale
pub fn create_local_session(
    session_id: String,
    output_tx: mpsc::Sender<OutputMessage>,
    on_exit: impl FnOnce() + Send + 'static,
) -> Result<LocalSession, String> {
    let pty_system = native_pty_system();

    let pair = pty_system
        .openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    let shell = if cfg!(windows) {
        std::env::var("COMSPEC").unwrap_or_else(|_| {
            if std::path::Path::new("C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe").exists() {
                "powershell.exe".to_string()
            } else {
                "cmd.exe".to_string()
            }
        })
    } else {
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_string())
    };

    #[cfg(not(windows))]
    let cmd = {
        let mut c = CommandBuilder::new(&shell);
        c.env("TERM", "xterm-256color");
        c
    };

    #[cfg(windows)]
    let cmd = CommandBuilder::new(&shell);

    let mut child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;

    // Lecteur pour recevoir la sortie du PTY
    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;

    // Writer pour envoyer des données au PTY
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

    // Thread pour lire la sortie du PTY
    let session_id_clone = session_id.clone();
    thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let _ = output_tx.send(OutputMessage {
                        session_id: session_id_clone.clone(),
                        data: buf[..n].to_vec(),
                    });
                }
                Err(_) => break,
            }
        }
    });

    // Thread pour attendre la fin du processus
    thread::spawn(move || {
        let _ = child.wait();
        on_exit();
    });

    Ok(LocalSession {
        writer: Mutex::new(writer),
        master: Arc::new(Mutex::new(pair.master)),
    })
}
