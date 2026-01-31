//! SSH Known Hosts Management
//!
//! Implements host key verification using the standard ~/.ssh/known_hosts file format.
//! Provides user confirmation flow for unknown or changed host keys.

use russh::keys::key::PublicKey;
use sha2::{Sha256, Digest};
use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;

/// Result of host key verification
#[derive(Debug, Clone, PartialEq)]
pub enum HostKeyVerification {
    /// Key matches the stored key - connection is safe
    Trusted,
    /// New host, key is not in known_hosts
    UnknownHost {
        key_type: String,
        fingerprint: String,
    },
    /// Key does not match stored key - potential MITM attack!
    KeyMismatch {
        expected_fingerprint: String,
        actual_fingerprint: String,
    },
    /// Error reading known_hosts
    Error(String),
}

/// Information about a host key for the frontend
#[allow(dead_code)]
#[derive(Debug, Clone, serde::Serialize)]
pub struct HostKeyInfo {
    pub host: String,
    pub port: u16,
    pub key_type: String,
    pub fingerprint: String,
    pub status: String, // "unknown", "mismatch", "trusted"
}

/// Get the path to the known_hosts file
fn get_known_hosts_path() -> Result<PathBuf, String> {
    let home = dirs::home_dir()
        .ok_or_else(|| "Cannot determine home directory".to_string())?;
    let ssh_dir = home.join(".ssh");

    // Create .ssh directory if it doesn't exist
    if !ssh_dir.exists() {
        fs::create_dir_all(&ssh_dir)
            .map_err(|e| format!("Failed to create .ssh directory: {}", e))?;

        // Set permissions on Unix
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let perms = fs::Permissions::from_mode(0o700);
            fs::set_permissions(&ssh_dir, perms)
                .map_err(|e| format!("Failed to set .ssh permissions: {}", e))?;
        }
    }

    Ok(ssh_dir.join("known_hosts"))
}

/// Convert a public key to OpenSSH format string
fn key_to_openssh_string(key: &PublicKey) -> String {
    match key {
        PublicKey::Ed25519(k) => {
            let key_data = k.as_bytes();
            let mut buf = Vec::with_capacity(51);
            // Type string length + "ssh-ed25519" + key length + key bytes
            buf.extend_from_slice(&(11u32).to_be_bytes());
            buf.extend_from_slice(b"ssh-ed25519");
            buf.extend_from_slice(&(32u32).to_be_bytes());
            buf.extend_from_slice(key_data);
            format!("ssh-ed25519 {}", base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &buf))
        }
        _ => {
            // For other key types, use a generic approach
            format!("unknown-key-type {}", "")
        }
    }
}

/// Get the key type string for a public key
pub fn get_key_type(key: &PublicKey) -> &'static str {
    match key {
        PublicKey::Ed25519(_) => "ssh-ed25519",
        _ => "unknown",
    }
}

/// Calculate SHA256 fingerprint of a public key
pub fn calculate_fingerprint(key: &PublicKey) -> String {
    let key_str = key_to_openssh_string(key);
    let key_data = key_str.split_whitespace().nth(1).unwrap_or("");

    if let Ok(decoded) = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, key_data) {
        let mut hasher = Sha256::new();
        hasher.update(&decoded);
        let result = hasher.finalize();
        format!("SHA256:{}", base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &result).trim_end_matches('='))
    } else {
        "unknown".to_string()
    }
}

/// Calculate fingerprint from base64 key data
fn calculate_fingerprint_from_base64(key_data: &str) -> String {
    if let Ok(decoded) = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, key_data) {
        let mut hasher = Sha256::new();
        hasher.update(&decoded);
        let result = hasher.finalize();
        format!("SHA256:{}", base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &result).trim_end_matches('='))
    } else {
        "unknown".to_string()
    }
}

/// Parse a known_hosts line and extract host, key_type, and key_data
fn parse_known_hosts_line(line: &str) -> Option<(Vec<String>, String, String)> {
    let parts: Vec<&str> = line.split_whitespace().collect();
    if parts.len() < 3 {
        return None;
    }

    let hosts: Vec<String> = parts[0].split(',').map(|s| s.to_string()).collect();
    let key_type = parts[1].to_string();
    let key_data = parts[2].to_string();

    Some((hosts, key_type, key_data))
}

