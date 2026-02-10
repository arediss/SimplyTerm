import { useTranslation } from "react-i18next";
import { Puzzle, RefreshCw, ArrowUpCircle } from "lucide-react";
import type { PluginManifest } from "../../plugins";
import type { PluginUpdate } from "../../hooks/useRegistry";
import { InstalledPluginCard, PluginListSkeleton } from "./PluginCards";

interface InstalledPluginsTabProps {
  plugins: PluginManifest[];
  updates: PluginUpdate[];
  loading: boolean;
  actionLoading: string | null;
  onToggle: (plugin: PluginManifest) => void;
  onUninstall: (plugin: PluginManifest) => void;
  onUpdate: (update: PluginUpdate) => void;
  onRefresh: () => void;
}

export default function InstalledPluginsTab({
  plugins,
  updates,
  loading,
  actionLoading,
  onToggle,
  onUninstall,
  onUpdate,
  onRefresh,
}: InstalledPluginsTabProps) {
  const { t } = useTranslation();
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
      <InstalledPluginsList
        loading={loading}
        plugins={plugins}
        updates={updates}
        actionLoading={actionLoading}
        onToggle={onToggle}
        onUninstall={onUninstall}
        onUpdate={onUpdate}
        t={t}
      />
    </div>
  );
}

function InstalledPluginsList({
  loading,
  plugins,
  updates,
  actionLoading,
  onToggle,
  onUninstall,
  onUpdate,
  t,
}: {
  loading: boolean;
  plugins: PluginManifest[];
  updates: PluginUpdate[];
  actionLoading: string | null;
  onToggle: (plugin: PluginManifest) => void;
  onUninstall: (plugin: PluginManifest) => void;
  onUpdate: (update: PluginUpdate) => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  if (loading) {
    return <PluginListSkeleton />;
  }

  if (plugins.length === 0) {
    return (
      <div className="flex flex-col items-center py-12 text-text-muted">
        <div className="w-16 h-16 rounded-2xl bg-surface-0/20 flex items-center justify-center mb-4">
          <Puzzle size={28} className="opacity-40" />
        </div>
        <p className="text-sm font-medium text-text/60">{t("settings.plugins.noPlugins")}</p>
        <p className="text-[11px] text-text-muted/60 mt-1 max-w-[240px] text-center">
          {t("settings.plugins.pluginDirHint")}
        </p>
      </div>
    );
  }

  return (
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
          />
        );
      })}
    </div>
  );
}
