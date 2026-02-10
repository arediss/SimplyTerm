import type { PaneGroupTab } from "../../types";

interface PaneGroupContentProps {
  tab: PaneGroupTab | null;
  isGroupFocused: boolean;
  renderTerminal: (ptySessionId: string, isActive: boolean, type: string) => React.ReactNode;
  renderSftp: (sessionId: string) => React.ReactNode;
  renderTunnel: (sessionId: string, sessionName: string) => React.ReactNode;
  renderSettings: () => React.ReactNode;
  renderEmpty: () => React.ReactNode;
}

export function PaneGroupContent({
  tab,
  isGroupFocused,
  renderTerminal,
  renderSftp,
  renderTunnel,
  renderSettings,
  renderEmpty,
}: PaneGroupContentProps) {
  if (!tab) return <>{renderEmpty()}</>;

  switch (tab.type) {
    case "settings":
      return <>{renderSettings()}</>;
    case "sftp":
      return <>{renderSftp(tab.sessionId)}</>;
    case "tunnel":
      return <>{renderTunnel(tab.sessionId, tab.title.replace("Tunnels - ", ""))}</>;
    case "local":
    case "ssh":
    case "telnet":
    case "serial":
      if (tab.ptySessionId) return <>{renderTerminal(tab.ptySessionId, isGroupFocused, tab.type)}</>;
      return null;
    default:
      return null;
  }
}
