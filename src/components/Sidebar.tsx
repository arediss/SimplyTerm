import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Monitor,
  Plus,
  Settings,
  Terminal,
  X,
  Folder,
  Clock,
  Trash2,
  Search,
  XCircle,
  Pencil,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  FolderPlus,
  FolderInput,
  Home,
} from "lucide-react";
import { Session, SavedSession, RecentSession, SessionFolder } from "../App";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: Session[];
  savedSessions: SavedSession[];
  folders: SessionFolder[];
  recentSessions: RecentSession[];
  onSessionSelect: (session: Session) => void;
  onSavedSessionConnect: (session: SavedSession) => void;
  onSavedSessionEdit: (session: SavedSession) => void;
  onSavedSessionDelete: (sessionId: string) => void;
  onSavedSessionSftp: (session: SavedSession) => void;
  onRecentSessionConnect: (session: RecentSession) => void;
  onRecentSessionDelete: (sessionId: string) => void;
  onClearRecentSessions: () => void;
  onOpenSettings: () => void;
  onCreateFolder: (name: string, color?: string, parentId?: string) => void;
  onUpdateFolder: (id: string, name?: string, color?: string, expanded?: boolean) => void;
  onDeleteFolder: (id: string) => void;
  onMoveSessionToFolder: (sessionId: string, folderId: string | null) => void;
}

