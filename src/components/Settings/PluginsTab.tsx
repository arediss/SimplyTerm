import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Search, RefreshCw, ArrowUpCircle, AlertCircle, Puzzle } from "lucide-react";
import type { UnifiedPlugin } from "./PluginsSettings";
import type { PluginUpdate } from "../../hooks/useRegistry";
import { UnifiedPluginCard, PluginListSkeleton } from "./PluginCards";
import type { PluginManifest } from "../../plugins";
import DeveloperPluginsTab from "./DeveloperPluginsTab";

type StatusFilter = "all" | "installed" | "available" | "dev";

const CATEGORIES = [
  { key: "themes", i18n: "categoryThemes" },
  { key: "productivity", i18n: "categoryProductivity" },
  { key: "security", i18n: "categorySecurity" },
  { key: "devops", i18n: "categoryDevops" },
  { key: "tools", i18n: "categoryTools" },
] as const;

const BASE_STATUS_FILTERS: { key: StatusFilter; i18n: string }[] = [
  { key: "all", i18n: "filterAll" },
  { key: "installed", i18n: "filterInstalled" },
  { key: "available", i18n: "filterAvailable" },
];

function getFilterButtonClass(key: StatusFilter, active: StatusFilter): string {
  const isDev = key === "dev";
  const isActive = key === active;
  if (isActive && isDev) return "bg-orange-400/20 text-orange-400 shadow-sm";
  if (isActive) return "bg-surface-0 text-text shadow-sm";
  if (isDev) return "text-orange-400/60 hover:text-orange-400 hover:bg-orange-400/10";
  return "text-text-muted hover:text-text hover:bg-surface-0/50";
}

interface PluginsTabProps {
  plugins: UnifiedPlugin[];
  updates: PluginUpdate[];
  loading: boolean;
  registryLoading: boolean;
  registryError: string | null;
  actionLoading: string | null;
  searchQuery: string;
  selectedCategory: string;
  onSearch: (query: string) => void;
  onCategoryChange: (cat: string) => void;
  onToggle: (plugin: PluginManifest) => void;
  onUninstall: (plugin: PluginManifest) => void;
  onUpdate: (update: PluginUpdate) => void;
  onInstall: (plugin: UnifiedPlugin) => void;
  onRefresh: () => void;
  pluginsWithSettings: Set<string>;
  onOpenPluginSettings: (pluginId: string) => void;
  devModeEnabled: boolean;
  devPlugins: PluginManifest[];
}

