import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import Modal from "./Modal";
import { SshConnectionConfig, ConnectionType, TelnetConnectionConfig, SerialConnectionConfig, SerialPortInfo } from "../types";
import { useSshKeys } from "../hooks/useSshKeys";
import { Terminal, Wifi, Cable } from "lucide-react";
import { SshFormContent } from "./Connection/SshConnectionForm";
import { TelnetFormContent } from "./Connection/TelnetConnectionForm";
import { SerialFormContent } from "./Connection/SerialConnectionForm";

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
    if (connectionType !== "serial") return;
    let active = true;
    (async () => {
      setIsLoadingPorts(true);
      try {
        const ports = await invoke<SerialPortInfo[]>("get_serial_ports");
        if (!active) return;
        setAvailablePorts(ports);
        if (ports.length > 0 && !serialPort) {
          setSerialPort(ports[0].port_name);
        }
      } catch (err) {
        console.error("Failed to load ports:", err);
      } finally {
        if (active) setIsLoadingPorts(false);
      }
    })();
    return () => { active = false; };
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
              flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors duration-200
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
              flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors duration-200
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
              flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors duration-200
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

export default NewConnectionModal;
