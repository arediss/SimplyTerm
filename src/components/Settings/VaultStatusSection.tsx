import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Lock, ShieldCheck, AlertCircle, Trash2, Download, Upload, Check, Loader2 } from "lucide-react";
import { save, open } from "@tauri-apps/plugin-dialog";
import { getAutoLockOptions } from "../../utils";
import { SettingGroup, SettingRow, Toggle } from "./SettingsUIComponents";
import type { useVault } from "../../hooks";

function getMethodLabel(method: string, t: (key: string) => string): string {
  if (method === 'master_password') return t("settings.security.methodPassword");
  if (method === 'pin') return t("settings.security.methodPin");
  if (method === 'security_key') return t("settings.security.methodSecurityKey");
  return method;
}

interface VaultStatusSectionProps {
  vault: ReturnType<typeof useVault>;
}

export default function VaultStatusSection({ vault }: Readonly<VaultStatusSectionProps>) {
  const { t } = useTranslation();
  const autoLockOptions = getAutoLockOptions(t);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Export/Import state
  const [exportStatus, setExportStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [importStatus, setImportStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [backupError, setBackupError] = useState<string | null>(null);

  const handleAutoLockChange = async (value: number) => {
    await vault.updateSettings(value);
  };

  const handleLock = async () => {
    await vault.lock();
  };

  const handleDeleteVault = async () => {
    setDeleteError(null);
    const result = await vault.deleteVault(deletePassword);
    if (result.success) {
      setShowDeleteConfirm(false);
      setDeletePassword('');
    } else {
      setDeleteError(result.error || t("settings.security.incorrectPassword"));
    }
  };

  const handleExport = async () => {
    setBackupError(null);
    const filePath = await save({
      filters: [{ name: "SimplyTerm Vault", extensions: ["stvault"] }],
      defaultPath: "vault-backup.stvault",
    });
    if (!filePath) return;

    setExportStatus("loading");
    const result = await vault.exportToFile(filePath);
    if (result.success) {
      setExportStatus("success");
      setTimeout(() => setExportStatus("idle"), 3000);
    } else {
      setExportStatus("error");
      setBackupError(result.error || t("settings.security.exportError"));
    }
  };

  const handleImport = async () => {
    setBackupError(null);
    const filePath = await open({
      filters: [{ name: "SimplyTerm Vault", extensions: ["stvault"] }],
      multiple: false,
    });
    if (!filePath) return;

    setImportStatus("loading");
    const result = await vault.importFromFile(filePath);
    if (result.success) {
      setImportStatus("success");
      setTimeout(() => setImportStatus("idle"), 3000);
    } else {
      setImportStatus("error");
      setBackupError(result.error || t("settings.security.importError"));
    }
  };

  return (
    <>
      {/* Vault Status */}
      <SettingGroup title={t("settings.security.vaultStatusTitle")} description={t("settings.security.vaultStatusDesc")}>
        <SettingRow
          icon={<Lock size={20} />}
          iconClassName={`w-10 h-10 rounded-lg flex items-center justify-center ${
            vault.status?.isUnlocked ? 'bg-success/20 text-success' : 'bg-error/20 text-error'
          }`}
          title={vault.status?.isUnlocked ? t("settings.security.vaultUnlocked") : t("settings.security.vaultLocked")}
          description={`${t("settings.security.methods")}: ${vault.status?.unlockMethods.map(m =>
            getMethodLabel(m, t)
          ).join(', ')}`}
        >
          {vault.status?.isUnlocked && (
            <button
              onClick={handleLock}
              className="px-3 py-1.5 bg-surface-0/50 text-text-muted text-xs rounded-lg hover:bg-surface-0 transition-colors"
            >
              {t("settings.security.lock")}
            </button>
          )}
        </SettingRow>
      </SettingGroup>

      {/* Auto-lock */}
      <SettingGroup title={t("settings.security.autoLockTitle")} description={t("settings.security.autoLockDesc")}>
        <select
          value={vault.status?.autoLockTimeout ?? 300}
          onChange={(e) => handleAutoLockChange(Number(e.target.value))}
          disabled={!vault.status?.isUnlocked}
          className="w-full px-4 py-3 bg-surface-0/30 border border-surface-0/50 rounded-xl text-text focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent disabled:opacity-50"
        >
          {autoLockOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </SettingGroup>

      {/* Maximum Security Mode */}
      <SettingGroup title={t("settings.security.maxSecurityTitle")} description={t("settings.security.maxSecurityDesc")}>
        <SettingRow
          icon={<ShieldCheck size={20} />}
          iconClassName={`w-10 h-10 rounded-lg flex items-center justify-center ${
            vault.status?.requireUnlockOnConnect ? 'bg-warning/20 text-warning' : 'bg-surface-0/50 text-text-muted'
          }`}
          title={vault.status?.requireUnlockOnConnect ? t("common.enabled") : t("common.disabled")}
          description={vault.status?.requireUnlockOnConnect
            ? t("settings.security.maxSecurityEnabled")
            : t("settings.security.maxSecurityDisabled")}
        >
          <Toggle
            checked={vault.status?.requireUnlockOnConnect || false}
            onChange={async (checked) => {
              await vault.setRequireUnlockOnConnect(checked);
            }}
          />
        </SettingRow>
        {vault.status?.requireUnlockOnConnect && (
          <p className="text-xs text-warning mt-2 flex items-center gap-2">
            <AlertCircle size={14} />
            {t("settings.security.maxSecurityWarning")}
          </p>
        )}
      </SettingGroup>

      {/* Backup / Restore */}
      <SettingGroup title={t("settings.security.backupTitle")} description={t("settings.security.backupDesc")}>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            disabled={exportStatus === "loading"}
            className="flex items-center gap-2 px-4 py-2.5 text-sm rounded-lg bg-surface-0/30 text-text hover:bg-surface-0/50 transition-colors disabled:opacity-50"
          >
            {exportStatus === "loading" ? (
              <Loader2 size={16} className="animate-spin" />
            ) : exportStatus === "success" ? (
              <Check size={16} className="text-success" />
            ) : (
              <Download size={16} />
            )}
            {exportStatus === "success" ? t("settings.security.exportSuccess") : t("settings.security.exportVault")}
          </button>
          <button
            onClick={handleImport}
            disabled={importStatus === "loading"}
            className="flex items-center gap-2 px-4 py-2.5 text-sm rounded-lg bg-surface-0/30 text-text hover:bg-surface-0/50 transition-colors disabled:opacity-50"
          >
            {importStatus === "loading" ? (
              <Loader2 size={16} className="animate-spin" />
            ) : importStatus === "success" ? (
              <Check size={16} className="text-success" />
            ) : (
              <Upload size={16} />
            )}
            {importStatus === "success" ? t("settings.security.importSuccess") : t("settings.security.importVault")}
          </button>
        </div>
        {backupError && (
          <p className="text-xs text-error mt-2 flex items-center gap-2">
            <AlertCircle size={14} />
            {backupError}
          </p>
        )}
        <p className="text-[11px] text-text-muted/60 mt-1">
          {t("settings.security.backupHint")}
        </p>
      </SettingGroup>

      {/* Delete Vault */}
      <SettingGroup title={t("settings.security.deleteVaultTitle")} description={t("settings.security.deleteVaultDesc")}>
        {showDeleteConfirm ? (
          <div className="p-4 bg-error/10 rounded-lg border border-error/30 space-y-4">
            <p className="text-sm text-error">
              {t("settings.security.deleteVaultWarning")}
            </p>
            <input
              type="password"
              placeholder={t("settings.security.deleteVaultPasswordPrompt")}
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              className="w-full px-4 py-3 bg-surface-0/30 border border-error/30 rounded-xl text-text placeholder-text-muted/50 focus:outline-none focus:ring-2 focus:ring-error"
            />
            {deleteError && <p className="text-sm text-error">{deleteError}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); setDeleteError(null); }}
                className="flex-1 py-2 bg-surface-0/50 text-text-muted text-sm rounded-lg hover:bg-surface-0 transition-colors"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleDeleteVault}
                disabled={!deletePassword}
                className="flex-1 py-2 bg-error text-white text-sm font-medium rounded-lg hover:bg-error/90 transition-colors disabled:opacity-50"
              >
                {t("settings.security.deletePermanently")}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-4 py-2.5 bg-error/10 text-error text-sm rounded-lg hover:bg-error/20 transition-colors"
          >
            <Trash2 size={16} className="inline mr-2" />
            {t("settings.security.deleteVault")}
          </button>
        )}
      </SettingGroup>
    </>
  );
}
