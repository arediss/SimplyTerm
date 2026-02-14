import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getErrorMessage } from "../utils";

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

interface RegistrySource {
  name: string;
  url: string;
  enabled: boolean;
}

// ============================================================================
// Module-level cache (shared across all hook instances)
// ============================================================================

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

let cachedPlugins: RegistryPlugin[] | null = null;
let cachedUpdates: PluginUpdate[] | null = null;
let cacheTimestamp = 0;

// ============================================================================
// Hook
// ============================================================================

export function useRegistry() {
  const [plugins, setPlugins] = useState<RegistryPlugin[]>(cachedPlugins ?? []);
  const [updates, setUpdates] = useState<PluginUpdate[]>(cachedUpdates ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState(cacheTimestamp);

  const fetchPlugins = useCallback(async () => {
    if (cachedPlugins && Date.now() - cacheTimestamp < CACHE_TTL) {
      setPlugins(cachedPlugins);
      setLastFetched(cacheTimestamp);
      return cachedPlugins;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await invoke<RegistryPlugin[]>("registry_fetch_plugins");
      cachedPlugins = result;
      cacheTimestamp = Date.now();
      setPlugins(result);
      setLastFetched(cacheTimestamp);
      return result;
    } catch (err) {
      const msg = getErrorMessage(err, "Failed to fetch registry");
      setError(msg);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const checkUpdates = useCallback(async () => {
    if (cachedUpdates && Date.now() - cacheTimestamp < CACHE_TTL) {
      setUpdates(cachedUpdates);
      return cachedUpdates;
    }

    try {
      const result = await invoke<PluginUpdate[]>("registry_check_updates");
      cachedUpdates = result;
      setUpdates(result);
      return result;
    } catch (err) {
      const msg = getErrorMessage(err, "Failed to check updates");
      setError(msg);
      return [];
    }
  }, []);

  const forceRefresh = useCallback(async () => {
    cacheTimestamp = 0;
    cachedPlugins = null;
    cachedUpdates = null;
    await Promise.all([fetchPlugins(), checkUpdates()]);
  }, [fetchPlugins, checkUpdates]);

  const installPlugin = useCallback(async (plugin: RegistryPlugin) => {
    try {
      await invoke("registry_install_plugin", { plugin });
      return true;
    } catch (err) {
      const msg = getErrorMessage(err, "Failed to install plugin");
      setError(msg);
      return false;
    }
  }, []);

  const updatePlugin = useCallback(async (update: PluginUpdate) => {
    try {
      await invoke("registry_update_plugin", { update });
      setUpdates((prev) => prev.filter((u) => u.id !== update.id));
      cachedUpdates = cachedUpdates?.filter((u) => u.id !== update.id) ?? null;
      return true;
    } catch (err) {
      const msg = getErrorMessage(err, "Failed to update plugin");
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
    lastFetched,
    fetchPlugins,
    forceRefresh,
    installPlugin,
    checkUpdates,
    updatePlugin,
    getSources,
  };
}
