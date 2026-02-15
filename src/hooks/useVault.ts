import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { VaultStatus, VaultCreateOptions, SecurityKeyInfo } from '../types/vault';
import { getErrorMessage } from '../utils';

/**
 * Hook for managing vault state and operations
 */
export function useVault() {
  const [status, setStatus] = useState<VaultStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const autoLockIntervalRef = useRef<number | null>(null);

  // Fetch vault status
  const refreshStatus = useCallback(async () => {
    try {
      const vaultStatus = await invoke<VaultStatus>('get_vault_status');
      setStatus(vaultStatus);
      setError(null);
    } catch (err) {
      console.error('Failed to get vault status:', err);
      setError(getErrorMessage(err));
    }
  }, []);

  // Initial load
  useEffect(() => {
    setIsLoading(true);
    refreshStatus().finally(() => setIsLoading(false));
  }, [refreshStatus]);

  // Auto-lock check interval
  useEffect(() => {
    if (status?.isUnlocked && status.autoLockTimeout > 0) {
      let active = true;

      // Check for auto-lock every 10 seconds
      autoLockIntervalRef.current = globalThis.setInterval(async () => {
        if (!active) return;
        try {
          const locked = await invoke<boolean>('check_vault_auto_lock');
          if (active && locked) {
            await refreshStatus();
          }
        } catch (err) {
          if (active) {
            console.error('Auto-lock check failed:', err);
          }
        }
      }, 10000);

      return () => {
        active = false;
        if (autoLockIntervalRef.current) {
          clearInterval(autoLockIntervalRef.current);
        }
      };
    }
  }, [status?.isUnlocked, status?.autoLockTimeout, refreshStatus]);

  // Create a new vault
  const createVault = useCallback(async (options: VaultCreateOptions) => {
    try {
      await invoke('create_vault', {
        masterPassword: options.masterPassword,
        autoLockTimeout: options.autoLockTimeout,
        pin: options.pin || null,
      });
      await refreshStatus();
      return { success: true };
    } catch (err) {
      const errorMsg = getErrorMessage(err);
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  }, [refreshStatus]);

  // Unlock with master password
  const unlockWithPassword = useCallback(async (password: string) => {
    try {
      await invoke('unlock_vault_with_password', { password });
      await refreshStatus();
      return { success: true };
    } catch (err) {
      const errorMsg = getErrorMessage(err);
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  }, [refreshStatus]);

  // Unlock with PIN
  const unlockWithPin = useCallback(async (pin: string) => {
    try {
      await invoke('unlock_vault_with_pin', { pin });
      await refreshStatus();
      return { success: true };
    } catch (err) {
      const errorMsg = getErrorMessage(err);
      await refreshStatus(); // Update PIN attempts remaining
      return { success: false, error: errorMsg };
    }
  }, [refreshStatus]);

  // Lock the vault
  const lock = useCallback(async () => {
    try {
      await invoke('lock_vault');
      await refreshStatus();
      return { success: true };
    } catch (err) {
      const errorMsg = getErrorMessage(err);
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  }, [refreshStatus]);

  // Update vault settings
  const updateSettings = useCallback(async (autoLockTimeout: number) => {
    try {
      await invoke('update_vault_settings', { autoLockTimeout });
      await refreshStatus();
      return { success: true };
    } catch (err) {
      const errorMsg = getErrorMessage(err);
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  }, [refreshStatus]);

  // Change master password
  const changeMasterPassword = useCallback(async (current: string, newPassword: string) => {
    try {
      await invoke('change_master_password', { current, newPassword });
      return { success: true };
    } catch (err) {
      const errorMsg = getErrorMessage(err);
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  }, []);

  // Setup PIN
  const setupPin = useCallback(async (pin: string) => {
    try {
      await invoke('setup_vault_pin', { pin });
      await refreshStatus();
      return { success: true };
    } catch (err) {
      const errorMsg = getErrorMessage(err);
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  }, [refreshStatus]);

  // Remove PIN
  const removePin = useCallback(async () => {
    try {
      await invoke('remove_vault_pin');
      await refreshStatus();
      return { success: true };
    } catch (err) {
      const errorMsg = getErrorMessage(err);
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  }, [refreshStatus]);

  // Delete vault
  const deleteVault = useCallback(async (masterPassword: string) => {
    try {
      await invoke('delete_vault', { masterPassword });
      await refreshStatus();
      return { success: true };
    } catch (err) {
      const errorMsg = getErrorMessage(err);
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  }, [refreshStatus]);

  // Set require unlock on connect (maximum security mode)
  const setRequireUnlockOnConnect = useCallback(async (require: boolean) => {
    try {
      await invoke('set_vault_require_unlock_on_connect', { require });
      await refreshStatus();
      return { success: true };
    } catch (err) {
      const errorMsg = getErrorMessage(err);
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  }, [refreshStatus]);

  // Check if FIDO2 security keys are available
  const isSecurityKeyAvailable = useCallback(async () => {
    try {
      return await invoke<boolean>('is_security_key_available');
    } catch {
      return false;
    }
  }, []);

  // Detect connected FIDO2 security keys
  const detectSecurityKeys = useCallback(async (): Promise<{ keys: SecurityKeyInfo[], error: string | null }> => {
    try {
      const keys = await invoke<SecurityKeyInfo[]>('detect_security_keys');
      return { keys, error: null };
    } catch (err) {
      console.error('Failed to detect security keys:', err);
      return { keys: [], error: getErrorMessage(err) };
    }
  }, []);

  // Setup security key for vault unlock
  // User will need to touch their key twice during this process
  const setupSecurityKey = useCallback(async (pin?: string) => {
    try {
      await invoke('setup_vault_security_key', { pin: pin || null });
      await refreshStatus();
      return { success: true };
    } catch (err) {
      const errorMsg = getErrorMessage(err);
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  }, [refreshStatus]);

  // Unlock with security key
  // User will need to touch their key
  const unlockWithSecurityKey = useCallback(async (pin?: string) => {
    try {
      await invoke('unlock_vault_with_security_key', { pin: pin || null });
      await refreshStatus();
      return { success: true };
    } catch (err) {
      const errorMsg = getErrorMessage(err);
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  }, [refreshStatus]);

  // Remove security key configuration
  const removeSecurityKey = useCallback(async () => {
    try {
      await invoke('remove_vault_security_key');
      await refreshStatus();
      return { success: true };
    } catch (err) {
      const errorMsg = getErrorMessage(err);
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  }, [refreshStatus]);

  // Export vault to a .stvault file
  const exportToFile = useCallback(async (filePath: string) => {
    try {
      await invoke('vault_export_to_file', { filePath });
      return { success: true };
    } catch (err) {
      const errorMsg = getErrorMessage(err);
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  }, []);

  // Import vault from a .stvault file (replaces current vault, locks after import)
  const importFromFile = useCallback(async (filePath: string) => {
    try {
      await invoke('vault_import_from_file', { filePath });
      await refreshStatus();
      return { success: true };
    } catch (err) {
      const errorMsg = getErrorMessage(err);
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  }, [refreshStatus]);

  // Selective export to encrypted .stvault file
  const selectiveExport = useCallback(async (
    filePath: string,
    folderIds: string[],
    sessionIds: string[],
    sshKeyIds: string[],
    exportPassword: string,
  ) => {
    try {
      await invoke('vault_selective_export', {
        filePath, folderIds, sessionIds, sshKeyIds, exportPassword,
      });
      return { success: true as const };
    } catch (err) {
      const errorMsg = getErrorMessage(err);
      setError(errorMsg);
      return { success: false as const, error: errorMsg };
    }
  }, []);

  // Execute a selective import
  const selectiveImportExecute = useCallback(async (filePath: string, importPassword: string) => {
    try {
      const result = await invoke<import('../types/vault').ImportResult>('vault_selective_import_execute', {
        filePath, importPassword,
      });
      await refreshStatus();
      return { success: true as const, result };
    } catch (err) {
      const errorMsg = getErrorMessage(err);
      setError(errorMsg);
      return { success: false as const, error: errorMsg };
    }
  }, [refreshStatus]);

  return {
    status,
    isLoading,
    error,
    createVault,
    unlockWithPassword,
    unlockWithPin,
    lock,
    updateSettings,
    changeMasterPassword,
    setupPin,
    removePin,
    deleteVault,
    setRequireUnlockOnConnect,
    // FIDO2 Security Keys
    isSecurityKeyAvailable,
    detectSecurityKeys,
    setupSecurityKey,
    unlockWithSecurityKey,
    removeSecurityKey,
    refreshStatus,
    // Export / Import
    exportToFile,
    importFromFile,
    // Selective Export / Import
    selectiveExport,
    selectiveImportExecute,
  };
}
