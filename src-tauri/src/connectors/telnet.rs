//! Telnet connector (RFC 854) with NAWS support for window resizing

use parking_lot::Mutex as SyncMutex;
use std::sync::mpsc as std_mpsc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::sync::mpsc as tokio_mpsc;

use crate::session::{OutputMessage, Session};

/// Codes IAC (Interpret As Command) Telnet - RFC 854
mod iac {
    pub const IAC: u8 = 255;  // Interpret As Command
    pub const DONT: u8 = 254;
    pub const DO: u8 = 253;
    pub const WONT: u8 = 252;
    pub const WILL: u8 = 251;
    pub const SB: u8 = 250;   // Subnegotiation Begin
    pub const SE: u8 = 240;   // Subnegotiation End
    
    // Options Telnet
    pub const ECHO: u8 = 1;
    pub const SUPPRESS_GO_AHEAD: u8 = 3;
    pub const TERMINAL_TYPE: u8 = 24;
    pub const NAWS: u8 = 31;  // Negotiate About Window Size
}

/// Commandes envoyées à la session Telnet
#[derive(Debug)]
enum TelnetCommand {
    Data(Vec<u8>),
    Resize { cols: u32, rows: u32 },
    Close,
}

/// Session Telnet
pub struct TelnetSession {
    cmd_tx: SyncMutex<tokio_mpsc::UnboundedSender<TelnetCommand>>,
}

impl std::fmt::Debug for TelnetSession {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("TelnetSession")
            .field("type", &"telnet")
            .finish()
    }
}

impl Session for TelnetSession {
    fn write(&self, data: &[u8]) -> Result<(), String> {
        self.cmd_tx
            .lock()
            .send(TelnetCommand::Data(data.to_vec()))
            .map_err(|e| format!("Write failed: {}", e))
    }

    fn resize(&self, cols: u32, rows: u32) -> Result<(), String> {
        self.cmd_tx
            .lock()
            .send(TelnetCommand::Resize { cols, rows })
            .map_err(|e| format!("Resize failed: {}", e))
    }

    fn session_type(&self) -> &'static str {
        "telnet"
    }

    fn close(&self) -> Result<(), String> {
        let _ = self.cmd_tx.lock().send(TelnetCommand::Close);
        Ok(())
    }
}

/// Construit une réponse NAWS (taille de fenêtre)
fn build_naws_response(cols: u16, rows: u16) -> Vec<u8> {
    vec![
        iac::IAC, iac::SB, iac::NAWS,
        (cols >> 8) as u8, (cols & 0xFF) as u8,
        (rows >> 8) as u8, (rows & 0xFF) as u8,
        iac::IAC, iac::SE,
    ]
}

