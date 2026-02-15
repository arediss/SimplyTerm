import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Lock, ShieldCheck, AlertCircle, Trash2, Download, Upload, Check, Loader2, FolderPlus, Pencil, X, Folder } from "lucide-react";
import { save, open } from "@tauri-apps/plugin-dialog";
import { getAutoLockOptions } from "../../utils";
import { SettingGroup, SettingRow, Toggle } from "./SettingsUIComponents";
import type { useVault } from "../../hooks";
import { useVaultFolders } from "../../hooks";
import SelectiveExportModal from "./SelectiveExportModal";
import SelectiveImportModal from "./SelectiveImportModal";

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
  const { folders, createFolder, renameFolder, deleteFolder } = useVaultFolders();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Export/Import full vault state
  const [exportStatus, setExportStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [importStatus, setImportStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [backupError, setBackupError] = useState<string | null>(null);

  // Selective export/import modals
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  // Folder inline editing state
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renamingFolderName, setRenamingFolderName] = useState("");

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

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    await createFolder(newFolderName.trim());
    setNewFolderName("");
    setIsCreatingFolder(false);
  };

  const handleRenameFolder = async (id: string) => {
    if (!renamingFolderName.trim()) return;
    await renameFolder(id, renamingFolderName.trim());
    setRenamingFolderId(null);
    setRenamingFolderName("");
  };

  const handleDeleteFolder = async (id: string) => {
    if (confirm(t("settings.security.folderDeleteConfirm"))) {
      await deleteFolder(id);
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

      {/* Folders */}
      {vault.status?.isUnlocked && (
        <SettingGroup title={t("settings.security.foldersTitle")} description={t("settings.security.foldersDesc")}>
          <div className="space-y-2">
            {folders.map(folder => (
              <div key={folder.id} className="flex items-center gap-2 px-3 py-2 bg-surface-0/20 rounded-lg">
                <Folder size={16} className="text-accent shrink-0" />
                {renamingFolderId === folder.id ? (
                  <input
                    type="text"
                    value={renamingFolderName}
                    onChange={(e) => setRenamingFolderName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRenameFolder(folder.id);
                      if (e.key === "Escape") setRenamingFolderId(null);
                    }}
                    onBlur={() => handleRenameFolder(folder.id)}
                    autoFocus
                    className="flex-1 px-2 py-1 bg-surface-0/30 border border-surface-0/50 rounded text-sm text-text focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                ) : (
                  <span className="flex-1 text-sm text-text">{folder.name}</span>
                )}
                <button
                  onClick={() => { setRenamingFolderId(folder.id); setRenamingFolderName(folder.name); }}
                  className="p-1 text-text-muted hover:text-text transition-colors"
                  title={t("settings.security.renameFolder")}
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => handleDeleteFolder(folder.id)}
                  className="p-1 text-text-muted hover:text-error transition-colors"
                  title={t("settings.security.deleteFolder")}
                >
                  <X size={14} />
                </button>
              </div>
            ))}

            {isCreatingFolder ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateFolder();
                    if (e.key === "Escape") setIsCreatingFolder(false);
                  }}
                  placeholder={t("settings.security.folderNamePlaceholder")}
                  autoFocus
                  className="flex-1 px-3 py-2 bg-surface-0/30 border border-surface-0/50 rounded-lg text-sm text-text placeholder-text-muted/50 focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <button
                  onClick={handleCreateFolder}
                  disabled={!newFolderName.trim()}
                  className="px-3 py-2 bg-accent text-white text-xs rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50"
                >
                  <Check size={14} />
                </button>
                <button
                  onClick={() => { setIsCreatingFolder(false); setNewFolderName(""); }}
                  className="px-3 py-2 bg-surface-0/50 text-text-muted text-xs rounded-lg hover:bg-surface-0 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsCreatingFolder(true)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-accent hover:bg-surface-0/20 rounded-lg transition-colors"
              >
                <FolderPlus size={16} />
                {t("settings.security.createFolder")}
              </button>
            )}
          </div>
        </SettingGroup>
      )}

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
        {/* Full vault export/import */}
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

        {/* Selective export/import */}
        {vault.status?.isUnlocked && (
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => setShowExportModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
            >
              <Download size={16} />
              {t("settings.security.selectiveExportTitle")}
            </button>
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
            >
              <Upload size={16} />
              {t("settings.security.selectiveImportTitle")}
            </button>
          </div>
        )}

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

      {/* Selective Export Modal */}
      <SelectiveExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        vault={vault}
      />

      {/* Selective Import Modal */}
      <SelectiveImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        vault={vault}
      />
    </>
  );
}
