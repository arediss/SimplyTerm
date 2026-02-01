import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import {
  Plus,
  Server,
  Trash2,
  Edit2,
  Key,
  Lock,
  User,
  X,
  Check,
} from "lucide-react";
import { BastionProfileInfo } from "../types";

interface BastionManagerProps {
  onBastionsChange?: () => void;
}

export function BastionManager({ onBastionsChange }: BastionManagerProps) {
  const { t } = useTranslation();
  const [bastions, setBastions] = useState<BastionProfileInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formHost, setFormHost] = useState("");
  const [formPort, setFormPort] = useState(22);
  const [formUsername, setFormUsername] = useState("");
  const [formAuthType, setFormAuthType] = useState<"password" | "key">("password");
  const [formPassword, setFormPassword] = useState("");
  const [formKeyPath, setFormKeyPath] = useState("");
  const [formKeyPassphrase, setFormKeyPassphrase] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    loadBastions();
  }, []);

  const loadBastions = async () => {
    try {
      setLoading(true);
      setError(null);
      const list = await invoke<BastionProfileInfo[]>("list_bastions");
      setBastions(list);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormName("");
    setFormHost("");
    setFormPort(22);
    setFormUsername("");
    setFormAuthType("password");
    setFormPassword("");
    setFormKeyPath("");
    setFormKeyPassphrase("");
    setFormError(null);
    setEditingId(null);
  };

  const openCreateForm = () => {
    resetForm();
    setShowForm(true);
  };

  const openEditForm = async (bastion: BastionProfileInfo) => {
    resetForm();
    setFormName(bastion.name);
    setFormHost(bastion.host);
    setFormPort(bastion.port);
    setFormUsername(bastion.username);
    setFormAuthType(bastion.authType);
    setFormKeyPath(bastion.keyPath || "");
    // Passwords are not loaded for security
    setEditingId(bastion.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormLoading(true);

    try {
      if (editingId) {
        // Update existing
        await invoke("update_bastion", {
          id: editingId,
          name: formName || null,
          host: formHost || null,
          port: formPort || null,
          username: formUsername || null,
          authType: formAuthType,
          password: formAuthType === "password" && formPassword ? formPassword : null,
          keyPath: formAuthType === "key" ? formKeyPath : null,
          keyPassphrase: formAuthType === "key" && formKeyPassphrase ? formKeyPassphrase : null,
        });
      } else {
        // Create new
        await invoke("create_bastion", {
          name: formName,
          host: formHost,
          port: formPort,
          username: formUsername,
          authType: formAuthType,
          password: formAuthType === "password" ? formPassword : null,
          keyPath: formAuthType === "key" ? formKeyPath : null,
          keyPassphrase: formAuthType === "key" && formKeyPassphrase ? formKeyPassphrase : null,
        });
      }

      await loadBastions();
      setShowForm(false);
      resetForm();
      onBastionsChange?.();
    } catch (err) {
      setFormError(String(err));
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await invoke("delete_bastion", { id });
      await loadBastions();
      setDeletingId(null);
      onBastionsChange?.();
    } catch (err) {
      setError(String(err));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-text-muted text-sm">
        {t("common.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Add button */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-text-muted">
          {bastions.length === 0
            ? t("settings.bastions.noBastions")
            : t("settings.bastions.count", { count: bastions.length })}
        </div>
        <button
          onClick={openCreateForm}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-accent/20 text-accent rounded-lg hover:bg-accent/30 transition-colors"
        >
          <Plus size={14} />
          {t("settings.bastions.add")}
        </button>
      </div>

      {error && (
        <div className="px-3 py-2 bg-error/10 border border-error/20 rounded-lg text-error text-xs">
          {error}
        </div>
      )}

      {/* Bastion List */}
      {bastions.length > 0 && (
        <div className="space-y-2">
          {bastions.map((bastion) => (
            <div
              key={bastion.id}
              className="flex items-center justify-between p-3 bg-surface-0/30 rounded-lg group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center text-accent shrink-0">
                  <Server size={16} />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-text truncate">
                    {bastion.name}
                  </div>
                  <div className="text-xs text-text-muted truncate">
                    {bastion.username}@{bastion.host}:{bastion.port}
                    <span className="ml-2 opacity-60">
                      {bastion.authType === "password" ? (
                        <Lock size={10} className="inline" />
                      ) : (
                        <Key size={10} className="inline" />
                      )}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => openEditForm(bastion)}
                  className="p-1.5 text-text-muted hover:text-text hover:bg-surface-0 rounded transition-colors"
                  title={t("common.modify")}
                >
                  <Edit2 size={14} />
                </button>
                {deletingId === bastion.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDelete(bastion.id)}
                      className="p-1.5 text-error hover:bg-error/20 rounded transition-colors"
                      title={t("common.confirm")}
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => setDeletingId(null)}
                      className="p-1.5 text-text-muted hover:text-text hover:bg-surface-0 rounded transition-colors"
                      title={t("common.cancel")}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeletingId(bastion.id)}
                    className="p-1.5 text-text-muted hover:text-error hover:bg-error/10 rounded transition-colors"
                    title={t("common.delete")}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Form */}
      {showForm && (
        <div className="border border-surface-0/50 rounded-lg p-4 bg-crust/50">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-medium text-text">
              {editingId ? t("settings.bastions.edit") : t("settings.bastions.create")}
            </h4>
            <button
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
              className="p-1 text-text-muted hover:text-text transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Name */}
            <div>
              <label className="block text-xs text-text-muted mb-1">
                {t("settings.bastions.name")}
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Production Bastion"
                required
                className="input-field"
              />
            </div>

            {/* Host + Port */}
            <div className="grid grid-cols-[1fr_80px] gap-2">
              <div>
                <label className="flex items-center gap-1 text-xs text-text-muted mb-1">
                  <Server size={12} />
                  {t("connection.host")}
                </label>
                <input
                  type="text"
                  value={formHost}
                  onChange={(e) => setFormHost(e.target.value)}
                  placeholder="bastion.example.com"
                  required
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">
                  {t("connection.port")}
                </label>
                <input
                  type="number"
                  value={formPort}
                  onChange={(e) => setFormPort(parseInt(e.target.value) || 22)}
                  min={1}
                  max={65535}
                  className="input-field"
                />
              </div>
            </div>

            {/* Username */}
            <div>
              <label className="flex items-center gap-1 text-xs text-text-muted mb-1">
                <User size={12} />
                {t("connection.username")}
              </label>
              <input
                type="text"
                value={formUsername}
                onChange={(e) => setFormUsername(e.target.value)}
                placeholder="admin"
                required
                className="input-field"
              />
            </div>

            {/* Auth Type */}
            <div>
              <label className="block text-xs text-text-muted mb-1">
                {t("connection.authentication")}
              </label>
              <div className="flex p-1 bg-mantle rounded-lg">
                <button
                  type="button"
                  onClick={() => setFormAuthType("password")}
                  className={`flex-1 py-1.5 px-3 rounded text-xs transition-all flex items-center justify-center gap-1.5 ${
                    formAuthType === "password"
                      ? "bg-surface-0 text-text shadow-sm"
                      : "text-text-muted hover:text-text"
                  }`}
                >
                  <Lock size={12} />
                  {t("connection.password")}
                </button>
                <button
                  type="button"
                  onClick={() => setFormAuthType("key")}
                  className={`flex-1 py-1.5 px-3 rounded text-xs transition-all flex items-center justify-center gap-1.5 ${
                    formAuthType === "key"
                      ? "bg-surface-0 text-text shadow-sm"
                      : "text-text-muted hover:text-text"
                  }`}
                >
                  <Key size={12} />
                  {t("connection.sshKey")}
                </button>
              </div>
            </div>

            {/* Auth Fields */}
            {formAuthType === "password" ? (
              <div>
                <label className="block text-xs text-text-muted mb-1">
                  {t("connection.password")}
                  {editingId && (
                    <span className="ml-1 opacity-60">
                      ({t("settings.bastions.leaveEmptyToKeep")})
                    </span>
                  )}
                </label>
                <input
                  type="password"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  required={!editingId}
                  className="input-field"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <div>
                  <label className="block text-xs text-text-muted mb-1">
                    {t("connection.keyPath")}
                  </label>
                  <input
                    type="text"
                    value={formKeyPath}
                    onChange={(e) => setFormKeyPath(e.target.value)}
                    placeholder="~/.ssh/id_rsa"
                    required
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">
                    {t("connection.passphraseOptional")}
                    {editingId && (
                      <span className="ml-1 opacity-60">
                        ({t("settings.bastions.leaveEmptyToKeep")})
                      </span>
                    )}
                  </label>
                  <input
                    type="password"
                    value={formKeyPassphrase}
                    onChange={(e) => setFormKeyPassphrase(e.target.value)}
                    className="input-field"
                  />
                </div>
              </div>
            )}

            {formError && (
              <div className="px-3 py-2 bg-error/10 border border-error/20 rounded-lg text-error text-xs">
                {formError}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="flex-1 py-2 text-xs bg-surface-0/50 text-text-secondary rounded-lg hover:bg-surface-0 transition-colors"
              >
                {t("common.cancel")}
              </button>
              <button
                type="submit"
                disabled={formLoading}
                className="flex-1 py-2 text-xs bg-accent text-base font-medium rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50"
              >
                {formLoading
                  ? t("common.loading")
                  : editingId
                  ? t("common.save")
                  : t("common.create")}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default BastionManager;
