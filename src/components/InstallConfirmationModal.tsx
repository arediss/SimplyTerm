import { useTranslation } from "react-i18next";
import { Shield, AlertTriangle, ExternalLink } from "lucide-react";
import Modal from "./Modal";
import { getPermissionInfo, sortPermissionsByRisk, type RiskLevel } from "../plugins/permissionInfo";
import type { RegistryPlugin } from "../hooks/useRegistry";

interface InstallConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInstallOnly: () => void;
  onInstallAndActivate: () => void;
  plugin: RegistryPlugin | null;
}

const dotColor: Record<RiskLevel, string> = {
  high: "bg-error",
  medium: "bg-warning",
  low: "bg-success",
};

function InstallConfirmationModal({
  isOpen,
  onClose,
  onInstallOnly,
  onInstallAndActivate,
  plugin,
}: Readonly<InstallConfirmationModalProps>) {
  const { t } = useTranslation();

  if (!plugin) return null;

  const sorted = sortPermissionsByRisk(plugin.permissions);
  const hasHighRisk = sorted.some((p) => getPermissionInfo(p).risk === "high");
  const hasPermissions = sorted.length > 0;
  const sourceUrl = plugin.repository || plugin.homepage;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("settings.plugins.installConfirmTitle")} width="md">
      <div className="space-y-4">
        {/* Header: name, version, author, source link, description */}
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm text-text font-medium">{plugin.name}</p>
            <span className="px-1.5 py-0.5 text-[10px] font-mono bg-accent/15 text-accent rounded">
              v{plugin.version}
            </span>
            {sourceUrl && (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto text-text-muted hover:text-accent transition-colors"
                title={t("settings.plugins.viewSource")}
              >
                <ExternalLink size={14} />
              </a>
            )}
          </div>
          <p className="text-xs text-text-muted mt-0.5">
            {t("settings.plugins.byAuthor", { author: plugin.author })}
          </p>
          <p className="text-xs text-text-muted mt-2">{plugin.description}</p>
        </div>

        {/* Permissions section */}
        <div>
          <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">
            {t("settings.plugins.permissionsRequired")}
          </p>

          {hasHighRisk && (
            <div className="flex items-center gap-2 p-2.5 bg-error/10 rounded-lg mb-2">
              <AlertTriangle size={14} className="text-error flex-shrink-0" />
              <p className="text-xs text-error">{t("settings.plugins.highRiskWarning")}</p>
            </div>
          )}

          {hasPermissions ? (
            <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
              {sorted.map((perm) => {
                const info = getPermissionInfo(perm);
                return (
                  <div key={perm} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-surface-0/20">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor[info.risk]}`} />
                    <span className="text-sm text-text">{info.label}</span>
                    <span className="text-xs text-text-muted truncate">{info.description}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center gap-2 px-2 py-2 text-success">
              <Shield size={14} />
              <span className="text-xs">{t("settings.plugins.noPermissions")}</span>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-col items-center gap-2 pt-2">
          <div className="flex gap-2 w-full">
            <button
              onClick={onInstallOnly}
              className="flex-1 py-2.5 bg-surface-0/80 text-text text-sm font-medium rounded-lg hover:bg-surface-1 transition-colors"
            >
              {t("settings.plugins.installOnly")}
            </button>
            <button
              onClick={onInstallAndActivate}
              className="flex-1 py-2.5 bg-accent text-crust text-sm font-medium rounded-lg hover:bg-accent-hover transition-colors"
            >
              {t("settings.plugins.installAndActivate")}
            </button>
          </div>
          <button
            onClick={onClose}
            className="pt-2 text-xs text-text-muted hover:text-text transition-colors"
          >
            {t("common.cancel")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default InstallConfirmationModal;
