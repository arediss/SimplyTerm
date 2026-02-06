import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Key, Lock, Server, User, ChevronDown, ChevronRight } from "lucide-react";

export interface SshConnectionConfig {
  name: string;
  host: string;
  port: number;
  username: string;
  authType: "password" | "key";
  password?: string;
  keyPath?: string;
  keyPassphrase?: string;
  // SSH key profile ID (when using a saved key from vault)
  sshKeyId?: string;
  // Jump host (bastion) configuration
  useJumpHost?: boolean;
  jumpHost?: string;
  jumpPort?: number;
  jumpUsername?: string;
  jumpAuthType?: "password" | "key";
  jumpPassword?: string;
  jumpKeyPath?: string;
  jumpKeyPassphrase?: string;
}

interface ConnectionFormProps {
  onConnect: (config: SshConnectionConfig) => void;
  onCancel: () => void;
  isConnecting?: boolean;
  error?: string;
  initialConfig?: Partial<SshConnectionConfig> | null;
}

function ConnectionForm({
  onConnect,
  onCancel,
  isConnecting,
  error,
  initialConfig,
}: ConnectionFormProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(initialConfig?.name || "");
  const [host, setHost] = useState(initialConfig?.host || "");
  const [port, setPort] = useState(initialConfig?.port || 22);
  const [username, setUsername] = useState(initialConfig?.username || "");
  const [authType, setAuthType] = useState<"password" | "key">(initialConfig?.authType || "password");
  const [password, setPassword] = useState("");
  const [keyPath, setKeyPath] = useState(initialConfig?.keyPath || "");
  const [keyPassphrase, setKeyPassphrase] = useState("");

  // Jump host states
  const [useJumpHost, setUseJumpHost] = useState(initialConfig?.useJumpHost || false);
  const [jumpHost, setJumpHost] = useState(initialConfig?.jumpHost || "");
  const [jumpPort, setJumpPort] = useState(initialConfig?.jumpPort || 22);
  const [jumpUsername, setJumpUsername] = useState(initialConfig?.jumpUsername || "");
  const [jumpAuthType, setJumpAuthType] = useState<"password" | "key">(initialConfig?.jumpAuthType || "password");
  const [jumpPassword, setJumpPassword] = useState("");
  const [jumpKeyPath, setJumpKeyPath] = useState(initialConfig?.jumpKeyPath || "");
  const [jumpKeyPassphrase, setJumpKeyPassphrase] = useState("");

  // Update form when initialConfig changes
  useEffect(() => {
    if (initialConfig) {
      setName(initialConfig.name || "");
      setHost(initialConfig.host || "");
      setPort(initialConfig.port || 22);
      setUsername(initialConfig.username || "");
      setAuthType(initialConfig.authType || "password");
      setKeyPath(initialConfig.keyPath || "");
      // Jump host
      setUseJumpHost(initialConfig.useJumpHost || false);
      setJumpHost(initialConfig.jumpHost || "");
      setJumpPort(initialConfig.jumpPort || 22);
      setJumpUsername(initialConfig.jumpUsername || "");
      setJumpAuthType(initialConfig.jumpAuthType || "password");
      setJumpKeyPath(initialConfig.jumpKeyPath || "");
      // Don't set password/passphrase - user needs to enter them
    }
  }, [initialConfig]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConnect({
      name: name || `${username}@${host}`,
      host,
      port,
      username,
      authType,
      password: authType === "password" ? password : undefined,
      keyPath: authType === "key" ? keyPath : undefined,
      keyPassphrase: authType === "key" ? keyPassphrase : undefined,
      // Jump host configuration
      useJumpHost,
      jumpHost: useJumpHost ? jumpHost : undefined,
      jumpPort: useJumpHost ? jumpPort : undefined,
      jumpUsername: useJumpHost ? (jumpUsername || username) : undefined,
      jumpAuthType: useJumpHost ? jumpAuthType : undefined,
      jumpPassword: useJumpHost && jumpAuthType === "password" ? jumpPassword : undefined,
      jumpKeyPath: useJumpHost && jumpAuthType === "key" ? jumpKeyPath : undefined,
      jumpKeyPassphrase: useJumpHost && jumpAuthType === "key" ? jumpKeyPassphrase : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Row 1: Name + Host */}
      <div className="grid grid-cols-2 gap-3">
        <FormField label={t('connection.nameOptional')}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('connection.namePlaceholder')}
            className="input-field"
          />
        </FormField>
        <FormField label={t('connection.host')} icon={<Server size={12} />}>
          <input
            type="text"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="192.168.1.1"
            required
            className="input-field"
          />
        </FormField>
      </div>

      {/* Row 2: Port + Username */}
      <div className="grid grid-cols-2 gap-3">
        <FormField label={t('connection.port')}>
          <input
            type="number"
            value={port}
            onChange={(e) => setPort(parseInt(e.target.value) || 22)}
            min={1}
            max={65535}
            className="input-field"
          />
        </FormField>
        <FormField label={t('connection.username')} icon={<User size={12} />}>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="root"
            required
            className="input-field"
          />
        </FormField>
      </div>

      {/* Auth Type Tabs */}
      <div>
        <label className="block text-xs text-text-muted mb-2">
          {t('connection.authentication')}
        </label>
        <div className="flex p-1 bg-crust rounded-lg">
          <AuthTab
            active={authType === "password"}
            onClick={() => setAuthType("password")}
            icon={<Lock size={14} />}
            label={t('connection.password')}
          />
          <AuthTab
            active={authType === "key"}
            onClick={() => setAuthType("key")}
            icon={<Key size={14} />}
            label={t('connection.sshKey')}
          />
        </div>
      </div>

      {/* Auth Fields */}
      {authType === "password" ? (
        <FormField label={t('connection.password')}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="input-field"
          />
        </FormField>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <FormField label={t('connection.keyPath')}>
            <input
              type="text"
              value={keyPath}
              onChange={(e) => setKeyPath(e.target.value)}
              placeholder="~/.ssh/id_rsa"
              required
              className="input-field"
            />
          </FormField>
          <FormField label={t('connection.passphraseOptional')}>
            <input
              type="password"
              value={keyPassphrase}
              onChange={(e) => setKeyPassphrase(e.target.value)}
              className="input-field"
            />
          </FormField>
        </div>
      )}

      {/* Jump Host (Bastion) */}
      <div className="border-t border-surface-0/50 pt-3">
        <button
          type="button"
          onClick={() => setUseJumpHost(!useJumpHost)}
          className="flex items-center gap-2 text-xs text-text-muted hover:text-text transition-colors"
        >
          {useJumpHost ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          {t('connection.jumpHost.title')}
        </button>

        {useJumpHost && (
          <div className="mt-3 pl-4 border-l-2 border-accent/30 flex flex-col gap-3">
            {/* Jump Host + Port */}
            <div className="grid grid-cols-2 gap-3">
              <FormField label={t('connection.jumpHost.host')} icon={<Server size={12} />}>
                <input
                  type="text"
                  value={jumpHost}
                  onChange={(e) => setJumpHost(e.target.value)}
                  placeholder="bastion.example.com"
                  required
                  className="input-field"
                />
              </FormField>
              <FormField label={t('connection.jumpHost.port')}>
                <input
                  type="number"
                  value={jumpPort}
                  onChange={(e) => setJumpPort(parseInt(e.target.value) || 22)}
                  min={1}
                  max={65535}
                  className="input-field"
                />
              </FormField>
            </div>

            {/* Jump Username */}
            <FormField label={t('connection.jumpHost.username')} icon={<User size={12} />}>
              <input
                type="text"
                value={jumpUsername}
                onChange={(e) => setJumpUsername(e.target.value)}
                placeholder={username || t('connection.jumpHost.sameAsDestination')}
                className="input-field"
              />
            </FormField>

            {/* Jump Auth Type */}
            <div>
              <label className="block text-xs text-text-muted mb-2">
                {t('connection.authentication')}
              </label>
              <div className="flex p-1 bg-crust rounded-lg">
                <AuthTab
                  active={jumpAuthType === "password"}
                  onClick={() => setJumpAuthType("password")}
                  icon={<Lock size={14} />}
                  label={t('connection.password')}
                />
                <AuthTab
                  active={jumpAuthType === "key"}
                  onClick={() => setJumpAuthType("key")}
                  icon={<Key size={14} />}
                  label={t('connection.sshKey')}
                />
              </div>
            </div>

            {/* Jump Auth Fields */}
            {jumpAuthType === "password" ? (
              <FormField label={t('connection.password')}>
                <input
                  type="password"
                  value={jumpPassword}
                  onChange={(e) => setJumpPassword(e.target.value)}
                  required
                  className="input-field"
                />
              </FormField>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <FormField label={t('connection.keyPath')}>
                  <input
                    type="text"
                    value={jumpKeyPath}
                    onChange={(e) => setJumpKeyPath(e.target.value)}
                    placeholder="~/.ssh/id_rsa"
                    required
                    className="input-field"
                  />
                </FormField>
                <FormField label={t('connection.passphraseOptional')}>
                  <input
                    type="password"
                    value={jumpKeyPassphrase}
                    onChange={(e) => setJumpKeyPassphrase(e.target.value)}
                    className="input-field"
                  />
                </FormField>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="px-3 py-2 bg-error/10 border border-error/20 rounded-lg text-error text-xs">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2.5 bg-surface-0/50 text-text-secondary text-sm rounded-lg hover:bg-surface-0 transition-colors"
        >
          {t('common.cancel')}
        </button>
        <button
          type="submit"
          disabled={isConnecting}
          className="flex-1 py-2.5 bg-accent text-base font-medium text-sm rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isConnecting ? t('connection.connecting') : t('connection.connect')}
        </button>
      </div>
    </form>
  );
}

// Sous-composants

interface FormFieldProps {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

function FormField({ label, icon, children }: FormFieldProps) {
  return (
    <div>
      <label className="flex items-center gap-1 text-xs text-text-muted mb-1.5">
        {icon}
        {label}
      </label>
      {children}
    </div>
  );
}

interface AuthTabProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

function AuthTab({ active, onClick, icon, label }: AuthTabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        flex-1 py-2 px-3 rounded-md text-xs transition-all flex items-center justify-center gap-2
        ${active ? "bg-surface-0 text-text shadow-sm" : "text-text-muted hover:text-text"}
      `}
    >
      {icon}
      {label}
    </button>
  );
}

export default ConnectionForm;