/// Process IAC sequences and return cleaned data + responses to send
fn process_telnet_data(
    input: &[u8],
    naws_enabled: &mut bool,
    current_cols: u16,
    current_rows: u16,
) -> (Vec<u8>, Vec<u8>) {
    let mut output = Vec::new();
    let mut response = Vec::new();
    let mut i = 0;

    while i < input.len() {
        if input[i] == iac::IAC && i + 1 < input.len() {
            match input[i + 1] {
                iac::IAC => {
                    // IAC IAC = literal 255
                    output.push(255);
                    i += 2;
                }
                iac::WILL | iac::WONT | iac::DO | iac::DONT if i + 2 < input.len() => {
                    let cmd = input[i + 1];
                    let opt = input[i + 2];
                    
                    match (cmd, opt) {
                        (iac::DO, iac::NAWS) => {
                            response.extend_from_slice(&[iac::IAC, iac::WILL, iac::NAWS]);
                            *naws_enabled = true;
                            response.extend_from_slice(&build_naws_response(current_cols, current_rows));
                        }
                        (iac::DO, iac::TERMINAL_TYPE) => {
                            response.extend_from_slice(&[iac::IAC, iac::WILL, iac::TERMINAL_TYPE]);
                        }
                        (iac::DO, iac::ECHO) => {
                            response.extend_from_slice(&[iac::IAC, iac::WONT, iac::ECHO]);
                        }
                        (iac::DO, iac::SUPPRESS_GO_AHEAD) => {
                            response.extend_from_slice(&[iac::IAC, iac::WILL, iac::SUPPRESS_GO_AHEAD]);
                        }
                        (iac::DO, _) => {
                            response.extend_from_slice(&[iac::IAC, iac::WONT, opt]);
                        }
                        (iac::WILL, iac::ECHO) => {
                            response.extend_from_slice(&[iac::IAC, iac::DO, iac::ECHO]);
                        }
                        (iac::WILL, iac::SUPPRESS_GO_AHEAD) => {
                            response.extend_from_slice(&[iac::IAC, iac::DO, iac::SUPPRESS_GO_AHEAD]);
                        }
                        (iac::WILL, _) => {
                            response.extend_from_slice(&[iac::IAC, iac::DONT, opt]);
                        }
                        _ => {}
                    }
                    i += 3;
                }
                iac::SB if i + 2 < input.len() => {
                    let opt = input[i + 2];
                    let mut j = i + 3;
                    while j + 1 < input.len() {
                        if input[j] == iac::IAC && input[j + 1] == iac::SE {
                            break;
                        }
                        j += 1;
                    }
                    
                    // Traiter la subnégociation
                    if opt == iac::TERMINAL_TYPE && i + 3 < input.len() && input[i + 3] == 1 {
                        // SEND request - répondre avec le type de terminal
                        response.extend_from_slice(&[
                            iac::IAC, iac::SB, iac::TERMINAL_TYPE, 0, // IS
                        ]);
                        response.extend_from_slice(b"xterm-256color");
                        response.extend_from_slice(&[iac::IAC, iac::SE]);
                    }
                    
                    i = j + 2;
                }
                _ => {
                    i += 2;
                }
            }
        } else {
            output.push(input[i]);
            i += 1;
        }
    }

    (output, response)
}

/// Connecte une session Telnet
pub async fn connect_telnet(
    host: String,
    port: u16,
    session_id: String,
    output_tx: std_mpsc::Sender<OutputMessage>,
    on_exit: impl FnOnce() + Send + 'static,
) -> Result<TelnetSession, String> {
    let addr = format!("{}:{}", host, port);
    
    let stream = TcpStream::connect(&addr)
        .await
        .map_err(|e| format!("Connection failed: {}", e))?;

    let (cmd_tx, mut cmd_rx) = tokio_mpsc::unbounded_channel::<TelnetCommand>();

    // Task principale Telnet
    tokio::spawn(async move {
        let (mut reader, mut writer) = stream.into_split();
        let mut buf = [0u8; 4096];
        let mut naws_enabled = false;
        let mut current_cols: u16 = 80;
        let mut current_rows: u16 = 24;

        loop {
            tokio::select! {
                // Lecture depuis le serveur
                result = reader.read(&mut buf) => {
                    match result {
                        Ok(0) => break,
                        Ok(n) => {
                            let (data, response) = process_telnet_data(
                                &buf[..n],
                                &mut naws_enabled,
                                current_cols,
                                current_rows,
                            );

                            if !response.is_empty() {
                                if writer.write_all(&response).await.is_err() {
                                    break;
                                }
                            }

                            if !data.is_empty() {
                                let _ = output_tx.send(OutputMessage {
                                    session_id: session_id.clone(),
                                    data,
                                });
                            }
                        }
                        Err(_) => break,
                    }
                }
                Some(cmd) = cmd_rx.recv() => {
                    match cmd {
                        TelnetCommand::Data(data) => {
                            // Escape IAC bytes
                            let mut escaped = Vec::with_capacity(data.len() * 2);
                            for byte in data {
                                if byte == iac::IAC {
                                    escaped.push(iac::IAC);
                                    escaped.push(iac::IAC);
                                } else {
                                    escaped.push(byte);
                                }
                            }
                            if writer.write_all(&escaped).await.is_err() {
                                break;
                            }
                        }
                        TelnetCommand::Resize { cols, rows } => {
                            current_cols = cols as u16;
                            current_rows = rows as u16;
                            if naws_enabled {
                                let naws = build_naws_response(current_cols, current_rows);
                                if writer.write_all(&naws).await.is_err() {
                                    break;
                                }
                            }
                        }
                        TelnetCommand::Close => {
                            break;
                        }
                    }
                }
            }
        }

        on_exit();
    });

    Ok(TelnetSession {
        cmd_tx: SyncMutex::new(cmd_tx),
    })
}
