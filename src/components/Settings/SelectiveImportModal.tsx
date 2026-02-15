import { useState } from "react";
import { useTranslation } from "react-i18next";
import { open } from "@tauri-apps/plugin-dialog";
import { Check, Loader2, AlertCircle, FileSearch } from "lucide-react";
import Modal from "../Modal";
import { PasswordInput } from "../UI/PasswordInput";
import type { useVault } from "../../hooks";
import type { ImportResult } from "../../types/vault";

interface SelectiveImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  vault: ReturnType<typeof useVault>;
  onImportComplete?: () => void;
}

export default function SelectiveImportModal({ isOpen, onClose, vault, onImportComplete }: Readonly<SelectiveImportModalProps>) {
  const { t } = useTranslation();

  const [filePath, setFilePath] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [status, setStatus] = useState<"idle" | "importing" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const handleChooseFile = async () => {
    const path = await open({
      filters: [{ name: "SimplyTerm Export", extensions: ["stvault"] }],
      multiple: false,
    });
    if (path) {
      setFilePath(path);
      setImportResult(null);
      setStatus("idle");
      setError(null);
    }
  };

  const handleImport = async () => {
    if (!filePath || !password) return;
    setStatus("importing");
    setError(null);

    const result = await vault.selectiveImportExecute(filePath, password);
    if (result.success) {
      setImportResult(result.result);
      setStatus("done");
      onImportComplete?.();
    } else {
      setStatus("error");
      setError(result.error || t("settings.security.importError"));
    }
  };

  const handleClose = () => {
    setFilePath(null);
    setPassword("");
    setImportResult(null);
    setStatus("idle");
    setError(null);
    onClose();
  };

  const canImport = filePath && password.length > 0 && status !== "importing" && status !== "done";

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t("settings.security.selectiveImportTitle")} width="md">
      <div className="space-y-4">
        {/* Warning */}
        <p className="text-xs text-text-muted bg-warning/5 border border-warning/20 rounded-lg px-3 py-2">
          {t("settings.security.importWarning")}
        </p>

        {/* File selection */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleChooseFile}
            className="px-4 py-2.5 text-sm rounded-lg bg-surface-0/30 text-text hover:bg-surface-0/50 transition-colors flex items-center gap-2"
          >
            <FileSearch size={16} />
            {t("settings.security.chooseFile")}
          </button>
          {filePath && (
            <span className="text-xs text-text-muted truncate flex-1">
              {filePath.split(/[/\\]/).pop()}
            </span>
          )}
        </div>

        {/* Password */}
        {filePath && (
          <PasswordInput
            value={password}
            onChange={setPassword}
            placeholder={t("settings.security.importPassword")}
          />
        )}

        {/* Import result */}
        {importResult && status === "done" && (
          <div className="bg-success/10 rounded-lg p-4 space-y-2 border border-success/30">
            <p className="text-sm font-medium text-success flex items-center gap-2">
              <Check size={16} />
              {t("settings.security.importResultTitle")}
            </p>
            <div className="text-xs text-text-muted space-y-1">
              {importResult.folders_added > 0 && <p>{t("settings.security.itemsAdded", { count: importResult.folders_added })} (folders)</p>}
              {importResult.sessions_added > 0 && <p>{t("settings.security.itemsAdded", { count: importResult.sessions_added })} (sessions)</p>}
              {importResult.ssh_keys_added > 0 && <p>{t("settings.security.itemsAdded", { count: importResult.ssh_keys_added })} (SSH keys)</p>}
              {importResult.credentials_added > 0 && <p>{t("settings.security.itemsAdded", { count: importResult.credentials_added })} (credentials)</p>}
              {importResult.duplicates_skipped > 0 && (
                <p className="text-warning">{t("settings.security.duplicatesSkipped", { count: importResult.duplicates_skipped })}</p>
              )}
            </div>
          </div>
        )}

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
            onClick={handleClose}
            className="flex-1 py-2.5 bg-surface-0/50 text-text-muted text-sm rounded-lg hover:bg-surface-0 transition-colors"
          >
            {status === "done" ? t("common.close") : t("common.cancel")}
          </button>
          {status !== "done" && (
            <button
              onClick={handleImport}
              disabled={!canImport}
              className="flex-1 py-2.5 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {status === "importing" ? (
                <><Loader2 size={16} className="animate-spin" />{t("settings.security.importing")}</>
              ) : (
                t("settings.security.importConfirm")
              )}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
