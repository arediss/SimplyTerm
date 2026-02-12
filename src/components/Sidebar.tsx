import { useEffect, useState, useMemo, useRef, useCallback, memo } from "react";
import { useTranslation } from "react-i18next";
import {
  Monitor,
  Search,
  XCircle,
  FolderOpen,
  List,
  Clock,
  Folder,
  Loader2,
  Pin,
  PinOff,
} from "lucide-react";
import { SavedSession } from "../types";
import { pluginManager } from "../plugins";
import type { SidebarViewRegistration } from "../plugins";
import SessionContextMenu from "./SessionContextMenu";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  mode: "overlay" | "pinned";
  onTogglePin: () => void;
  savedSessions: SavedSession[];
  connectingSessionId?: string | null;
  onSavedSessionConnect: (session: SavedSession) => void;
  onSavedSessionEdit: (session: SavedSession) => void;
  onSavedSessionDelete: (sessionId: string) => void;
  onSavedSessionSftp: (session: SavedSession) => void;
  onSavedSessionTunnel: (session: SavedSession) => void;
}

// Tab definition
interface SidebarTab {
  id: string;
  label: string;
  icon: React.ReactNode;
  order: number;
  type: 'core' | 'plugin';
  pluginId?: string;
  view?: SidebarViewRegistration;
}

