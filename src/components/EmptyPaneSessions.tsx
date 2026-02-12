import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Monitor, Plus, Terminal, Loader2 } from "lucide-react";
import type { SavedSession } from "../types";
import { pluginManager } from "../plugins/PluginManager";
import type { HomePanelColumnRegistration } from "../plugins/types";
import { useSessionDecorators } from "../hooks/useSessionDecorators";
import DynamicLucideIcon from "./DynamicLucideIcon";
import SessionContextMenu from "./SessionContextMenu";

interface EmptyPaneSessionsProps {
  savedSessions: SavedSession[];
  connectingSessionId?: string | null;
  onConnect: (session: SavedSession) => void;
  onNewConnection: () => void;
  onLocalTerminal: () => void;
  onEdit: (session: SavedSession) => void;
  onDelete: (sessionId: string) => void;
  onSftp: (session: SavedSession) => void;
  onTunnel: (session: SavedSession) => void;
}

export default memo(function EmptyPaneSessions({
  savedSessions,
  connectingSessionId,
  onConnect,
  onNewConnection,
  onLocalTerminal,
  onEdit,
  onDelete,
  onSftp,
  onTunnel,
}: EmptyPaneSessionsProps) {
  const { t } = useTranslation();

  // Track registered home panel columns
  const [columns, setColumns] = useState<{ pluginId: string; column: HomePanelColumnRegistration }[]>([]);

  useEffect(() => {
    const updateColumns = () => setColumns(pluginManager.getHomePanelColumns());
    updateColumns();

    return pluginManager.subscribe((event) => {
      if (event.type === 'home-panel:register' || event.type === 'home-panel:unregister') {
        updateColumns();
      }
    });
  }, []);

  const hasColumns = columns.length > 0;

  // Session filter from plugins (e.g. folder tabs)
  const [sessionFilter, setSessionFilter] = useState<{ sessionIds: string[] | null; label: string | null }>({ sessionIds: null, label: null });

  useEffect(() => {
    const handleFilter = (e: Event) => {
      const detail = (e as CustomEvent).detail as { sessionIds: string[] | null; label: string | null };
      setSessionFilter({ sessionIds: detail.sessionIds, label: detail.label });
    };
    globalThis.addEventListener('home-panel-session-filter', handleFilter);
    return () => globalThis.removeEventListener('home-panel-session-filter', handleFilter);
  }, []);

  const filteredSessions = sessionFilter.sessionIds
    ? savedSessions.filter(s => sessionFilter.sessionIds!.includes(s.id))
    : savedSessions;

  return (
    <div className="w-full h-full overflow-y-auto p-6">
      <div className={hasColumns ? "max-w-4xl mx-auto" : "max-w-md mx-auto"}>
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

        {/* Content area: columns layout or single list */}
        {hasColumns ? (
          <div className="flex gap-0">
            {/* Left columns (order < 50) */}
            {columns.filter(c => (c.column.config.order ?? 50) < 50).map(({ column }) => (
              <HomePanelPluginColumn key={column.config.id} column={column} />
            ))}

            {/* Center column: sessions list */}
            <div className="flex-1 min-w-0 px-4 border-l border-r border-surface-0/30 first:border-l-0 last:border-r-0">
              <SessionsList
                savedSessions={filteredSessions}
                connectingSessionId={connectingSessionId}
                onConnect={onConnect}
                onEdit={onEdit}
                onDelete={onDelete}
                onSftp={onSftp}
                onTunnel={onTunnel}
                filterLabel={sessionFilter.label}
              />
            </div>

            {/* Right columns (order >= 50) */}
            {columns.filter(c => (c.column.config.order ?? 50) >= 50).map(({ column }) => (
              <HomePanelPluginColumn key={column.config.id} column={column} />
            ))}
          </div>
        ) : (
          <SessionsList
            savedSessions={filteredSessions}
            connectingSessionId={connectingSessionId}
            onConnect={onConnect}
            onEdit={onEdit}
            onDelete={onDelete}
            onSftp={onSftp}
            onTunnel={onTunnel}
            filterLabel={sessionFilter.label}
          />
        )}
      </div>
    </div>
  );
});

