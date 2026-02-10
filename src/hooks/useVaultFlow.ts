import { useState, useEffect, useCallback } from "react";
import { useVault } from "./useVault";
import { useAppSettings } from "./useAppSettings";

export function useVaultFlow() {
  const vault = useVault();
  const { settings, updateSettings, isLoading: settingsLoading } = useAppSettings();
  const [showVaultSetup, setShowVaultSetup] = useState(false);
  const [showVaultUnlock, setShowVaultUnlock] = useState(false);
  const [initialVaultCheckDone, setInitialVaultCheckDone] = useState(false);

  // Handle vault startup flow - only show unlock modal on initial app load
  useEffect(() => {
    if (vault.isLoading || settingsLoading) return;

    if (vault.status?.exists && vault.status?.isUnlocked) {
      // Vault is unlocked - hide all modals
      setShowVaultSetup(false);
      setShowVaultUnlock(false);
    } else if (vault.status?.exists) {
      // Vault exists but is locked
      // Only show unlock modal on initial load, not after auto-lock
      if (!initialVaultCheckDone) {
        setShowVaultSetup(false);
        setShowVaultUnlock(true);
      }
    } else {
      // No vault exists - show setup modal (unless skipped in settings)
      if (!settings.security?.vaultSetupSkipped) {
        setShowVaultSetup(true);
      }
      setShowVaultUnlock(false);
    }

    // Mark initial check as done after first evaluation
    if (!initialVaultCheckDone) {
      setInitialVaultCheckDone(true);
    }
  }, [vault.isLoading, vault.status?.exists, vault.status?.isUnlocked, settings.security?.vaultSetupSkipped, initialVaultCheckDone, settingsLoading]);

  const handleVaultSetupSkip = useCallback(() => {
    // Persist the skip choice in settings
    updateSettings({
      ...settings,
      security: { ...settings.security, vaultSetupSkipped: true },
    });
    setShowVaultSetup(false);
  }, [settings, updateSettings]);

  const handleVaultSetup = useCallback(async (
    masterPassword: string,
    autoLockTimeout: number,
    pin?: string
  ) => {
    return vault.createVault({ masterPassword, autoLockTimeout, pin });
  }, [vault]);

  const closeVaultSetup = useCallback(() => {
    setShowVaultSetup(false);
  }, []);

  const closeVaultUnlock = useCallback(() => {
    setShowVaultUnlock(false);
  }, []);

  // Manually open unlock modal (e.g., from status bar)
  const openVaultUnlock = useCallback(() => {
    if (vault.status?.exists && !vault.status?.isUnlocked) {
      setShowVaultUnlock(true);
    }
  }, [vault.status?.exists, vault.status?.isUnlocked]);

  // Lock vault and optionally show unlock modal
  const lockVault = useCallback(async () => {
    if (vault.status?.isUnlocked) {
      await vault.lock();
    }
  }, [vault]);

  return {
    vault,
    showVaultSetup,
    showVaultUnlock,
    handleVaultSetupSkip,
    handleVaultSetup,
    closeVaultSetup,
    closeVaultUnlock,
    openVaultUnlock,
    lockVault,
  };
}
