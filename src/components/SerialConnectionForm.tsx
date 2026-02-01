import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { Cable, RefreshCw } from "lucide-react";
import { SerialConnectionConfig, SerialPortInfo } from "../types";

interface SerialConnectionFormProps {
  onConnect: (config: SerialConnectionConfig) => void;
  onCancel: () => void;
  isConnecting?: boolean;
  error?: string;
  initialConfig?: Partial<SerialConnectionConfig> | null;
}

const BAUD_RATES = [300, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600];
const DATA_BITS: (5 | 6 | 7 | 8)[] = [5, 6, 7, 8];
const STOP_BITS: (1 | 2)[] = [1, 2];
const PARITY_OPTIONS: ("none" | "odd" | "even")[] = ["none", "odd", "even"];
const FLOW_CONTROL_OPTIONS: ("none" | "hardware" | "software")[] = ["none", "hardware", "software"];

export function SerialConnectionForm({
  onConnect,
  onCancel,
  isConnecting,
  error,
  initialConfig,
}: SerialConnectionFormProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(initialConfig?.name || "");
  const [port, setPort] = useState(initialConfig?.port || "");
  const [baudRate, setBaudRate] = useState(initialConfig?.baudRate || 9600);
  const [dataBits, setDataBits] = useState<5 | 6 | 7 | 8>(initialConfig?.dataBits || 8);
  const [stopBits, setStopBits] = useState<1 | 2>(initialConfig?.stopBits || 1);
  const [parity, setParity] = useState<"none" | "odd" | "even">(initialConfig?.parity || "none");
  const [flowControl, setFlowControl] = useState<"none" | "hardware" | "software">(
    initialConfig?.flowControl || "none"
  );

  const [availablePorts, setAvailablePorts] = useState<SerialPortInfo[]>([]);
  const [isLoadingPorts, setIsLoadingPorts] = useState(false);
  const [portsError, setPortsError] = useState<string | null>(null);

  // Load available ports on mount
  useEffect(() => {
    loadPorts();
  }, []);

  useEffect(() => {
    if (initialConfig) {
      setName(initialConfig.name || "");
      setPort(initialConfig.port || "");
      setBaudRate(initialConfig.baudRate || 9600);
      setDataBits(initialConfig.dataBits || 8);
      setStopBits(initialConfig.stopBits || 1);
      setParity(initialConfig.parity || "none");
      setFlowControl(initialConfig.flowControl || "none");
    }
  }, [initialConfig]);

  const loadPorts = async () => {
    setIsLoadingPorts(true);
    setPortsError(null);
    try {
      const ports = await invoke<SerialPortInfo[]>("get_serial_ports");
      setAvailablePorts(ports);
      // Auto-select first port if none selected
      if (ports.length > 0 && !port) {
        setPort(ports[0].port_name);
      }
    } catch (err) {
      setPortsError(String(err));
    } finally {
      setIsLoadingPorts(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConnect({
      name: name || port,
      port,
      baudRate,
      dataBits,
      stopBits,
      parity,
      flowControl,
    });
  };

  const getPortDescription = (portInfo: SerialPortInfo): string => {
    const parts: string[] = [];
    if (portInfo.product) parts.push(portInfo.product);
    if (portInfo.manufacturer) parts.push(`(${portInfo.manufacturer})`);
    if (parts.length === 0) parts.push(portInfo.port_type);
    return parts.join(" ");
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Row 1: Name + Port selector */}
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
        <FormField
          label={t("connection.serial.port")}
          icon={<Cable size={12} />}
          action={
            <button
              type="button"
              onClick={loadPorts}
              disabled={isLoadingPorts}
              className="p-0.5 text-text-muted hover:text-text transition-colors"
              title={t("common.refresh")}
            >
              <RefreshCw size={12} className={isLoadingPorts ? "animate-spin" : ""} />
            </button>
          }
        >
          <select
            value={port}
            onChange={(e) => setPort(e.target.value)}
            required
            className="input-field"
          >
            {availablePorts.length === 0 ? (
              <option value="">{t("connection.serial.noPorts")}</option>
            ) : (
              availablePorts.map((p) => (
                <option key={p.port_name} value={p.port_name}>
                  {p.port_name} - {getPortDescription(p)}
                </option>
              ))
            )}
          </select>
        </FormField>
      </div>

      {portsError && (
        <div className="px-3 py-2 bg-error/10 border border-error/20 rounded-lg text-error text-xs">
          {portsError}
        </div>
      )}

      {/* Row 2: Baud Rate + Data Bits */}
      <div className="grid grid-cols-2 gap-3">
        <FormField label={t("connection.serial.baudRate")}>
          <select
            value={baudRate}
            onChange={(e) => setBaudRate(parseInt(e.target.value))}
            className="input-field"
          >
            {BAUD_RATES.map((rate) => (
              <option key={rate} value={rate}>
                {rate}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label={t("connection.serial.dataBits")}>
          <select
            value={dataBits}
            onChange={(e) => setDataBits(parseInt(e.target.value) as 5 | 6 | 7 | 8)}
            className="input-field"
          >
            {DATA_BITS.map((bits) => (
              <option key={bits} value={bits}>
                {bits}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      {/* Row 3: Stop Bits + Parity */}
      <div className="grid grid-cols-2 gap-3">
        <FormField label={t("connection.serial.stopBits")}>
          <select
            value={stopBits}
            onChange={(e) => setStopBits(parseInt(e.target.value) as 1 | 2)}
            className="input-field"
          >
            {STOP_BITS.map((bits) => (
              <option key={bits} value={bits}>
                {bits}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label={t("connection.serial.parity")}>
          <select
            value={parity}
            onChange={(e) => setParity(e.target.value as "none" | "odd" | "even")}
            className="input-field"
          >
            {PARITY_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {t(`connection.serial.parity${p.charAt(0).toUpperCase() + p.slice(1)}`)}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      {/* Row 4: Flow Control */}
      <div className="grid grid-cols-2 gap-3">
        <FormField label={t("connection.serial.flowControl")}>
          <select
            value={flowControl}
            onChange={(e) => setFlowControl(e.target.value as "none" | "hardware" | "software")}
            className="input-field"
          >
            {FLOW_CONTROL_OPTIONS.map((fc) => (
              <option key={fc} value={fc}>
                {t(`connection.serial.flow${fc.charAt(0).toUpperCase() + fc.slice(1)}`)}
              </option>
            ))}
          </select>
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
          disabled={isConnecting || !port}
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
  action?: React.ReactNode;
  children: React.ReactNode;
}

function FormField({ label, icon, action, children }: FormFieldProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="flex items-center gap-1 text-xs text-text-muted">
          {icon}
          {label}
        </label>
        {action}
      </div>
      {children}
    </div>
  );
}

export default SerialConnectionForm;
