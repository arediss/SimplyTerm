import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { Folder, Server, Key, Check, Loader2, AlertCircle } from "lucide-react";
import Modal from "../Modal";
import { PasswordInput } from "../UI/PasswordInput";
import type { useVault } from "../../hooks";
import type { VaultFolder } from "../../types/vault";
import type { SavedSession, SshKeyProfileInfo } from "../../types";

interface BastionInfo {
  id: string;
  name: string;
  host: string;
  folderId?: string;
}

interface SelectiveExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  vault: ReturnType<typeof useVault>;
}

export default function SelectiveExportModal({ isOpen, onClose, vault }: Readonly<SelectiveExportModalProps>) {
  const { t } = useTranslation();

  // Data loaded from backend
  const [folders, setFolders] = useState<VaultFolder[]>([]);
  const [sessions, setSessions] = useState<SavedSession[]>([]);
  const [bastions, setBastions] = useState<BastionInfo[]>([]);
  const [sshKeys, setSshKeys] = useState<SshKeyProfileInfo[]>([]);

  // Selection state
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set());
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [selectedBastions, setSelectedBastions] = useState<Set<string>>(new Set());
  const [selectedSshKeys, setSelectedSshKeys] = useState<Set<string>>(new Set());

  // Password
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Status
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const passwordError = password.length > 0 && password.length < 8
    ? t("settings.security.passwordTooShort")
    : password !== confirmPassword && confirmPassword.length > 0
      ? t("settings.security.passwordMismatchError")
      : null;

  // Load data when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setStatus("idle");
    setError(null);
    setPassword("");
    setConfirmPassword("");
    setSelectedFolders(new Set());
    setSelectedSessions(new Set());
    setSelectedBastions(new Set());
    setSelectedSshKeys(new Set());

    (async () => {
      try {
        const [foldersRes, sessionsRes, bastionsRes, sshKeysRes] = await Promise.all([
          invoke<VaultFolder[]>("list_vault_folders"),
          invoke<SavedSession[]>("load_saved_sessions"),
          invoke<BastionInfo[]>("list_bastions"),
          invoke<SshKeyProfileInfo[]>("list_ssh_keys"),
        ]);
        setFolders(foldersRes);
        setSessions(sessionsRes);
        setBastions(bastionsRes);
        setSshKeys(sshKeysRes);
      } catch {
        // Vault might be locked
      }
    })();
  }, [isOpen]);

  const totalSelected = selectedFolders.size + selectedSessions.size + selectedBastions.size + selectedSshKeys.size;
  const canExport = totalSelected > 0 && !passwordError && password.length >= 8;

  const toggleFolder = useCallback((id: string) => {
    setSelectedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSession = useCallback((id: string) => {
    setSelectedSessions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleBastion = useCallback((id: string) => {
    setSelectedBastions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSshKey = useCallback((id: string) => {
    setSelectedSshKeys((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    const allSelected = totalSelected === folders.length + sessions.length + bastions.length + sshKeys.length;
    if (allSelected) {
      setSelectedFolders(new Set());
      setSelectedSessions(new Set());
      setSelectedBastions(new Set());
      setSelectedSshKeys(new Set());
    } else {
      setSelectedFolders(new Set(folders.map(f => f.id)));
      setSelectedSessions(new Set(sessions.map(s => s.id)));
      setSelectedBastions(new Set(bastions.map(b => b.id)));
      setSelectedSshKeys(new Set(sshKeys.map(k => k.id)));
    }
  }, [folders, sessions, bastions, sshKeys, totalSelected]);

  const handleExport = async () => {
    const filePath = await save({
      filters: [{ name: "SimplyTerm Export", extensions: ["stvault"] }],
      defaultPath: "vault-export.stvault",
    });
    if (!filePath) return;

    setStatus("loading");
    setError(null);

    const result = await vault.selectiveExport(
      filePath,
      Array.from(selectedFolders),
      Array.from(selectedSessions),
      Array.from(selectedBastions),
      Array.from(selectedSshKeys),
      password,
    );

    if (result.success) {
      setStatus("success");
      setTimeout(() => onClose(), 1500);
    } else {
      setStatus("error");
      setError(result.error || t("settings.security.exportError"));
    }
  };

  // Group items by folder for the tree view
  const unfolderedSessions = sessions.filter(s => !s.folder_id || !folders.some(f => f.id === s.folder_id));
  const unfolderedBastions = bastions.filter(b => !b.folderId || !folders.some(f => f.id === b.folderId));
  const unfolderedSshKeys = sshKeys.filter(k => !k.folderId || !folders.some(f => f.id === k.folderId));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("settings.security.selectiveExportTitle")} width="lg">
      <div className="space-y-4 max-h-[70vh] flex flex-col">
        <p className="text-sm text-text-muted">{t("settings.security.selectiveExportDesc")}</p>

        {/* Select All */}
        <label className="flex items-center gap-2 text-sm text-text cursor-pointer">
          <input
            type="checkbox"
            checked={totalSelected === folders.length + sessions.length + bastions.length + sshKeys.length && totalSelected > 0}
            onChange={selectAll}
            className="accent-accent"
          />
          {t("settings.security.selectAll")}
        </label>

        {/* Item tree */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-0 max-h-[35vh]">
          {/* Folders with their items */}
          {folders.map(folder => {
            const folderSessions = sessions.filter(s => s.folder_id === folder.id);
            const folderBastions = bastions.filter(b => b.folderId === folder.id);
            const folderSshKeys = sshKeys.filter(k => k.folderId === folder.id);
            const itemCount = folderSessions.length + folderBastions.length + folderSshKeys.length;

            return (
              <div key={folder.id} className="bg-surface-0/20 rounded-lg p-3">
                <label className="flex items-center gap-2 text-sm font-medium text-text cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedFolders.has(folder.id)}
                    onChange={() => toggleFolder(folder.id)}
                    className="accent-accent"
                  />
                  <Folder size={16} className="text-accent" />
                  {folder.name}
                  <span className="text-text-muted text-xs ml-auto">
                    {t("settings.security.itemCount", { count: itemCount })}
                  </span>
                </label>
                {itemCount > 0 && (
                  <div className="ml-8 mt-2 space-y-1">
                    {folderSessions.map(s => (
                      <ItemCheckbox key={s.id} icon={<Server size={14} />} label={`${s.name} (${s.host})`}
                        checked={selectedSessions.has(s.id) || selectedFolders.has(folder.id)}
                        disabled={selectedFolders.has(folder.id)}
                        onChange={() => toggleSession(s.id)} />
                    ))}
                    {folderBastions.map(b => (
                      <ItemCheckbox key={b.id} icon={<Server size={14} />} label={`${b.name} (${b.host})`}
                        checked={selectedBastions.has(b.id) || selectedFolders.has(folder.id)}
                        disabled={selectedFolders.has(folder.id)}
                        onChange={() => toggleBastion(b.id)} />
                    ))}
                    {folderSshKeys.map(k => (
                      <ItemCheckbox key={k.id} icon={<Key size={14} />} label={k.name}
                        checked={selectedSshKeys.has(k.id) || selectedFolders.has(folder.id)}
                        disabled={selectedFolders.has(folder.id)}
                        onChange={() => toggleSshKey(k.id)} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Unfoldered items */}
          {(unfolderedSessions.length > 0 || unfolderedBastions.length > 0 || unfolderedSshKeys.length > 0) && (
            <div className="bg-surface-0/10 rounded-lg p-3">
              <p className="text-xs text-text-muted mb-2">{t("settings.security.noFolder")}</p>
              <div className="space-y-1">
                {unfolderedSessions.map(s => (
                  <ItemCheckbox key={s.id} icon={<Server size={14} />} label={`${s.name} (${s.host})`}
                    checked={selectedSessions.has(s.id)} onChange={() => toggleSession(s.id)} />
                ))}
                {unfolderedBastions.map(b => (
                  <ItemCheckbox key={b.id} icon={<Server size={14} />} label={`${b.name} (${b.host})`}
                    checked={selectedBastions.has(b.id)} onChange={() => toggleBastion(b.id)} />
                ))}
                {unfolderedSshKeys.map(k => (
                  <ItemCheckbox key={k.id} icon={<Key size={14} />} label={k.name}
                    checked={selectedSshKeys.has(k.id)} onChange={() => toggleSshKey(k.id)} />
                ))}
              </div>
            </div>
          )}

          {folders.length === 0 && sessions.length === 0 && bastions.length === 0 && sshKeys.length === 0 && (
            <p className="text-sm text-text-muted text-center py-4">{t("settings.security.nothingSelected")}</p>
          )}
        </div>

        {/* Password section */}
        <div className="space-y-2 pt-2 border-t border-surface-0/30">
          <PasswordInput
            value={password}
            onChange={setPassword}
            placeholder={t("settings.security.exportPassword")}
          />
          <PasswordInput
            value={confirmPassword}
            onChange={setConfirmPassword}
            placeholder={t("settings.security.exportPasswordConfirm")}
          />
          {passwordError && password.length > 0 && confirmPassword.length > 0 && (
            <p className="text-xs text-error">{passwordError}</p>
          )}
          <p className="text-[11px] text-text-muted/60">{t("settings.security.exportPasswordHint")}</p>
        </div>

        {/* Error */}
        {error && (
          <p className="text-xs text-error flex items-center gap-2">
            <AlertCircle size={14} />
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-surface-0/50 text-text-muted text-sm rounded-lg hover:bg-surface-0 transition-colors"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={handleExport}
            disabled={!canExport || status === "loading"}
            className="flex-1 py-2.5 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {status === "loading" ? (
              <><Loader2 size={16} className="animate-spin" />{t("settings.security.exporting")}</>
            ) : status === "success" ? (
              <><Check size={16} />{t("settings.security.exportSelectiveSuccess")}</>
            ) : (
              t("settings.security.exportVault")
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ItemCheckbox({ icon, label, checked, disabled, onChange }: Readonly<{
  icon: React.ReactNode;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}>) {
  return (
    <label className={`flex items-center gap-2 text-xs text-text-muted cursor-pointer ${disabled ? 'opacity-50' : ''}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={onChange} className="accent-accent" />
      {icon}
      <span className="truncate">{label}</span>
    </label>
  );
}
