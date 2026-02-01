import { useState } from "react";
import { useTranslation } from "react-i18next";
import Modal from "./Modal";
import ConnectionTypeSelector, { ConnectionType } from "./ConnectionTypeSelector";
import ConnectionForm, { SshConnectionConfig } from "./ConnectionForm";
import TelnetConnectionForm from "./TelnetConnectionForm";
import SerialConnectionForm from "./SerialConnectionForm";
import { TelnetConnectionConfig, SerialConnectionConfig } from "../types";

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

  const handleClose = () => {
    setConnectionType("ssh");
    onClose();
  };

  const getTitle = (): string => {
    if (title) return title;
    switch (connectionType) {
      case "ssh":
        return t("app.newSshConnection");
      case "telnet":
        return t("connection.types.newTelnet");
      case "serial":
        return t("connection.types.newSerial");
      default:
        return t("app.newConnection");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={getTitle()} width="md">
      <ConnectionTypeSelector selected={connectionType} onChange={setConnectionType} />

      {connectionType === "ssh" && (
        <ConnectionForm
          onConnect={onSshConnect}
          onCancel={handleClose}
          isConnecting={isConnecting}
          error={error}
          initialConfig={initialSshConfig}
        />
      )}

      {connectionType === "telnet" && (
        <TelnetConnectionForm
          onConnect={onTelnetConnect}
          onCancel={handleClose}
          isConnecting={isConnecting}
          error={error}
          initialConfig={initialTelnetConfig}
        />
      )}

      {connectionType === "serial" && (
        <SerialConnectionForm
          onConnect={onSerialConnect}
          onCancel={handleClose}
          isConnecting={isConnecting}
          error={error}
          initialConfig={initialSerialConfig}
        />
      )}
    </Modal>
  );
}

export default NewConnectionModal;
