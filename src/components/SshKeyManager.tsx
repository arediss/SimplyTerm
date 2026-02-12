import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { getErrorMessage } from "../utils";
import { Key, Plus, Pencil, Trash2, Lock, X, Check, AlertTriangle } from "lucide-react";
import { useSshKeys } from "../hooks";
import type { SshKeyProfileInfo } from "../types";

interface SshKeyManagerProps {
  isVaultUnlocked: boolean;
}

export default function SshKeyManager({ isVaultUnlocked }: Readonly<SshKeyManagerProps>) {
  const { t } = useTranslation();
  const { keys, createKey, updateKey, deleteKey } = useSshKeys();
  const [showForm, setShowForm] = useState(false);
  const [editingKey, setEditingKey] = useState<SshKeyProfileInfo | null>(null);
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<SshKeyProfileInfo | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formKeyPath, setFormKeyPath] = useState("");
  const [formPassphrase, setFormPassphrase] = useState("");
  const [formAlwaysAsk, setFormAlwaysAsk] = useState(false);
  const [formError, setFormError] = useState("");

  const resetForm = () => {
    setFormName("");
    setFormKeyPath("");
    setFormPassphrase("");
    setFormAlwaysAsk(false);
    setFormError("");
    setShowForm(false);
    setEditingKey(null);
  };

  const openAddForm = () => {
    resetForm();
    setShowForm(true);
  };

  const openEditForm = (key: SshKeyProfileInfo) => {
    setEditingKey(key);
    setFormName(key.name);
    setFormKeyPath(key.keyPath);
    setFormPassphrase("");
    setFormAlwaysAsk(key.requirePassphrasePrompt);
    setFormError("");
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formKeyPath.trim()) {
      setFormError("Name and key path are required");
      return;
    }

    try {
      if (editingKey) {
        await updateKey(
          editingKey.id,
          formName,
          formKeyPath,
          formAlwaysAsk ? undefined : (formPassphrase || undefined),
          formAlwaysAsk
        );
      } else {
        await createKey(
          formName,
          formKeyPath,
          formAlwaysAsk ? null : (formPassphrase || null),
          formAlwaysAsk
        );
      }
      resetForm();
    } catch (err) {
      setFormError(getErrorMessage(err));
    }
  };

  const handleDeleteConfirm = useCallback(async () => {
    if (!confirmDeleteKey) return;
    setIsDeleting(true);
    try {
      await deleteKey(confirmDeleteKey.id);
    } catch (err) {
      console.error("Failed to delete SSH key:", err);
    } finally {
      setIsDeleting(false);
      setConfirmDeleteKey(null);
    }
  }, [confirmDeleteKey, deleteKey]);

  if (!isVaultUnlocked) {
    return (
      <div className="space-y-3">
        <div>
          <h4 className="text-sm font-medium text-text">{t("settings.security.sshKeysTitle")}</h4>
          <p className="text-xs text-text-muted">{t("settings.security.sshKeysDesc")}</p>
        </div>
        <div className="px-4 py-3 bg-surface-0/20 rounded-lg text-xs text-text-muted flex items-center gap-2">
          <Lock size={14} />
          {t("settings.security.vaultLocked")}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium text-text">{t("settings.security.sshKeysTitle")}</h4>
          <p className="text-xs text-text-muted">{t("settings.security.sshKeysDesc")}</p>
        </div>
        {!showForm && (
          <button
            onClick={openAddForm}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/10 text-accent text-xs rounded-lg hover:bg-accent/20 transition-colors"
          >
            <Plus size={14} />
            {t("settings.security.sshKeysAddKey")}
          </button>
        )}
      </div>

      {/* Key list */}
      {keys.length === 0 && !showForm && (
        <div className="px-4 py-6 bg-surface-0/20 rounded-lg text-xs text-text-muted text-center">
          <Key size={24} className="mx-auto mb-2 opacity-40" />
          {t("settings.security.sshKeysNoKeys")}
        </div>
      )}

      {keys.map((key) => (
        <div
          key={key.id}
          className="flex items-center justify-between p-3 bg-surface-0/20 rounded-lg group"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0">
              <Key size={16} />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-text truncate">{key.name}</div>
              <div className="text-xs text-text-muted truncate">{key.keyPath}</div>
              <div className="flex items-center gap-2 mt-0.5">
                {key.hasPassphrase && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-success/10 text-success rounded">
                    {t("settings.security.sshKeysPassphrase")}
                  </span>
                )}
                {key.requirePassphrasePrompt && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-warning/10 text-warning rounded">
                    {t("settings.security.sshKeysAlwaysAskPassphrase")}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => openEditForm(key)}
              className="p-1.5 text-text-muted hover:text-text hover:bg-surface-0/50 rounded-md transition-colors"
              title={t("settings.security.sshKeysEditKey")}
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={() => setConfirmDeleteKey(key)}
              className="p-1.5 text-text-muted hover:text-error hover:bg-error/10 rounded-md transition-colors"
              title={t("settings.security.sshKeysDeleteKey")}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      ))}

      {/* Delete confirmation modal */}
      {confirmDeleteKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in">
          <div
            className="absolute inset-0 bg-black/70"
            aria-hidden="true"
            onClick={() => !isDeleting && setConfirmDeleteKey(null)}
          />
          <div className="relative bg-crust border border-surface-0/50 rounded-xl shadow-2xl w-[360px] animate-scale-in">
            <div className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-error/10 text-error flex items-center justify-center shrink-0">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-text">
                    {t("settings.security.sshKeysDeleteKey")}
                  </h3>
                  <p className="text-xs text-text-muted mt-0.5">
                    {t("settings.security.sshKeysConfirmDelete")}
                  </p>
                </div>
              </div>

              <div className="px-3 py-2 bg-surface-0/30 rounded-lg mb-4">
                <div className="flex items-center gap-2">
                  <Key size={14} className="text-accent shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-text truncate">{confirmDeleteKey.name}</div>
                    <div className="text-[10px] text-text-muted truncate">{confirmDeleteKey.keyPath}</div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setConfirmDeleteKey(null)}
                  disabled={isDeleting}
                  className="px-4 py-2 text-xs text-text-muted hover:text-text rounded-lg hover:bg-surface-0/50 transition-colors disabled:opacity-50"
                >
                  {t("common.cancel") || "Cancel"}
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={isDeleting}
                  className="flex items-center gap-1.5 px-4 py-2 bg-error text-white text-xs font-medium rounded-lg hover:bg-error/90 transition-colors disabled:opacity-50"
                >
                  <Trash2 size={13} />
                  {isDeleting ? "..." : t("settings.security.sshKeysDeleteKey")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit form */}
      {showForm && (
        <div className="p-4 bg-surface-0/20 rounded-lg space-y-3 border border-surface-0/50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text">
              {editingKey ? t("settings.security.sshKeysEditKey") : t("settings.security.sshKeysAddKey")}
            </span>
            <button onClick={resetForm} className="p-1 text-text-muted hover:text-text">
              <X size={14} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-text-muted mb-1">
                {t("settings.security.sshKeysName")}
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder={t("settings.security.sshKeysNamePlaceholder")}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">
                {t("settings.security.sshKeysKeyPath")}
              </label>
              <input
                type="text"
                value={formKeyPath}
                onChange={(e) => setFormKeyPath(e.target.value)}
                placeholder={t("settings.security.sshKeysKeyPathPlaceholder")}
                className="input-field"
              />
            </div>
          </div>

          {!formAlwaysAsk && (
            <div>
              <label className="block text-xs text-text-muted mb-1">
                {t("settings.security.sshKeysPassphrase")}
              </label>
              <input
                type="password"
                value={formPassphrase}
                onChange={(e) => setFormPassphrase(e.target.value)}
                className="input-field"
              />
            </div>
          )}

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formAlwaysAsk}
              onChange={(e) => setFormAlwaysAsk(e.target.checked)}
              className="mt-0.5 accent-accent"
              aria-label={t("settings.security.sshKeysAlwaysAskPassphrase")}
            />
            <span>
              <span className="block text-xs text-text">{t("settings.security.sshKeysAlwaysAskPassphrase")}</span>
              <span className="block text-[10px] text-text-muted">{t("settings.security.sshKeysAlwaysAskPassphraseDesc")}</span>
            </span>
          </label>

          {formError && (
            <div className="text-xs text-error">{formError}</div>
          )}

          <div className="flex gap-2 justify-end">
            <button
              onClick={resetForm}
              className="px-3 py-1.5 text-xs text-text-muted hover:text-text transition-colors"
            >
              {t("common.cancel") || "Cancel"}
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-base text-xs rounded-lg hover:bg-accent/90 transition-colors"
            >
              <Check size={14} />
              {t("common.save") || "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