/// Check if a host matches (supports [host]:port format)
fn host_matches(stored_host: &str, host: &str, port: u16) -> bool {
    // Check exact match
    if stored_host == host {
        return true;
    }

    // Check [host]:port format for non-standard ports
    if port != 22 {
        let bracketed = format!("[{}]:{}", host, port);
        if stored_host == bracketed {
            return true;
        }
    }

    // Check if stored host is hashed (starts with |1|)
    // For now, we don't support hashed hosts - would need HMAC-SHA1
    if stored_host.starts_with("|1|") {
        return false; // Skip hashed entries
    }

    false
}

/// Verify a server's host key against known_hosts (without adding)
///
/// This only checks - it does NOT automatically add unknown hosts.
/// Use `add_known_host` to add a trusted host key.
pub fn verify_host_key(host: &str, port: u16, server_key: &PublicKey) -> HostKeyVerification {
    let known_hosts_path = match get_known_hosts_path() {
        Ok(p) => p,
        Err(e) => return HostKeyVerification::Error(e),
    };

    let server_key_type = get_key_type(server_key);
    let server_key_str = key_to_openssh_string(server_key);
    let server_key_data = server_key_str.split_whitespace().nth(1).unwrap_or("");
    let server_fingerprint = calculate_fingerprint(server_key);

    // Read known_hosts file
    if known_hosts_path.exists() {
        let file = match fs::File::open(&known_hosts_path) {
            Ok(f) => f,
            Err(e) => return HostKeyVerification::Error(format!("Failed to open known_hosts: {}", e)),
        };

        let reader = BufReader::new(file);

        for line in reader.lines() {
            let line = match line {
                Ok(l) => l,
                Err(_) => continue,
            };

            // Skip comments and empty lines
            let trimmed = line.trim();
            if trimmed.is_empty() || trimmed.starts_with('#') {
                continue;
            }

            if let Some((hosts, key_type, key_data)) = parse_known_hosts_line(trimmed) {
                // Check if this line is for our host
                for stored_host in &hosts {
                    if host_matches(stored_host, host, port) {
                        // Found a matching host entry
                        if key_type == server_key_type {
                            // Same key type - compare keys
                            if key_data == server_key_data {
                                return HostKeyVerification::Trusted;
                            } else {
                                // KEY MISMATCH - potential MITM attack!
                                let expected_fingerprint = calculate_fingerprint_from_base64(&key_data);
                                return HostKeyVerification::KeyMismatch {
                                    expected_fingerprint,
                                    actual_fingerprint: server_fingerprint,
                                };
                            }
                        }
                        // Different key type - continue looking for matching type
                    }
                }
            }
        }
    }

    // Host not found
    HostKeyVerification::UnknownHost {
        key_type: server_key_type.to_string(),
        fingerprint: server_fingerprint,
    }
}

/// Add a new host key to known_hosts
pub fn add_known_host(host: &str, port: u16, key_type: &str, key_base64: &str) -> Result<(), String> {
    let known_hosts_path = get_known_hosts_path()?;

    // Format host entry
    let host_entry = if port != 22 {
        format!("[{}]:{}", host, port)
    } else {
        host.to_string()
    };

    // Append to known_hosts
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&known_hosts_path)
        .map_err(|e| format!("Failed to open known_hosts for writing: {}", e))?;

    writeln!(file, "{} {} {}", host_entry, key_type, key_base64)
        .map_err(|e| format!("Failed to write to known_hosts: {}", e))?;

    // Set permissions on Unix
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let perms = fs::Permissions::from_mode(0o644);
        fs::set_permissions(&known_hosts_path, perms)
            .map_err(|e| format!("Failed to set known_hosts permissions: {}", e))?;
    }

    Ok(())
}