function Sidebar({
  isOpen,
  onClose,
  sessions: _sessions,
  savedSessions,
  folders,
  recentSessions,
  onSessionSelect: _onSessionSelect,
  onSavedSessionConnect,
  onSavedSessionEdit,
  onSavedSessionDelete,
  onSavedSessionSftp,
  onRecentSessionConnect,
  onRecentSessionDelete,
  onClearRecentSessions,
  onOpenSettings,
  onCreateFolder,
  onUpdateFolder,
  onDeleteFolder,
  onMoveSessionToFolder: _onMoveSessionToFolder,
}: SidebarProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Initialize expanded folders from saved state
  useEffect(() => {
    const expanded = new Set(folders.filter(f => f.expanded).map(f => f.id));
    setExpandedFolders(expanded);
  }, [folders]);

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
        onUpdateFolder(folderId, undefined, undefined, false);
      } else {
        newSet.add(folderId);
        onUpdateFolder(folderId, undefined, undefined, true);
      }
      return newSet;
    });
  };

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      onCreateFolder(newFolderName.trim());
      setNewFolderName("");
      setIsCreatingFolder(false);
    }
  };

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
      setIsCreatingFolder(false);
      setNewFolderName("");
    }
  }, [isOpen]);

  // Filter sessions based on search query
  const filteredSavedSessions = useMemo(() => {
    if (!searchQuery.trim()) return savedSessions;
    const query = searchQuery.toLowerCase();
    return savedSessions.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.host.toLowerCase().includes(query) ||
        s.username.toLowerCase().includes(query)
    );
  }, [savedSessions, searchQuery]);

  // Organize sessions by folder
  const sessionsByFolder = useMemo(() => {
    const result: Map<string | null, SavedSession[]> = new Map();
    result.set(null, []); // Root level sessions

    // Initialize all folders
    folders.forEach(folder => {
      result.set(folder.id, []);
    });

    // Distribute sessions to folders
    filteredSavedSessions.forEach(session => {
      const folderId = session.folder_id || null;
      if (!result.has(folderId)) {
        // Folder doesn't exist, put in root
        result.get(null)!.push(session);
      } else {
        result.get(folderId)!.push(session);
      }
    });

    return result;
  }, [filteredSavedSessions, folders]);

  // Get root level folders (no parent)
  const rootFolders = useMemo(() => {
    return folders.filter(f => !f.parent_id).sort((a, b) => a.order - b.order);
  }, [folders]);

  const filteredRecentSessions = useMemo(() => {
    if (!searchQuery.trim()) return recentSessions;
    const query = searchQuery.toLowerCase();
    return recentSessions.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.host.toLowerCase().includes(query) ||
        s.username.toLowerCase().includes(query)
    );
  }, [recentSessions, searchQuery]);

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
              placeholder="Rechercher..."
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



        {/* Sessions list */}
        <div className="flex-1 overflow-y-auto p-3">
          {/* Section sessions sauvegardées */}
          <SectionHeader
            icon={<Folder size={12} />}
            label="Sauvegardées"
            action={
              !searchQuery ? (
                <button
                  onClick={() => setIsCreatingFolder(true)}
                  className="p-1 rounded hover:bg-surface-0/50 text-text-muted hover:text-accent transition-colors"
                  title="Nouveau dossier"
                >
                  <FolderPlus size={12} />
                </button>
              ) : undefined
            }
          />

          {/* New folder input */}
          {isCreatingFolder && (
            <div className="flex items-center gap-2 px-3 py-2 mb-2">
              <Folder size={14} className="text-accent flex-shrink-0" />
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateFolder();
                  if (e.key === "Escape") {
                    setIsCreatingFolder(false);
                    setNewFolderName("");
                  }
                }}
                placeholder="Nom du dossier..."
                className="flex-1 bg-crust rounded px-2 py-1 text-sm text-text placeholder:text-text-muted/50 border border-transparent focus:border-accent/50 focus:outline-none"
                autoFocus
              />
              <button
                onClick={handleCreateFolder}
                className="p-1 rounded hover:bg-accent/20 text-accent transition-colors"
              >
                <Plus size={14} />
              </button>
              <button
                onClick={() => {
                  setIsCreatingFolder(false);
                  setNewFolderName("");
                }}
                className="p-1 rounded hover:bg-error/20 text-text-muted hover:text-error transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          )}

          <div className="space-y-1 mb-4">
            {filteredSavedSessions.length === 0 && folders.length === 0 ? (
              <p className="text-xs text-text-muted px-3 py-4 text-center">
                {searchQuery
                  ? "Aucun résultat"
                  : "Aucune connexion sauvegardée"}
              </p>
            ) : (
              <>
                {/* Render folders */}
                {rootFolders.map((folder) => (
                  <FolderItem
                    key={folder.id}
                    folder={folder}
                    sessions={sessionsByFolder.get(folder.id) || []}
                    isExpanded={expandedFolders.has(folder.id)}
                    onToggle={() => toggleFolder(folder.id)}
                    onDelete={() => onDeleteFolder(folder.id)}
                    onSessionConnect={onSavedSessionConnect}
                    onSessionEdit={onSavedSessionEdit}
                    onSessionDelete={onSavedSessionDelete}
                    onSessionSftp={onSavedSessionSftp}
                    allFolders={folders}
                    onMoveSessionToFolder={_onMoveSessionToFolder}
                  />
                ))}

                {/* Render root level sessions (no folder) - also drop zone */}
                <RootDropZone onDrop={(sessionId) => _onMoveSessionToFolder(sessionId, null)}>
                  {(sessionsByFolder.get(null) || []).map((session) => (
                    <SavedSessionItem
                      key={session.id}
                      session={session}
                      onClick={() => onSavedSessionConnect(session)}
                      onEdit={() => onSavedSessionEdit(session)}
                      onDelete={() => onSavedSessionDelete(session.id)}
                      onSftp={() => onSavedSessionSftp(session)}
                      folders={folders}
                      onMoveToFolder={(folderId) => _onMoveSessionToFolder(session.id, folderId)}
                    />
                  ))}
                </RootDropZone>
              </>
            )}
          </div>

          {/* Section récentes */}
          <SectionHeader
            icon={<Clock size={12} />}
            label="Récentes"
            action={
              recentSessions.length > 0 && !searchQuery ? (
                <button
                  onClick={onClearRecentSessions}
                  className="text-[10px] text-text-muted hover:text-error transition-colors"
                >
                  Effacer
                </button>
              ) : undefined
            }
          />
          <div className="space-y-1">
            {filteredRecentSessions.length === 0 ? (
              <p className="text-xs text-text-muted px-3 py-4 text-center">
                {searchQuery ? "Aucun résultat" : "Aucune connexion récente"}
              </p>
            ) : (
              filteredRecentSessions.map((session) => (
                <RecentSessionItem
                  key={session.id}
                  session={session}
                  onClick={() => onRecentSessionConnect(session)}
                  onDelete={() => onRecentSessionDelete(session.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-surface-0/30">
          <button
            onClick={onOpenSettings}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-text-muted hover:text-text hover:bg-white/5 transition-colors"
          >
            <Settings size={16} />
            <span className="text-sm">Paramètres</span>
          </button>
        </div>
      </div>
    </>
  );
}



interface SectionHeaderProps {
  icon: React.ReactNode;
  label: string;
  action?: React.ReactNode;
}

function SectionHeader({ icon, label, action }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between px-3 py-2 text-text-muted">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-wider">
          {label}
        </span>
      </div>
      {action}
    </div>
  );
}

interface SavedSessionItemProps {
  session: SavedSession;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSftp: () => void;
  folders?: SessionFolder[];
  onMoveToFolder?: (folderId: string | null) => void;
}

function SavedSessionItem({
  session,
  onClick,
  onEdit,
  onDelete,
  onSftp,
  folders = [],
  onMoveToFolder,
}: SavedSessionItemProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [showFolderSubmenu, setShowFolderSubmenu] = useState(false);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Fermer tous les autres context menus
    window.dispatchEvent(new CustomEvent("closeContextMenus"));
    setContextMenu({ x: e.clientX, y: e.clientY });
    setShowFolderSubmenu(false);
  };

  const closeContextMenu = () => {
    setContextMenu(null);
    setShowFolderSubmenu(false);
  };

  const handleAction = (action: () => void) => {
    action();
    closeContextMenu();
  };

  const handleMoveToFolder = (folderId: string | null) => {
    if (onMoveToFolder) {
      onMoveToFolder(folderId);
    }
    closeContextMenu();
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("sessionId", session.id);
    e.dataTransfer.effectAllowed = "move";
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
        draggable
        onDragStart={handleDragStart}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-left cursor-pointer"
      >
        <span style={{ color: session.color || undefined }} className={session.color ? "" : "text-accent"}>
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
            <span>Connecter</span>
          </button>
          <button
            onClick={() => handleAction(onSftp)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text hover:bg-surface-0/50 transition-colors"
          >
            <FolderOpen size={12} />
            <span>Ouvrir SFTP</span>
          </button>
          <div className="h-px bg-surface-0/30 my-1" />
          {folders.length > 0 && onMoveToFolder && (
            <div
              className="relative"
              onMouseEnter={() => setShowFolderSubmenu(true)}
              onMouseLeave={() => setShowFolderSubmenu(false)}
            >
              <button className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-xs text-text hover:bg-surface-0/50 transition-colors">
                <div className="flex items-center gap-2">
                  <FolderInput size={12} />
                  <span>Déplacer vers</span>
                </div>
                <ChevronRight size={12} />
              </button>
              {showFolderSubmenu && (
                <div className="absolute left-full top-0 ml-1 min-w-[140px] bg-crust border border-surface-0/50 rounded-lg shadow-xl py-1">
                  {session.folder_id && (
                    <button
                      onClick={() => handleMoveToFolder(null)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text hover:bg-surface-0/50 transition-colors"
                    >
                      <Home size={12} />
                      <span>Racine</span>
                    </button>
                  )}
                  {folders.filter(f => f.id !== session.folder_id).map((folder) => (
                    <button
                      key={folder.id}
                      onClick={() => handleMoveToFolder(folder.id)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text hover:bg-surface-0/50 transition-colors"
                    >
                      <Folder size={12} style={{ color: folder.color || undefined }} />
                      <span className="truncate">{folder.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button
            onClick={() => handleAction(onEdit)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text hover:bg-surface-0/50 transition-colors"
          >
            <Pencil size={12} />
            <span>Modifier</span>
          </button>
          <div className="h-px bg-surface-0/30 my-1" />
          <button
            onClick={() => handleAction(onDelete)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-error hover:bg-error/10 transition-colors"
          >
            <Trash2 size={12} />
            <span>Supprimer</span>
          </button>
        </div>,
        document.body
      )}
    </>
  );
}

interface FolderItemProps {
  folder: SessionFolder;
  sessions: SavedSession[];
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onSessionConnect: (session: SavedSession) => void;
  onSessionEdit: (session: SavedSession) => void;
  onSessionDelete: (sessionId: string) => void;
  onSessionSftp: (session: SavedSession) => void;
  allFolders: SessionFolder[];
  onMoveSessionToFolder: (sessionId: string, folderId: string | null) => void;
}

function FolderItem({
  folder,
  sessions,
  isExpanded,
  onToggle,
  onDelete,
  onSessionConnect,
  onSessionEdit,
  onSessionDelete,
  onSessionSftp,
  allFolders,
  onMoveSessionToFolder,
}: FolderItemProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const sessionId = e.dataTransfer.getData("sessionId");
    if (sessionId) {
      onMoveSessionToFolder(sessionId, folder.id);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Fermer tous les autres context menus
    window.dispatchEvent(new CustomEvent("closeContextMenus"));
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  // Close context menu on outside click or when another menu opens
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    const handleCloseAll = () => setContextMenu(null);
    
    document.addEventListener("click", handleClick);
    window.addEventListener("closeContextMenus", handleCloseAll);
    
    return () => {
      document.removeEventListener("click", handleClick);
      window.removeEventListener("closeContextMenus", handleCloseAll);
    };
  }, []);

  return (
    <div>
      {/* Folder header */}
      <div
        onClick={onToggle}
        onContextMenu={handleContextMenu}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer ${
          isDragOver ? "bg-accent/20 ring-1 ring-accent/50" : ""
        }`}
      >
        <span className="text-text-muted">
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        <span style={{ color: folder.color || undefined }}>
          <Folder size={16} />
        </span>
        <span className="flex-1 text-sm font-medium text-text truncate">
          {folder.name}
        </span>
        <span className="text-[10px] text-text-muted">
          {sessions.length}
        </span>
      </div>

      {/* Folder context menu - rendered via Portal to escape transform context */}
      {contextMenu && createPortal(
        <div
          className="fixed z-[100] min-w-[140px] bg-crust border border-surface-0/50 rounded-lg shadow-xl py-1"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => { onDelete(); setContextMenu(null); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-error hover:bg-error/10 transition-colors"
          >
            <Trash2 size={12} />
            <span>Supprimer le dossier</span>
          </button>
        </div>,
        document.body
      )}

      {/* Folder contents */}
      {isExpanded && sessions.length > 0 && (
        <div className="ml-4 pl-2 border-l border-surface-0/30">
          {sessions.map((session) => (
            <SavedSessionItem
              key={session.id}
              session={session}
              onClick={() => onSessionConnect(session)}
              onEdit={() => onSessionEdit(session)}
              onDelete={() => onSessionDelete(session.id)}
              onSftp={() => onSessionSftp(session)}
              folders={allFolders}
              onMoveToFolder={(folderId) => onMoveSessionToFolder(session.id, folderId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface RootDropZoneProps {
  children: React.ReactNode;
  onDrop: (sessionId: string) => void;
}

function RootDropZone({ children, onDrop }: RootDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const sessionId = e.dataTransfer.getData("sessionId");
    if (sessionId) {
      onDrop(sessionId);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`min-h-[20px] rounded transition-colors ${isDragOver ? "bg-accent/10" : ""}`}
    >
      {children}
    </div>
  );
}

interface RecentSessionItemProps {
  session: RecentSession;
  onClick: () => void;
  onDelete: () => void;
}

function RecentSessionItem({
  session,
  onClick,
  onDelete,
}: RecentSessionItemProps) {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onDelete();
  };

  // Format relative time
  const getRelativeTime = (timestamp: number) => {
    const now = Date.now() / 1000;
    const diff = now - timestamp;

    if (diff < 60) return "maintenant";
    if (diff < 3600) return `il y a ${Math.floor(diff / 60)}min`;
    if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
    if (diff < 604800) return `il y a ${Math.floor(diff / 86400)}j`;
    return new Date(timestamp * 1000).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
    });
  };

  return (
    <div
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-left group cursor-pointer"
    >
      <span className="text-text-muted">
        <Clock size={16} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-text truncate">
          {session.name}
        </div>
        <div className="text-[11px] text-text-muted truncate">
          {session.username}@{session.host} ·{" "}
          {getRelativeTime(session.last_used)}
        </div>
      </div>
      <button
        onClick={handleDelete}
        className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-error/20 text-text-muted hover:text-error transition-all"
        title="Supprimer"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

export default Sidebar;
