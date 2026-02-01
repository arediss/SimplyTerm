//! Connecteur Serial/COM
//!
//! Permet la communication avec des périphériques série (Arduino, routeurs, etc.)

use parking_lot::Mutex as SyncMutex;
use serde::Serialize;
use serialport::{DataBits, FlowControl, Parity, StopBits};
use std::io::{Read, Write};
use std::sync::mpsc as std_mpsc;
use std::sync::Arc;
use std::thread;
use std::time::Duration;
use tokio::sync::mpsc as tokio_mpsc;

use crate::session::{OutputMessage, Session};

/// Information sur un port série disponible
#[derive(Debug, Clone, Serialize)]
pub struct SerialPortInfo {
    pub port_name: String,
    pub port_type: String,
    pub manufacturer: Option<String>,
    pub product: Option<String>,
}

/// Configuration d'une connexion série
#[derive(Debug, Clone)]
pub struct SerialConfig {
    pub port: String,
    pub baud_rate: u32,
    pub data_bits: u8,
    pub stop_bits: u8,
    pub parity: String,
    pub flow_control: String,
}

/// Commandes envoyées à la session Serial
#[derive(Debug)]
enum SerialCommand {
    Data(Vec<u8>),
    Close,
}

/// Session Serial
pub struct SerialSession {
    cmd_tx: SyncMutex<tokio_mpsc::UnboundedSender<SerialCommand>>,
}

impl std::fmt::Debug for SerialSession {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("SerialSession")
            .field("type", &"serial")
            .finish()
    }
}

impl Session for SerialSession {
    fn write(&self, data: &[u8]) -> Result<(), String> {
        self.cmd_tx
            .lock()
            .send(SerialCommand::Data(data.to_vec()))
            .map_err(|e| format!("Write failed: {}", e))
    }

    fn resize(&self, _cols: u32, _rows: u32) -> Result<(), String> {
        // Serial n'a pas de concept de taille de fenêtre
        Ok(())
    }

    fn session_type(&self) -> &'static str {
        "serial"
    }

    fn close(&self) -> Result<(), String> {
        let _ = self.cmd_tx.lock().send(SerialCommand::Close);
        Ok(())
    }
}

/// Énumère les ports série disponibles sur le système
pub fn list_serial_ports() -> Result<Vec<SerialPortInfo>, String> {
    let ports = serialport::available_ports()
        .map_err(|e| format!("Failed to enumerate ports: {}", e))?;

    Ok(ports
        .into_iter()
        .map(|p| {
            let (port_type, manufacturer, product) = match p.port_type {
                serialport::SerialPortType::UsbPort(info) => (
                    "USB".to_string(),
                    info.manufacturer,
                    info.product,
                ),
                serialport::SerialPortType::PciPort => ("PCI".to_string(), None, None),
                serialport::SerialPortType::BluetoothPort => ("Bluetooth".to_string(), None, None),
                serialport::SerialPortType::Unknown => ("Unknown".to_string(), None, None),
            };

            SerialPortInfo {
                port_name: p.port_name,
                port_type,
                manufacturer,
                product,
            }
        })
        .collect())
}

/// Convertit les paramètres de configuration
fn parse_data_bits(bits: u8) -> DataBits {
    match bits {
        5 => DataBits::Five,
        6 => DataBits::Six,
        7 => DataBits::Seven,
        _ => DataBits::Eight,
    }
}

fn parse_stop_bits(bits: u8) -> StopBits {
    match bits {
        2 => StopBits::Two,
        _ => StopBits::One,
    }
}

fn parse_parity(parity: &str) -> Parity {
    match parity.to_lowercase().as_str() {
        "odd" => Parity::Odd,
        "even" => Parity::Even,
        _ => Parity::None,
    }
}

fn parse_flow_control(flow: &str) -> FlowControl {
    match flow.to_lowercase().as_str() {
        "hardware" | "rtscts" => FlowControl::Hardware,
        "software" | "xonxoff" => FlowControl::Software,
        _ => FlowControl::None,
    }
}

/// Connecte une session Serial
pub fn connect_serial(
    config: SerialConfig,
    session_id: String,
    output_tx: std_mpsc::Sender<OutputMessage>,
    on_exit: impl FnOnce() + Send + 'static,
) -> Result<SerialSession, String> {
    // Ouvrir le port série
    let port = serialport::new(&config.port, config.baud_rate)
        .data_bits(parse_data_bits(config.data_bits))
        .stop_bits(parse_stop_bits(config.stop_bits))
        .parity(parse_parity(&config.parity))
        .flow_control(parse_flow_control(&config.flow_control))
        .timeout(Duration::from_millis(100))
        .open()
        .map_err(|e| format!("Failed to open port: {}", e))?;

    let (cmd_tx, cmd_rx) = tokio_mpsc::unbounded_channel::<SerialCommand>();

    // Créer un clone du port pour l'écriture
    let port = Arc::new(SyncMutex::new(port));
    let port_read = Arc::clone(&port);
    let port_write = Arc::clone(&port);

    // Thread de lecture (bloquant car serialport n'est pas async)
    let session_id_read = session_id.clone();
    let running = Arc::new(std::sync::atomic::AtomicBool::new(true));
    let running_read = Arc::clone(&running);
    let running_write = Arc::clone(&running);

    thread::spawn(move || {
        let mut buf = [0u8; 1024];
        
        while running_read.load(std::sync::atomic::Ordering::Relaxed) {
            let result = {
                let mut port = port_read.lock();
                port.read(&mut buf)
            };

            match result {
                Ok(n) if n > 0 => {
                    let _ = output_tx.send(OutputMessage {
                        session_id: session_id_read.clone(),
                        data: buf[..n].to_vec(),
                    });
                }
                Ok(_) => {
                    // Pas de données, continuer
                    thread::sleep(Duration::from_millis(10));
                }
                Err(ref e) if e.kind() == std::io::ErrorKind::TimedOut => {
                    // Timeout normal, continuer
                }
                Err(_) => {
                    // Erreur, sortir
                    break;
                }
            }
        }

        on_exit();
    });

    // Thread d'écriture et gestion des commandes
    thread::spawn(move || {
        // Convertir le receiver tokio en receiver std synchrone
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();

        rt.block_on(async move {
            let mut cmd_rx = cmd_rx;
            while let Some(cmd) = cmd_rx.recv().await {
                match cmd {
                    SerialCommand::Data(data) => {
                        let result = {
                            let mut port = port_write.lock();
                            port.write_all(&data)
                        };
                        if result.is_err() {
                            break;
                        }
                    }
                    SerialCommand::Close => {
                        running_write.store(false, std::sync::atomic::Ordering::Relaxed);
                        break;
                    }
                }
            }
        });
    });

    Ok(SerialSession {
        cmd_tx: SyncMutex::new(cmd_tx),
    })
}
