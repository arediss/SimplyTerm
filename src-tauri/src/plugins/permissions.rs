//! Permission validation and checking

use super::error::{PluginError, PluginResult};
use super::manifest::{GrantedPermissions, Permission};

/// Validates that a plugin has the required permission
pub fn require_permission(
    granted: &GrantedPermissions,
    required: Permission,
) -> PluginResult<()> {
    if granted.has(required) {
        Ok(())
    } else {
        Err(PluginError::permission_denied(format!(
            "Permission required: {:?}",
            required
        )))
    }
}

/// Validates that a plugin has all of the required permissions
pub fn require_all_permissions(
    granted: &GrantedPermissions,
    required: &[Permission],
) -> PluginResult<()> {
    for perm in required {
        require_permission(granted, *perm)?;
    }
    Ok(())
}

/// Validates that a plugin has at least one of the required permissions
pub fn require_any_permission(
    granted: &GrantedPermissions,
    required: &[Permission],
) -> PluginResult<()> {
    for perm in required {
        if granted.has(*perm) {
            return Ok(());
        }
    }
    Err(PluginError::permission_denied(format!(
        "One of these permissions required: {:?}",
        required
    )))
}

/// Permission guard that can be used with the ? operator
pub struct PermissionGuard<'a> {
    granted: &'a GrantedPermissions,
}

impl<'a> PermissionGuard<'a> {
    pub fn new(granted: &'a GrantedPermissions) -> Self {
        Self { granted }
    }

    pub fn require(&self, permission: Permission) -> PluginResult<()> {
        require_permission(self.granted, permission)
    }

    pub fn require_all(&self, permissions: &[Permission]) -> PluginResult<()> {
        require_all_permissions(self.granted, permissions)
    }

    pub fn require_any(&self, permissions: &[Permission]) -> PluginResult<()> {
        require_any_permission(self.granted, permissions)
    }

    pub fn has(&self, permission: Permission) -> bool {
        self.granted.has(permission)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_require_permission_granted() {
        let mut perms = GrantedPermissions::new();
        perms.grant(Permission::SessionsRead);

        assert!(require_permission(&perms, Permission::SessionsRead).is_ok());
    }

    #[test]
    fn test_require_permission_denied() {
        let perms = GrantedPermissions::new();
        let result = require_permission(&perms, Permission::SessionsRead);

        assert!(result.is_err());
    }

    #[test]
    fn test_require_all_permissions() {
        let mut perms = GrantedPermissions::new();
        perms.grant(Permission::SessionsRead);
        perms.grant(Permission::SessionsWrite);

        assert!(require_all_permissions(
            &perms,
            &[Permission::SessionsRead, Permission::SessionsWrite]
        ).is_ok());

        assert!(require_all_permissions(
            &perms,
            &[Permission::SessionsRead, Permission::FoldersRead]
        ).is_err());
    }

    #[test]
    fn test_require_any_permission() {
        let mut perms = GrantedPermissions::new();
        perms.grant(Permission::SessionsRead);

        assert!(require_any_permission(
            &perms,
            &[Permission::SessionsRead, Permission::FoldersRead]
        ).is_ok());

        assert!(require_any_permission(
            &perms,
            &[Permission::FoldersRead, Permission::FoldersWrite]
        ).is_err());
    }
}
