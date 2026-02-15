import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import {
  Lock,
  LockOpen,
  Download,
  Upload,
  Trash2,
  ShieldCheck,
  ChevronDown,
  AlertCircle,
  Check,
  Loader2,
} from "lucide-react";
import type { useVault } from "../../hooks";
import { useSessions, useVaultFolders, useSshKeys } from "../../hooks";
import { getAutoLockOptions } from "../../utils";
import { SettingGroup, SettingRow, Toggle } from "./SettingsUIComponents";
import { PasswordInput } from "../UI/PasswordInput";
import Modal from "../Modal";
import VaultTreeView, { StyledCheck } from "./VaultTreeView";
import type { TreeSelectionState, ItemType } from "./VaultTreeView";
import SelectiveImportModal from "./SelectiveImportModal";

interface VaultManagerProps {
  vault: ReturnType<typeof useVault>;
}

function getMethodLabel(method: string, t: (key: string) => string): string {
  if (method === "master_password") return t("settings.security.methodPassword");
  if (method === "pin") return t("settings.security.methodPin");
  if (method === "security_key") return t("settings.security.methodSecurityKey");
  return method;
}

function emptySelection(): TreeSelectionState {
  return { folders: new Set(), sessions: new Set(), sshKeys: new Set() };
}

export default function VaultManager({ vault }: Readonly<VaultManagerProps>) {
  const { t } = useTranslation();
  const isUnlocked = vault.status?.isUnlocked || false;
  const { savedSessions, loadSavedSessions } = useSessions();
  const { keys: sshKeys, refresh: refreshSshKeys } = useSshKeys();
  const { folders, createFolder, renameFolder, deleteFolder, refreshFolders } = useVaultFolders();
  const autoLockOptions = getAutoLockOptions(t);

  const [showImportModal, setShowImportModal] = useState(false);
  const [contentsExpanded, setContentsExpanded] = useState(true);

  // Export mode
  const [isExporting, setIsExporting] = useState(false);
  const [selection, setSelection] = useState<TreeSelectionState>(emptySelection);
  const [showExportModal, setShowExportModal] = useState(false);

  // Export modal state
  const [exportPassword, setExportPassword] = useState("");
  const [exportConfirm, setExportConfirm] = useState("");
  const [includeSshKeys, setIncludeSshKeys] = useState(true);
  const [exportStatus, setExportStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [exportError, setExportError] = useState<string | null>(null);

  // Delete vault state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Exit export mode when vault locks
  useEffect(() => {
    if (!isUnlocked) {
      setIsExporting(false);
      setSelection(emptySelection());
    }
  }, [isUnlocked]);

  const handleLock = async () => { await vault.lock(); };

  const handleAutoLockChange = async (value: number) => {
    await vault.updateSettings(value);
  };

  const handleDeleteVault = async () => {
    setDeleteError(null);
    const result = await vault.deleteVault(deletePassword);
    if (result.success) {
      setShowDeleteConfirm(false);
      setDeletePassword("");
    } else {
      setDeleteError(result.error || t("settings.security.incorrectPassword"));
    }
  };

  // ── Selection helpers ──────────────────────────────────

  // Map folder id → child item ids (for bulk toggle)
  const folderContents = useMemo(() => {
    // Index items by folder_id first (O(n+m) instead of O(n*m))
    const sessionsByFolder = new Map<string, string[]>();
    for (const s of savedSessions) {
      if (s.folder_id) {
        const arr = sessionsByFolder.get(s.folder_id);
        if (arr) arr.push(s.id);
        else sessionsByFolder.set(s.folder_id, [s.id]);
      }
    }
    const sshKeysByFolder = new Map<string, string[]>();
    for (const k of sshKeys) {
      if (k.folderId) {
        const arr = sshKeysByFolder.get(k.folderId);
        if (arr) arr.push(k.id);
        else sshKeysByFolder.set(k.folderId, [k.id]);
      }
    }
    const map = new Map<string, { sessions: string[]; sshKeys: string[] }>();
    for (const f of folders) {
      map.set(f.id, {
        sessions: sessionsByFolder.get(f.id) || [],
        sshKeys: sshKeysByFolder.get(f.id) || [],
      });
    }
    return map;
  }, [folders, savedSessions, sshKeys]);

  const toggleSelection = useCallback((type: "folder" | "session" | "sshKey", id: string) => {
    setSelection(prev => {
      if (type === "folder") {
        const next = {
          folders: new Set(prev.folders),
          sessions: new Set(prev.sessions),
          sshKeys: new Set(prev.sshKeys),
        };
        const contents = folderContents.get(id);
        if (next.folders.has(id)) {
          next.folders.delete(id);
          if (contents) {
            for (const sid of contents.sessions) next.sessions.delete(sid);
            for (const kid of contents.sshKeys) next.sshKeys.delete(kid);
          }
        } else {
          next.folders.add(id);
          if (contents) {
            for (const sid of contents.sessions) next.sessions.add(sid);
            for (const kid of contents.sshKeys) next.sshKeys.add(kid);
          }
        }
        return next;
      }
      const key = type === "session" ? "sessions" : "sshKeys";
      const next = { ...prev, [key]: new Set(prev[key]) };
      if (next[key].has(id)) next[key].delete(id);
      else next[key].add(id);
      return next;
    });
  }, [folderContents]);

  const totalItems = savedSessions.length + sshKeys.length + folders.length;
  const totalSelected = selection.folders.size + selection.sessions.size + selection.sshKeys.size;

  const handleSelectAll = useCallback(() => {
    if (totalSelected === totalItems) {
      setSelection(emptySelection());
    } else {
      setSelection({
        folders: new Set(folders.map(f => f.id)),
        sessions: new Set(savedSessions.map(s => s.id)),
        sshKeys: new Set(sshKeys.map(k => k.id)),
      });
    }
  }, [folders, savedSessions, sshKeys, totalSelected, totalItems]);

  // ── Move to folder handler ──────────────────────────
  const handleMoveToFolder = useCallback(async (type: ItemType, id: string, folderId: string | null) => {
    try {
      if (type === "session") {
        await invoke("set_session_folder", { id, folderId });
        await loadSavedSessions();
      } else if (type === "sshKey") {
        await invoke("set_ssh_key_folder", { id, folderId });
        await refreshSshKeys();
      }
    } catch (err) {
      console.error("[VaultManager] Move to folder failed:", err);
    }
  }, [loadSavedSessions, refreshSshKeys]);

  const startExportMode = () => {
    setIsExporting(true);
    setContentsExpanded(true);
    // Select all by default
    setSelection({
      folders: new Set(folders.map(f => f.id)),
      sessions: new Set(savedSessions.map(s => s.id)),
      sshKeys: new Set(sshKeys.map(k => k.id)),
    });
  };

  const cancelExportMode = () => {
    setIsExporting(false);
    setSelection(emptySelection());
  };

  const openExportModal = () => {
    setExportPassword("");
    setExportConfirm("");
    setIncludeSshKeys(true);
    setExportStatus("idle");
    setExportError(null);
    setShowExportModal(true);
  };

  // ── Export handler ─────────────────────────────────────

  const passwordError = exportPassword.length > 0 && exportPassword.length < 8
    ? t("settings.security.passwordTooShort")
    : exportPassword !== exportConfirm && exportConfirm.length > 0
      ? t("settings.security.passwordMismatchError")
      : null;

  const canExport = totalSelected > 0 && !passwordError && exportPassword.length >= 8;

  const handleExport = async () => {
    const filePath = await save({
      filters: [{ name: "SimplyTerm Export", extensions: ["stvault"] }],
      defaultPath: "vault-export.stvault",
    });
    if (!filePath) return;

    setExportStatus("loading");
    setExportError(null);

    const result = await vault.selectiveExport(
      filePath,
      Array.from(selection.folders),
      Array.from(selection.sessions),
      includeSshKeys ? Array.from(selection.sshKeys) : [],
      exportPassword,
    );

    if (result.success) {
      setExportStatus("success");
      setTimeout(() => {
        setShowExportModal(false);
        cancelExportMode();
      }, 1500);
    } else {
      setExportStatus("error");
      setExportError(result.error || t("settings.security.exportError"));
    }
  };

  const contentItemCount = savedSessions.length + sshKeys.length;

  return (
    <div className="space-y-6">
      {/* ── Section 1: Vault (status + contents unified) ──── */}
      <SettingGroup
        title={t("settings.security.tabVault")}
        description={t("settings.security.vaultStatusDesc")}
      >
        <div className="bg-surface-0/20 rounded-lg overflow-hidden">
          {/* Status header */}
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                  isUnlocked ? "bg-success/20 text-success" : "bg-error/20 text-error"
                }`}>
                  {isUnlocked ? <LockOpen size={18} /> : <Lock size={18} />}
                </div>
                <div>
                  <div className="text-sm font-medium text-text">
                    {isUnlocked ? t("settings.security.vaultUnlocked") : t("settings.security.vaultLocked")}
                  </div>
                  <div className="text-xs text-text-muted/60">
                    {vault.status?.unlockMethods.map(m => getMethodLabel(m, t)).join(", ")}
                  </div>
                </div>
              </div>

              {/* Export / Import / Lock buttons */}
              {isUnlocked && (
                <div className="flex items-center gap-1.5">
                  {!isExporting && (
                    <button
                      onClick={startExportMode}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg bg-surface-0/30 text-text-muted hover:bg-surface-0/50 hover:text-text transition-colors"
                      title={t("settings.security.exportVault")}
                    >
                      <Download size={14} />
                      <span className="hidden sm:inline">{t("settings.security.exportVault")}</span>
                    </button>
                  )}
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg bg-surface-0/30 text-text-muted hover:bg-surface-0/50 hover:text-text transition-colors"
                    title={t("settings.security.importVault")}
                  >
                    <Upload size={14} />
                    <span className="hidden sm:inline">{t("settings.security.importVault")}</span>
                  </button>
                  <div className="w-px h-5 bg-surface-0/30 mx-0.5" />
                  <button
                    onClick={handleLock}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg bg-surface-0/30 text-text-muted hover:bg-surface-0/50 hover:text-text transition-colors"
                    title={t("settings.security.lock")}
                  >
                    <Lock size={14} />
                    <span className="hidden sm:inline">{t("settings.security.lock")}</span>
                  </button>
                </div>
              )}
            </div>

            {!isUnlocked && (
              <div className="text-xs text-text-muted/40 text-center">
                {t("settings.security.unlock")}
              </div>
            )}
          </div>

          {/* Vault contents (tree view) — inside same container */}
          {isUnlocked && (
            <>
              {/* Collapsible header + select all in export mode */}
              <button
                onClick={() => setContentsExpanded(!contentsExpanded)}
                className="w-full flex items-center justify-between px-4 py-2.5 border-t border-surface-0/30 hover:bg-surface-0/10 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  {isExporting && (
                    <StyledCheck
                      checked={totalSelected === totalItems && totalItems > 0}
                      onClick={(e) => { e.stopPropagation(); handleSelectAll(); }}
                    />
                  )}
                  <span className="text-xs font-medium text-text-muted">
                    {isExporting
                      ? `${totalSelected}/${totalItems} ${t("settings.security.selectAll").toLowerCase()}`
                      : `${contentItemCount} ${t("settings.security.vaultItems")}`
                    }
                  </span>
                </div>
                <ChevronDown
                  size={14}
                  className={`text-text-muted transition-transform duration-200 ${contentsExpanded ? "" : "-rotate-90"}`}
                />
              </button>

              {/* Collapsible content */}
              <div
                className="grid transition-[grid-template-rows] duration-200"
                style={{ gridTemplateRows: contentsExpanded ? "1fr" : "0fr" }}
              >
                <div className="overflow-hidden">
                  <div className="border-t border-surface-0/15">
                    <VaultTreeView
                      folders={folders}
                      sessions={savedSessions}
                      sshKeys={sshKeys}
                      onCreateFolder={async (name) => {
                        const result = await createFolder(name);
                        if (!result.success) console.error("[VaultFolder] Create failed:", result.error);
                      }}
                      onRenameFolder={async (id, name) => {
                        const result = await renameFolder(id, name);
                        if (!result.success) console.error("[VaultFolder] Rename failed:", result.error);
                      }}
                      onDeleteFolder={async (id) => {
                        const result = await deleteFolder(id);
                        if (!result.success) console.error("[VaultFolder] Delete failed:", result.error);
                      }}
                      onMoveToFolder={handleMoveToFolder}
                      selectionMode={isExporting}
                      selection={selection}
                      onToggleSelection={toggleSelection}
                    />
                  </div>
                </div>
              </div>

              {/* Export action bar */}
              {isExporting && (
                <div className="border-t border-surface-0/30 px-4 py-3 flex items-center justify-between gap-3 bg-surface-0/10">
                  <span className="text-xs text-text-muted">
                    {totalSelected} {t("settings.security.selectedCount")}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={cancelExportMode}
                      className="px-3 py-1.5 text-xs text-text-muted bg-surface-0/30 rounded-lg hover:bg-surface-0/50 transition-colors"
                    >
                      {t("common.cancel")}
                    </button>
                    <button
                      onClick={openExportModal}
                      disabled={totalSelected === 0}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-accent rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50"
                    >
                      <Download size={14} />
                      {t("settings.security.exportVault")}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </SettingGroup>

      {/* ── Section 2: Auto-lock ────────────────────────────── */}
      <SettingGroup
        title={t("settings.security.autoLockTitle")}
        description={t("settings.security.autoLockDesc")}
      >
        <select
          value={vault.status?.autoLockTimeout ?? 300}
          onChange={(e) => handleAutoLockChange(Number(e.target.value))}
          disabled={!isUnlocked}
          className="w-full px-3 py-2.5 bg-surface-0/20 border border-surface-0/30 rounded-lg text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
        >
          {autoLockOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </SettingGroup>

      {/* ── Section 3: Maximum Security ─────────────────────── */}
      <SettingGroup
        title={t("settings.security.maxSecurityTitle")}
        description={t("settings.security.maxSecurityDesc")}
      >
        <SettingRow
          icon={<ShieldCheck size={18} />}
          iconClassName={vault.status?.requireUnlockOnConnect ? "text-warning" : "text-text-muted"}
          title={vault.status?.requireUnlockOnConnect
            ? t("settings.security.maxSecurityEnabled")
            : t("settings.security.maxSecurityDisabled")}
          description={t("settings.security.maxSecurityWarning")}
        >
          <Toggle
            checked={vault.status?.requireUnlockOnConnect || false}
            onChange={(checked) => vault.setRequireUnlockOnConnect(checked)}
          />
        </SettingRow>
      </SettingGroup>

      {/* ── Section 4: Delete Vault ─────────────────────────── */}
      <SettingGroup
        title={t("settings.security.deleteVaultTitle")}
        description={t("settings.security.deleteVaultDesc")}
      >
        {showDeleteConfirm ? (
          <div className="p-4 bg-error/5 border border-error/20 rounded-lg space-y-3">
            <p className="text-xs text-error">{t("settings.security.deleteVaultWarning")}</p>
            <input
              type="password"
              placeholder={t("settings.security.deleteVaultPasswordPrompt")}
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              className="w-full px-3 py-2 bg-surface-0/30 border border-error/30 rounded-lg text-sm text-text placeholder-text-muted/50 focus:outline-none focus:ring-1 focus:ring-error"
            />
            {deleteError && <p className="text-xs text-error">{deleteError}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeletePassword(""); setDeleteError(null); }}
                className="flex-1 py-2 bg-surface-0/50 text-text-muted text-xs rounded-lg hover:bg-surface-0 transition-colors"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleDeleteVault}
                disabled={!deletePassword}
                className="flex-1 py-2 bg-error text-white text-xs font-medium rounded-lg hover:bg-error/90 transition-colors disabled:opacity-50"
              >
                {t("settings.security.deletePermanently")}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm text-error rounded-lg bg-error/5 hover:bg-error/10 transition-colors"
          >
            <Trash2 size={16} />
            {t("settings.security.deleteVault")}
          </button>
        )}
      </SettingGroup>

      {/* ── Export Modal (password + options) ─────────────── */}
      <Modal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        title={t("settings.security.exportVault")}
        width="md"
      >
        <div className="space-y-4">
          <p className="text-xs text-text-muted">{t("settings.security.exportPasswordHint")}</p>

          <PasswordInput
            value={exportPassword}
            onChange={setExportPassword}
            placeholder={t("settings.security.exportPassword")}
          />
          <PasswordInput
            value={exportConfirm}
            onChange={setExportConfirm}
            placeholder={t("settings.security.exportPasswordConfirm")}
          />
          {passwordError && exportPassword.length > 0 && exportConfirm.length > 0 && (
            <p className="text-xs text-error">{passwordError}</p>
          )}

          {/* Options */}
          <div className="space-y-2.5 pt-3 border-t border-surface-0/20">
            <div
              className="flex items-center gap-2.5 text-sm text-text cursor-pointer select-none"
              onClick={() => setIncludeSshKeys(!includeSshKeys)}
            >
              <StyledCheck checked={includeSshKeys} />
              {t("settings.security.includeSshKeys")}
            </div>
          </div>

          {/* Error */}
          {exportError && (
            <p className="text-xs text-error flex items-center gap-2">
              <AlertCircle size={14} />
              {exportError}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setShowExportModal(false)}
              className="flex-1 py-2.5 bg-surface-0/50 text-text-muted text-sm rounded-lg hover:bg-surface-0 transition-colors"
            >
              {t("common.cancel")}
            </button>
            <button
              onClick={handleExport}
              disabled={!canExport || exportStatus === "loading"}
              className="flex-1 py-2.5 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {exportStatus === "loading" ? (
                <><Loader2 size={16} className="animate-spin" />{t("settings.security.exporting")}</>
              ) : exportStatus === "success" ? (
                <><Check size={16} />{t("settings.security.exportSelectiveSuccess")}</>
              ) : (
                <><Download size={16} />{t("settings.security.exportVault")}</>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Import Modal ────────────────────────────────────── */}
      <SelectiveImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        vault={vault}
        onImportComplete={async () => {
          await loadSavedSessions();
          await refreshSshKeys();
          await refreshFolders();
        }}
      />
    </div>
  );
}
