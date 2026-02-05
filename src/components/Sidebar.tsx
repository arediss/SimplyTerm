import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  Monitor,
  Settings,
  Terminal,
  Search,
  XCircle,
  Pencil,
  FolderOpen,
  ArrowLeftRight,
  Lock,
  LockOpen,
  Trash2,
  List,
  Clock,
  Folder,
  Tag,
  type LucideIcon,
} from "lucide-react";
import { SavedSession } from "../types";
import { pluginManager } from "../plugins";
import type { SidebarViewRegistration, ContextMenuItemConfig } from "../plugins/types";
import type { ContextMenuContext } from "../plugins/extensionTypes";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  savedSessions: SavedSession[];
  onSavedSessionConnect: (session: SavedSession) => void;
  onSavedSessionEdit: (session: SavedSession) => void;
  onSavedSessionDelete: (sessionId: string) => void;
  onSavedSessionSftp: (session: SavedSession) => void;
  onSavedSessionTunnel: (session: SavedSession) => void;
  onOpenSettings: () => void;
  // Vault status
  vaultExists?: boolean;
  vaultUnlocked?: boolean;
  onVaultLock?: () => void;
  onVaultUnlock?: () => void;
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

function Sidebar({
  isOpen,
  onClose,
  savedSessions,
  onSavedSessionConnect,
  onSavedSessionEdit,
  onSavedSessionDelete,
  onSavedSessionSftp,
  onSavedSessionTunnel,
  onOpenSettings,
  vaultExists,
  vaultUnlocked,
  onVaultLock,
  onVaultUnlock,
}: SidebarProps) {
  const { t } = useTranslation();
  const [isAnimating, setIsAnimating] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [pluginViews, setPluginViews] = useState<Map<string, { pluginId: string; view: SidebarViewRegistration }>>(
    new Map(pluginManager.registeredSidebarViews)
  );

  // Subscribe to plugin sidebar view changes
  useEffect(() => {
    const unsubscribe = pluginManager.subscribe((event) => {
      if (event.type === 'sidebar-view:register' || event.type === 'sidebar-view:unregister') {
        setPluginViews(new Map(pluginManager.registeredSidebarViews));
      }
      // Reset to default tab if the active plugin view was removed
      if (event.type === 'sidebar-view:unregister') {
        setActiveTab((prev) => prev === event.viewId ? 'all' : prev);
      }
    });

    // Initial load
    setPluginViews(new Map(pluginManager.registeredSidebarViews));

    return unsubscribe;
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
    if (isOpen) {
      setShouldRender(true);
      setIsAnimating(true);
    } else if (shouldRender) {
      setIsAnimating(false);
      const timer = setTimeout(() => setShouldRender(false), 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

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

  return (
    <>
      {/* Backdrop - sous la titlebar */}
      <div
        className={`fixed inset-0 top-10 z-30 bg-black/40 transition-opacity duration-200 ${
          isAnimating ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />

      {/* Sidebar panel - flottant */}
      <div
        className={`
          fixed top-14 left-3 bottom-3 z-40 w-72
          bg-mantle/95 backdrop-blur-xl border border-surface-0/50 rounded-2xl
          flex flex-col shadow-2xl
          ${isAnimating ? "animate-slide-in" : "animate-slide-out"}
        `}
      >
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
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200
                    ${activeTab === tab.id
                      ? 'bg-surface-0 text-text shadow-sm'
                      : 'text-text-muted hover:text-text hover:bg-surface-0/50'
                    }
                  `}
                  title={tab.label}
                >
                  {tab.icon}
                  <span className="truncate">{tab.label}</span>
                </button>
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
        <div className="p-3 border-t border-surface-0/30 flex items-center gap-2">
          <button
            onClick={onOpenSettings}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-text-muted hover:text-text hover:bg-white/5 transition-colors"
          >
            <Settings size={16} />
            <span className="text-sm">{t('sidebar.settings')}</span>
          </button>

          {/* Vault button */}
          {vaultExists && (
            <button
              onClick={() => vaultUnlocked ? onVaultLock?.() : onVaultUnlock?.()}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg transition-colors ${
                vaultUnlocked
                  ? "text-success hover:bg-success/10"
                  : "text-text-muted hover:bg-white/5 hover:text-warning"
              }`}
              title={vaultUnlocked ? t('sidebar.vaultUnlocked') : t('sidebar.vaultLocked')}
            >
              {vaultUnlocked ? <LockOpen size={16} /> : <Lock size={16} />}
              <span className="text-sm">{t('sidebar.vault')}</span>
            </button>
          )}
        </div>
      </div>
    </>
  );
}

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

// All sessions view (flat list)
interface AllSessionsViewProps {
  sessions: SavedSession[];
  searchQuery: string;
  onConnect: (session: SavedSession) => void;
  onEdit: (session: SavedSession) => void;
  onDelete: (sessionId: string) => void;
  onSftp: (session: SavedSession) => void;
  onTunnel: (session: SavedSession) => void;
}

function AllSessionsView({
  sessions,
  searchQuery,
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
          onClick={() => onConnect(session)}
          onEdit={() => onEdit(session)}
          onDelete={() => onDelete(session.id)}
          onSftp={() => onSftp(session)}
          onTunnel={() => onTunnel(session)}
        />
      ))}
    </div>
  );
}

// Plugin sidebar view renderer
interface PluginSidebarViewProps {
  pluginId: string;
  view: SidebarViewRegistration;
}

function PluginSidebarView({ pluginId, view }: PluginSidebarViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | void>();

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
    const timer = setTimeout(renderContent, 0);
    return () => clearTimeout(timer);
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
}

interface SavedSessionItemProps {
  session: SavedSession;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSftp: () => void;
  onTunnel: () => void;
}

function SavedSessionItem({
  session,
  onClick,
  onEdit,
  onDelete,
  onSftp,
  onTunnel,
}: SavedSessionItemProps) {
  const { t } = useTranslation();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [pluginMenuItems, setPluginMenuItems] = useState<{ pluginId: string; item: ContextMenuItemConfig }[]>([]);

  // Subscribe to plugin context menu items
  useEffect(() => {
    const updateItems = () => {
      setPluginMenuItems(pluginManager.getContextMenuItems('session'));
    };

    updateItems();

    const unsubscribe = pluginManager.subscribe((event) => {
      if (event.type === 'context-menu:register' || event.type === 'context-menu:unregister') {
        updateItems();
      }
    });

    return unsubscribe;
  }, []);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Fermer tous les autres context menus
    window.dispatchEvent(new CustomEvent("closeContextMenus"));
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  const handleAction = (action: () => void) => {
    action();
    closeContextMenu();
  };

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
    window.addEventListener("closeContextMenus", handleCloseAll);

    return () => {
      document.removeEventListener("click", handleClick);
      window.removeEventListener("closeContextMenus", handleCloseAll);
    };
  }, []);

  return (
    <>
      <div
        onClick={onClick}
        onContextMenu={handleContextMenu}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-left cursor-pointer"
      >
        <span className="text-accent">
          <Monitor size={16} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-text truncate">
            {session.name}
          </div>
          <div className="text-[11px] text-text-muted truncate">
            {session.username}@{session.host}:{session.port}
          </div>
        </div>
      </div>

      {/* Context Menu - rendered via Portal to escape transform context */}
      {contextMenu && createPortal(
        <div
          className="fixed z-[100] min-w-[160px] bg-crust border border-surface-0/50 rounded-lg shadow-xl py-1"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => handleAction(onClick)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text hover:bg-surface-0/50 transition-colors"
          >
            <Terminal size={12} />
            <span>{t('sidebar.connect')}</span>
          </button>
          <button
            onClick={() => handleAction(onSftp)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text hover:bg-surface-0/50 transition-colors"
          >
            <FolderOpen size={12} />
            <span>{t('sidebar.openSftp')}</span>
          </button>
          <button
            onClick={() => handleAction(onTunnel)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-blue hover:bg-blue/10 transition-colors"
          >
            <ArrowLeftRight size={12} />
            <span>{t('sidebar.tunnelOnly')}</span>
          </button>
          <div className="h-px bg-surface-0/30 my-1" />
          <button
            onClick={() => handleAction(onEdit)}
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
            onClick={() => handleAction(onDelete)}
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
}

export default Sidebar;
