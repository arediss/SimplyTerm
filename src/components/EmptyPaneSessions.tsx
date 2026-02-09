import { useTranslation } from "react-i18next";
import { Monitor, Plus, Terminal, Loader2 } from "lucide-react";
import type { SavedSession } from "../types";

interface EmptyPaneSessionsProps {
  savedSessions: SavedSession[];
  connectingSessionId?: string | null;
  onConnect: (session: SavedSession) => void;
  onNewConnection: () => void;
  onLocalTerminal: () => void;
}

export default function EmptyPaneSessions({
  savedSessions,
  connectingSessionId,
  onConnect,
  onNewConnection,
  onLocalTerminal,
}: EmptyPaneSessionsProps) {
  const { t } = useTranslation();

  return (
    <div className="w-full h-full overflow-y-auto p-6">
      <div className="max-w-md mx-auto">
        {/* Quick actions */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={onNewConnection}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors text-sm font-medium"
          >
            <Plus size={15} />
            {t("header.newSshConnection")}
          </button>
          <button
            onClick={onLocalTerminal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-surface-0/30 text-text-secondary hover:bg-surface-0/50 hover:text-text transition-colors text-sm font-medium"
          >
            <Terminal size={15} />
            Terminal
          </button>
        </div>

        {/* Sessions list */}
        {savedSessions.length > 0 && (
          <>
            <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">
              {t("sidebar.allSessions")}
            </h3>
            <div className="space-y-1.5">
              {savedSessions.map((session) => {
                const isConnecting = connectingSessionId === session.id;
                const isDisabled = !!connectingSessionId;
                return (
                  <button
                    key={session.id}
                    onClick={() => !isDisabled && onConnect(session)}
                    disabled={isDisabled}
                    className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-lg transition-colors text-left group ${
                      isConnecting
                        ? "bg-accent/10 cursor-wait"
                        : isDisabled
                          ? "opacity-50 cursor-not-allowed"
                          : "hover:bg-surface-0/30 cursor-pointer"
                    }`}
                  >
                    {isConnecting ? (
                      <Loader2 size={16} className="text-accent shrink-0 animate-spin" />
                    ) : (
                      <Monitor size={16} className="text-accent shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium truncate ${isConnecting ? "text-accent" : "text-text"}`}>
                        {session.name}
                      </div>
                      <div className="text-[11px] text-text-muted truncate">
                        {isConnecting ? t("sidebar.connecting") : `${session.username}@${session.host}:${session.port}`}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
