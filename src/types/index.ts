import { SshConnectionConfig } from "../components/ConnectionForm";
import { PaneNode } from "../components/SplitPane";

export interface Session {
  id: string;
  name: string;
  type: "ssh" | "local" | "sftp";
  host?: string;
  user?: string;
  status: "connected" | "disconnected" | "connecting";
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
  type: "local" | "ssh" | "sftp" | "tunnel";
  sshConfig?: SshConnectionConfig;
  focusedPaneId: string | null;
}

export interface SessionCredentials {
  password: string | null;
  key_passphrase: string | null;
}
