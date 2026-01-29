import { useEffect, useState, useMemo } from "react";
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
} from "lucide-react";
import { Session, SavedSession, RecentSession, SessionFolder } from "../App";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: Session[];
  savedSessions: SavedSession[];
  folders: SessionFolder[];
  recentSessions: RecentSession[];
  onLocalTerminal: () => void;
  onSessionSelect: (session: Session) => void;
  onSavedSessionConnect: (session: SavedSession) => void;
  onSavedSessionEdit: (session: SavedSession) => void;
  onSavedSessionDelete: (sessionId: string) => void;
  onSavedSessionSftp: (session: SavedSession) => void;
  onRecentSessionConnect: (session: RecentSession) => void;
  onRecentSessionDelete: (sessionId: string) => void;
  onClearRecentSessions: () => void;
  onNewConnection: () => void;
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
  onLocalTerminal,
  onSessionSelect: _onSessionSelect,
  onSavedSessionConnect,
  onSavedSessionEdit,
  onSavedSessionDelete,
  onSavedSessionSftp,
  onRecentSessionConnect,
  onRecentSessionDelete,
  onClearRecentSessions,
  onNewConnection,
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

      {/* Sidebar panel - sous la titlebar */}
      <div
        className={`
          fixed top-10 left-0 bottom-0 z-40 w-72
          bg-mantle/95 backdrop-blur-xl border-r border-surface-0/50
          flex flex-col
          ${isAnimating ? "animate-slide-in" : "animate-slide-out"}
        `}
      >
        {/* Header */}
        <div className="h-14 px-4 flex items-center justify-between border-b border-surface-0/30">
          <span className="text-sm font-semibold text-text tracking-tight">
            SimplyTerm
          </span>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text hover:bg-white/5 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

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

        {/* Quick actions */}
        <div className="p-3 border-b border-surface-0/30">
          <div className="grid grid-cols-2 gap-2">
            <QuickAction
              icon={<Terminal size={18} />}
              label="Local"
              onClick={onLocalTerminal}
              color="success"
            />
            <QuickAction
              icon={<Plus size={18} />}
              label="SSH"
              onClick={onNewConnection}
              color="accent"
            />
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
                  />
                ))}

                {/* Render root level sessions (no folder) */}
                {(sessionsByFolder.get(null) || []).map((session) => (
                  <SavedSessionItem
                    key={session.id}
                    session={session}
                    onClick={() => onSavedSessionConnect(session)}
                    onEdit={() => onSavedSessionEdit(session)}
                    onDelete={() => onSavedSessionDelete(session.id)}
                    onSftp={() => onSavedSessionSftp(session)}
                  />
                ))}
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

interface QuickActionProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  color: "success" | "accent";
}

function QuickAction({ icon, label, onClick, color }: QuickActionProps) {
  const colorClasses = {
    success: "text-success hover:bg-success/10",
    accent: "text-accent hover:bg-accent/10",
  };

  return (
    <button
      onClick={onClick}
      className={`
        flex items-center justify-center gap-2 py-3 rounded-xl
        bg-surface-0/30 transition-all duration-200
        ${colorClasses[color]}
      `}
    >
      {icon}
      <span className="text-xs font-medium text-text">{label}</span>
    </button>
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
}

function SavedSessionItem({
  session,
  onClick,
  onEdit,
  onDelete,
  onSftp,
}: SavedSessionItemProps) {
  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onEdit();
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onDelete();
  };

  const handleSftp = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onSftp();
  };

  return (
    <div
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-left group cursor-pointer"
    >
      <span style={{ color: session.color || undefined }} className={session.color ? "" : "text-accent"}>
        <Monitor size={16} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text truncate">
            {session.name}
          </span>
          {session.tags && session.tags.length > 0 && (
            <div className="flex gap-1">
              {session.tags.slice(0, 2).map((tag, i) => (
                <span
                  key={i}
                  className="px-1.5 py-0.5 text-[9px] rounded bg-surface-0/50 text-text-muted"
                >
                  {tag}
                </span>
              ))}
              {session.tags.length > 2 && (
                <span className="text-[9px] text-text-muted">+{session.tags.length - 2}</span>
              )}
            </div>
          )}
        </div>
        <div className="text-[11px] text-text-muted truncate">
          {session.username}@{session.host}:{session.port}
        </div>
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
        <button
          onClick={handleSftp}
          className="p-1.5 rounded-md hover:bg-blue/20 text-text-muted hover:text-blue transition-all"
          title="Ouvrir SFTP"
        >
          <FolderOpen size={14} />
        </button>
        <button
          onClick={handleEdit}
          className="p-1.5 rounded-md hover:bg-accent/20 text-text-muted hover:text-accent transition-all"
          title="Modifier"
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={handleDelete}
          className="p-1.5 rounded-md hover:bg-error/20 text-text-muted hover:text-error transition-all"
          title="Supprimer"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
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
}: FolderItemProps) {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onDelete();
  };

  return (
    <div>
      {/* Folder header */}
      <div
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer group"
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
        <button
          onClick={handleDelete}
          className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-error/20 text-text-muted hover:text-error transition-all"
          title="Supprimer le dossier"
        >
          <Trash2 size={12} />
        </button>
      </div>

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
            />
          ))}
        </div>
      )}
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
