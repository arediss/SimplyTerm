import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FormField } from "../FormField";
import { Server, User, Lock, Key } from "lucide-react";
import type { SshKeyProfileInfo } from "../../types";

// Auth type tabs (internal helper)
function AuthTab({ active, onClick, icon, label }: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        flex-1 py-2 px-3 rounded-md text-xs transition-colors flex items-center justify-center gap-2
        ${active ? "bg-surface-0 text-text shadow-sm" : "text-text-muted hover:text-text"}
      `}
    >
      {icon}
      {label}
    </button>
  );
}

export interface SshFormContentProps {
  name: string;
  setName: (v: string) => void;
  host: string;
  setHost: (v: string) => void;
  port: number;
  setPort: (v: number) => void;
  username: string;
  setUsername: (v: string) => void;
  authType: "password" | "key";
  setAuthType: (v: "password" | "key") => void;
  password: string;
  setPassword: (v: string) => void;
  keyPath: string;
  setKeyPath: (v: string) => void;
  keyPassphrase: string;
  setKeyPassphrase: (v: string) => void;
  sshKeyId: string;
  setSshKeyId: (v: string) => void;
  savedSshKeys: SshKeyProfileInfo[];
}

export const SshFormContent = memo(function SshFormContent(props: SshFormContentProps) {
  const { t } = useTranslation();
  const selectedKey = useMemo(
    () => props.sshKeyId ? props.savedSshKeys.find(k => k.id === props.sshKeyId) : null,
    [props.sshKeyId, props.savedSshKeys]
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Row 1: Name + Host */}
      <div className="grid grid-cols-2 gap-3">
        <FormField label={t("connection.nameOptional")}>
          <input
            type="text"
            value={props.name}
            onChange={(e) => props.setName(e.target.value)}
            placeholder={t("connection.namePlaceholder")}
            className="input-field"
          />
        </FormField>
        <FormField label={t("connection.host")} icon={<Server size={12} />}>
          <input
            type="text"
            value={props.host}
            onChange={(e) => props.setHost(e.target.value)}
            placeholder="192.168.1.1"
            required
            className="input-field"
          />
        </FormField>
      </div>

      {/* Row 2: Port + Username */}
      <div className="grid grid-cols-2 gap-3">
        <FormField label={t("connection.port")}>
          <input
            type="number"
            value={props.port}
            onChange={(e) => props.setPort(parseInt(e.target.value) || 22)}
            min={1}
            max={65535}
            className="input-field"
          />
        </FormField>
        <FormField label={t("connection.username")} icon={<User size={12} />}>
          <input
            type="text"
            value={props.username}
            onChange={(e) => props.setUsername(e.target.value)}
            placeholder="root"
            required
            className="input-field"
          />
        </FormField>
      </div>

      {/* Auth Type Tabs */}
      <div>
        <label className="block text-xs text-text-muted mb-2">
          {t("connection.authentication")}
        </label>
        <div className="flex p-1 bg-crust rounded-lg">
          <AuthTab
            active={props.authType === "password"}
            onClick={() => props.setAuthType("password")}
            icon={<Lock size={14} />}
            label={t("connection.password")}
          />
          <AuthTab
            active={props.authType === "key"}
            onClick={() => props.setAuthType("key")}
            icon={<Key size={14} />}
            label={t("connection.sshKey")}
          />
        </div>
      </div>

      {/* Auth Fields */}
      {props.authType === "password" ? (
        <FormField label={t("connection.password")}>
          <input
            type="password"
            value={props.password}
            onChange={(e) => props.setPassword(e.target.value)}
            required
            className="input-field"
          />
        </FormField>
      ) : (
        <>
          {/* SSH Key selection: saved keys dropdown or custom */}
          {props.savedSshKeys.length > 0 && (
            <FormField label={t("settings.security.sshKeysSelectKey")} icon={<Key size={12} />}>
              <select
                value={props.sshKeyId}
                onChange={(e) => {
                  props.setSshKeyId(e.target.value);
                  if (e.target.value) {
                    props.setKeyPath("");
                    props.setKeyPassphrase("");
                  }
                }}
                className="input-field"
              >
                <option value="">{t("settings.security.sshKeysCustomKey")}</option>
                {props.savedSshKeys.map((key) => (
                  <option key={key.id} value={key.id}>
                    {key.name} ({key.keyPath})
                  </option>
                ))}
              </select>
            </FormField>
          )}

          {/* Show manual key path/passphrase only when "Custom key" is selected */}
          {!props.sshKeyId && (
            <div className="grid grid-cols-2 gap-3">
              <FormField label={t("connection.keyPath")}>
                <input
                  type="text"
                  value={props.keyPath}
                  onChange={(e) => props.setKeyPath(e.target.value)}
                  placeholder="~/.ssh/id_rsa"
                  required
                  className="input-field"
                />
              </FormField>
              <FormField label={t("connection.passphraseOptional")}>
                <input
                  type="password"
                  value={props.keyPassphrase}
                  onChange={(e) => props.setKeyPassphrase(e.target.value)}
                  className="input-field"
                />
              </FormField>
            </div>
          )}

          {/* Show selected key info when a saved key is chosen */}
          {selectedKey && (
              <div className="px-3 py-2 bg-surface-0/30 rounded-lg text-xs text-text-muted space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-text-muted">{t("settings.security.sshKeysKeyPath")}:</span>
                  <span className="text-text">{selectedKey.keyPath}</span>
                </div>
                {selectedKey.requirePassphrasePrompt && (
                  <div className="text-warning text-[10px]">
                    {t("settings.security.sshKeysAlwaysAskPassphrase")}
                  </div>
                )}
              </div>
          )}
        </>
      )}

    </div>
  );
});
