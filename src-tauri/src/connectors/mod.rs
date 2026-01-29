//! Connecteurs disponibles (SSH, Local, etc.)
//!
//! Pour ajouter un nouveau connecteur :
//! 1. Créer un nouveau fichier (ex: serial.rs)
//! 2. Implémenter le trait Session
//! 3. Exposer via ce module

pub mod local;
pub mod ssh;
pub mod ssh_exec;
pub mod sftp;

pub use local::create_local_session;
pub use ssh::{connect_ssh, SshAuth, SshConfig};
pub use ssh_exec::ssh_exec;
pub use sftp::{sftp_list_dir, sftp_read_file, sftp_write_file, sftp_delete, sftp_rename, sftp_mkdir, FileEntry};
