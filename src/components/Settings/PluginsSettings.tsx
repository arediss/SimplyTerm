import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Trash2 } from "lucide-react";
import { usePlugins, type PluginManifest } from "../../plugins";
import { useRegistry, type RegistryPlugin, type PluginUpdate } from "../../hooks/useRegistry";
import PermissionApprovalModal from "../PermissionApprovalModal";
import Modal from "../Modal";
import { SubTabs } from "./SettingsUIComponents";
import InstalledPluginsTab from "./InstalledPluginsTab";
import BrowsePluginsTab from "./BrowsePluginsTab";
import DeveloperPluginsTab from "./DeveloperPluginsTab";

type Tab = "installed" | "browse" | "dev";

export default function PluginsSettings() {
  const { t } = useTranslation();
  const { plugins, loading, refresh, enablePlugin, disablePlugin, uninstallPlugin } = usePlugins();
  const registry = useRegistry();

  const [tab, setTab] = useState<Tab>("installed");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [pendingPlugin, setPendingPlugin] = useState<PluginManifest | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [uninstallTarget, setUninstallTarget] = useState<PluginManifest | null>(null);

  const installedIds = new Set(plugins.filter((p) => !p.isDev).map((p) => p.id));

  useEffect(() => {
    void registry.checkUpdates();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tab === "browse" && registry.plugins.length === 0 && !registry.loading) {
      void registry.fetchPlugins();
    }
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

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
      await refresh();
      await registry.checkUpdates();
    } finally {
      setActionLoading(null);
    }
  };

  const handleInstall = async (plugin: RegistryPlugin) => {
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

  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      if (query.trim()) {
        void registry.searchPlugins(query);
      } else {
        void registry.fetchPlugins();
      }
    },
    [registry] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const filteredBrowse =
    selectedCategory === "all"
      ? registry.plugins
      : registry.plugins.filter(
          (p) => p.category?.toLowerCase() === selectedCategory
        );

  const installedPlugins = plugins.filter((p) => !p.isDev);
  const devPlugins = plugins.filter((p) => p.isDev);

  return (
    <div className="space-y-4">
      <SubTabs
        tabs={[
          { id: "installed" as const, label: t("settings.plugins.tabInstalled") },
          { id: "browse" as const, label: t("settings.plugins.tabBrowse") },
          { id: "dev" as const, label: t("settings.plugins.tabDev"), variant: "warning" },
        ]}
        activeTab={tab}
        onChange={setTab}
      />

      {tab === "installed" && (
        <InstalledPluginsTab
          plugins={installedPlugins}
          updates={registry.updates}
          loading={loading}
          actionLoading={actionLoading}
          onToggle={handleTogglePlugin}
          onUninstall={setUninstallTarget}
          onUpdate={handleUpdate}
          onRefresh={handleRefresh}
        />
      )}

      {tab === "browse" && (
        <BrowsePluginsTab
          plugins={filteredBrowse}
          loading={registry.loading}
          error={registry.error}
          installedIds={installedIds}
          actionLoading={actionLoading}
          searchQuery={searchQuery}
          selectedCategory={selectedCategory}
          onSearch={handleSearch}
          onCategoryChange={setSelectedCategory}
          onInstall={handleInstall}
          onRefresh={() => registry.fetchPlugins()}
        />
      )}

      {tab === "dev" && (
        <DeveloperPluginsTab
          plugins={devPlugins}
          loading={loading}
          actionLoading={actionLoading}
          onToggle={handleTogglePlugin}
          onRefresh={handleRefresh}
        />
      )}

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
    </div>
  );
}
