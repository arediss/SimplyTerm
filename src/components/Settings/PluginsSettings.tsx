import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Trash2 } from "lucide-react";
import { pluginManager, usePlugins, type PluginManifest } from "../../plugins";
import { useRegistry, type RegistryPlugin, type PluginUpdate } from "../../hooks/useRegistry";
import { useAppSettings } from "../../hooks";
import PermissionApprovalModal from "../PermissionApprovalModal";
import Modal from "../Modal";
import InstallConfirmationModal from "../InstallConfirmationModal";
import PluginsTab from "./PluginsTab";

// ============================================================================
// Unified Plugin Type
// ============================================================================

export type UnifiedPlugin = {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  category?: string;
  downloads?: number;
  repository?: string;
  homepage?: string;
  permissions: string[];
  installed: boolean;
  status?: "enabled" | "disabled" | "error";
  update?: PluginUpdate;
  manifest?: PluginManifest;
  registryEntry?: RegistryPlugin;
};

// ============================================================================
// Component
// ============================================================================

interface PluginsSettingsProps {
  onNavigateToSection?: (section: string) => void;
}

export default function PluginsSettings({ onNavigateToSection }: Readonly<PluginsSettingsProps> = {}) {
  const { t } = useTranslation();
  const { plugins, loading, refresh, enablePlugin, disablePlugin, uninstallPlugin } = usePlugins();
  const registry = useRegistry();
  const { settings } = useAppSettings();

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [pendingPlugin, setPendingPlugin] = useState<PluginManifest | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [uninstallTarget, setUninstallTarget] = useState<PluginManifest | null>(null);
  const [installTarget, setInstallTarget] = useState<RegistryPlugin | null>(null);

  const devModeEnabled = settings.developer?.enabled ?? false;

  // Fetch registry on mount
  useEffect(() => {
    registry.fetchPlugins();
    registry.checkUpdates();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Build unified plugin list ----
  const unifiedPlugins = useMemo(() => {
    const result: UnifiedPlugin[] = [];
    const installedById = new Map<string, PluginManifest>();

    for (const p of plugins) {
      if (!p.isDev) {
        installedById.set(p.id, p);
      }
    }

    const seen = new Set<string>();
    for (const rp of registry.plugins) {
      seen.add(rp.id);
      const installed = installedById.get(rp.id);
      result.push({
        id: rp.id,
        name: rp.name,
        version: installed?.version ?? rp.version,
        description: rp.description,
        author: rp.author,
        category: rp.category,
        downloads: rp.downloads,
        repository: rp.repository,
        homepage: rp.homepage,
        permissions: installed?.permissions ?? rp.permissions,
        installed: !!installed,
        status: installed?.status,
        manifest: installed,
        registryEntry: rp,
      });
    }

    for (const [id, mp] of installedById) {
      if (!seen.has(id)) {
        result.push({
          id: mp.id,
          name: mp.name,
          version: mp.version,
          description: mp.description,
          author: mp.author,
          category: mp.category,
          repository: mp.repository,
          homepage: mp.homepage,
          permissions: mp.permissions,
          installed: true,
          status: mp.status,
          manifest: mp,
        });
      }
    }

    return result;
  }, [plugins, registry.plugins]);

  // ---- Handlers ----

  const handleTogglePlugin = async (plugin: PluginManifest) => {
    if (plugin.status === "enabled") {
      setActionLoading(plugin.id);
      try {
        await disablePlugin(plugin.id);
      } catch (error) {
        console.error("Failed to disable plugin:", error);
      } finally {
        setActionLoading(null);
      }
    } else {
      setPendingPlugin(plugin);
    }
  };

  const handleApprovePermissions = async () => {
    if (!pendingPlugin) return;
    const pluginId = pendingPlugin.id;
    setPendingPlugin(null);
    setActionLoading(pluginId);
    try {
      await enablePlugin(pluginId);
    } catch (error) {
      console.error("Failed to enable plugin:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRefresh = async () => {
    setActionLoading("refresh");
    try {
      await Promise.all([refresh(), registry.forceRefresh()]);
    } finally {
      setActionLoading(null);
    }
  };

  const performInstall = async (plugin: RegistryPlugin) => {
    setActionLoading(plugin.id);
    try {
      const success = await registry.installPlugin(plugin);
      if (success) {
        await refresh();
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleInstall = (plugin: UnifiedPlugin) => {
    if (plugin.registryEntry) {
      setInstallTarget(plugin.registryEntry);
    }
  };

  const handleConfirmInstallOnly = async () => {
    if (!installTarget) return;
    const plugin = installTarget;
    setInstallTarget(null);
    await performInstall(plugin);
  };

  const handleConfirmInstallAndActivate = async () => {
    if (!installTarget) return;
    const plugin = installTarget;
    setInstallTarget(null);
    setActionLoading(plugin.id);
    try {
      const success = await registry.installPlugin(plugin);
      if (success) {
        await refresh();
        await enablePlugin(plugin.id);
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleConfirmUninstall = async () => {
    if (!uninstallTarget) return;
    const pluginId = uninstallTarget.id;
    setUninstallTarget(null);
    setActionLoading(pluginId);
    try {
      await uninstallPlugin(pluginId);
    } catch (error) {
      console.error("Failed to uninstall plugin:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdate = async (update: PluginUpdate) => {
    setActionLoading(update.id);
    try {
      const success = await registry.updatePlugin(update);
      if (success) {
        await refresh();
        await registry.checkUpdates();
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const devPlugins = plugins.filter((p) => p.isDev);

  const pluginsWithSettings = useMemo(
    () => new Set(
      Array.from(pluginManager.registeredSettingsPanels.values()).map((entry) => entry.pluginId)
    ),
    [plugins] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const handleOpenPluginSettings = useCallback((pluginId: string) => {
    for (const [panelId, entry] of pluginManager.registeredSettingsPanels) {
      if (entry.pluginId === pluginId) {
        onNavigateToSection?.(`plugin:${panelId}`);
        return;
      }
    }
  }, [onNavigateToSection]);

  return (
    <div className="space-y-4">
      <PluginsTab
        plugins={unifiedPlugins}
        updates={registry.updates}
        loading={loading}
        registryLoading={registry.loading}
        registryError={registry.error}
        actionLoading={actionLoading}
        searchQuery={searchQuery}
        selectedCategory={selectedCategory}
        onSearch={handleSearch}
        onCategoryChange={setSelectedCategory}
        onToggle={handleTogglePlugin}
        onUninstall={setUninstallTarget}
        onUpdate={handleUpdate}
        onInstall={handleInstall}
        onRefresh={handleRefresh}
        pluginsWithSettings={pluginsWithSettings}
        onOpenPluginSettings={handleOpenPluginSettings}
        devModeEnabled={devModeEnabled}
        devPlugins={devPlugins}
      />

      {/* Permission approval modal */}
      <PermissionApprovalModal
        isOpen={pendingPlugin !== null}
        onClose={() => setPendingPlugin(null)}
        onApprove={handleApprovePermissions}
        pluginName={pendingPlugin?.name ?? ""}
        permissions={pendingPlugin?.permissions ?? []}
      />

      {/* Uninstall confirmation modal */}
      <Modal
        isOpen={uninstallTarget !== null}
        onClose={() => setUninstallTarget(null)}
        title={t("settings.plugins.uninstall")}
        width="sm"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-error/20 flex items-center justify-center text-error shrink-0">
              <Trash2 size={18} />
            </div>
            <p className="text-sm text-text">
              {t("settings.plugins.uninstallConfirm", { name: uninstallTarget?.name ?? "" })}
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setUninstallTarget(null)}
              className="px-4 py-2 text-xs font-medium text-text-muted hover:text-text bg-surface-0/30 hover:bg-surface-0/50 rounded-lg transition-colors"
            >
              {t("common.cancel")}
            </button>
            <button
              onClick={handleConfirmUninstall}
              className="px-4 py-2 text-xs font-medium text-white bg-error hover:bg-error/80 rounded-lg transition-colors"
            >
              {t("settings.plugins.uninstall")}
            </button>
          </div>
        </div>
      </Modal>

      {/* Install confirmation modal */}
      <InstallConfirmationModal
        isOpen={installTarget !== null}
        onClose={() => setInstallTarget(null)}
        onInstallOnly={handleConfirmInstallOnly}
        onInstallAndActivate={handleConfirmInstallAndActivate}
        plugin={installTarget}
      />
    </div>
  );
}
