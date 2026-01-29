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
} from "lucide-react";
import { Session, SavedSession, RecentSession } from "../App";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: Session[];
  savedSessions: SavedSession[];
  recentSessions: RecentSession[];
  onLocalTerminal: () => void;
  onSessionSelect: (session: Session) => void;
  onSavedSessionConnect: (session: SavedSession) => void;
  onSavedSessionEdit: (session: SavedSession) => void;
  onSavedSessionDelete: (sessionId: string) => void;
  onRecentSessionConnect: (session: RecentSession) => void;
  onRecentSessionDelete: (sessionId: string) => void;
  onClearRecentSessions: () => void;
  onNewConnection: () => void;
  onOpenSettings: () => void;
}

function Sidebar({
  isOpen,
  onClose,
  sessions: _sessions,
  savedSessions,
  recentSessions,
  onLocalTerminal,
  onSessionSelect: _onSessionSelect,
  onSavedSessionConnect,
  onSavedSessionEdit,
  onSavedSessionDelete,
  onRecentSessionConnect,
  onRecentSessionDelete,
  onClearRecentSessions,
  onNewConnection,
  onOpenSettings,
}: SidebarProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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
          <SectionHeader icon={<Folder size={12} />} label="Sauvegardées" />
          <div className="space-y-1 mb-4">
            {filteredSavedSessions.length === 0 ? (
              <p className="text-xs text-text-muted px-3 py-4 text-center">
                {searchQuery
                  ? "Aucun résultat"
                  : "Aucune connexion sauvegardée"}
              </p>
            ) : (
              filteredSavedSessions.map((session) => (
                <SavedSessionItem
                  key={session.id}
                  session={session}
                  onClick={() => onSavedSessionConnect(session)}
                  onEdit={() => onSavedSessionEdit(session)}
                  onDelete={() => onSavedSessionDelete(session.id)}
                />
              ))
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
}

function SavedSessionItem({
  session,
  onClick,
  onEdit,
  onDelete,
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

  return (
    <div
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-left group cursor-pointer"
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
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
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
