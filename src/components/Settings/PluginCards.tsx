import { useTranslation } from "react-i18next";
import {
  Puzzle,
  RefreshCw,
  Power,
  PowerOff,
  AlertCircle,
  Download,
  ArrowUpCircle,
  ExternalLink,
  Trash2,
  Settings,
} from "lucide-react";
import type { UnifiedPlugin } from "./PluginsSettings";

function getIconClassName(plugin: UnifiedPlugin): string {
  if (!plugin.installed) return "bg-accent/15 text-accent";
  if (plugin.status === "error") return "bg-error/15 text-error";
  if (plugin.status === "enabled") return "bg-accent/15 text-accent";
  return "bg-surface-0/40 text-text-muted";
}

function StatusBadge({ plugin }: Readonly<{ plugin: UnifiedPlugin }>) {
  const { t } = useTranslation();

  if (plugin.installed) {
    const isEnabled = plugin.status === "enabled";
    return (
      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 ${
        isEnabled ? "text-success bg-success/15" : "text-text-muted/70 bg-surface-0/40"
      }`}>
        {isEnabled ? t("common.active") : t("settings.plugins.installed")}
      </span>
    );
  }

  if (!plugin.category) return null;

  return (
    <span className="text-[10px] text-accent/70 bg-accent/10 px-1.5 py-0.5 rounded shrink-0">
      {plugin.category}
    </span>
  );
}

function PluginMeta({ plugin }: Readonly<{ plugin: UnifiedPlugin }>) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-2.5 mt-1">
      {plugin.author && (
        <span className="text-[10px] text-text-muted/50">
          {t("settings.plugins.byAuthor", { author: plugin.author })}
        </span>
      )}
      {plugin.downloads != null && plugin.downloads > 0 && (
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
  );
}

function InstalledActions({
  plugin,
  loading,
  onToggle,
  onOpenSettings,
  onUninstall,
}: Readonly<{
  plugin: UnifiedPlugin;
  loading: boolean;
  onToggle?: () => void;
  onOpenSettings?: () => void;
  onUninstall?: () => void;
}>) {
  const { t } = useTranslation();
  const isEnabled = plugin.status === "enabled";

  return (
    <>
      {onToggle && (
        <button
          onClick={onToggle}
          disabled={loading}
          className={`
            flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors
            ${isEnabled
              ? "bg-success/15 text-success hover:bg-success/25"
              : "bg-surface-0/40 text-text-muted hover:bg-surface-0/60"
            }
            disabled:opacity-50
          `}
        >
          {isEnabled ? (
            <><Power size={11} />{t("common.active")}</>
          ) : (
            <><PowerOff size={11} />{t("common.inactive")}</>
          )}
        </button>
      )}
      {onOpenSettings && (
        <button
          onClick={onOpenSettings}
          className="p-1.5 rounded-lg text-text-muted/30 opacity-0 group-hover:opacity-100 hover:text-accent hover:bg-accent/10 transition-[colors,opacity]"
          title={t("settings.plugins.openSettings")}
        >
          <Settings size={13} />
        </button>
      )}
      {onUninstall && (
        <button
          onClick={onUninstall}
          disabled={loading}
          className="p-1.5 rounded-lg text-text-muted/30 opacity-0 group-hover:opacity-100 hover:text-error hover:bg-error/10 transition-[colors,opacity] disabled:opacity-50"
          title={t("settings.plugins.uninstall")}
        >
          <Trash2 size={13} />
        </button>
      )}
    </>
  );
}

function InstallAction({ loading, onInstall }: Readonly<{ loading: boolean; onInstall: () => void }>) {
  const { t } = useTranslation();

  return (
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
  );
}

export function UnifiedPluginCard({
  plugin,
  loading,
  onToggle,
  onUninstall,
  onUpdate,
  onInstall,
  onOpenSettings,
}: Readonly<{
  plugin: UnifiedPlugin;
  loading: boolean;
  onToggle?: () => void;
  onUninstall?: () => void;
  onUpdate?: () => void;
  onInstall?: () => void;
  onOpenSettings?: () => void;
}>) {
  const { t } = useTranslation();

  return (
    <div className="group flex gap-3 p-3 bg-surface-0/15 hover:bg-surface-0/25 rounded-xl transition-colors">
      {/* Icon */}
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${getIconClassName(plugin)}`}>
        <Puzzle size={18} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text truncate">{plugin.name}</span>
          <span className="text-[10px] text-text-muted/60 bg-surface-0/40 px-1.5 py-0.5 rounded shrink-0">
            v{plugin.version}
          </span>
          <StatusBadge plugin={plugin} />
          {plugin.status === "error" && <AlertCircle size={12} className="text-error shrink-0" />}
        </div>
        {plugin.description && (
          <p className="text-[11px] text-text-muted/70 truncate mt-0.5">{plugin.description}</p>
        )}

        <PluginMeta plugin={plugin} />

        {/* Update banner */}
        {plugin.update && onUpdate && (
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
                : t("settings.plugins.updateTo", { version: plugin.update.latestVersion })}
            </span>
          </button>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-start gap-1 shrink-0">
        {plugin.installed ? (
          <InstalledActions
            plugin={plugin}
            loading={loading}
            onToggle={onToggle}
            onOpenSettings={onOpenSettings}
            onUninstall={onUninstall}
          />
        ) : (
          onInstall && <InstallAction loading={loading} onInstall={onInstall} />
        )}
      </div>
    </div>
  );
}

export function PluginListSkeleton({ count = 3 }: Readonly<{ count?: number }>) {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: count }, (_, i) => i).map(n => (
        <div key={n} className="flex gap-3 p-3 bg-surface-0/15 rounded-xl">
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
