import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import Modal from "./Modal";
import { SshConnectionConfig } from "./ConnectionForm";
import { ConnectionType } from "./ConnectionTypeSelector";
import { TelnetConnectionConfig, SerialConnectionConfig, SerialPortInfo } from "../types";
import { useSshKeys } from "../hooks/useSshKeys";
import {
  Terminal,
  Wifi,
  Cable,
  Server,
  User,
  Lock,
  Key,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";

export type { ConnectionType };

interface NewConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSshConnect: (config: SshConnectionConfig) => void;
  onTelnetConnect: (config: TelnetConnectionConfig) => void;
  onSerialConnect: (config: SerialConnectionConfig) => void;
  isConnecting?: boolean;
  error?: string;
  initialSshConfig?: Partial<SshConnectionConfig> | null;
  initialTelnetConfig?: Partial<TelnetConnectionConfig> | null;
  initialSerialConfig?: Partial<SerialConnectionConfig> | null;
  initialConnectionType?: ConnectionType;
  title?: string;
}

const BAUD_RATES = [300, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600];
const DATA_BITS: (5 | 6 | 7 | 8)[] = [5, 6, 7, 8];
const STOP_BITS: (1 | 2)[] = [1, 2];
const PARITY_OPTIONS: ("none" | "odd" | "even")[] = ["none", "odd", "even"];
const FLOW_CONTROL_OPTIONS: ("none" | "hardware" | "software")[] = ["none", "hardware", "software"];

