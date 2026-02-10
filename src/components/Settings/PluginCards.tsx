import { useTranslation } from "react-i18next";
import {
  Puzzle,
  RefreshCw,
  Power,
  PowerOff,
  AlertCircle,
  Download,
  Check,
  ArrowUpCircle,
  ExternalLink,
  Trash2,
} from "lucide-react";
import type { PluginManifest } from "../../plugins";
import type { RegistryPlugin, PluginUpdate } from "../../hooks/useRegistry";

export function InstalledPluginCard({
  plugin,
  update,
  loading,
  onToggle,
  onUninstall,
  onUpdate,
}: {
  plugin: PluginManifest;
  update?: PluginUpdate;
  loading: boolean;
  onToggle: () => void;
  onUninstall: () => void;
  onUpdate?: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="group flex gap-3 p-3 bg-surface-0/15 hover:bg-surface-0/25 rounded-xl transition-colors">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
        plugin.status === "error" ? "bg-error/15 text-error" :
        plugin.status === "enabled" ? "bg-accent/15 text-accent" :
        "bg-surface-0/40 text-text-muted"
      }`}>
        <Puzzle size={18} />
      </div>

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
            className="p-1.5 rounded-lg text-text-muted/30 opacity-0 group-hover:opacity-100 hover:text-error hover:bg-error/10 transition-[colors,opacity] disabled:opacity-50"
            title={t("settings.plugins.uninstall")}
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

export function BrowsePluginCard({
  plugin,
  isInstalled,
  loading,
  onInstall,
}: {
  plugin: RegistryPlugin;
  isInstalled: boolean;
  loading: boolean;
  onInstall: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex gap-3 p-3 bg-surface-0/15 hover:bg-surface-0/25 rounded-xl transition-colors">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
        isInstalled ? "bg-success/15 text-success" : "bg-accent/15 text-accent"
      }`}>
        {isInstalled ? <Check size={18} /> : <Puzzle size={18} />}
      </div>

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

export function PluginListSkeleton({ count = 3 }: { count?: number }) {
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
