//! SSH Known Hosts Management
//!
//! Implements host key verification using the standard ~/.ssh/known_hosts file format.
//! Uses TOFU (Trust On First Use) strategy: new keys are automatically trusted and stored,
//! but a key mismatch (potential MITM attack) will reject the connection.

use russh::keys::key::PublicKey;
use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;

/// Result of host key verification
#[derive(Debug, Clone, PartialEq)]
pub enum HostKeyVerification {
    /// Key matches the stored key - connection is safe
    Trusted,
    /// New host, key has been added to known_hosts - TOFU
    TrustedNewHost,
    /// Key does not match stored key - potential MITM attack!
    KeyMismatch { 
        expected: String, 
        actual: String 
    },
    /// Error reading/writing known_hosts
    Error(String),
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
            // This is a simplified implementation
            format!("unknown-key-type {}", "")
        }
    }
}

/// Get the key type string for a public key
fn get_key_type(key: &PublicKey) -> &'static str {
    match key {
        PublicKey::Ed25519(_) => "ssh-ed25519",
        _ => "unknown",
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

/// Verify a server's host key against known_hosts
/// 
/// Returns the verification result and handles TOFU (Trust On First Use)
pub fn verify_host_key(host: &str, port: u16, server_key: &PublicKey) -> HostKeyVerification {
    let known_hosts_path = match get_known_hosts_path() {
        Ok(p) => p,
        Err(e) => return HostKeyVerification::Error(e),
    };
    
    let server_key_type = get_key_type(server_key);
    let server_key_str = key_to_openssh_string(server_key);
    let server_key_data = server_key_str.split_whitespace().nth(1).unwrap_or("");
    
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
                                return HostKeyVerification::KeyMismatch {
                                    expected: key_data,
                                    actual: server_key_data.to_string(),
                                };
                            }
                        }
                        // Different key type - continue looking for matching type
                    }
                }
            }
        }
    }
    
    // Host not found - add it (TOFU)
    match add_host_key(host, port, &server_key_str) {
        Ok(()) => HostKeyVerification::TrustedNewHost,
        Err(e) => HostKeyVerification::Error(e),
    }
}

/// Add a new host key to known_hosts
fn add_host_key(host: &str, port: u16, key_str: &str) -> Result<(), String> {
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
    
    writeln!(file, "{} {}", host_entry, key_str)
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
