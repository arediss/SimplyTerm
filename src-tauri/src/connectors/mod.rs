//! Available connectors (SSH, Local, Telnet, Serial)

pub mod local;
pub mod ssh;
pub mod ssh_exec;
pub mod sftp;
pub mod known_hosts;
pub mod telnet;
pub mod serial;

pub use local::create_local_session;
pub use ssh::{connect_ssh, check_host_key_only, load_ssh_key, SshAuth, SshConfig, HostKeyCheckResult};
pub use known_hosts::{accept_pending_key, accept_and_update_pending_key, remove_pending_key};
pub use sftp::{sftp_list_dir, sftp_read_file, sftp_write_file, sftp_delete, sftp_rename, sftp_mkdir, FileEntry};
pub use telnet::connect_telnet;
pub use serial::{connect_serial, list_serial_ports, SerialConfig, SerialPortInfo};
