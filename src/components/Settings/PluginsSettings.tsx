import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import {
  Puzzle,
  RefreshCw,
  Power,
  PowerOff,
  AlertCircle,
  Search,
  Download,
  Check,
  ArrowUpCircle,
  Globe,
  ExternalLink,
  Trash2,
  Code2,
  ScanSearch,
} from "lucide-react";
import { usePlugins, type PluginManifest } from "../../plugins";
import { useRegistry, type RegistryPlugin, type PluginUpdate } from "../../hooks/useRegistry";
import { useAppSettings } from "../../hooks/useAppSettings";
import PermissionApprovalModal from "../PermissionApprovalModal";
import Modal from "../Modal";
import { SubTabs } from "./SettingsUIComponents";

type Tab = "installed" | "browse" | "dev";

const CATEGORIES = [
  { key: "all", i18n: "categoryAll" },
  { key: "themes", i18n: "categoryThemes" },
  { key: "productivity", i18n: "categoryProductivity" },
  { key: "security", i18n: "categorySecurity" },
  { key: "devops", i18n: "categoryDevops" },
  { key: "tools", i18n: "categoryTools" },
] as const;

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

  // Installed plugin IDs for quick lookup (exclude dev plugins for consistency with Installed tab)
  const installedIds = new Set(plugins.filter((p) => !p.isDev).map((p) => p.id));

  // Check for updates on mount
  useEffect(() => {
    registry.checkUpdates();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch registry when switching to browse tab
  useEffect(() => {
    if (tab === "browse" && registry.plugins.length === 0 && !registry.loading) {
      registry.fetchPlugins();
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

  const handleDenyPermissions = () => {
    setPendingPlugin(null);
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

  const handleUninstall = (plugin: PluginManifest) => {
    setUninstallTarget(plugin);
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
        registry.searchPlugins(query);
      } else {
        registry.fetchPlugins();
      }
    },
    [registry] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Filter browse results by category
  const filteredBrowse =
    selectedCategory === "all"
      ? registry.plugins
      : registry.plugins.filter(
          (p) => p.category?.toLowerCase() === selectedCategory
        );

  // Split plugins: non-dev for Installed tab, dev for Dev tab
  const installedPlugins = plugins.filter((p) => !p.isDev);
  const devPlugins = plugins.filter((p) => p.isDev);

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <SubTabs
        tabs={[
          { id: "installed" as const, label: t("settings.plugins.tabInstalled") },
          { id: "browse" as const, label: t("settings.plugins.tabBrowse") },
          { id: "dev" as const, label: t("settings.plugins.tabDev"), variant: "warning" },
        ]}
        activeTab={tab}
        onChange={setTab}
      />

      {/* Tab content */}
      {tab === "installed" && (
        <InstalledTab
          t={t}
          plugins={installedPlugins}
          updates={registry.updates}
          loading={loading}
          actionLoading={actionLoading}

          onToggle={handleTogglePlugin}
          onUninstall={handleUninstall}
          onUpdate={handleUpdate}
          onRefresh={handleRefresh}
        />
      )}

      {tab === "browse" && (
        <BrowseTab
          t={t}
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
        <DevTab
          t={t}
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
        onClose={handleDenyPermissions}
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

// ============================================================================
// Installed Tab
// ============================================================================

function InstalledTab({
  t,
  plugins,
  updates,
  loading,
  actionLoading,
  onToggle,
  onUninstall,
  onUpdate,
  onRefresh,
}: {
  t: (key: string, opts?: Record<string, unknown>) => string;
  plugins: PluginManifest[];
  updates: PluginUpdate[];
  loading: boolean;
  actionLoading: string | null;
  onToggle: (plugin: PluginManifest) => void;
  onUninstall: (plugin: PluginManifest) => void;
  onUpdate: (update: PluginUpdate) => void;
  onRefresh: () => void;
}) {
  const updatableCount = updates.length;

  return (
    <div className="space-y-4">
      {/* Updates banner */}
      {updatableCount > 0 && !loading && (
        <div className="flex items-center gap-3 p-3 bg-warning/8 border border-warning/15 rounded-xl">
          <div className="w-8 h-8 rounded-lg bg-warning/15 flex items-center justify-center shrink-0">
            <ArrowUpCircle size={16} className="text-warning" />
          </div>
          <p className="flex-1 text-xs text-text">
            <span className="font-medium">{updatableCount}</span>{" "}
            <span className="text-text-muted">
              {updatableCount === 1 ? t("settings.plugins.updateAvailableSingular") : t("settings.plugins.updateAvailablePlural")}
            </span>
          </p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted">
            {t("settings.plugins.pluginCount", { count: plugins.length })}
          </span>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading || actionLoading === "refresh"}
          className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-0/30 transition-colors disabled:opacity-50"
          title={t("common.refresh")}
        >
          <RefreshCw size={14} className={actionLoading === "refresh" ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Plugin list */}
      {loading ? (
        <PluginListSkeleton />
      ) : plugins.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-text-muted">
          <div className="w-16 h-16 rounded-2xl bg-surface-0/20 flex items-center justify-center mb-4">
            <Puzzle size={28} className="opacity-40" />
          </div>
          <p className="text-sm font-medium text-text/60">{t("settings.plugins.noPlugins")}</p>
          <p className="text-[11px] text-text-muted/60 mt-1 max-w-[240px] text-center">
            {t("settings.plugins.pluginDirHint")}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {plugins.map((plugin) => {
            const update = updates.find((u) => u.id === plugin.id);
            return (
              <InstalledPluginCard
                key={plugin.id}
                plugin={plugin}
                update={update}
                loading={actionLoading === plugin.id}
                onToggle={() => onToggle(plugin)}
                onUninstall={() => onUninstall(plugin)}
                onUpdate={update ? () => onUpdate(update) : undefined}
                t={t}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function InstalledPluginCard({
  plugin,
  update,
  loading,
  onToggle,
  onUninstall,
  onUpdate,
  t,
}: {
  plugin: PluginManifest;
  update?: PluginUpdate;
  loading: boolean;
  onToggle: () => void;
  onUninstall: () => void;
  onUpdate?: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  return (
    <div className="group flex gap-3 p-3 bg-surface-0/15 hover:bg-surface-0/25 rounded-xl transition-colors">
      {/* Icon — color reflects status */}
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
        plugin.status === "error" ? "bg-error/15 text-error" :
        plugin.status === "enabled" ? "bg-accent/15 text-accent" :
        "bg-surface-0/40 text-text-muted"
      }`}>
        <Puzzle size={18} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text truncate">{plugin.name}</span>
          <span className="text-[10px] text-text-muted/60 bg-surface-0/40 px-1.5 py-0.5 rounded shrink-0">
            v{plugin.version}
          </span>
          {plugin.isDev && (
            <span className="text-[10px] font-semibold text-orange-400 bg-orange-400/15 px-1.5 py-0.5 rounded shrink-0">
              {t("settings.plugins.devBadge")}
            </span>
          )}
          {plugin.status === "error" && <AlertCircle size={12} className="text-error shrink-0" />}
        </div>
        {plugin.description && (
          <p className="text-[11px] text-text-muted/70 truncate mt-0.5">{plugin.description}</p>
        )}
        {plugin.author && (
          <p className="text-[10px] text-text-muted/50 mt-0.5">
            {t("settings.plugins.byAuthor", { author: plugin.author })}
          </p>
        )}

        {/* Update banner — inline in the card */}
        {update && onUpdate && (
          <button
            onClick={onUpdate}
            disabled={loading}
            className="flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-lg bg-warning/10 hover:bg-warning/20 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <RefreshCw size={11} className="text-warning animate-spin" />
            ) : (
              <ArrowUpCircle size={11} className="text-warning" />
            )}
            <span className="text-[11px] text-warning font-medium">
              {loading
                ? t("settings.plugins.updating")
                : t("settings.plugins.updateTo", { version: update.latestVersion })}
            </span>
          </button>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-start gap-1 shrink-0">
        <button
          onClick={onToggle}
          disabled={loading}
          className={`
            flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors
            ${plugin.status === "enabled"
              ? "bg-success/15 text-success hover:bg-success/25"
              : "bg-surface-0/40 text-text-muted hover:bg-surface-0/60"
            }
            disabled:opacity-50
          `}
        >
          {plugin.status === "enabled" ? (
            <><Power size={11} />{t("common.active")}</>
          ) : (
            <><PowerOff size={11} />{t("common.inactive")}</>
          )}
        </button>
        {!plugin.isDev && (
          <button
            onClick={onUninstall}
            disabled={loading}
            className="p-1.5 rounded-lg text-text-muted/30 opacity-0 group-hover:opacity-100 hover:text-error hover:bg-error/10 transition-all disabled:opacity-50"
            title={t("settings.plugins.uninstall")}
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Dev Tab
// ============================================================================

function DevTab({
  t,
  plugins,
  loading,
  actionLoading,
  onToggle,
  onRefresh,
}: {
  t: (key: string, opts?: Record<string, unknown>) => string;
  plugins: PluginManifest[];
  loading: boolean;
  actionLoading: string | null;
  onToggle: (plugin: PluginManifest) => void;
  onRefresh: () => void;
}) {
  const { settings, updateSettings } = useAppSettings();
  const [scanning, setScanning] = useState(false);

  const devPath = settings.developer?.devPluginsPath ?? "";

  const handlePathChange = async (newPath: string) => {
    const updated = {
      ...settings,
      developer: { enabled: true, devPluginsPath: newPath || undefined },
    };
    await updateSettings(updated);
  };

  const handleScan = async () => {
    if (!devPath) return;
    setScanning(true);
    try {
      // Ensure dev mode is enabled before scanning
      if (!settings.developer?.enabled) {
        const updated = {
          ...settings,
          developer: { enabled: true, devPluginsPath: devPath },
        };
        await updateSettings(updated);
      }
      await invoke("scan_dev_plugins");
      onRefresh();
    } catch (err) {
      console.error("Dev scan failed:", err);
    } finally {
      setScanning(false);
    }
  };

  // Auto-enable dev mode when entering this tab (if path is set)
  useEffect(() => {
    if (devPath && !settings.developer?.enabled) {
      const updated = {
        ...settings,
        developer: { enabled: true, devPluginsPath: devPath },
      };
      updateSettings(updated);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      {/* Dev info + path config grouped */}
      <div className="p-3 bg-orange-400/5 border border-orange-400/15 rounded-xl space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-orange-400/15 flex items-center justify-center shrink-0">
            <Code2 size={16} className="text-orange-400" />
          </div>
          <div>
            <p className="text-xs font-medium text-text">
              {t("settings.plugins.devModeTitle")}
            </p>
            <p className="text-[11px] text-text-muted/70 leading-relaxed mt-0.5">
              {t("settings.plugins.devModeDesc")}
            </p>
          </div>
        </div>

        {/* Path config inline */}
        <div className="flex gap-1.5">
          <input
            type="text"
            value={devPath}
            onChange={(e) => handlePathChange(e.target.value)}
            placeholder={t("settings.plugins.devPathPlaceholder")}
            className="flex-1 px-2.5 py-1.5 bg-surface-0/20 border border-orange-400/15 rounded-lg text-xs text-text placeholder:text-text-muted/40 focus:outline-none focus:border-orange-400/40 transition-colors"
          />
          <button
            onClick={handleScan}
            disabled={!devPath || scanning}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-400/20 hover:bg-orange-400/30 text-orange-400 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
          >
            {scanning ? (
              <RefreshCw size={12} className="animate-spin" />
            ) : (
              <ScanSearch size={12} />
            )}
            {t("settings.plugins.devScan")}
          </button>
        </div>
      </div>

      {/* Dev plugins list */}
      {loading ? (
        <PluginListSkeleton count={2} />
      ) : plugins.length === 0 ? (
        <div className="flex flex-col items-center py-10 text-text-muted">
          <div className="w-14 h-14 rounded-2xl bg-orange-400/8 flex items-center justify-center mb-3">
            <Code2 size={24} className="text-orange-400/40" />
          </div>
          <p className="text-xs text-text-muted/60">
            {devPath
              ? t("settings.plugins.devNoPlugins")
              : t("settings.plugins.devNoPath")}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <span className="text-[11px] text-text-muted/60">
            {t("settings.plugins.pluginCount", { count: plugins.length })}
          </span>
          {plugins.map((plugin) => (
            <InstalledPluginCard
              key={plugin.id}
              plugin={plugin}
              loading={actionLoading === plugin.id}
              onToggle={() => onToggle(plugin)}
              onUninstall={() => {}}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Browse Tab
// ============================================================================

function BrowseTab({
  t,
  plugins,
  loading,
  error,
  installedIds,
  actionLoading,
  searchQuery,
  selectedCategory,
  onSearch,
  onCategoryChange,
  onInstall,
  onRefresh,
}: {
  t: (key: string, opts?: Record<string, unknown>) => string;
  plugins: RegistryPlugin[];
  loading: boolean;
  error: string | null;
  installedIds: Set<string>;
  actionLoading: string | null;
  searchQuery: string;
  selectedCategory: string;
  onSearch: (query: string) => void;
  onCategoryChange: (cat: string) => void;
  onInstall: (plugin: RegistryPlugin) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* Search + Categories grouped */}
      <div className="space-y-3 p-3 bg-surface-0/10 rounded-xl">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted/50" />
          <input
            type="text"
            placeholder={t("settings.plugins.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-surface-0/30 border border-surface-0/30 rounded-xl text-xs text-text placeholder:text-text-muted/40 focus:outline-none focus:border-accent/40 focus:bg-surface-0/40 transition-colors"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => onCategoryChange(cat.key)}
              className={`
                px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors
                ${selectedCategory === cat.key
                  ? "bg-accent/20 text-accent"
                  : "text-text-muted/60 hover:text-text hover:bg-surface-0/40"
                }
              `}
            >
              {t(`settings.plugins.${cat.i18n}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {error ? (
        <div className="flex flex-col items-center py-12 text-text-muted">
          <div className="w-16 h-16 rounded-2xl bg-error/10 flex items-center justify-center mb-4">
            <AlertCircle size={28} className="text-error/60" />
          </div>
          <p className="text-sm font-medium text-error/80">{t("settings.plugins.registryError")}</p>
          {error && <p className="text-[10px] text-text-muted/60 mt-1.5 max-w-[280px] text-center break-all">{error}</p>}
          <button
            onClick={onRefresh}
            className="mt-4 px-4 py-1.5 text-xs font-medium text-accent bg-accent/10 hover:bg-accent/20 rounded-lg transition-colors"
          >
            {t("common.refresh")}
          </button>
        </div>
      ) : loading ? (
        <PluginListSkeleton />
      ) : plugins.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-text-muted">
          <div className="w-16 h-16 rounded-2xl bg-surface-0/20 flex items-center justify-center mb-4">
            <Globe size={28} className="opacity-40" />
          </div>
          <p className="text-sm font-medium text-text/60">{t("settings.plugins.noResults")}</p>
          <p className="text-[11px] text-text-muted/60 mt-1">{t("settings.plugins.noResultsHint")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {plugins.map((plugin) => {
            const isInstalled = installedIds.has(plugin.id);
            return (
              <BrowsePluginCard
                key={plugin.id}
                plugin={plugin}
                isInstalled={isInstalled}
                loading={actionLoading === plugin.id}
                onInstall={() => onInstall(plugin)}
                t={t}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function BrowsePluginCard({
  plugin,
  isInstalled,
  loading,
  onInstall,
  t,
}: {
  plugin: RegistryPlugin;
  isInstalled: boolean;
  loading: boolean;
  onInstall: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  return (
    <div className="flex gap-3 p-3 bg-surface-0/15 hover:bg-surface-0/25 rounded-xl transition-colors">
      {/* Icon — changes when installed */}
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
        isInstalled ? "bg-success/15 text-success" : "bg-accent/15 text-accent"
      }`}>
        {isInstalled ? <Check size={18} /> : <Puzzle size={18} />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text truncate">{plugin.name}</span>
          <span className="text-[10px] text-text-muted/60 bg-surface-0/40 px-1.5 py-0.5 rounded shrink-0">
            v{plugin.version}
          </span>
          {plugin.category && (
            <span className="text-[10px] text-accent/70 bg-accent/10 px-1.5 py-0.5 rounded shrink-0">
              {plugin.category}
            </span>
          )}
        </div>
        {plugin.description && (
          <p className="text-[11px] text-text-muted/70 truncate mt-0.5">{plugin.description}</p>
        )}
        <div className="flex items-center gap-2.5 mt-1">
          {plugin.author && (
            <span className="text-[10px] text-text-muted/50">
              {t("settings.plugins.byAuthor", { author: plugin.author })}
            </span>
          )}
          {plugin.downloads > 0 && (
            <span className="text-[10px] text-text-muted/40 flex items-center gap-0.5">
              <Download size={9} />
              {plugin.downloads.toLocaleString()}
            </span>
          )}
          {plugin.repository && (
            <a
              href={plugin.repository}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-text-muted/40 hover:text-accent flex items-center gap-0.5 transition-colors"
            >
              <ExternalLink size={9} />
              Source
            </a>
          )}
        </div>
      </div>

      {/* Action */}
      <div className="shrink-0 self-start">
        {isInstalled ? (
          <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-success/15 text-success">
            <Check size={11} />
            {t("settings.plugins.installed")}
          </span>
        ) : (
          <button
            onClick={onInstall}
            disabled={loading}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-accent/15 text-accent hover:bg-accent/25 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <><RefreshCw size={11} className="animate-spin" />{t("settings.plugins.installing")}</>
            ) : (
              <><Download size={11} />{t("settings.plugins.install")}</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Shared Components
// ============================================================================

function PluginListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex gap-3 p-3 bg-surface-0/15 rounded-xl">
          <div className="w-10 h-10 rounded-xl bg-surface-0/30 shrink-0" />
          <div className="flex-1 space-y-2 py-0.5">
            <div className="flex items-center gap-2">
              <div className="h-3.5 w-28 bg-surface-0/25 rounded" />
              <div className="h-3 w-10 bg-surface-0/15 rounded" />
            </div>
            <div className="h-2.5 w-48 bg-surface-0/15 rounded" />
          </div>
          <div className="h-7 w-16 bg-surface-0/20 rounded-lg shrink-0" />
        </div>
      ))}
    </div>
  );
}
