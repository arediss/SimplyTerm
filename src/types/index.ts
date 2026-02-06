import { SshConnectionConfig } from "../components/ConnectionForm";
import { PaneNode } from "../components/SplitPane";

export interface Session {
  id: string;
  name: string;
  type: "ssh" | "local" | "sftp" | "telnet" | "serial";
  host?: string;
  user?: string;
  status: "connected" | "disconnected" | "connecting";
}

// Telnet connection configuration
export interface TelnetConnectionConfig {
  name: string;
  host: string;
  port: number;
}

// Serial/COM connection configuration
export interface SerialConnectionConfig {
  name: string;
  port: string;
  baudRate: number;
  dataBits: 5 | 6 | 7 | 8;
  stopBits: 1 | 2;
  parity: "none" | "odd" | "even";
  flowControl: "none" | "hardware" | "software";
}

// Serial port information from backend
export interface SerialPortInfo {
  port_name: string;
  port_type: string;
  manufacturer: string | null;
  product: string | null;
}

// Bastion/Jump Host profile stored in vault
export interface BastionProfile {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: "password" | "key";
  password?: string;
  keyPath?: string;
  keyPassphrase?: string;
  createdAt: number;
  updatedAt: number;
}

// Bastion profile info (without sensitive data)
export interface BastionProfileInfo {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: "password" | "key";
  hasPassword: boolean;
  keyPath?: string;
  hasKeyPassphrase: boolean;
  createdAt: number;
  updatedAt: number;
}

// SSH key profile info (without sensitive data)
export interface SshKeyProfileInfo {
  id: string;
  name: string;
  keyPath: string;
  hasPassphrase: boolean;
  requirePassphrasePrompt: boolean;
  createdAt: number;
  updatedAt: number;
}

// SSH key profile with credentials (for connection use)
export interface SshKeyProfile {
  id: string;
  name: string;
  key_path: string;
  passphrase?: string;
  require_passphrase_prompt: boolean;
  created_at: number;
  updated_at: number;
}

/**
 * Core saved session (connection info only)
 * Plugin-managed metadata (folders, tags, colors) is stored separately via session metadata API
 */
export interface SavedSession {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  auth_type: "password" | "key";
  key_path?: string;
  ssh_key_id?: string;
}


export interface Tab {
  id: string;
  sessionId: string;
  paneTree: PaneNode;
  title: string;
  type: "local" | "ssh" | "sftp" | "tunnel" | "telnet" | "serial";
  sshConfig?: SshConnectionConfig;
  telnetConfig?: TelnetConnectionConfig;
  serialConfig?: SerialConnectionConfig;
  focusedPaneId: string | null;
}

export interface SessionCredentials {
  password: string | null;
  key_passphrase: string | null;
}
