import { Terminal, Server, Clock, Copy, FolderOpen, Wifi } from "lucide-react";
import type { SshConnectionConfig } from "./ConnectionForm";
import type { SavedSession, RecentSession } from "../types";

export interface ActiveConnection {
  tabId: string;
  sessionId: string;
  ptySessionId: string;
  type: "ssh" | "local" | "sftp";
  title: string;
  host?: string;
  username?: string;
}

interface PanePickerProps {
  onSelectLocal: () => void;
  onSelectDuplicate: () => void;
  onSelectSaved: (session: SavedSession) => void;
  onSelectRecent: (session: RecentSession) => void;
  onSelectSftpForConnection?: (sessionId: string, ptySessionId: string) => void;
  currentSessionConfig?: SshConnectionConfig;
  savedSessions: SavedSession[];
  recentSessions: RecentSession[];
  activeConnections?: ActiveConnection[];
}

export function PanePicker({
  onSelectLocal,
  onSelectDuplicate,
  onSelectSaved,
  onSelectRecent,
  onSelectSftpForConnection,
  currentSessionConfig,
  savedSessions,
  recentSessions,
  activeConnections = [],
}: PanePickerProps) {
  // Filter SSH connections that can have SFTP
  const sshConnections = activeConnections.filter(c => c.type === "ssh");
  return (
    <div className="w-full h-full flex items-center justify-center bg-base/50">
      <div className="w-80 max-h-[80%] overflow-hidden flex flex-col bg-crust rounded-lg border border-surface-0/50 shadow-xl">
        {/* Header */}
        <div className="px-4 py-3 border-b border-surface-0/30">
          <h3 className="text-sm font-medium text-text">New Pane</h3>
          <p className="text-xs text-subtext-0 mt-0.5">Choose a connection type</p>
        </div>

        {/* Options */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {/* Local Terminal */}
          <button
            onClick={onSelectLocal}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-surface-0/50 transition-colors text-left"
          >
            <div className="w-8 h-8 rounded bg-green/20 flex items-center justify-center">
              <Terminal size={16} className="text-green" />
            </div>
            <div>
              <div className="text-sm text-text">Local Terminal</div>
              <div className="text-xs text-subtext-0">Open a new local shell</div>
            </div>
          </button>

          {/* Duplicate Current */}
          {currentSessionConfig && (
            <button
              onClick={onSelectDuplicate}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-surface-0/50 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded bg-blue/20 flex items-center justify-center">
                <Copy size={16} className="text-blue rotate-90" />
              </div>
              <div>
                <div className="text-sm text-text">Duplicate Session</div>
                <div className="text-xs text-subtext-0 truncate max-w-[200px]">
                  {currentSessionConfig.username}@{currentSessionConfig.host}
                </div>
              </div>
            </button>
          )}

          {/* Active SSH Connections - SFTP Option */}
          {sshConnections.length > 0 && onSelectSftpForConnection && (
            <>
              <div className="px-3 pt-3 pb-1">
                <span className="text-xs font-medium text-subtext-0 uppercase tracking-wider">
                  Active Connections
                </span>
              </div>
              {sshConnections.map((conn) => (
                <button
                  key={conn.tabId}
                  onClick={() => onSelectSftpForConnection(conn.sessionId, conn.ptySessionId)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-surface-0/50 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded bg-teal/20 flex items-center justify-center relative">
                    <FolderOpen size={16} className="text-teal" />
                    <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green border border-crust" title="Connected" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-text flex items-center gap-1.5">
                      <Wifi size={10} className="text-green shrink-0" />
                      <span className="truncate">SFTP - {conn.title}</span>
                    </div>
                    {conn.host && (
                      <div className="text-xs text-subtext-0 truncate">
                        {conn.username}@{conn.host}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </>
          )}

          {/* Saved Sessions */}
          {savedSessions.length > 0 && (
            <>
              <div className="px-3 pt-3 pb-1">
                <span className="text-xs font-medium text-subtext-0 uppercase tracking-wider">
                  Saved Sessions
                </span>
              </div>
              {savedSessions.slice(0, 5).map((session) => (
                <button
                  key={session.id}
                  onClick={() => onSelectSaved(session)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-surface-0/50 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded bg-mauve/20 flex items-center justify-center">
                    <Server size={16} className="text-mauve" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-text truncate">{session.name}</div>
                    <div className="text-xs text-subtext-0 truncate">
                      {session.username}@{session.host}
                    </div>
                  </div>
                </button>
              ))}
            </>
          )}

          {/* Recent Sessions */}
          {recentSessions.length > 0 && (
            <>
              <div className="px-3 pt-3 pb-1">
                <span className="text-xs font-medium text-subtext-0 uppercase tracking-wider">
                  Recent
                </span>
              </div>
              {recentSessions.slice(0, 5).map((session) => (
                <button
                  key={session.id}
                  onClick={() => onSelectRecent(session)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-surface-0/50 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded bg-peach/20 flex items-center justify-center">
                    <Clock size={16} className="text-peach" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-text truncate">{session.name}</div>
                    <div className="text-xs text-subtext-0 truncate">
                      {session.username}@{session.host}
                    </div>
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
