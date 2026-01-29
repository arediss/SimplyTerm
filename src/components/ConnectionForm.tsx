import { useState, useEffect } from "react";
import { Key, Lock, Server, User } from "lucide-react";

export interface SshConnectionConfig {
  name: string;
  host: string;
  port: number;
  username: string;
  authType: "password" | "key";
  password?: string;
  keyPath?: string;
  keyPassphrase?: string;
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
  const [name, setName] = useState(initialConfig?.name || "");
  const [host, setHost] = useState(initialConfig?.host || "");
  const [port, setPort] = useState(initialConfig?.port || 22);
  const [username, setUsername] = useState(initialConfig?.username || "");
  const [authType, setAuthType] = useState<"password" | "key">(initialConfig?.authType || "password");
  const [password, setPassword] = useState("");
  const [keyPath, setKeyPath] = useState(initialConfig?.keyPath || "");
  const [keyPassphrase, setKeyPassphrase] = useState("");

  // Update form when initialConfig changes
  useEffect(() => {
    if (initialConfig) {
      setName(initialConfig.name || "");
      setHost(initialConfig.host || "");
      setPort(initialConfig.port || 22);
      setUsername(initialConfig.username || "");
      setAuthType(initialConfig.authType || "password");
      setKeyPath(initialConfig.keyPath || "");
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
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Row 1: Name + Host */}
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Nom (optionnel)">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Mon serveur"
            className="input-field"
          />
        </FormField>
        <FormField label="Hôte" icon={<Server size={12} />}>
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
        <FormField label="Port">
          <input
            type="number"
            value={port}
            onChange={(e) => setPort(parseInt(e.target.value) || 22)}
            min={1}
            max={65535}
            className="input-field"
          />
        </FormField>
        <FormField label="Utilisateur" icon={<User size={12} />}>
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
          Authentification
        </label>
        <div className="flex p-1 bg-crust rounded-lg">
          <AuthTab
            active={authType === "password"}
            onClick={() => setAuthType("password")}
            icon={<Lock size={14} />}
            label="Mot de passe"
          />
          <AuthTab
            active={authType === "key"}
            onClick={() => setAuthType("key")}
            icon={<Key size={14} />}
            label="Clé SSH"
          />
        </div>
      </div>

      {/* Auth Fields */}
      {authType === "password" ? (
        <FormField label="Mot de passe">
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
          <FormField label="Chemin de la clé">
            <input
              type="text"
              value={keyPath}
              onChange={(e) => setKeyPath(e.target.value)}
              placeholder="~/.ssh/id_rsa"
              required
              className="input-field"
            />
          </FormField>
          <FormField label="Passphrase (optionnel)">
            <input
              type="password"
              value={keyPassphrase}
              onChange={(e) => setKeyPassphrase(e.target.value)}
              className="input-field"
            />
          </FormField>
        </div>
      )}

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
          Annuler
        </button>
        <button
          type="submit"
          disabled={isConnecting}
          className="flex-1 py-2.5 bg-accent text-base font-medium text-sm rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isConnecting ? "Connexion..." : "Se connecter"}
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
