//! Permission validation and sandboxing
//!
//! Ensures plugins can only perform actions they have permission for.

use super::manifest::Permission;
use std::collections::HashSet;

/// Validates plugin API calls against declared permissions
pub struct PermissionValidator {
    /// Set of granted permissions
    permissions: HashSet<Permission>,
}

impl PermissionValidator {
    /// Create a new validator from a list of permissions
    pub fn new(permissions: Vec<Permission>) -> Self {
        Self {
            permissions: permissions.into_iter().collect(),
        }
    }

    /// Check if a permission is granted
    pub fn has_permission(&self, permission: &Permission) -> bool {
        self.permissions.contains(permission)
    }

    /// Validate an action requires a permission
    pub fn require(&self, permission: &Permission) -> Result<(), String> {
        if self.has_permission(permission) {
            Ok(())
        } else {
            Err(format!("Permission denied: {}", permission))
        }
    }

    /// Validate multiple permissions (all must be granted)
    pub fn require_all(&self, permissions: &[Permission]) -> Result<(), String> {
        for perm in permissions {
            self.require(perm)?;
        }
        Ok(())
    }

    /// Validate at least one permission is granted
    pub fn require_any(&self, permissions: &[Permission]) -> Result<(), String> {
        for perm in permissions {
            if self.has_permission(perm) {
                return Ok(());
            }
        }
        Err(format!(
            "Permission denied: requires one of {:?}",
            permissions
        ))
    }
}

/// Backend API whitelist - functions that plugins can call
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum BackendApi {
    /// Execute a command on SSH session
    ExecSshCommand,
    /// Get session info (host, user, etc.)
    GetSessionInfo,
    /// Read file via SFTP
    ReadFileSftp,
    /// List directory via SFTP
    ListDirSftp,
    /// Write file via SFTP
    WriteFileSftp,
}

impl BackendApi {
    /// Get required permission for this API
    pub fn required_permission(&self) -> Permission {
        match self {
            BackendApi::ExecSshCommand => Permission::BackendExec,
            BackendApi::GetSessionInfo => Permission::SessionInfo,
            BackendApi::ReadFileSftp => Permission::BackendExec,
            BackendApi::ListDirSftp => Permission::BackendExec,
            BackendApi::WriteFileSftp => Permission::BackendExec,
        }
    }

    /// Parse API name from string
    pub fn from_str(name: &str) -> Option<Self> {
        match name {
            "exec_ssh_command" => Some(BackendApi::ExecSshCommand),
            "get_session_info" => Some(BackendApi::GetSessionInfo),
            "read_file_sftp" => Some(BackendApi::ReadFileSftp),
            "list_dir_sftp" => Some(BackendApi::ListDirSftp),
            "write_file_sftp" => Some(BackendApi::WriteFileSftp),
            _ => None,
        }
    }
}

/// Validate a backend API call from a plugin
pub fn validate_backend_call(
    validator: &PermissionValidator,
    api_name: &str,
) -> Result<BackendApi, String> {
    let api = BackendApi::from_str(api_name)
        .ok_or_else(|| format!("Unknown backend API: {}", api_name))?;

    validator.require(&api.required_permission())?;

    Ok(api)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_permission_validator() {
        let validator = PermissionValidator::new(vec![
            Permission::TerminalRead,
            Permission::PanelRegister,
        ]);

        assert!(validator.has_permission(&Permission::TerminalRead));
        assert!(!validator.has_permission(&Permission::TerminalWrite));
        assert!(validator.require(&Permission::PanelRegister).is_ok());
        assert!(validator.require(&Permission::BackendExec).is_err());
    }

    #[test]
    fn test_backend_api_validation() {
        let validator = PermissionValidator::new(vec![Permission::BackendExec]);

        assert!(validate_backend_call(&validator, "exec_ssh_command").is_ok());
        assert!(validate_backend_call(&validator, "unknown_api").is_err());

        let no_perms = PermissionValidator::new(vec![]);
        assert!(validate_backend_call(&no_perms, "exec_ssh_command").is_err());
    }
}
