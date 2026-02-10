import { useEffect, useState, useMemo, useRef, useCallback, memo } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  Monitor,
  Terminal,
  Search,
  XCircle,
  Pencil,
  FolderOpen,
  ArrowLeftRight,
  Trash2,
  List,
  Clock,
  Folder,
  Tag,
  Loader2,
  Pin,
  PinOff,
} from "lucide-react";
import { SavedSession } from "../types";
import { pluginManager } from "../plugins";
import type { SidebarViewRegistration, ContextMenuItemConfig, ContextMenuContext } from "../plugins";

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

// Helper to get icon for context menu items (12px size)
function getContextMenuIcon(iconName?: string): React.ReactNode {
  switch (iconName) {
    case 'folder':
      return <Folder size={12} />;
    case 'folder-open':
      return <FolderOpen size={12} />;
    case 'tag':
      return <Tag size={12} />;
    case 'pencil':
      return <Pencil size={12} />;
    case 'trash':
      return <Trash2 size={12} />;
    default:
      return null;
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
  const [pluginMenuItems, setPluginMenuItems] = useState<{ pluginId: string; item: ContextMenuItemConfig }[]>([]);
  const decoratorRef = useRef<HTMLDivElement>(null);

  // Subscribe to plugin context menu items
  useEffect(() => {
    const updateItems = () => {
      setPluginMenuItems(pluginManager.getContextMenuItems('session'));
    };

    updateItems();

    return pluginManager.subscribe((event) => {
      if (event.type === 'context-menu:register' || event.type === 'context-menu:unregister') {
        updateItems();
      }
    });
  }, []);

  // Session decorators (e.g., tag pills from plugins)
  useEffect(() => {
    const container = decoratorRef.current;
    if (!container) return;

    const cleanups: (() => void)[] = [];

    const renderDecorators = () => {
      // Run previous cleanups
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

    // Re-render when decorators change
    const unsubscribe = pluginManager.subscribe((event) => {
      if (event.type === 'session-decorator:register' || event.type === 'session-decorator:unregister') {
        renderDecorators();
      }
    });

    // Listen for plugin-triggered re-renders (e.g., after tag assignment changes)
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
    // Fermer tous les autres context menus
    globalThis.dispatchEvent(new CustomEvent("closeContextMenus"));
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  const handleConnect = useCallback(() => { onConnect(session); }, [session, onConnect]);
  const handleEdit = useCallback(() => { onEdit(session); }, [session, onEdit]);
  const handleDelete = useCallback(() => { onDelete(session.id); }, [session.id, onDelete]);
  const handleSftp = useCallback(() => { onSftp(session); }, [session, onSftp]);
  const handleTunnel = useCallback(() => { onTunnel(session); }, [session, onTunnel]);

  const handlePluginAction = (item: ContextMenuItemConfig) => {
    const context: ContextMenuContext = {
      type: 'session',
      targetId: session.id,
      data: {
        name: session.name,
        host: session.host,
        port: session.port,
        username: session.username,
      },
    };
    item.onClick(context);
    closeContextMenu();
  };

  // Close context menu on outside click or when another menu opens
  useEffect(() => {
    const handleClick = () => closeContextMenu();
    const handleCloseAll = () => closeContextMenu();

    document.addEventListener("click", handleClick);
    globalThis.addEventListener("closeContextMenus", handleCloseAll);

    return () => {
      document.removeEventListener("click", handleClick);
      globalThis.removeEventListener("closeContextMenus", handleCloseAll);
    };
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={isConnecting ? undefined : handleConnect}
        onContextMenu={isConnecting ? undefined : handleContextMenu}
        disabled={isConnecting}
        className={`group/session w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left bg-transparent border-none ${
          isConnecting
            ? "bg-accent/10 cursor-wait"
            : "hover:bg-white/5 cursor-pointer"
        }`}
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
        {!isConnecting && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleSftp();
            }}
            className="shrink-0 p-1.5 rounded-md text-text-muted opacity-0 group-hover/session:opacity-100 hover:!text-accent hover:bg-white/10 transition-[colors,opacity]"
            title={t('sidebar.openSftp')}
          >
            <FolderOpen size={14} />
          </button>
        )}
      </button>

      {/* Context Menu - rendered via Portal to escape transform context */}
      {contextMenu && createPortal(
        <div
          className="fixed z-[100] min-w-[160px] bg-crust border border-surface-0/50 rounded-lg shadow-xl py-1"
          style={{ transform: `translate3d(${contextMenu.x}px, ${contextMenu.y}px, 0)`, left: 0, top: 0 }}
          role="menu"
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => { if (e.key === 'Escape') closeContextMenu(); }}
        >
          <button
            onClick={() => { handleConnect(); closeContextMenu(); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text hover:bg-surface-0/50 transition-colors"
          >
            <Terminal size={12} />
            <span>{t('sidebar.connect')}</span>
          </button>
          <button
            onClick={() => { handleSftp(); closeContextMenu(); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text hover:bg-surface-0/50 transition-colors"
          >
            <FolderOpen size={12} />
            <span>{t('sidebar.openSftp')}</span>
          </button>
          <button
            onClick={() => { handleTunnel(); closeContextMenu(); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-blue hover:bg-blue/10 transition-colors"
          >
            <ArrowLeftRight size={12} />
            <span>{t('sidebar.tunnelOnly')}</span>
          </button>
          <div className="h-px bg-surface-0/30 my-1" />
          <button
            onClick={() => { handleEdit(); closeContextMenu(); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text hover:bg-surface-0/50 transition-colors"
          >
            <Pencil size={12} />
            <span>{t('sidebar.edit')}</span>
          </button>

          {/* Plugin context menu items */}
          {pluginMenuItems.length > 0 && (
            <>
              <div className="h-px bg-surface-0/30 my-1" />
              {pluginMenuItems.map(({ item }) => (
                <button
                  key={item.id}
                  onClick={() => handlePluginAction(item)}
                  disabled={item.disabled}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text hover:bg-surface-0/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {getContextMenuIcon(item.icon)}
                  <span>{item.label}</span>
                </button>
              ))}
            </>
          )}

          <div className="h-px bg-surface-0/30 my-1" />
          <button
            onClick={() => { handleDelete(); closeContextMenu(); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-error hover:bg-error/10 transition-colors"
          >
            <Trash2 size={12} />
            <span>{t('common.delete')}</span>
          </button>
        </div>,
        document.body
      )}
    </>
  );
});

export default Sidebar;