export function NewConnectionModal({
  isOpen,
  onClose,
  onSshConnect,
  onTelnetConnect,
  onSerialConnect,
  isConnecting,
  error,
  initialSshConfig,
  initialTelnetConfig,
  initialSerialConfig,
  initialConnectionType = "ssh",
  title,
}: NewConnectionModalProps) {
  const { t } = useTranslation();
  const [connectionType, setConnectionType] = useState<ConnectionType>(initialConnectionType);

  // SSH state
  const [sshName, setSshName] = useState("");
  const [sshHost, setSshHost] = useState("");
  const [sshPort, setSshPort] = useState(22);
  const [sshUsername, setSshUsername] = useState("");
  const [sshAuthType, setSshAuthType] = useState<"password" | "key">("password");
  const [sshPassword, setSshPassword] = useState("");
  const [sshKeyPath, setSshKeyPath] = useState("");
  const [sshKeyPassphrase, setSshKeyPassphrase] = useState("");
  const [sshKeyId, setSshKeyId] = useState<string>("");

  // SSH saved keys from vault
  const { keys: savedSshKeys } = useSshKeys();

  // Telnet state
  const [telnetName, setTelnetName] = useState("");
  const [telnetHost, setTelnetHost] = useState("");
  const [telnetPort, setTelnetPort] = useState(23);

  // Serial state
  const [serialName, setSerialName] = useState("");
  const [serialPort, setSerialPort] = useState("");
  const [baudRate, setBaudRate] = useState(9600);
  const [dataBits, setDataBits] = useState<5 | 6 | 7 | 8>(8);
  const [stopBits, setStopBits] = useState<1 | 2>(1);
  const [parity, setParity] = useState<"none" | "odd" | "even">("none");
  const [flowControl, setFlowControl] = useState<"none" | "hardware" | "software">("none");
  const [availablePorts, setAvailablePorts] = useState<SerialPortInfo[]>([]);
  const [isLoadingPorts, setIsLoadingPorts] = useState(false);


  // Initialize from props
  useEffect(() => {
    if (initialSshConfig) {
      setSshName(initialSshConfig.name || "");
      setSshHost(initialSshConfig.host || "");
      setSshPort(initialSshConfig.port || 22);
      setSshUsername(initialSshConfig.username || "");
      setSshAuthType(initialSshConfig.authType || "password");
      setSshKeyPath(initialSshConfig.keyPath || "");
      setSshKeyId(initialSshConfig.sshKeyId || "");
    }
  }, [initialSshConfig]);

  useEffect(() => {
    if (initialTelnetConfig) {
      setTelnetName(initialTelnetConfig.name || "");
      setTelnetHost(initialTelnetConfig.host || "");
      setTelnetPort(initialTelnetConfig.port || 23);
    }
  }, [initialTelnetConfig]);

  useEffect(() => {
    if (initialSerialConfig) {
      setSerialName(initialSerialConfig.name || "");
      setSerialPort(initialSerialConfig.port || "");
      setBaudRate(initialSerialConfig.baudRate || 9600);
      setDataBits(initialSerialConfig.dataBits || 8);
      setStopBits(initialSerialConfig.stopBits || 1);
      setParity(initialSerialConfig.parity || "none");
      setFlowControl(initialSerialConfig.flowControl || "none");
    }
  }, [initialSerialConfig]);

  // Load serial ports when Serial type is selected
  useEffect(() => {
    if (connectionType === "serial") {
      loadPorts();
    }
  }, [connectionType]);

  const loadPorts = async () => {
    setIsLoadingPorts(true);
    try {
      const ports = await invoke<SerialPortInfo[]>("get_serial_ports");
      setAvailablePorts(ports);
      if (ports.length > 0 && !serialPort) {
        setSerialPort(ports[0].port_name);
      }
    } catch (err) {
      console.error("Failed to load ports:", err);
    } finally {
      setIsLoadingPorts(false);
    }
  };

  const handleClose = () => {
    setConnectionType("ssh");
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    switch (connectionType) {
      case "ssh":
        onSshConnect({
          name: sshName || `${sshUsername}@${sshHost}`,
          host: sshHost,
          port: sshPort,
          username: sshUsername,
          authType: sshAuthType,
          password: sshAuthType === "password" ? sshPassword : undefined,
          keyPath: sshAuthType === "key" && !sshKeyId ? sshKeyPath : undefined,
          keyPassphrase: sshAuthType === "key" && !sshKeyId ? sshKeyPassphrase : undefined,
          sshKeyId: sshAuthType === "key" && sshKeyId ? sshKeyId : undefined,
        });
        break;
      case "telnet":
        onTelnetConnect({
          name: telnetName || telnetHost,
          host: telnetHost,
          port: telnetPort,
        });
        break;
      case "serial":
        onSerialConnect({
          name: serialName || serialPort,
          port: serialPort,
          baudRate,
          dataBits,
          stopBits,
          parity,
          flowControl,
        });
        break;
    }
  };

  const getPortDescription = (portInfo: SerialPortInfo): string => {
    const parts: string[] = [];
    if (portInfo.product) parts.push(portInfo.product);
    if (portInfo.manufacturer) parts.push(`(${portInfo.manufacturer})`);
    if (parts.length === 0) parts.push(portInfo.port_type);
    return parts.join(" ");
  };

  const modalTitle = title || t("app.newConnection");

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={modalTitle} width="2xl">
      <form onSubmit={handleSubmit} className="flex flex-col min-h-[380px]">
        {/* Connection type tabs */}
        <div className="flex gap-1 p-1 bg-crust rounded-xl mb-5">
          <button
            type="button"
            onClick={() => setConnectionType("ssh")}
            className={`
              flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200
              ${connectionType === "ssh"
                ? "bg-surface-0 text-text shadow-sm"
                : "text-text-muted hover:text-text hover:bg-surface-0/50"
              }
            `}
          >
            <Terminal size={14} />
            {t("connection.types.ssh")}
          </button>
          <button
            type="button"
            onClick={() => setConnectionType("telnet")}
            className={`
              flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200
              ${connectionType === "telnet"
                ? "bg-surface-0 text-text shadow-sm"
                : "text-text-muted hover:text-text hover:bg-surface-0/50"
              }
            `}
          >
            <Wifi size={14} />
            {t("connection.types.telnet")}
          </button>
          <button
            type="button"
            onClick={() => setConnectionType("serial")}
            className={`
              flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200
              ${connectionType === "serial"
                ? "bg-surface-0 text-text shadow-sm"
                : "text-text-muted hover:text-text hover:bg-surface-0/50"
              }
            `}
          >
            <Cable size={14} />
            {t("connection.types.serial")}
          </button>
        </div>

        {/* Form content */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto">
            {connectionType === "ssh" && (
              <SshFormContent
                name={sshName}
                setName={setSshName}
                host={sshHost}
                setHost={setSshHost}
                port={sshPort}
                setPort={setSshPort}
                username={sshUsername}
                setUsername={setSshUsername}
                authType={sshAuthType}
                setAuthType={setSshAuthType}
                password={sshPassword}
                setPassword={setSshPassword}
                keyPath={sshKeyPath}
                setKeyPath={setSshKeyPath}
                keyPassphrase={sshKeyPassphrase}
                setKeyPassphrase={setSshKeyPassphrase}
                sshKeyId={sshKeyId}
                setSshKeyId={setSshKeyId}
                savedSshKeys={savedSshKeys}
              />
            )}

            {connectionType === "telnet" && (
              <TelnetFormContent
                name={telnetName}
                setName={setTelnetName}
                host={telnetHost}
                setHost={setTelnetHost}
                port={telnetPort}
                setPort={setTelnetPort}
              />
            )}

            {connectionType === "serial" && (
              <SerialFormContent
                name={serialName}
                setName={setSerialName}
                port={serialPort}
                setPort={setSerialPort}
                baudRate={baudRate}
                setBaudRate={setBaudRate}
                dataBits={dataBits}
                setDataBits={setDataBits}
                stopBits={stopBits}
                setStopBits={setStopBits}
                parity={parity}
                setParity={setParity}
                flowControl={flowControl}
                setFlowControl={setFlowControl}
                availablePorts={availablePorts}
                isLoadingPorts={isLoadingPorts}
                onRefreshPorts={loadPorts}
                getPortDescription={getPortDescription}
              />
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="mt-3 px-3 py-2 bg-error/10 border border-error/20 rounded-lg text-error text-xs">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 mt-3 border-t border-surface-0/50">
            <button
              type="button"
              onClick={handleClose}
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
        </div>
      </form>
    </Modal>
  );
}

// Form field component
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

// Auth type tabs
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

// SSH Form Content
interface SshFormContentProps {
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
  savedSshKeys: import("../types").SshKeyProfileInfo[];
}

function SshFormContent(props: SshFormContentProps) {
  const { t } = useTranslation();

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
                    // Clear manual key fields when selecting a saved key
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
          {props.sshKeyId && (() => {
            const selectedKey = props.savedSshKeys.find(k => k.id === props.sshKeyId);
            if (!selectedKey) return null;
            return (
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
            );
          })()}
        </>
      )}

    </div>
  );
}

