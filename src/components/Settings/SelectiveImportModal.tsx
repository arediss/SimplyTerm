import { useState } from "react";
import { useTranslation } from "react-i18next";
import { open } from "@tauri-apps/plugin-dialog";
import { Folder, Server, Key, Check, Loader2, AlertCircle, FileSearch } from "lucide-react";
import Modal from "../Modal";
import { PasswordInput } from "../UI/PasswordInput";
import type { useVault } from "../../hooks";
import type { ImportPreview, ImportResult } from "../../types/vault";

interface SelectiveImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  vault: ReturnType<typeof useVault>;
}

export default function SelectiveImportModal({ isOpen, onClose, vault }: Readonly<SelectiveImportModalProps>) {
  const { t } = useTranslation();

  const [filePath, setFilePath] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [status, setStatus] = useState<"idle" | "previewing" | "previewed" | "importing" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const handleChooseFile = async () => {
    const path = await open({
      filters: [{ name: "SimplyTerm Export", extensions: ["stvault"] }],
      multiple: false,
    });
    if (path) {
      setFilePath(path);
      setPreview(null);
      setImportResult(null);
      setStatus("idle");
      setError(null);
    }
  };

  const handlePreview = async () => {
    if (!filePath || !password) return;
    setStatus("previewing");
    setError(null);

    const result = await vault.selectiveImportPreview(filePath, password);
    if (result.success) {
      setPreview(result.preview);
      setStatus("previewed");
    } else {
      setStatus("error");
      setError(t("settings.security.wrongPassword"));
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
    } else {
      setStatus("error");
      setError(result.error || t("settings.security.importError"));
    }
  };

  const handleClose = () => {
    setFilePath(null);
    setPassword("");
    setPreview(null);
    setImportResult(null);
    setStatus("idle");
    setError(null);
    onClose();
  };

  const totalPreviewItems = preview
    ? preview.folders.length + preview.sessions.length + preview.bastions.length + preview.ssh_keys.length
    : 0;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t("settings.security.selectiveImportTitle")} width="lg">
      <div className="space-y-4">
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

        {/* Preview button */}
        {filePath && password && status !== "previewed" && status !== "done" && (
          <button
            onClick={handlePreview}
            disabled={status === "previewing"}
            className="w-full py-2.5 bg-surface-0/30 text-text text-sm rounded-lg hover:bg-surface-0/50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {status === "previewing" ? (
              <><Loader2 size={16} className="animate-spin" />{t("settings.security.preview")}...</>
            ) : (
              t("settings.security.preview")
            )}
          </button>
        )}

        {/* Preview results */}
        {preview && status === "previewed" && (
          <div className="bg-surface-0/20 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium text-text">{t("settings.security.previewDesc")}</p>
            <div className="space-y-1">
              {preview.folders.length > 0 && (
                <PreviewGroup icon={<Folder size={14} className="text-accent" />} items={preview.folders} />
              )}
              {preview.sessions.length > 0 && (
                <PreviewGroup icon={<Server size={14} className="text-blue" />} items={preview.sessions} />
              )}
              {preview.bastions.length > 0 && (
                <PreviewGroup icon={<Server size={14} className="text-peach" />} items={preview.bastions} />
              )}
              {preview.ssh_keys.length > 0 && (
                <PreviewGroup icon={<Key size={14} className="text-green" />} items={preview.ssh_keys} />
              )}
            </div>
            <p className="text-xs text-text-muted mt-1">
              {totalPreviewItems} item(s)
            </p>
          </div>
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
              {importResult.bastions_added > 0 && <p>{t("settings.security.itemsAdded", { count: importResult.bastions_added })} (bastions)</p>}
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
          {status === "previewed" && (
            <button
              onClick={handleImport}
              className="flex-1 py-2.5 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors flex items-center justify-center gap-2"
            >
              {t("settings.security.importConfirm")}
            </button>
          )}
          {status === "importing" && (
            <button
              disabled
              className="flex-1 py-2.5 bg-accent/50 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-2"
            >
              <Loader2 size={16} className="animate-spin" />
              {t("settings.security.importing")}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function PreviewGroup({ icon, items }: Readonly<{ icon: React.ReactNode; items: string[] }>) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5">{icon}</span>
      <div className="flex flex-wrap gap-1">
        {items.map((item) => (
          <span key={item} className="px-2 py-0.5 bg-surface-0/30 rounded text-xs text-text">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
