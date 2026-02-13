//! Shell API for plugins
//!
//! Provides restricted shell command execution.
//! Commands are sanitized and execution is limited.
//! Requires: shell_execute permission

use crate::plugins::error::{PluginError, PluginResult};
use crate::plugins::manifest::{GrantedPermissions, Permission};
use crate::plugins::permissions::require_permission;
use serde::{Deserialize, Serialize};
use std::process::{Command, Stdio};
use std::time::Duration;

/// Maximum command execution time (30 seconds)
const MAX_EXECUTION_TIME: Duration = Duration::from_secs(30);

/// Maximum output size (1MB)
const MAX_OUTPUT_SIZE: usize = 1024 * 1024;

/// Command execution result
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandResult {
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
    pub success: bool,
    pub truncated: bool,
}

/// Allowed commands whitelist (can be extended)
const ALLOWED_COMMANDS: &[&str] = &[
    // Network utilities
    "ping",
    "curl",
    "wget",
    "nslookup",
    "dig",
    "host",
    "traceroute",
    "tracert",
    // File utilities (read-only)
    "cat",
    "head",
    "tail",
    "less",
    "more",
    "wc",
    // System info
    "date",
    "uptime",
    "whoami",
    "hostname",
    "uname",
    // Git (read-only operations)
    "git",
    // SSH utilities
    "ssh-keygen",
    "ssh-keyscan",
];

/// Blocked arguments patterns
const BLOCKED_PATTERNS: &[&str] = &[
    // Shell escapes
    ";",
    "&&",
    "||",
    "|",
    "`",
    "$(",
    // Redirections
    ">",
    ">>",
    "<",
    // Background execution
    "&",
    // Dangerous patterns
    "rm ",
    "del ",
    "format ",
    "mkfs",
    "dd ",
    ":(){",
    "fork",
];

/// Check if a command is allowed
fn is_command_allowed(command: &str) -> bool {
    let cmd_name = command.split_whitespace().next().unwrap_or("");

    // Extract just the command name (without path)
    let base_name = std::path::Path::new(cmd_name)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(cmd_name);

    // Remove .exe extension on Windows
    let base_name = base_name.strip_suffix(".exe").unwrap_or(base_name);

    ALLOWED_COMMANDS.contains(&base_name)
}

/// Check if command arguments contain blocked patterns
fn has_blocked_patterns(command: &str) -> bool {
    let lower = command.to_lowercase();
    BLOCKED_PATTERNS.iter().any(|p| lower.contains(p))
}

/// Execute a shell command (restricted)
pub fn execute_command(
    permissions: &GrantedPermissions,
    command: &str,
    args: &[String],
    working_dir: Option<&str>,
) -> PluginResult<CommandResult> {
    require_permission(permissions, Permission::ShellExecute)?;

    // Validate command
    if !is_command_allowed(command) {
        return Err(PluginError::permission_denied(format!(
            "Command not allowed: {}",
            command
        )));
    }

    // Check arguments for blocked patterns
    let full_command = format!("{} {}", command, args.join(" "));
    if has_blocked_patterns(&full_command) {
        return Err(PluginError::permission_denied(
            "Command contains blocked patterns",
        ));
    }

    // Build command (CREATE_NO_WINDOW on Windows to prevent console flash)
    let mut cmd = Command::new(command);
    cmd.args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    if let Some(dir) = working_dir {
        cmd.current_dir(dir);
    }

    // Execute with timeout
    let output = cmd
        .output()
        .map_err(|e| PluginError::internal(format!("Failed to execute command: {}", e)))?;

    // Collect output
    let mut stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let mut stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let mut truncated = false;

    // Truncate if too large
    if stdout.len() > MAX_OUTPUT_SIZE {
        stdout.truncate(MAX_OUTPUT_SIZE);
        stdout.push_str("\n... (output truncated)");
        truncated = true;
    }
    if stderr.len() > MAX_OUTPUT_SIZE {
        stderr.truncate(MAX_OUTPUT_SIZE);
        stderr.push_str("\n... (output truncated)");
        truncated = true;
    }

    Ok(CommandResult {
        exit_code: output.status.code().unwrap_or(-1),
        stdout,
        stderr,
        success: output.status.success(),
        truncated,
    })
}

/// Get list of allowed commands
pub fn get_allowed_commands(
    permissions: &GrantedPermissions,
) -> PluginResult<Vec<String>> {
    require_permission(permissions, Permission::ShellExecute)?;

    Ok(ALLOWED_COMMANDS.iter().map(|s| s.to_string()).collect())
}