// Telnet Form Content
interface TelnetFormContentProps {
  name: string;
  setName: (v: string) => void;
  host: string;
  setHost: (v: string) => void;
  port: number;
  setPort: (v: number) => void;
}

function TelnetFormContent(props: TelnetFormContentProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-3">
      {/* Warning */}
      <div className="flex items-start gap-2 px-3 py-2 bg-warning/10 border border-warning/20 rounded-lg">
        <AlertTriangle size={14} className="text-warning shrink-0 mt-0.5" />
        <p className="text-xs text-warning">{t("connection.telnetWarning")}</p>
      </div>

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
            value={props.port}
            onChange={(e) => props.setPort(parseInt(e.target.value) || 23)}
            min={1}
            max={65535}
            className="input-field"
          />
        </FormField>
        <div />
      </div>
    </div>
  );
}

// Serial Form Content
interface SerialFormContentProps {
  name: string;
  setName: (v: string) => void;
  port: string;
  setPort: (v: string) => void;
  baudRate: number;
  setBaudRate: (v: number) => void;
  dataBits: 5 | 6 | 7 | 8;
  setDataBits: (v: 5 | 6 | 7 | 8) => void;
  stopBits: 1 | 2;
  setStopBits: (v: 1 | 2) => void;
  parity: "none" | "odd" | "even";
  setParity: (v: "none" | "odd" | "even") => void;
  flowControl: "none" | "hardware" | "software";
  setFlowControl: (v: "none" | "hardware" | "software") => void;
  availablePorts: SerialPortInfo[];
  isLoadingPorts: boolean;
  onRefreshPorts: () => void;
  getPortDescription: (p: SerialPortInfo) => string;
}

function SerialFormContent(props: SerialFormContentProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-3">
      {/* Row 1: Name + Port */}
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
        <FormField
          label={t("connection.serial.port")}
          icon={<Cable size={12} />}
          action={
            <button
              type="button"
              onClick={props.onRefreshPorts}
              disabled={props.isLoadingPorts}
              className="p-0.5 text-text-muted hover:text-text transition-colors"
              title={t("common.refresh")}
            >
              <RefreshCw size={12} className={props.isLoadingPorts ? "animate-spin" : ""} />
            </button>
          }
        >
          <select
            value={props.port}
            onChange={(e) => props.setPort(e.target.value)}
            required
            className="input-field"
          >
            {props.availablePorts.length === 0 ? (
              <option value="">{t("connection.serial.noPorts")}</option>
            ) : (
              props.availablePorts.map((p) => (
                <option key={p.port_name} value={p.port_name}>
                  {p.port_name} - {props.getPortDescription(p)}
                </option>
              ))
            )}
          </select>
        </FormField>
      </div>

      {/* Row 2: Baud Rate + Data Bits */}
      <div className="grid grid-cols-2 gap-3">
        <FormField label={t("connection.serial.baudRate")}>
          <select
            value={props.baudRate}
            onChange={(e) => props.setBaudRate(parseInt(e.target.value))}
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
            value={props.dataBits}
            onChange={(e) => props.setDataBits(parseInt(e.target.value) as 5 | 6 | 7 | 8)}
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
            value={props.stopBits}
            onChange={(e) => props.setStopBits(parseInt(e.target.value) as 1 | 2)}
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
            value={props.parity}
            onChange={(e) => props.setParity(e.target.value as "none" | "odd" | "even")}
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
            value={props.flowControl}
            onChange={(e) =>
              props.setFlowControl(e.target.value as "none" | "hardware" | "software")
            }
            className="input-field"
          >
            {FLOW_CONTROL_OPTIONS.map((fc) => (
              <option key={fc} value={fc}>
                {t(`connection.serial.flow${fc.charAt(0).toUpperCase() + fc.slice(1)}`)}
              </option>
            ))}
          </select>
        </FormField>
        <div />
      </div>
    </div>
  );
}

export default NewConnectionModal;
