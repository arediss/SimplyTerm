import { SshConnectionConfig } from "./index";
import { TelnetConnectionConfig, SerialConnectionConfig } from "./index";

// ============================================================================
// Workspace Tree Types
// ============================================================================

/** A node in the workspace layout tree */
export type WorkspaceNode =
  | { type: "group"; id: string }
  | {
      type: "split";
      id: string;
      direction: "horizontal" | "vertical";
      children: WorkspaceNode[];
      sizes: number[];
    };

// ============================================================================
// PaneGroup Types
// ============================================================================

/** A group of tabs with its own tab bar */
export interface PaneGroup {
  id: string;
  tabs: PaneGroupTab[];
  activeTabId: string | null;
}

/** A single tab inside a PaneGroup */
export interface PaneGroupTab {
  id: string;
  type: "local" | "ssh" | "sftp" | "tunnel" | "telnet" | "serial" | "settings";
  title: string;
  sessionId: string;
  ptySessionId?: string;
  sshConfig?: SshConnectionConfig;
  telnetConfig?: TelnetConnectionConfig;
  serialConfig?: SerialConnectionConfig;
}
