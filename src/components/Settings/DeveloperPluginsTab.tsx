import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { RefreshCw, Code2, ScanSearch } from "lucide-react";
import { useAppSettings } from "../../hooks";
import type { PluginManifest } from "../../plugins";
import { InstalledPluginCard, PluginListSkeleton } from "./PluginCards";

interface DeveloperPluginsTabProps {
  plugins: PluginManifest[];
  loading: boolean;
  actionLoading: string | null;
  onToggle: (plugin: PluginManifest) => void;
  onRefresh: () => void;
}

export default function DeveloperPluginsTab({
  plugins,
  loading,
  actionLoading,
  onToggle,
  onRefresh,
}: DeveloperPluginsTabProps) {
  const { t } = useTranslation();
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
      void updateSettings(updated);
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
            />
          ))}
        </div>
      )}
    </div>
  );
}
