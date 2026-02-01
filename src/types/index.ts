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

export interface SavedSession {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  auth_type: "password" | "key";
  key_path?: string;
  folder_id?: string;
  tags: string[];
  color?: string;
}

export interface SessionFolder {
  id: string;
  name: string;
  color?: string;
  parent_id?: string;
  order: number;
  expanded: boolean;
}

export interface RecentSession {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  auth_type: "password" | "key";
  key_path?: string;
  last_used: number;
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