/// Update an existing host key in known_hosts (for key mismatch resolution)
pub fn update_known_host(host: &str, port: u16, key_type: &str, key_base64: &str) -> Result<(), String> {
    let known_hosts_path = get_known_hosts_path()?;

    // Format host entry for matching
    let host_entry = if port != 22 {
        format!("[{}]:{}", host, port)
    } else {
        host.to_string()
    };

    // Read current content
    let content = if known_hosts_path.exists() {
        fs::read_to_string(&known_hosts_path)
            .map_err(|e| format!("Failed to read known_hosts: {}", e))?
    } else {
        String::new()
    };

    // Filter out old entries for this host and add new one
    let mut new_lines: Vec<String> = Vec::new();
    let mut found = false;

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            new_lines.push(line.to_string());
            continue;
        }

        if let Some((hosts, stored_key_type, _)) = parse_known_hosts_line(trimmed) {
            let matches = hosts.iter().any(|h| host_matches(h, host, port));
            if matches && stored_key_type == key_type {
                // Replace this entry
                if !found {
                    new_lines.push(format!("{} {} {}", host_entry, key_type, key_base64));
                    found = true;
                }
                // Skip old entry (don't add it)
            } else {
                new_lines.push(line.to_string());
            }
        } else {
            new_lines.push(line.to_string());
        }
    }

    // If not found, add new entry
    if !found {
        new_lines.push(format!("{} {} {}", host_entry, key_type, key_base64));
    }

    // Write back
    fs::write(&known_hosts_path, new_lines.join("\n") + "\n")
        .map_err(|e| format!("Failed to write known_hosts: {}", e))?;

    Ok(())
}

/// Store for pending host key verifications
use std::sync::RwLock;
use std::collections::HashMap;

lazy_static::lazy_static! {
    static ref PENDING_KEYS: RwLock<HashMap<String, PendingHostKey>> = RwLock::new(HashMap::new());
}

#[derive(Debug, Clone)]
pub struct PendingHostKey {
    pub host: String,
    pub port: u16,
    pub key_type: String,
    pub key_base64: String,
    #[allow(dead_code)]
    pub fingerprint: String,
}

/// Store a pending host key for later approval
pub fn store_pending_key(host: &str, port: u16, key: &PublicKey) -> String {
    let key_str = key_to_openssh_string(key);
    let parts: Vec<&str> = key_str.split_whitespace().collect();
    let key_type = parts.get(0).unwrap_or(&"").to_string();
    let key_base64 = parts.get(1).unwrap_or(&"").to_string();
    let fingerprint = calculate_fingerprint(key);

    let pending_id = format!("{}:{}", host, port);

    let pending = PendingHostKey {
        host: host.to_string(),
        port,
        key_type,
        key_base64,
        fingerprint,
    };

    PENDING_KEYS.write().unwrap().insert(pending_id.clone(), pending);
    pending_id
}

/// Get a pending host key
pub fn get_pending_key(pending_id: &str) -> Option<PendingHostKey> {
    PENDING_KEYS.read().unwrap().get(pending_id).cloned()
}

/// Remove a pending host key
pub fn remove_pending_key(pending_id: &str) {
    PENDING_KEYS.write().unwrap().remove(pending_id);
}

/// Accept a pending host key and add it to known_hosts
pub fn accept_pending_key(pending_id: &str) -> Result<(), String> {
    let pending = get_pending_key(pending_id)
        .ok_or_else(|| "Pending key not found".to_string())?;

    add_known_host(&pending.host, pending.port, &pending.key_type, &pending.key_base64)?;
    remove_pending_key(pending_id);
    Ok(())
}

/// Accept and update a pending host key (for mismatch resolution)
pub fn accept_and_update_pending_key(pending_id: &str) -> Result<(), String> {
    let pending = get_pending_key(pending_id)
        .ok_or_else(|| "Pending key not found".to_string())?;

    update_known_host(&pending.host, pending.port, &pending.key_type, &pending.key_base64)?;
    remove_pending_key(pending_id);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_host_matches() {
        assert!(host_matches("example.com", "example.com", 22));
        assert!(host_matches("[example.com]:2222", "example.com", 2222));
        assert!(!host_matches("example.com", "other.com", 22));
        assert!(!host_matches("[example.com]:2222", "example.com", 22));
    }

    #[test]
    fn test_parse_known_hosts_line() {
        let line = "github.com,192.30.255.113 ssh-ed25519 AAAAC3NzaC1...";
        let result = parse_known_hosts_line(line);
        assert!(result.is_some());
        let (hosts, key_type, _) = result.unwrap();
        assert_eq!(hosts, vec!["github.com", "192.30.255.113"]);
        assert_eq!(key_type, "ssh-ed25519");
    }
}
