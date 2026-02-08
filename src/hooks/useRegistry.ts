import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

// ============================================================================
// Types
// ============================================================================

export interface RegistryPlugin {
  id: string;
  name: string;
  version: string;
  apiVersion: string;
  description: string;
  author: string;
  homepage?: string;
  repository?: string;
  license?: string;
  category?: string;
  keywords: string[];
  permissions: string[];
  downloadUrl: string;
  checksum?: string;
  downloads: number;
  registry?: string;
}

export interface PluginUpdate {
  id: string;
  currentVersion: string;
  latestVersion: string;
  downloadUrl: string;
  checksum?: string;
  description?: string;
}

export interface RegistrySource {
  name: string;
  url: string;
  enabled: boolean;
}

// ============================================================================
// Hook
// ============================================================================

export function useRegistry() {
  const [plugins, setPlugins] = useState<RegistryPlugin[]>([]);
  const [updates, setUpdates] = useState<PluginUpdate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPlugins = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<RegistryPlugin[]>("registry_fetch_plugins");
      setPlugins(result);
      return result;
    } catch (err) {
      const msg = typeof err === "string" ? err : "Failed to fetch registry";
      setError(msg);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const searchPlugins = useCallback(async (query: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<RegistryPlugin[]>("registry_search_plugins", { query });
      setPlugins(result);
      return result;
    } catch (err) {
      const msg = typeof err === "string" ? err : "Failed to search registry";
      setError(msg);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const installPlugin = useCallback(async (plugin: RegistryPlugin) => {
    try {
      await invoke("registry_install_plugin", { plugin });
      return true;
    } catch (err) {
      const msg = typeof err === "string" ? err : "Failed to install plugin";
      setError(msg);
      return false;
    }
  }, []);

  const checkUpdates = useCallback(async () => {
    try {
      const result = await invoke<PluginUpdate[]>("registry_check_updates");
      setUpdates(result);
      return result;
    } catch (err) {
      const msg = typeof err === "string" ? err : "Failed to check updates";
      setError(msg);
      return [];
    }
  }, []);

  const updatePlugin = useCallback(async (update: PluginUpdate) => {
    try {
      await invoke("registry_update_plugin", { update });
      // Remove from updates list
      setUpdates((prev) => prev.filter((u) => u.id !== update.id));
      return true;
    } catch (err) {
      const msg = typeof err === "string" ? err : "Failed to update plugin";
      setError(msg);
      return false;
    }
  }, []);

  const getSources = useCallback(async () => {
    try {
      return await invoke<RegistrySource[]>("registry_get_sources");
    } catch {
      return [];
    }
  }, []);

  return {
    plugins,
    updates,
    loading,
    error,
    fetchPlugins,
    searchPlugins,
    installPlugin,
    checkUpdates,
    updatePlugin,
    getSources,
  };
}
