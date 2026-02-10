import { useTranslation } from "react-i18next";
import { Search, AlertCircle, Globe } from "lucide-react";
import type { RegistryPlugin } from "../../hooks/useRegistry";
import { BrowsePluginCard, PluginListSkeleton } from "./PluginCards";

const CATEGORIES = [
  { key: "all", i18n: "categoryAll" },
  { key: "themes", i18n: "categoryThemes" },
  { key: "productivity", i18n: "categoryProductivity" },
  { key: "security", i18n: "categorySecurity" },
  { key: "devops", i18n: "categoryDevops" },
  { key: "tools", i18n: "categoryTools" },
] as const;

interface BrowsePluginsTabProps {
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
}

export default function BrowsePluginsTab({
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
}: BrowsePluginsTabProps) {
  const { t } = useTranslation();

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
      <BrowsePluginsResults
        error={error}
        loading={loading}
        plugins={plugins}
        installedIds={installedIds}
        actionLoading={actionLoading}
        onRefresh={onRefresh}
        onInstall={onInstall}
        t={t}
      />
    </div>
  );
}

function BrowsePluginsResults({
  error,
  loading,
  plugins,
  installedIds,
  actionLoading,
  onRefresh,
  onInstall,
  t,
}: {
  error: string | null;
  loading: boolean;
  plugins: RegistryPlugin[];
  installedIds: Set<string>;
  actionLoading: string | null;
  onRefresh: () => void;
  onInstall: (plugin: RegistryPlugin) => void;
  t: (key: string) => string;
}) {
  if (error) {
    return (
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
    );
  }

  if (loading) {
    return <PluginListSkeleton />;
  }

  if (plugins.length === 0) {
    return (
      <div className="flex flex-col items-center py-12 text-text-muted">
        <div className="w-16 h-16 rounded-2xl bg-surface-0/20 flex items-center justify-center mb-4">
          <Globe size={28} className="opacity-40" />
        </div>
        <p className="text-sm font-medium text-text/60">{t("settings.plugins.noResults")}</p>
        <p className="text-[11px] text-text-muted/60 mt-1">{t("settings.plugins.noResultsHint")}</p>
      </div>
    );
  }

  return (
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
          />
        );
      })}
    </div>
  );
}
