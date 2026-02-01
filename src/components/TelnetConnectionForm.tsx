import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Server, AlertTriangle } from "lucide-react";
import { TelnetConnectionConfig } from "../types";

interface TelnetConnectionFormProps {
  onConnect: (config: TelnetConnectionConfig) => void;
  onCancel: () => void;
  isConnecting?: boolean;
  error?: string;
  initialConfig?: Partial<TelnetConnectionConfig> | null;
}

export function TelnetConnectionForm({
  onConnect,
  onCancel,
  isConnecting,
  error,
  initialConfig,
}: TelnetConnectionFormProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(initialConfig?.name || "");
  const [host, setHost] = useState(initialConfig?.host || "");
  const [port, setPort] = useState(initialConfig?.port || 23);

  useEffect(() => {
    if (initialConfig) {
      setName(initialConfig.name || "");
      setHost(initialConfig.host || "");
      setPort(initialConfig.port || 23);
    }
  }, [initialConfig]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConnect({
      name: name || host,
      host,
      port,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Warning about unencrypted connection */}
      <div className="flex items-start gap-2 px-3 py-2 bg-warning/10 border border-warning/20 rounded-lg">
        <AlertTriangle size={14} className="text-warning shrink-0 mt-0.5" />
        <p className="text-xs text-warning">
          {t("connection.telnetWarning")}
        </p>
      </div>

      {/* Row 1: Name + Host */}
      <div className="grid grid-cols-2 gap-3">
        <FormField label={t("connection.nameOptional")}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("connection.namePlaceholder")}
            className="input-field"
          />
        </FormField>
        <FormField label={t("connection.host")} icon={<Server size={12} />}>
          <input
            type="text"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="towel.blinkenlights.nl"
            required
            className="input-field"
          />
        </FormField>
      </div>

      {/* Row 2: Port */}
      <div className="grid grid-cols-2 gap-3">
        <FormField label={t("connection.port")}>
          <input
            type="number"
            value={port}
            onChange={(e) => setPort(parseInt(e.target.value) || 23)}
            min={1}
            max={65535}
            className="input-field"
          />
        </FormField>
        <div /> {/* Empty cell for alignment */}
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
          {t("common.cancel")}
        </button>
        <button
          type="submit"
          disabled={isConnecting}
          className="flex-1 py-2.5 bg-accent text-base font-medium text-sm rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isConnecting ? t("connection.connecting") : t("connection.connect")}
        </button>
      </div>
    </form>
  );
}

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

export default TelnetConnectionForm;
