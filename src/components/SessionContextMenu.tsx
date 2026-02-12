import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  Terminal,
  FolderOpen,
  ArrowLeftRight,
  Pencil,
  Trash2,
  Folder,
  Tag,
} from "lucide-react";
import type { SavedSession } from "../types";
import { pluginManager } from "../plugins";
import type { ContextMenuItemConfig, ContextMenuContext } from "../plugins";

interface SessionContextMenuProps {
  session: SavedSession;
  position: { x: number; y: number };
  onClose: () => void;
  onConnect: (session: SavedSession) => void;
  onEdit: (session: SavedSession) => void;
  onDelete: (sessionId: string) => void;
  onSftp: (session: SavedSession) => void;
  onTunnel: (session: SavedSession) => void;
}

/** Map icon names to Lucide components (12px) */
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

export default function SessionContextMenu({
  session,
  position,
  onClose,
  onConnect,
  onEdit,
  onDelete,
  onSftp,
  onTunnel,
}: SessionContextMenuProps) {
  const { t } = useTranslation();
  const [pluginMenuItems, setPluginMenuItems] = useState<{ pluginId: string; item: ContextMenuItemConfig }[]>([]);

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

  // Close on outside click, Escape, or closeContextMenus event
  useEffect(() => {
    const handleClick = () => onClose();
    const handleCloseAll = () => onClose();

    document.addEventListener("click", handleClick);
    globalThis.addEventListener("closeContextMenus", handleCloseAll);

    return () => {
      document.removeEventListener("click", handleClick);
      globalThis.removeEventListener("closeContextMenus", handleCloseAll);
    };
  }, [onClose]);

  const handleConnect = useCallback(() => { onConnect(session); onClose(); }, [session, onConnect, onClose]);
  const handleSftp = useCallback(() => { onSftp(session); onClose(); }, [session, onSftp, onClose]);
  const handleTunnel = useCallback(() => { onTunnel(session); onClose(); }, [session, onTunnel, onClose]);
  const handleEdit = useCallback(() => { onEdit(session); onClose(); }, [session, onEdit, onClose]);
  const handleDelete = useCallback(() => { onDelete(session.id); onClose(); }, [session.id, onDelete, onClose]);

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
    onClose();
  };

  return createPortal(
    <div
      className="fixed z-[100] min-w-[160px] bg-crust border border-surface-0/50 rounded-lg shadow-xl py-1"
      style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0)`, left: 0, top: 0 }}
      role="menu"
      tabIndex={-1}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
    >
      <button
        onClick={handleConnect}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text hover:bg-surface-0/50 transition-colors"
      >
        <Terminal size={12} />
        <span>{t('sidebar.connect')}</span>
      </button>
      <button
        onClick={handleSftp}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text hover:bg-surface-0/50 transition-colors"
      >
        <FolderOpen size={12} />
        <span>{t('sidebar.openSftp')}</span>
      </button>
      <button
        onClick={handleTunnel}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-blue hover:bg-blue/10 transition-colors"
      >
        <ArrowLeftRight size={12} />
        <span>{t('sidebar.tunnelOnly')}</span>
      </button>
      <div className="h-px bg-surface-0/30 my-1" />
      <button
        onClick={handleEdit}
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
        onClick={handleDelete}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-error hover:bg-error/10 transition-colors"
      >
        <Trash2 size={12} />
        <span>{t('common.delete')}</span>
      </button>
    </div>,
    document.body
  );
}