/** Plugin column rendered in the home panel */
const HomePanelPluginColumn = memo(function HomePanelPluginColumn({
  column,
}: {
  column: HomePanelColumnRegistration;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const cleanup = column.render(el);
    return () => {
      if (cleanup) cleanup();
      el.replaceChildren();
    };
  }, [column]);

  return (
    <div className="w-[200px] shrink-0 px-3 group/col">
      <div className="flex items-center gap-2 mb-3">
        {column.config.icon && (
          <DynamicLucideIcon name={column.config.icon} size={13} className="text-text-muted" />
        )}
        <h3 className="flex-1 text-xs font-medium text-text-muted uppercase tracking-wider">
          {column.config.title}
        </h3>
        {column.config.onAdd && (
          <button
            onClick={column.config.onAdd}
            className="opacity-0 group-hover/col:opacity-100 p-0.5 rounded text-text-muted hover:text-accent transition-all"
            title={`Add ${column.config.title.toLowerCase()}`}
          >
            <Plus size={13} />
          </button>
        )}
      </div>
      <div ref={containerRef} />
    </div>
  );
});

/** Sessions list with decorators */
const SessionsList = memo(function SessionsList({
  savedSessions,
  connectingSessionId,
  onConnect,
  onEdit,
  onDelete,
  onSftp,
  onTunnel,
  filterLabel,
}: {
  savedSessions: SavedSession[];
  connectingSessionId?: string | null;
  onConnect: (session: SavedSession) => void;
  onEdit: (session: SavedSession) => void;
  onDelete: (sessionId: string) => void;
  onSftp: (session: SavedSession) => void;
  onTunnel: (session: SavedSession) => void;
  filterLabel?: string | null;
}) {
  const { t } = useTranslation();

  const title = filterLabel || t("sidebar.allSessions");

  if (savedSessions.length === 0) {
    return (
      <>
        <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">
          {title}
        </h3>
        {filterLabel && (
          <p className="text-xs text-text-muted text-center py-4 opacity-60">
            {t("sidebar.noResults")}
          </p>
        )}
      </>
    );
  }

  return (
    <>
      <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">
        {title}
      </h3>
      <div className="space-y-1.5">
        {savedSessions.map((session) => (
          <EmptyPaneSessionItem
            key={session.id}
            session={session}
            isConnecting={connectingSessionId === session.id}
            isDisabled={!!connectingSessionId}
            onConnect={onConnect}
            onEdit={onEdit}
            onDelete={onDelete}
            onSftp={onSftp}
            onTunnel={onTunnel}
          />
        ))}
      </div>
    </>
  );
});

function getSessionItemClassName(isConnecting: boolean, isDisabled: boolean): string {
  if (isConnecting) return "bg-accent/10 cursor-wait";
  if (isDisabled) return "opacity-50 cursor-not-allowed";
  return "hover:bg-surface-0/30 cursor-pointer";
}

const EmptyPaneSessionItem = memo(function EmptyPaneSessionItem({
  session,
  isConnecting,
  isDisabled,
  onConnect,
  onEdit,
  onDelete,
  onSftp,
  onTunnel,
}: {
  session: SavedSession;
  isConnecting: boolean;
  isDisabled: boolean;
  onConnect: (session: SavedSession) => void;
  onEdit: (session: SavedSession) => void;
  onDelete: (sessionId: string) => void;
  onSftp: (session: SavedSession) => void;
  onTunnel: (session: SavedSession) => void;
}) {
  const { t } = useTranslation();
  const decoratorRef = useSessionDecorators(session.id);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const handleClick = useCallback(() => {
    if (!isDisabled) onConnect(session);
  }, [isDisabled, onConnect, session]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (isDisabled) return;
    e.preventDefault();
    e.stopPropagation();
    globalThis.dispatchEvent(new CustomEvent("closeContextMenus"));
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, [isDisabled]);

  return (
    <>
      <button
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        disabled={isDisabled}
        className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-lg transition-colors text-left group ${getSessionItemClassName(isConnecting, isDisabled)}`}
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
          <div ref={decoratorRef} className="flex flex-wrap gap-1 mt-0.5 empty:hidden" />
        </div>
      </button>

      {contextMenu && (
        <SessionContextMenu
          session={session}
          position={contextMenu}
          onClose={() => setContextMenu(null)}
          onConnect={onConnect}
          onEdit={onEdit}
          onDelete={onDelete}
          onSftp={onSftp}
          onTunnel={onTunnel}
        />
      )}
    </>
  );
});
