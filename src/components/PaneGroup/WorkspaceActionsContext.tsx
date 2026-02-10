import { createContext, useContext } from "react";

export interface WorkspaceActions {
  // Global actions (same for all pane groups)
  onNewConnection: () => void;
  onLocalTerminal: () => void;
  onToggleTunnelSidebar: () => void;
  isTunnelSidebarOpen: boolean;
  activeTunnelCount: number;
  onSplitVertical: () => void;
  onSplitHorizontal: () => void;
  // Render functions
  renderTerminal: (ptySessionId: string, isActive: boolean, type: string) => React.ReactNode;
  renderSftp: (sessionId: string) => React.ReactNode;
  renderTunnel: (sessionId: string, sessionName: string) => React.ReactNode;
  renderSettings: () => React.ReactNode;
  renderEmpty: () => React.ReactNode;
}

export const WorkspaceActionsContext = createContext<WorkspaceActions | null>(null);

export function useWorkspaceActions(): WorkspaceActions {
  const ctx = useContext(WorkspaceActionsContext);
  if (!ctx) throw new Error("useWorkspaceActions must be used within WorkspaceActionsContext.Provider");
  return ctx;
}
