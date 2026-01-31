import { useState, useEffect, useCallback } from "react";
import { useVault } from "./useVault";

export function useVaultFlow() {
  const vault = useVault();
  const [showVaultSetup, setShowVaultSetup] = useState(false);
  const [showVaultUnlock, setShowVaultUnlock] = useState(false);
  const [vaultSetupSkipped, setVaultSetupSkipped] = useState(false);
  const [initialVaultCheckDone, setInitialVaultCheckDone] = useState(false);

  // Handle vault startup flow - only show unlock modal on initial app load
  useEffect(() => {
    if (vault.isLoading) return;

    if (!vault.status?.exists) {
      // No vault exists - show setup modal (unless skipped)
      if (!vaultSetupSkipped) {
        setShowVaultSetup(true);
      }
      setShowVaultUnlock(false);
    } else if (!vault.status?.isUnlocked) {
      // Vault exists but is locked
      // Only show unlock modal on initial load, not after auto-lock
      if (!initialVaultCheckDone) {
        setShowVaultSetup(false);
        setShowVaultUnlock(true);
      }
    } else {
      // Vault is unlocked - hide all modals
      setShowVaultSetup(false);
      setShowVaultUnlock(false);
    }

    // Mark initial check as done after first evaluation
    if (!initialVaultCheckDone) {
      setInitialVaultCheckDone(true);
    }
  }, [vault.isLoading, vault.status?.exists, vault.status?.isUnlocked, vaultSetupSkipped, initialVaultCheckDone]);

  const handleVaultSetupSkip = useCallback(() => {
    setVaultSetupSkipped(true);
    setShowVaultSetup(false);
  }, []);

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
