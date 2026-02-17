import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { getVersion } from "@tauri-apps/api/app";
import { getErrorMessage } from "../../utils";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import {
  Terminal,
  BookOpen,
  Heart,
  Copy,
  Check,
  ArrowUpCircle,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Download,
  Loader2,
  Code2,
} from "lucide-react";

/** Local GitHub icon to replace deprecated lucide Github brand icon */
function GitHubIcon({ size = 24 }: Readonly<{ size?: number }>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}
import { SettingGroup, SettingRow, Toggle, LinkButton } from "./SettingsUIComponents";
import { useAppSettings } from "../../hooks";

type UpdateStatus =
  | "idle"
  | "checking"
  | "up-to-date"
  | "available"
  | "downloading"
  | "installing"
  | "ready"
  | "error";

export default function AboutSettings() {
  const { t } = useTranslation();
  const { settings, updateSettings } = useAppSettings();
  const [appVersion, setAppVersion] = useState<string>("...");
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  const devModeEnabled = settings.developer?.enabled ?? false;

  // Update state
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>("idle");
  const [updateInfo, setUpdateInfo] = useState<Update | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadTotal, setDownloadTotal] = useState(0);
  const [updateError, setUpdateError] = useState<string>("");

  useEffect(() => {
    getVersion().then(setAppVersion).catch(() => setAppVersion("?"));
  }, []);

  // Cleanup copy feedback timeout on unmount
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  const handleCopyVersion = () => {
    navigator.clipboard.writeText(`SimplyTerm v${appVersion}`).catch(() => {});
    setCopied(true);
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => setCopied(false), 1500);
  };

  const handleCheckUpdate = useCallback(async () => {
    setUpdateStatus("checking");
    setUpdateError("");
    setDownloadProgress(0);
    setDownloadTotal(0);

    try {
      const update = await check();
      if (update) {
        setUpdateInfo(update);
        setUpdateStatus("available");
      } else {
        setUpdateInfo(null);
        setUpdateStatus("up-to-date");
      }
    } catch (err) {
      setUpdateError(getErrorMessage(err));
      setUpdateStatus("error");
    }
  }, []);

  const handleDownloadAndInstall = useCallback(async () => {
    if (!updateInfo) return;

    setUpdateStatus("downloading");
    setDownloadProgress(0);

    try {
      await updateInfo.downloadAndInstall((event) => {
        if (event.event === "Started") {
          setDownloadTotal(event.data.contentLength ?? 0);
        } else if (event.event === "Progress") {
          setDownloadProgress((prev) => prev + (event.data.chunkLength ?? 0));
        } else if (event.event === "Finished") {
          setUpdateStatus("ready");
        }
      });

      setUpdateStatus("ready");
    } catch (err) {
      setUpdateError(getErrorMessage(err));
      setUpdateStatus("error");
    }
  }, [updateInfo]);

  const handleRelaunch = useCallback(async () => {
    await relaunch();
  }, []);

  const progressPercent =
    downloadTotal > 0 ? Math.round((downloadProgress / downloadTotal) * 100) : 0;

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  return (
    <div className="space-y-6">
      {/* App header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-accent/10 via-surface-0/20 to-surface-0/10 p-6">
        <div className="absolute -top-8 -right-8 w-32 h-32 bg-accent/5 rounded-full blur-2xl" />
        <div className="relative flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-crust/80 border border-surface-0/30 flex items-center justify-center shadow-lg">
            <Terminal size={28} className="text-accent" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-text tracking-tight">SimplyTerm</h3>
            <p className="text-xs text-text-muted mt-0.5">
              {t("settings.about.tagline")}
            </p>
            <button
              onClick={handleCopyVersion}
              className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 bg-crust/60 rounded-md text-[11px] text-text-muted hover:text-text transition-colors"
            >
              {copied ? <Check size={10} className="text-success" /> : <Copy size={10} />}
              v{appVersion}
            </button>
          </div>
        </div>
      </div>

      {/* Updates */}
      <SettingGroup
        title={t("settings.about.updateTitle")}
        description={t("settings.about.updateDesc")}
      >
        <div className="rounded-xl bg-surface-0/20 border border-surface-0/20 overflow-hidden">
          {/* Idle state */}
          {updateStatus === "idle" && (
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <ArrowUpCircle size={20} className="text-text-muted" />
                <div>
                  <div className="text-sm text-text">v{appVersion}</div>
                  <div className="text-xs text-text-muted">
                    {t("settings.about.updateDesc")}
                  </div>
                </div>
              </div>
              <button
                onClick={handleCheckUpdate}
                className="px-3 py-1.5 text-xs font-medium bg-accent/15 text-accent hover:bg-accent/25 rounded-lg transition-colors"
              >
                {t("settings.about.checkNow")}
              </button>
            </div>
          )}

          {/* Checking */}
          {updateStatus === "checking" && (
            <div className="flex items-center gap-3 p-4">
              <Loader2 size={20} className="text-accent animate-spin" />
              <div className="text-sm text-text-muted">
                {t("settings.about.checking")}
              </div>
            </div>
          )}

          {/* Up to date */}
          {updateStatus === "up-to-date" && (
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 size={20} className="text-green" />
                <div>
                  <div className="text-sm text-text">
                    {t("settings.about.upToDate")}
                  </div>
                  <div className="text-xs text-text-muted">
                    v{appVersion} ({t("settings.about.latestVersion")})
                  </div>
                </div>
              </div>
              <button
                onClick={handleCheckUpdate}
                className="p-1.5 text-text-muted hover:text-text rounded-lg hover:bg-surface-0/30 transition-colors"
                title={t("settings.about.checkNow")}
              >
                <RefreshCw size={14} />
              </button>
            </div>
          )}

          {/* Update available */}
          {updateStatus === "available" && updateInfo && (
            <div className="p-4 space-y-3">
              <div className="flex items-start gap-3">
                <ArrowUpCircle size={20} className="text-accent mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text">
                      {t("settings.about.updateAvailable")}
                    </span>
                    <span className="px-1.5 py-0.5 text-[10px] font-medium bg-accent/15 text-accent rounded-md">
                      v{updateInfo.version}
                    </span>
                  </div>
                  {updateInfo.date && (
                    <div className="text-xs text-text-muted mt-0.5">
                      {new Date(updateInfo.date).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>

              {/* Release notes */}
              {updateInfo.body && (
                <div className="ml-8">
                  <div className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-1">
                    {t("settings.about.releaseNotes")}
                  </div>
                  <div className="text-xs text-text-muted bg-crust/50 rounded-lg p-3 max-h-32 overflow-y-auto leading-relaxed whitespace-pre-wrap">
                    {updateInfo.body}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center gap-2 ml-8">
                <button
                  onClick={handleDownloadAndInstall}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-accent text-crust hover:bg-accent/90 rounded-lg transition-colors"
                >
                  <Download size={12} />
                  {t("settings.about.updateAndRestart")}
                </button>
                <button
                  onClick={() => setUpdateStatus("idle")}
                  className="px-3 py-1.5 text-xs text-text-muted hover:text-text hover:bg-surface-0/30 rounded-lg transition-colors"
                >
                  {t("settings.about.later")}
                </button>
              </div>
            </div>
          )}

          {/* Downloading */}
          {updateStatus === "downloading" && (
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Loader2 size={20} className="text-accent animate-spin" />
                <div className="flex-1">
                  <div className="text-sm text-text">
                    {t("settings.about.downloading")}
                  </div>
                  {downloadTotal > 0 && (
                    <div className="text-xs text-text-muted">
                      {formatBytes(downloadProgress)} / {formatBytes(downloadTotal)}
                    </div>
                  )}
                </div>
                {downloadTotal > 0 && (
                  <span className="text-xs font-medium text-accent">{progressPercent}%</span>
                )}
              </div>
              {/* Progress bar */}
              <div className="h-1.5 bg-crust/60 rounded-full overflow-hidden">
                <div
                  className="h-full w-full bg-accent rounded-full transition-transform duration-300 ease-out origin-left"
                  style={{ transform: `scaleX(${downloadTotal > 0 ? progressPercent / 100 : 1})` }}
                />
              </div>
            </div>
          )}

          {/* Installing */}
          {updateStatus === "installing" && (
            <div className="flex items-center gap-3 p-4">
              <Loader2 size={20} className="text-accent animate-spin" />
              <div className="text-sm text-text-muted">
                {t("settings.about.installing")}
              </div>
            </div>
          )}

          {/* Ready to restart */}
          {updateStatus === "ready" && (
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 size={20} className="text-green" />
                  <div className="text-sm text-text">
                    {t("settings.about.readyToInstall")}
                  </div>
                </div>
                <button
                  onClick={handleRelaunch}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-accent text-crust hover:bg-accent/90 rounded-lg transition-colors"
                >
                  <RefreshCw size={12} />
                  {t("settings.about.updateAndRestart")}
                </button>
              </div>
            </div>
          )}

          {/* Error */}
          {updateStatus === "error" && (
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertCircle size={20} className="text-red" />
                  <div>
                    <div className="text-sm text-text">
                      {t("settings.about.updateError")}
                    </div>
                    {updateError && (
                      <div className="text-xs text-text-muted mt-0.5 max-w-xs truncate">
                        {updateError}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleCheckUpdate}
                  className="px-3 py-1.5 text-xs font-medium bg-accent/15 text-accent hover:bg-accent/25 rounded-lg transition-colors"
                >
                  {t("settings.about.retry")}
                </button>
              </div>
            </div>
          )}
        </div>
      </SettingGroup>

      {/* Tech stack */}
      <SettingGroup title={t("settings.about.techTitle")} description={t("settings.about.techDesc")}>
        <div className="flex flex-wrap gap-2">
          {[
            { name: "Tauri v2", color: "text-yellow" },
            { name: "React", color: "text-blue" },
            { name: "TypeScript", color: "text-blue" },
            { name: "Rust", color: "text-peach" },
            { name: "xterm.js", color: "text-green" },
          ].map((tech) => (
            <span
              key={tech.name}
              className="px-3 py-1.5 bg-surface-0/30 border border-surface-0/20 rounded-lg text-xs text-text-muted"
            >
              <span className={tech.color}>&#x2022;</span> {tech.name}
            </span>
          ))}
        </div>
      </SettingGroup>

      {/* Links */}
      <SettingGroup title={t("settings.about.linksTitle")} description={t("settings.about.linksDesc")}>
        <div className="space-y-2">
          <LinkButton
            icon={<GitHubIcon size={18} />}
            title={t("settings.about.sourceCode")}
            description={t("settings.about.viewOnGithub")}
            href="https://github.com/arediss/SimplyTerm"
          />
          <LinkButton
            icon={<BookOpen size={18} />}
            title={t("settings.about.documentation")}
            description={t("settings.about.userGuide")}
            href="https://github.com/arediss/SimplyTerm/wiki"
          />
        </div>
      </SettingGroup>

      {/* Developer Mode */}
      <SettingGroup title={t("settings.about.devModeTitle")} description={t("settings.about.devModeDesc")}>
        <SettingRow
          icon={<Code2 size={18} />}
          iconClassName="text-orange-400"
          title={t("settings.about.devModeToggle")}
          description={t("settings.about.devModeToggleDesc")}
        >
          <Toggle
            checked={devModeEnabled}
            onChange={(checked) =>
              updateSettings({
                ...settings,
                developer: { ...settings.developer, enabled: checked },
              })
            }
          />
        </SettingRow>
      </SettingGroup>

      {/* Footer */}
      <div className="pt-4 border-t border-surface-0/30">
        <p className="text-xs text-text-muted text-center flex items-center justify-center gap-1.5">
          {t("settings.about.footer")} <Heart size={10} className="text-red inline" />
        </p>
      </div>
    </div>
  );
}
