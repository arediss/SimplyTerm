import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { VaultFolder } from "../types/vault";

export function useVaultFolders() {
  const [folders, setFolders] = useState<VaultFolder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshFolders = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await invoke<VaultFolder[]>("list_vault_folders");
      setFolders(result);
      setError(null);
    } catch (err) {
      // Vault might be locked — silently ignore
      setFolders([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createFolder = useCallback(async (name: string) => {
    try {
      const folder = await invoke<VaultFolder>("create_vault_folder", { name });
      setFolders((prev) => [...prev, folder]);
      return { success: true, folder };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      return { success: false, error: msg };
    }
  }, []);

  const renameFolder = useCallback(async (id: string, name: string) => {
    try {
      await invoke<boolean>("rename_vault_folder", { id, name });
      setFolders((prev) =>
        prev.map((f) => (f.id === id ? { ...f, name } : f))
      );
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      return { success: false, error: msg };
    }
  }, []);

  const deleteFolder = useCallback(async (id: string) => {
    try {
      await invoke<boolean>("delete_vault_folder", { id });
      setFolders((prev) => prev.filter((f) => f.id !== id));
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      return { success: false, error: msg };
    }
  }, []);

  // Refresh when vault status changes
  useEffect(() => {
    refreshFolders();
    const unlisten = listen("vault-status-changed", () => {
      refreshFolders();
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [refreshFolders]);

  return {
    folders,
    isLoading,
    error,
    createFolder,
    renameFolder,
    deleteFolder,
    refreshFolders,
  };
}
