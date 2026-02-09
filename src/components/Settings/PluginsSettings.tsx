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
  ChevronRight,
  Code2,
  ScanSearch,
} from "lucide-react";
import { usePlugins, type PluginManifest } from "../../plugins";
import { useRegistry, type RegistryPlugin, type PluginUpdate } from "../../hooks/useRegistry";
import { useAppSettings } from "../../hooks/useAppSettings";
import PermissionApprovalModal from "../PermissionApprovalModal";
import Modal from "../Modal";

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
  const [pluginsDir, setPluginsDir] = useState("");
  const [pendingPlugin, setPendingPlugin] = useState<PluginManifest | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [uninstallTarget, setUninstallTarget] = useState<PluginManifest | null>(null);

  // Installed plugin IDs for quick lookup
  const installedIds = new Set(plugins.map((p) => p.id));

  useEffect(() => {
    invoke<string>("get_plugins_dir").then(setPluginsDir).catch(console.error);
  }, []);

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
      <div className="flex gap-1 p-1 bg-surface-0/20 rounded-lg">
        {(["installed", "browse", "dev"] as Tab[]).map((tabKey) => (
          <button
            key={tabKey}
            onClick={() => setTab(tabKey)}
            className={`
              flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all
              ${tab === tabKey
                ? tabKey === "dev" ? "bg-orange-400/20 text-orange-400" : "bg-accent/20 text-accent"
                : "text-text-muted hover:text-text hover:bg-surface-0/30"
              }
            `}
          >
            {tabKey === "installed"
              ? t("settings.plugins.tabInstalled")
              : tabKey === "browse"
                ? t("settings.plugins.tabBrowse")
                : t("settings.plugins.tabDev")}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "installed" && (
        <InstalledTab
          t={t}
          plugins={installedPlugins}
          updates={registry.updates}
          loading={loading}
          actionLoading={actionLoading}
          pluginsDir={pluginsDir}
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
  pluginsDir,
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
  pluginsDir: string;
  onToggle: (plugin: PluginManifest) => void;
  onUninstall: (plugin: PluginManifest) => void;
  onUpdate: (update: PluginUpdate) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-muted">
          {t("settings.plugins.pluginCount", { count: plugins.length })}
        </span>
        <button
          onClick={onRefresh}
          disabled={loading || actionLoading === "refresh"}
          className="flex items-center gap-1.5 px-2 py-1 text-xs text-text-muted hover:text-text transition-colors disabled:opacity-50"
        >
          <RefreshCw size={12} className={actionLoading === "refresh" ? "animate-spin" : ""} />
          {t("common.refresh")}
        </button>
      </div>

      {loading ? (
        <PluginListSkeleton />
      ) : plugins.length === 0 ? (
        <div className="text-center py-8 text-text-muted">
          <Puzzle size={32} className="mx-auto mb-3 opacity-50" />
          <p className="text-sm">{t("settings.plugins.noPlugins")}</p>
          <p className="text-xs mt-1">
            {t("settings.plugins.pluginDirHint")}{" "}
            <code className="px-1 py-0.5 bg-surface-0/50 rounded text-[10px]">
              {pluginsDir || "plugins/"}
            </code>
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
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
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-surface-0/20 rounded-lg overflow-hidden">
      {/* Header row - always visible, clickable to expand */}
      <div
        className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <ChevronRight
          size={14}
          className={`text-text-muted/50 transition-transform duration-200 shrink-0 ${expanded ? "rotate-90" : ""}`}
        />
        <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center text-accent shrink-0">
          <Puzzle size={14} />
        </div>
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="text-sm font-medium text-text truncate">{plugin.name}</span>
          <span className="text-[10px] text-text-muted bg-surface-0/50 px-1.5 py-0.5 rounded shrink-0">
            v{plugin.version}
          </span>
          {plugin.isDev && (
            <span className="text-[10px] font-semibold text-orange-400 bg-orange-400/15 px-1.5 py-0.5 rounded shrink-0">
              {t("settings.plugins.devBadge")}
            </span>
          )}
          {plugin.status === "error" && <AlertCircle size={12} className="text-error shrink-0" />}
          {update && (
            <span className="w-1.5 h-1.5 rounded-full bg-warning shrink-0" title={t("settings.plugins.updateTo", { version: update.latestVersion })} />
          )}
        </div>
        {/* Actions - stop propagation to avoid toggling expand */}
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onToggle}
            disabled={loading}
            className={`
              flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors
              ${plugin.status === "enabled"
                ? "bg-success/20 text-success hover:bg-success/30"
                : "bg-surface-0/50 text-text-muted hover:bg-surface-0"
              }
              disabled:opacity-50
            `}
          >
            {plugin.status === "enabled" ? (
              <>
                <Power size={11} />
                {t("common.active")}
              </>
            ) : (
              <>
                <PowerOff size={11} />
                {t("common.inactive")}
              </>
            )}
          </button>
          {!plugin.isDev && (
            <button
              onClick={onUninstall}
              disabled={loading}
              className="p-1.5 rounded-lg text-text-muted/40 hover:text-error hover:bg-error/10 transition-colors disabled:opacity-50"
              title={t("settings.plugins.uninstall")}
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-3 pb-3 pt-0 space-y-2 ml-[26px]">
          {plugin.description && (
            <p className="text-xs text-text-muted leading-relaxed">{plugin.description}</p>
          )}
          <div className="flex items-center gap-3">
            {plugin.author && (
              <span className="text-[10px] text-text-muted/70">
                {t("settings.plugins.byAuthor", { author: plugin.author })}
              </span>
            )}
            <span className="text-[10px] text-text-muted/40">{plugin.id}</span>
          </div>

          {/* Update banner */}
          {update && onUpdate && (
            <button
              onClick={onUpdate}
              disabled={loading}
              className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md bg-warning/10 hover:bg-warning/20 transition-colors disabled:opacity-50 group"
            >
              {loading ? (
                <RefreshCw size={12} className="text-warning animate-spin" />
              ) : (
                <ArrowUpCircle size={12} className="text-warning" />
              )}
              <span className="text-[11px] text-warning font-medium">
                {loading
                  ? t("settings.plugins.updating")
                  : t("settings.plugins.updateTo", { version: update.latestVersion })}
              </span>
              {!loading && (
                <span className="ml-auto text-[10px] text-warning/60 group-hover:text-warning transition-colors">
                  {t("settings.plugins.update")}
                </span>
              )}
            </button>
          )}
        </div>
      )}
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
      {/* Description */}
      <div className="flex items-start gap-3 p-3 bg-orange-400/5 border border-orange-400/20 rounded-lg">
        <Code2 size={16} className="text-orange-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-medium text-text mb-1">
            {t("settings.plugins.devModeTitle")}
          </p>
          <p className="text-[11px] text-text-muted leading-relaxed">
            {t("settings.plugins.devModeDesc")}
          </p>
        </div>
      </div>

      {/* Path config + scan */}
      <div className="space-y-1.5">
        <label className="text-[11px] text-text-muted">
          {t("settings.plugins.devPathLabel")}
        </label>
        <div className="flex gap-1.5">
          <input
            type="text"
            value={devPath}
            onChange={(e) => handlePathChange(e.target.value)}
            placeholder={t("settings.plugins.devPathPlaceholder")}
            className="flex-1 px-2.5 py-1.5 bg-surface-0/30 border border-surface-0/50 rounded-lg text-xs text-text placeholder:text-text-muted/50 focus:outline-none focus:border-orange-400/50"
          />
          <button
            onClick={handleScan}
            disabled={!devPath || scanning}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-orange-400/20 hover:bg-orange-400/30 text-orange-400 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
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
        <div className="text-center py-6 text-text-muted">
          <Code2 size={28} className="mx-auto mb-3 opacity-30" />
          <p className="text-xs">
            {devPath
              ? t("settings.plugins.devNoPlugins")
              : t("settings.plugins.devNoPath")}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          <span className="text-xs text-text-muted">
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
    <div className="space-y-3">
      {/* Search bar */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          placeholder={t("settings.plugins.searchPlaceholder")}
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 bg-surface-0/30 border border-surface-0/50 rounded-lg text-sm text-text placeholder:text-text-muted/50 focus:outline-none focus:border-accent/50"
        />
      </div>

      {/* Category filter */}
      <div className="flex gap-1.5 flex-wrap">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => onCategoryChange(cat.key)}
            className={`
              px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors
              ${selectedCategory === cat.key
                ? "bg-accent/20 text-accent"
                : "bg-surface-0/30 text-text-muted hover:text-text hover:bg-surface-0/50"
              }
            `}
          >
            {t(`settings.plugins.${cat.i18n}`)}
          </button>
        ))}
      </div>

      {/* Results */}
      {error ? (
        <div className="text-center py-8 text-text-muted">
          <AlertCircle size={28} className="mx-auto mb-3 text-error opacity-60" />
          <p className="text-sm text-error">{t("settings.plugins.registryError")}</p>
          {error && <p className="text-[10px] text-text-muted mt-1 break-all">{error}</p>}
          <button
            onClick={onRefresh}
            className="mt-3 px-3 py-1.5 text-xs text-accent hover:text-accent-hover transition-colors"
          >
            {t("common.refresh")}
          </button>
        </div>
      ) : loading ? (
        <PluginListSkeleton />
      ) : plugins.length === 0 ? (
        <div className="text-center py-8 text-text-muted">
          <Globe size={28} className="mx-auto mb-3 opacity-50" />
          <p className="text-sm">{t("settings.plugins.noResults")}</p>
          <p className="text-xs mt-1">{t("settings.plugins.noResultsHint")}</p>
        </div>
      ) : (
        <div className="space-y-1.5">
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
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-surface-0/20 rounded-lg overflow-hidden">
      {/* Header row - clickable to expand */}
      <div
        className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <ChevronRight
          size={14}
          className={`text-text-muted/50 transition-transform duration-200 shrink-0 ${expanded ? "rotate-90" : ""}`}
        />
        <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center text-accent shrink-0">
          <Puzzle size={14} />
        </div>
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="text-sm font-medium text-text truncate">{plugin.name}</span>
          <span className="text-[10px] text-text-muted bg-surface-0/50 px-1.5 py-0.5 rounded shrink-0">
            v{plugin.version}
          </span>
          {plugin.category && (
            <span className="text-[10px] text-accent/70 bg-accent/10 px-1.5 py-0.5 rounded shrink-0">
              {plugin.category}
            </span>
          )}
        </div>
        {/* Action - stop propagation to avoid toggling expand */}
        {isInstalled ? (
          <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-success/15 text-success shrink-0" onClick={(e) => e.stopPropagation()}>
            <Check size={11} />
            {t("settings.plugins.installed")}
          </span>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onInstall(); }}
            disabled={loading}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-accent/20 text-accent hover:bg-accent/30 transition-colors disabled:opacity-50 shrink-0"
          >
            {loading ? (
              <>
                <RefreshCw size={11} className="animate-spin" />
                {t("settings.plugins.installing")}
              </>
            ) : (
              <>
                <Download size={11} />
                {t("settings.plugins.install")}
              </>
            )}
          </button>
        )}
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-3 pb-3 pt-0 space-y-1.5 ml-[26px]">
          {plugin.description && (
            <p className="text-xs text-text-muted leading-relaxed">{plugin.description}</p>
          )}
          <div className="flex items-center gap-3 flex-wrap">
            {plugin.author && (
              <span className="text-[10px] text-text-muted/70">
                {t("settings.plugins.byAuthor", { author: plugin.author })}
              </span>
            )}
            {plugin.downloads > 0 && (
              <span className="text-[10px] text-text-muted/50 flex items-center gap-0.5">
                <Download size={9} />
                {plugin.downloads.toLocaleString()}
              </span>
            )}
            {plugin.repository && (
              <a
                href={plugin.repository}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-text-muted/50 hover:text-accent flex items-center gap-0.5 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink size={9} />
                Source
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Shared Components
// ============================================================================

function PluginListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-1.5 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-2.5 px-3 py-2.5 bg-surface-0/20 rounded-lg">
          <div className="w-3.5 h-3.5 rounded bg-surface-0/20 shrink-0" />
          <div className="w-8 h-8 rounded-lg bg-surface-0/30 shrink-0" />
          <div className="flex-1 flex items-center gap-2">
            <div className="h-3.5 w-24 bg-surface-0/25 rounded" />
            <div className="h-3 w-10 bg-surface-0/15 rounded" />
          </div>
          <div className="h-7 w-16 bg-surface-0/20 rounded-lg" />
        </div>
      ))}
    </div>
  );
}
