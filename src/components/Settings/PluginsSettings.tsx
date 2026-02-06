import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import {
  Puzzle,
  RefreshCw,
  Power,
  PowerOff,
  AlertCircle,
} from "lucide-react";
import { usePlugins, type PluginManifest } from "../../plugins";
import PermissionApprovalModal from "../PermissionApprovalModal";
import { SettingGroup } from "./SettingsUIComponents";

export default function PluginsSettings() {
  const { t } = useTranslation();
  const { plugins, loading, refresh, enablePlugin, disablePlugin } = usePlugins();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [pluginsDir, setPluginsDir] = useState<string>("");
  const [pendingPlugin, setPendingPlugin] = useState<PluginManifest | null>(null);

  // Fetch plugins directory on mount
  useEffect(() => {
    invoke<string>("get_plugins_dir").then(setPluginsDir).catch(console.error);
  }, []);

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
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <SettingGroup
        title={t("settings.plugins.installedTitle")}
        description={t("settings.plugins.installedDesc")}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-text-muted">
            {t("settings.plugins.pluginCount", { count: plugins.length })}
          </span>
          <button
            onClick={handleRefresh}
            disabled={loading || actionLoading === "refresh"}
            className="flex items-center gap-1.5 px-2 py-1 text-xs text-text-muted hover:text-text transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={actionLoading === "refresh" ? "animate-spin" : ""} />
            {t("common.refresh")}
          </button>
        </div>

        {loading ? (
          <div className="space-y-2 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-surface-0/20 rounded-lg">
                <div className="w-10 h-10 rounded-lg bg-surface-0/30 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-32 bg-surface-0/25 rounded" />
                  <div className="h-2.5 w-48 bg-surface-0/15 rounded" />
                </div>
                <div className="h-7 w-16 bg-surface-0/20 rounded-lg" />
              </div>
            ))}
          </div>
        ) : plugins.length === 0 ? (
          <div className="text-center py-8 text-text-muted">
            <Puzzle size={32} className="mx-auto mb-3 opacity-50" />
            <p className="text-sm">{t("settings.plugins.noPlugins")}</p>
            <p className="text-xs mt-1">
              {t("settings.plugins.pluginDirHint")} <code className="px-1 py-0.5 bg-surface-0/50 rounded text-[10px]">{pluginsDir || "plugins/"}</code>
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {plugins.map((plugin) => (
              <div
                key={plugin.id}
                className="flex items-center gap-3 p-3 bg-surface-0/20 rounded-lg"
              >
                <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center text-accent">
                  <Puzzle size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text truncate">
                      {plugin.name}
                    </span>
                    <span className="text-[10px] text-text-muted bg-surface-0/50 px-1.5 py-0.5 rounded">
                      v{plugin.version}
                    </span>
                    {plugin.status === "error" && (
                      <AlertCircle size={14} className="text-error" />
                    )}
                  </div>
                  {plugin.description && (
                    <p className="text-xs text-text-muted truncate">
                      {plugin.description}
                    </p>
                  )}
                  {plugin.author && (
                    <p className="text-[10px] text-text-muted/70">
                      {t("settings.plugins.byAuthor", { author: plugin.author })}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleTogglePlugin(plugin)}
                  disabled={actionLoading === plugin.id}
                  className={`
                    flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                    ${plugin.status === "enabled"
                      ? "bg-success/20 text-success hover:bg-success/30"
                      : "bg-surface-0/50 text-text-muted hover:bg-surface-0"
                    }
                    disabled:opacity-50
                  `}
                >
                  {actionLoading === plugin.id ? (
                    <RefreshCw size={12} className="animate-spin" />
                  ) : plugin.status === "enabled" ? (
                    <>
                      <Power size={12} />
                      {t("common.active")}
                    </>
                  ) : (
                    <>
                      <PowerOff size={12} />
                      {t("common.inactive")}
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </SettingGroup>

      <SettingGroup
        title={t("settings.plugins.installationTitle")}
        description={t("settings.plugins.installationDesc")}
      >
        <div className="p-3 bg-surface-0/20 rounded-lg text-xs text-text-muted space-y-2">
          <p>
            <strong className="text-text">1.</strong> {t("settings.plugins.installStep1")}{" "}
            <code className="px-1 py-0.5 bg-surface-0/50 rounded">{pluginsDir || "plugins/"}</code>
          </p>
          <p>
            <strong className="text-text">2.</strong> {t("settings.plugins.installStep2")}
          </p>
          <ul className="ml-4 space-y-1">
            <li>• <code className="px-1 py-0.5 bg-surface-0/50 rounded">manifest.json</code> - {t("settings.plugins.manifestFile")}</li>
            <li>• <code className="px-1 py-0.5 bg-surface-0/50 rounded">index.js</code> - {t("settings.plugins.indexFile")}</li>
          </ul>
          <p>
            <strong className="text-text">3.</strong> {t("settings.plugins.installStep3")}
          </p>
        </div>
      </SettingGroup>

      {/* Permission approval modal */}
      <PermissionApprovalModal
        isOpen={pendingPlugin !== null}
        onClose={handleDenyPermissions}
        onApprove={handleApprovePermissions}
        pluginName={pendingPlugin?.name ?? ''}
        permissions={pendingPlugin?.permissions ?? []}
      />
    </div>
  );
}