const Sidebar = memo(function Sidebar({
  isOpen,
  onClose,
  mode,
  onTogglePin,
  savedSessions,
  connectingSessionId,
  onSavedSessionConnect,
  onSavedSessionEdit,
  onSavedSessionDelete,
  onSavedSessionSftp,
  onSavedSessionTunnel,
}: SidebarProps) {
  const { t } = useTranslation();
  const [isAnimating, setIsAnimating] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [pluginViews, setPluginViews] = useState<Map<string, { pluginId: string; view: SidebarViewRegistration }>>(
    new Map(pluginManager.registeredSidebarViews)
  );
  const animTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Subscribe to plugin sidebar view changes
  useEffect(() => {
    return pluginManager.subscribe((event) => {
      if (event.type === 'sidebar-view:register' || event.type === 'sidebar-view:unregister') {
        setPluginViews(new Map(pluginManager.registeredSidebarViews));
      }
      // Reset to default tab if the active plugin view was removed
      if (event.type === 'sidebar-view:unregister') {
        setActiveTab((prev) => prev === event.viewId ? 'all' : prev);
      }
    });
  }, []);

  // Build tabs list
  const tabs = useMemo<SidebarTab[]>(() => {
    const result: SidebarTab[] = [
      {
        id: 'all',
        label: t('sidebar.allSessions'),
        icon: <List size={14} />,
        order: 0,
        type: 'core',
      },
    ];

    // Add plugin views as tabs
    pluginViews.forEach(({ pluginId, view }) => {
      result.push({
        id: view.config.id,
        label: view.config.label,
        icon: getIconForView(view.config.icon),
        order: view.config.order,
        type: 'plugin',
        pluginId,
        view,
      });
    });

    return result.sort((a, b) => a.order - b.order);
  }, [pluginViews, t]);

  useEffect(() => {
    if (mode === "pinned") {
      // No animation in pinned mode
      setShouldRender(isOpen);
      setIsAnimating(isOpen);
      return;
    }
    if (isOpen) {
      setShouldRender(true);
      setIsAnimating(true);
    } else if (shouldRender) {
      setIsAnimating(false);
      if (animTimerRef.current) clearTimeout(animTimerRef.current);
      animTimerRef.current = setTimeout(() => setShouldRender(false), 200);
    }
    return () => {
      if (animTimerRef.current) clearTimeout(animTimerRef.current);
    };
  }, [isOpen, mode]);

  // Reset search when sidebar closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
    }
  }, [isOpen]);

  // Filter sessions based on search query
  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return savedSessions;
    const query = searchQuery.toLowerCase();
    return savedSessions.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.host.toLowerCase().includes(query) ||
        s.username.toLowerCase().includes(query)
    );
  }, [savedSessions, searchQuery]);

  // Get the active tab definition
  const activeTabDef = tabs.find(t => t.id === activeTab) || tabs[0];

  if (!shouldRender) return null;

  const sidebarInner = (
    <>
      {/* Search bar */}
      <div className="p-3 border-b border-surface-0/30">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('sidebar.searchPlaceholder')}
            className="w-full pl-9 pr-8 py-2 bg-crust rounded-lg text-sm text-text placeholder:text-text-muted/50 border border-transparent focus:border-accent/50 focus:outline-none transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text transition-colors"
            >
              <XCircle size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Tab bar - only show if there are plugin views */}
      {tabs.length > 1 && (
        <div className="px-3 py-2">
          <div className="flex gap-1 p-1 bg-crust rounded-xl">
            {tabs.map((tab) => (
              <SidebarTabButton
                key={tab.id}
                tab={tab}
                isActive={activeTab === tab.id}
                onSelect={setActiveTab}
              />
            ))}
          </div>
        </div>
      )}

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeTabDef?.type === 'core' && activeTabDef.id === 'all' && (
          <AllSessionsView
            sessions={filteredSessions}
            searchQuery={searchQuery}
            connectingSessionId={connectingSessionId}
            onConnect={onSavedSessionConnect}
            onEdit={onSavedSessionEdit}
            onDelete={onSavedSessionDelete}
            onSftp={onSavedSessionSftp}
            onTunnel={onSavedSessionTunnel}
          />
        )}
        {activeTabDef?.type === 'plugin' && activeTabDef.view && (
          <PluginSidebarView
            key={activeTabDef.id}
            pluginId={activeTabDef.pluginId!}
            view={activeTabDef.view}
          />
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-surface-0/30 flex items-center justify-end">
        {/* Pin/Unpin button */}
        <button
          onClick={onTogglePin}
          className={`p-2.5 rounded-lg transition-colors ${
            mode === "pinned"
              ? "text-accent hover:text-accent/80 hover:bg-accent/10"
              : "text-text-muted hover:text-text hover:bg-white/5"
          }`}
          title={mode === "pinned" ? t('sidebar.unpin') : t('sidebar.pin')}
        >
          {mode === "pinned" ? <PinOff size={16} /> : <Pin size={16} />}
        </button>
      </div>
    </>
  );

  // Pinned mode: render as a simple flex child, no backdrop/animation
  if (mode === "pinned") {
    return (
      <div className="w-72 flex flex-col shrink-0 ml-1.5 mb-1.5 rounded-xl overflow-hidden" style={{ backgroundColor: "var(--color-panel)" }}>
        {sidebarInner}
      </div>
    );
  }

  // Overlay mode: floating panel with backdrop and animation
  return (
    <>
      {/* Backdrop - sous la titlebar */}
      <div
        className={`fixed inset-0 top-10 z-30 bg-black/40 transition-opacity duration-200 ${
          isAnimating ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Sidebar panel - flottant */}
      <div
        className={`
          fixed top-14 left-3 bottom-3 z-40 w-72
          bg-mantle/98 backdrop-blur-sm border border-surface-0/50 rounded-2xl
          flex flex-col shadow-2xl [contain:layout_paint]
          ${isAnimating ? "animate-slide-in" : "animate-slide-out"}
        `}
      >
        {sidebarInner}
      </div>
    </>
  );
});

// Helper to get icon component from icon name
function getIconForView(iconName?: string): React.ReactNode {
  switch (iconName) {
    case 'clock':
      return <Clock size={14} />;
    case 'folder':
      return <Folder size={14} />;
    case 'list':
      return <List size={14} />;
    default:
      return <List size={14} />;
  }
}

// Memoized sidebar tab button to avoid inline onClick closures
const SidebarTabButton = memo(function SidebarTabButton({
  tab,
  isActive,
  onSelect,
}: {
  tab: SidebarTab;
  isActive: boolean;
  onSelect: (id: string) => void;
}) {
  const handleClick = useCallback(() => onSelect(tab.id), [tab.id, onSelect]);
  return (
    <button
      onClick={handleClick}
      className={`
        flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-200
        ${isActive
          ? 'bg-surface-0 text-text shadow-sm'
          : 'text-text-muted hover:text-text hover:bg-surface-0/50'
        }
      `}
      title={tab.label}
    >
      {tab.icon}
      <span className="truncate">{tab.label}</span>
    </button>
  );
});

// All sessions view (flat list)
interface AllSessionsViewProps {
  sessions: SavedSession[];
  searchQuery: string;
  connectingSessionId?: string | null;
  onConnect: (session: SavedSession) => void;
  onEdit: (session: SavedSession) => void;
  onDelete: (sessionId: string) => void;
  onSftp: (session: SavedSession) => void;
  onTunnel: (session: SavedSession) => void;
}

const AllSessionsView = memo(function AllSessionsView({
  sessions,
  searchQuery,
  connectingSessionId,
  onConnect,
  onEdit,
  onDelete,
  onSftp,
  onTunnel,
}: AllSessionsViewProps) {
  const { t } = useTranslation();

  if (sessions.length === 0) {
    return (
      <p className="text-xs text-text-muted px-3 py-4 text-center">
        {searchQuery
          ? t('sidebar.noResults')
          : t('sidebar.noSavedConnections')}
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {sessions.map((session) => (
        <SavedSessionItem
          key={session.id}
          session={session}
          isConnecting={connectingSessionId === session.id}
          onConnect={onConnect}
          onEdit={onEdit}
          onDelete={onDelete}
          onSftp={onSftp}
          onTunnel={onTunnel}
        />
      ))}
    </div>
  );
});

// Plugin sidebar view renderer
interface PluginSidebarViewProps {
  pluginId: string;
  view: SidebarViewRegistration;
}

const PluginSidebarView = memo(function PluginSidebarView({ pluginId, view }: PluginSidebarViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | void>(undefined);
  const renderTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const renderContent = useCallback(() => {
    if (containerRef.current && view.render) {
      // Clean up previous render
      if (typeof cleanupRef.current === 'function') {
        cleanupRef.current();
        cleanupRef.current = undefined;
      }
      // Render the view
      cleanupRef.current = view.render(containerRef.current);
    }
  }, [view]);

  useEffect(() => {
    if (renderTimerRef.current) clearTimeout(renderTimerRef.current);
    renderTimerRef.current = setTimeout(renderContent, 0);
    return () => {
      if (renderTimerRef.current) clearTimeout(renderTimerRef.current);
    };
  }, [renderContent]);

  useEffect(() => {
    return () => {
      if (typeof cleanupRef.current === 'function') {
        cleanupRef.current();
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="plugin-sidebar-view"
      data-plugin={pluginId}
      data-view={view.config.id}
    />
  );
});

interface SavedSessionItemProps {
  session: SavedSession;
  isConnecting?: boolean;
  onConnect: (session: SavedSession) => void;
  onEdit: (session: SavedSession) => void;
  onDelete: (sessionId: string) => void;
  onSftp: (session: SavedSession) => void;
  onTunnel: (session: SavedSession) => void;
}

const SavedSessionItem = memo(function SavedSessionItem({
  session,
  isConnecting,
  onConnect,
  onEdit,
  onDelete,
  onSftp,
  onTunnel,
}: SavedSessionItemProps) {
  const { t } = useTranslation();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const decoratorRef = useRef<HTMLDivElement>(null);

  // Session decorators (e.g., tag pills from plugins)
  useEffect(() => {
    const container = decoratorRef.current;
    if (!container) return;

    const cleanups: (() => void)[] = [];

    const renderDecorators = () => {
      cleanups.forEach(fn => fn());
      cleanups.length = 0;
      container.replaceChildren();

      const decorators = pluginManager.getSessionDecorators();
      for (const { decorator } of decorators) {
        const cleanup = decorator.render(session.id, container);
        if (cleanup) cleanups.push(cleanup);
      }
    };

    renderDecorators();

    const unsubscribe = pluginManager.subscribe((event) => {
      if (event.type === 'session-decorator:register' || event.type === 'session-decorator:unregister') {
        renderDecorators();
      }
    });

    const handleDecoratorChanged = () => renderDecorators();
    globalThis.addEventListener('plugin-decorators-changed', handleDecoratorChanged);

    return () => {
      unsubscribe();
      globalThis.removeEventListener('plugin-decorators-changed', handleDecoratorChanged);
      cleanups.forEach(fn => fn());
    };
  }, [session.id]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    globalThis.dispatchEvent(new CustomEvent("closeContextMenus"));
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleConnect = useCallback(() => { onConnect(session); }, [session, onConnect]);
  const handleSftp = useCallback(() => { onSftp(session); }, [session, onSftp]);

  return (
    <>
      <div
        className={`group/session w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${
          isConnecting
            ? "bg-accent/10 cursor-wait"
            : "hover:bg-white/5 cursor-pointer"
        }`}
        onContextMenu={isConnecting ? undefined : handleContextMenu}
      >
        <button
          type="button"
          disabled={isConnecting}
          onClick={handleConnect}
          className="flex items-center gap-3 flex-1 min-w-0 bg-transparent border-none p-0 text-left cursor-[inherit]"
        >
          <span className="text-accent">
            {isConnecting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Monitor size={16} />
            )}
          </span>
          <div className="flex-1 min-w-0">
            <div className={`text-sm font-medium truncate ${isConnecting ? "text-accent" : "text-text"}`}>
              {session.name}
            </div>
            <div className="text-[11px] text-text-muted truncate">
              {isConnecting ? t('sidebar.connecting') : `${session.username}@${session.host}:${session.port}`}
            </div>
            <div ref={decoratorRef} className="flex flex-wrap gap-1 mt-0.5 empty:hidden" />
          </div>
        </button>
        {!isConnecting && (
          <button
            type="button"
            onClick={handleSftp}
            className="shrink-0 p-1.5 rounded-md text-text-muted opacity-0 group-hover/session:opacity-100 hover:!text-accent hover:bg-white/10 transition-[colors,opacity]"
            title={t('sidebar.openSftp')}
          >
            <FolderOpen size={14} />
          </button>
        )}
      </div>

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

export default Sidebar;