export default function PluginsTab({
  plugins,
  updates,
  loading,
  registryLoading,
  registryError,
  actionLoading,
  searchQuery,
  selectedCategory,
  onSearch,
  onCategoryChange,
  onToggle,
  onUninstall,
  onUpdate,
  onInstall,
  onRefresh,
  pluginsWithSettings,
  onOpenPluginSettings,
  devModeEnabled,
  devPlugins,
}: Readonly<PluginsTabProps>) {
  const { t } = useTranslation();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const updatableCount = updates.length;

  const isDevView = statusFilter === "dev";

  // ---- Apply filters (only for non-dev view) ----
  const filteredPlugins = useMemo(() => {
    if (isDevView) return [];

    let list = plugins;

    if (statusFilter === "installed") {
      list = list.filter((p) => p.installed);
    } else if (statusFilter === "available") {
      list = list.filter((p) => !p.installed);
    }

    if (selectedCategory !== "all") {
      list = list.filter((p) => p.category?.toLowerCase() === selectedCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.author.toLowerCase().includes(q)
      );
    }

    return [...list].sort((a, b) => {
      if (a.installed !== b.installed) return a.installed ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [plugins, statusFilter, selectedCategory, searchQuery, isDevView]);

  // Build status filter list (add dev if enabled)
  const statusFilters = useMemo(() => {
    if (!devModeEnabled) return BASE_STATUS_FILTERS;
    return [...BASE_STATUS_FILTERS, { key: "dev" as StatusFilter, i18n: "filterDev" }];
  }, [devModeEnabled]);

  return (
    <div className="space-y-4">
      {/* Updates banner (hide in dev view) */}
      {!isDevView && updatableCount > 0 && !loading && (
        <div className="flex items-center gap-3 p-3 bg-warning/8 border border-warning/15 rounded-xl">
          <div className="w-8 h-8 rounded-lg bg-warning/15 flex items-center justify-center shrink-0">
            <ArrowUpCircle size={16} className="text-warning" />
          </div>
          <p className="flex-1 text-xs text-text">
            <span className="font-medium">{updatableCount}</span>{" "}
            <span className="text-text-muted">
              {updatableCount === 1
                ? t("settings.plugins.updateAvailableSingular")
                : t("settings.plugins.updateAvailablePlural")}
            </span>
          </p>
        </div>
      )}

      {/* Search + Filters (hide search in dev view) */}
      <div className="space-y-3 p-3 bg-surface-0/10 rounded-xl">
        {!isDevView && (
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
        )}

        {/* Filters: status segmented control + category chips */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Status segmented control */}
          <div className="flex gap-1 p-1 bg-crust rounded-xl">
            {statusFilters.map((sf) => (
              <button
                key={sf.key}
                onClick={() => setStatusFilter(sf.key)}
                className={`
                  px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors duration-200
                  ${getFilterButtonClass(sf.key, statusFilter)}
                `}
              >
                {t(`settings.plugins.${sf.i18n}`)}
              </button>
            ))}
          </div>
          {/* Category chips (hide in dev view) */}
          {!isDevView && (
            <div className="flex gap-1.5 flex-wrap">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => onCategoryChange(cat.key === selectedCategory ? "all" : cat.key)}
                  className={`
                    px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors
                    ${selectedCategory === cat.key
                      ? "bg-surface-0/50 text-text"
                      : "text-text-muted/60 hover:text-text hover:bg-surface-0/40"
                    }
                  `}
                >
                  {t(`settings.plugins.${cat.i18n}`)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Content: dev view OR plugin list */}
      {isDevView ? (
        <DeveloperPluginsTab
          plugins={devPlugins}
          loading={loading}
          actionLoading={actionLoading}
          onToggle={onToggle}
          onRefresh={onRefresh}
        />
      ) : (
        <>
          {/* Header: count + refresh */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted">
              {t("settings.plugins.pluginCount", { count: filteredPlugins.length })}
            </span>
            <button
              onClick={onRefresh}
              disabled={loading || registryLoading || actionLoading === "refresh"}
              className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-0/30 transition-colors disabled:opacity-50"
              title={t("common.refresh")}
            >
              <RefreshCw size={14} className={actionLoading === "refresh" || registryLoading ? "animate-spin" : ""} />
            </button>
          </div>

          {/* Plugin list */}
          <PluginList
            plugins={filteredPlugins}
            loading={loading && !registryLoading}
            registryLoading={registryLoading}
            registryError={registryError}
            actionLoading={actionLoading}
            updates={updates}
            onToggle={onToggle}
            onUninstall={onUninstall}
            onUpdate={onUpdate}
            onInstall={onInstall}
            onRefresh={onRefresh}
            pluginsWithSettings={pluginsWithSettings}
            onOpenPluginSettings={onOpenPluginSettings}
          />
        </>
      )}
    </div>
  );
}

function PluginList({
  plugins,
  loading,
  registryLoading,
  registryError,
  actionLoading,
  updates,
  onToggle,
  onUninstall,
  onUpdate,
  onInstall,
  onRefresh,
  pluginsWithSettings,
  onOpenPluginSettings,
}: Readonly<{
  plugins: UnifiedPlugin[];
  loading: boolean;
  registryLoading: boolean;
  registryError: string | null;
  actionLoading: string | null;
  updates: PluginUpdate[];
  onToggle: (plugin: PluginManifest) => void;
  onUninstall: (plugin: PluginManifest) => void;
  onUpdate: (update: PluginUpdate) => void;
  onInstall: (plugin: UnifiedPlugin) => void;
  onRefresh: () => void;
  pluginsWithSettings: Set<string>;
  onOpenPluginSettings: (pluginId: string) => void;
}>) {
  const { t } = useTranslation();

  if (registryError) {
    return (
      <div className="flex flex-col items-center py-12 text-text-muted">
        <div className="w-16 h-16 rounded-2xl bg-error/10 flex items-center justify-center mb-4">
          <AlertCircle size={28} className="text-error/60" />
        </div>
        <p className="text-sm font-medium text-error/80">{t("settings.plugins.registryError")}</p>
        <p className="text-[10px] text-text-muted/60 mt-1.5 max-w-[280px] text-center break-all">{registryError}</p>
        <button
          onClick={onRefresh}
          className="mt-4 px-4 py-1.5 text-xs font-medium text-accent bg-accent/10 hover:bg-accent/20 rounded-lg transition-colors"
        >
          {t("common.refresh")}
        </button>
      </div>
    );
  }

  if (loading || registryLoading) {
    return <PluginListSkeleton />;
  }

  if (plugins.length === 0) {
    return (
      <div className="flex flex-col items-center py-12 text-text-muted">
        <div className="w-16 h-16 rounded-2xl bg-surface-0/20 flex items-center justify-center mb-4">
          <Puzzle size={28} className="opacity-40" />
        </div>
        <p className="text-sm font-medium text-text/60">{t("settings.plugins.noResults")}</p>
        <p className="text-[11px] text-text-muted/60 mt-1">{t("settings.plugins.noResultsHint")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {plugins.map((plugin) => (
        <PluginListItem
          key={plugin.id}
          plugin={plugin}
          updates={updates}
          actionLoading={actionLoading}
          onToggle={onToggle}
          onUninstall={onUninstall}
          onUpdate={onUpdate}
          onInstall={onInstall}
          pluginsWithSettings={pluginsWithSettings}
          onOpenPluginSettings={onOpenPluginSettings}
        />
      ))}
    </div>
  );
}

interface PluginCallbacks {
  onToggle: (p: PluginManifest) => void;
  onUninstall: (p: PluginManifest) => void;
  onUpdate: (u: PluginUpdate) => void;
  onInstall: (p: UnifiedPlugin) => void;
  pluginsWithSettings: Set<string>;
  onOpenPluginSettings: (id: string) => void;
}

function handlersForInstalled(plugin: UnifiedPlugin, update: PluginUpdate | undefined, cb: PluginCallbacks) {
  const manifest = plugin.manifest;
  return {
    onToggle: manifest ? () => cb.onToggle(manifest) : undefined,
    onUninstall: manifest ? () => cb.onUninstall(manifest) : undefined,
    onUpdate: update ? () => cb.onUpdate(update) : undefined,
    onOpenSettings: cb.pluginsWithSettings.has(plugin.id) ? () => cb.onOpenPluginSettings(plugin.id) : undefined,
  };
}

function handlersForAvailable(plugin: UnifiedPlugin, update: PluginUpdate | undefined, cb: PluginCallbacks) {
  return {
    onInstall: () => cb.onInstall(plugin),
    onUpdate: update ? () => cb.onUpdate(update) : undefined,
  };
}

function PluginListItem({
  plugin,
  updates,
  actionLoading,
  ...callbacks
}: Readonly<{
  plugin: UnifiedPlugin;
  updates: PluginUpdate[];
  actionLoading: string | null;
} & PluginCallbacks>) {
  const update = updates.find((u) => u.id === plugin.id);
  const handlers = plugin.installed
    ? handlersForInstalled(plugin, update, callbacks)
    : handlersForAvailable(plugin, update, callbacks);

  return (
    <UnifiedPluginCard
      plugin={{ ...plugin, update }}
      loading={actionLoading === plugin.id}
      {...handlers}
    />
  );
}
