import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  ChevronRight,
  Folder,
  FolderOpen,
  Monitor,
  Key,
  FolderPlus,
  Pencil,
  X,
  Check,
  Package,
  GripVertical,
} from "lucide-react";
import type { SavedSession, SshKeyProfileInfo } from "../../types";
import type { VaultFolder } from "../../types/vault";

/** Selection state used by the parent for export mode */
export interface TreeSelectionState {
  folders: Set<string>;
  sessions: Set<string>;
  sshKeys: Set<string>;
}

export type ItemType = "session" | "sshKey";

interface VaultTreeViewProps {
  folders: VaultFolder[];
  sessions: SavedSession[];
  sshKeys: SshKeyProfileInfo[];
  onCreateFolder: (name: string) => Promise<void>;
  onRenameFolder: (id: string, name: string) => Promise<void>;
  onDeleteFolder: (id: string) => Promise<void>;
  onMoveToFolder?: (type: ItemType, id: string, folderId: string | null) => Promise<void>;
  // Export selection mode
  selectionMode?: boolean;
  selection?: TreeSelectionState;
  onToggleSelection?: (type: "folder" | "session" | "sshKey", id: string) => void;
}

/** Styled checkbox matching Catppuccin theme */
export function StyledCheck({ checked, disabled, onClick, className }: Readonly<{
  checked: boolean;
  disabled?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
}>) {
  return (
    <label
      className={`inline-flex items-center justify-center w-[16px] h-[16px] rounded-[4px] border-[1.5px] transition-all duration-150 shrink-0 ${
        checked
          ? "bg-accent border-accent text-white"
          : "border-text-muted/30 bg-surface-0/10"
      } ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:border-accent/60"} ${className || ""}`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={() => { /* handled by parent onClick */ }}
        onClick={disabled ? undefined : onClick}
        className="sr-only"
      />
      {checked && <Check size={10} strokeWidth={3} />}
    </label>
  );
}

function FolderCreateInput({ value, onChange, onSubmit, onCancel, placeholder }: Readonly<{
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  placeholder: string;
}>) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit();
          if (e.key === "Escape") onCancel();
        }}
        placeholder={placeholder}
        autoFocus
        className="flex-1 px-2.5 py-1.5 bg-surface-0/30 border border-surface-0/50 rounded-lg text-xs text-text placeholder-text-muted/50 focus:outline-none focus:ring-1 focus:ring-accent"
      />
      <button onClick={onSubmit} disabled={!value.trim()} className="p-1.5 text-accent disabled:opacity-50">
        <Check size={14} />
      </button>
      <button onClick={onCancel} className="p-1.5 text-text-muted">
        <X size={14} />
      </button>
    </div>
  );
}

const ITEM_CONFIG: Record<ItemType, { icon: typeof Monitor; colorClass: string }> = {
  session: { icon: Monitor, colorClass: "text-accent" },
  sshKey: { icon: Key, colorClass: "text-success" },
};

// ── Custom drag system (pointer events, works in Tauri webview) ──

interface DragItem {
  type: ItemType;
  id: string;
  name: string;
}

interface DragState {
  item: DragItem;
  x: number;
  y: number;
}

/** Floating ghost element while dragging */
function DragGhost({ drag }: Readonly<{ drag: DragState }>) {
  const { icon: Icon, colorClass } = ITEM_CONFIG[drag.item.type];
  return (
    <div
      className="fixed pointer-events-none z-50 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-0 border border-accent/40 shadow-lg shadow-black/20 text-xs text-text"
      style={{ left: drag.x + 12, top: drag.y - 14 }}
    >
      <Icon size={14} className={colorClass} />
      {drag.item.name}
    </div>
  );
}

function TreeItem({
  id, type, name, subtitle,
  selectionMode, checked, disabled, onToggle,
  onDragStart,
}: Readonly<{
  id: string;
  type: ItemType;
  name: string;
  subtitle?: string;
  selectionMode?: boolean;
  checked?: boolean;
  disabled?: boolean;
  onToggle?: () => void;
  onDragStart?: (item: DragItem, e: React.PointerEvent) => void;
}>) {
  const { icon: Icon, colorClass } = ITEM_CONFIG[type];
  return (
    <div
      className={`group/item flex items-center gap-2.5 px-3 py-1.5 rounded-md hover:bg-surface-0/20 transition-colors ${
        selectionMode && !disabled ? "cursor-pointer" : ""
      }`}
      role={selectionMode && !disabled ? "button" : undefined}
      tabIndex={selectionMode && !disabled ? 0 : undefined}
      onClick={selectionMode && !disabled ? onToggle : undefined}
      onKeyDown={selectionMode && !disabled ? (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle?.(); }
      } : undefined}
    >
      {selectionMode && (
        <StyledCheck checked={checked || false} disabled={disabled} />
      )}
      {!selectionMode && onDragStart && (
        <button
          className="opacity-0 group-hover/item:opacity-60 hover:!opacity-100 cursor-grab active:cursor-grabbing text-text-muted transition-opacity touch-none"
          onPointerDown={(e) => {
            e.preventDefault();
            onDragStart({ type, id, name }, e);
          }}
        >
          <GripVertical size={12} />
        </button>
      )}
      <Icon size={14} className={`${colorClass} shrink-0`} />
      <div className="min-w-0 flex-1">
        <div className="text-xs text-text truncate">{name}</div>
        {subtitle && <div className="text-[10px] text-text-muted/70 truncate">{subtitle}</div>}
      </div>
    </div>
  );
}

function FolderNode({
  folder,
  sessions,
  sshKeys,
  onRename,
  onDelete,
  confirmingDelete,
  selectionMode,
  selection,
  onToggle,
  dropTargetId,
  onDropTargetRef,
  onDragStart,
}: Readonly<{
  folder: VaultFolder;
  sessions: SavedSession[];
  sshKeys: SshKeyProfileInfo[];
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  selectionMode?: boolean;
  selection?: TreeSelectionState;
  onToggle?: (type: "folder" | "session" | "sshKey", id: string) => void;
  dropTargetId?: string | null;
  onDropTargetRef?: (id: string, el: HTMLDivElement | null) => void;
  confirmingDelete?: boolean;
  onDragStart?: (item: DragItem, e: React.PointerEvent) => void;
}>) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const itemCount = sessions.length + sshKeys.length;
  const folderSelected = selection?.folders.has(folder.id) || false;
  const isDropTarget = dropTargetId === folder.id;

  const handleRename = async () => {
    if (renameValue.trim()) {
      await onRename(folder.id, renameValue.trim());
    }
    setIsRenaming(false);
    setRenameValue("");
  };

  return (
    <div>
      {/* Folder header — drop target */}
      <div
        ref={(el) => onDropTargetRef?.(folder.id, el)}
        className={`group relative flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-colors ${
          isDropTarget
            ? "bg-accent/15 ring-1 ring-accent/40"
            : "hover:bg-surface-0/20"
        }`}
      >
        {selectionMode && (
          <StyledCheck
            checked={folderSelected}
            onClick={(e) => { e.stopPropagation(); onToggle?.("folder", folder.id); }}
          />
        )}
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-0.5 text-text-muted hover:text-text transition-colors"
        >
          <ChevronRight
            size={14}
            className={`transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
          />
        </button>
        <Folder size={14} className="text-accent shrink-0" />
        {isRenaming ? (
          <input
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRename();
              if (e.key === "Escape") setIsRenaming(false);
            }}
            onBlur={handleRename}
            autoFocus
            className="flex-1 px-1.5 py-0.5 bg-surface-0/30 border border-surface-0/50 rounded text-xs text-text focus:outline-none focus:ring-1 focus:ring-accent min-w-0"
          />
        ) : (
          <span className="flex-1 text-xs font-medium text-text truncate">{folder.name}</span>
        )}
        <span className="text-[10px] text-text-muted/60 tabular-nums mr-1">({itemCount})</span>
        {!isRenaming && !selectionMode && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-surface-0/80 rounded px-0.5">
            <button
              onClick={() => { setIsRenaming(true); setRenameValue(folder.name); }}
              className="p-1 text-text-muted hover:text-text rounded transition-colors"
              title={t("settings.security.renameFolder")}
            >
              <Pencil size={12} />
            </button>
            <button
              onClick={() => onDelete(folder.id)}
              className={`p-1 rounded transition-colors ${
                confirmingDelete ? "text-error bg-error/10" : "text-text-muted hover:text-error"
              }`}
              title={confirmingDelete ? t("settings.security.folderDeleteConfirm") : t("settings.security.deleteFolder")}
            >
              <X size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Folder children */}
      <div
        className="grid transition-[grid-template-rows] duration-200"
        style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="ml-4 pl-3 border-l border-surface-0/20 py-0.5">
            {itemCount === 0 ? (
              <div className="px-3 py-1.5 text-[10px] text-text-muted/50 italic">
                {t("settings.security.emptyFolder")}
              </div>
            ) : (
              <>
                {sessions.map((s) => (
                  <TreeItem
                    key={s.id} id={s.id} type="session" name={s.name}
                    subtitle={`${s.username}@${s.host}:${s.port}`}
                    selectionMode={selectionMode}
                    checked={(selection?.sessions.has(s.id) || folderSelected)}
                    disabled={folderSelected}
                    onToggle={() => onToggle?.("session", s.id)}
                    onDragStart={onDragStart}
                  />
                ))}
                {sshKeys.map((k) => (
                  <TreeItem
                    key={k.id} id={k.id} type="sshKey" name={k.name} subtitle={k.keyPath}
                    selectionMode={selectionMode}
                    checked={(selection?.sshKeys.has(k.id) || folderSelected)}
                    disabled={folderSelected}
                    onToggle={() => onToggle?.("sshKey", k.id)}
                    onDragStart={onDragStart}
                  />
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VaultTreeView({
  folders,
  sessions,
  sshKeys,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveToFolder,
  selectionMode,
  selection,
  onToggleSelection,
}: Readonly<VaultTreeViewProps>) {
  const { t } = useTranslation();
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [ungroupedExpanded, setUngroupedExpanded] = useState(true);

  // ── Custom drag state ──
  const [drag, setDrag] = useState<DragState | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null | undefined>(undefined); // null = "no folder", undefined = none
  const dropRefs = useRef<Map<string, HTMLDivElement>>(new Map()); // folder id → header el
  const noFolderRef = useRef<HTMLDivElement>(null);

  const registerDropRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) dropRefs.current.set(id, el);
    else dropRefs.current.delete(id);
  }, []);

  const handleDragStart = useCallback((item: DragItem, e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ item, x: e.clientX, y: e.clientY });
    setDropTargetId(undefined);
  }, []);

  // Pointer move + up handlers (attached to window during drag)
  useEffect(() => {
    if (!drag) return;

    const handleMove = (e: PointerEvent) => {
      setDrag(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);

      // Hit-test drop targets
      let found: string | null | undefined = undefined;
      // Check folder headers
      for (const [folderId, el] of dropRefs.current) {
        const rect = el.getBoundingClientRect();
        if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
          found = folderId;
          break;
        }
      }
      // Check "no folder" header
      if (found === undefined && noFolderRef.current) {
        const rect = noFolderRef.current.getBoundingClientRect();
        if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
          found = null;
        }
      }
      setDropTargetId(found);
    };

    const handleUp = () => {
      if (drag && dropTargetId !== undefined && onMoveToFolder) {
        onMoveToFolder(drag.item.type, drag.item.id, dropTargetId);
      }
      setDrag(null);
      setDropTargetId(undefined);
    };

    globalThis.addEventListener("pointermove", handleMove);
    globalThis.addEventListener("pointerup", handleUp);
    return () => {
      globalThis.removeEventListener("pointermove", handleMove);
      globalThis.removeEventListener("pointerup", handleUp);
    };
  }, [drag, dropTargetId, onMoveToFolder]);

  const { folderGroups, ungrouped } = useMemo(() => {
    const groups = folders.map((f) => ({
      folder: f,
      sessions: sessions.filter((s) => s.folder_id === f.id),
      sshKeys: sshKeys.filter((k) => k.folderId === f.id),
    }));
    const folderIds = new Set(folders.map((f) => f.id));
    return {
      folderGroups: groups,
      ungrouped: {
        sessions: sessions.filter((s) => !s.folder_id || !folderIds.has(s.folder_id)),
        sshKeys: sshKeys.filter((k) => !k.folderId || !folderIds.has(k.folderId)),
      },
    };
  }, [folders, sessions, sshKeys]);

  const totalItems = sessions.length + sshKeys.length;
  const ungroupedCount = ungrouped.sessions.length + ungrouped.sshKeys.length;

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    await onCreateFolder(newFolderName.trim());
    setNewFolderName("");
    setIsCreatingFolder(false);
  };

  const handleDeleteFolder = async (id: string) => {
    if (confirmDeleteId === id) {
      setConfirmDeleteId(null);
      await onDeleteFolder(id);
    } else {
      setConfirmDeleteId(id);
      // Auto-reset after 3s
      setTimeout(() => setConfirmDeleteId(prev => prev === id ? null : prev), 3000);
    }
  };

  // Empty vault state
  if (totalItems === 0 && folders.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-surface-0/30 flex items-center justify-center mb-4">
          <Package size={32} className="text-text-muted/50" />
        </div>
        <h3 className="text-sm font-medium text-text mb-1">{t("settings.security.emptyVault")}</h3>
        <p className="text-xs text-text-muted/60 mb-4">{t("settings.security.emptyVaultDesc")}</p>
        <button
          onClick={() => setIsCreatingFolder(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-accent hover:bg-accent/10 rounded-lg transition-colors"
        >
          <FolderPlus size={14} />
          {t("settings.security.createFolder")}
        </button>
        {isCreatingFolder && (
          <div className="mt-3">
            <FolderCreateInput
              value={newFolderName}
              onChange={setNewFolderName}
              onSubmit={handleCreateFolder}
              onCancel={() => { setIsCreatingFolder(false); setNewFolderName(""); }}
              placeholder={t("settings.security.folderNamePlaceholder")}
            />
          </div>
        )}
      </div>
    );
  }

  // Tree view
  return (
    <div className="flex-1 flex flex-col overflow-y-auto p-3">
      {/* Drag ghost (portal to body to avoid transform offset) */}
      {drag && createPortal(<DragGhost drag={drag} />, document.body)}

      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted/60">
          {t("settings.security.vaultContentsTitle")}
        </h3>
        <span className="text-[10px] text-text-muted/50 tabular-nums">
          {totalItems} {t("settings.security.vaultItems")}
        </span>
      </div>

      {/* Folder groups */}
      <div className="space-y-1 flex-1">
        {folderGroups.map((g) => (
          <FolderNode
            key={g.folder.id}
            folder={g.folder}
            sessions={g.sessions}
            sshKeys={g.sshKeys}
            onRename={onRenameFolder}
            onDelete={handleDeleteFolder}
            confirmingDelete={confirmDeleteId === g.folder.id}
            selectionMode={selectionMode}
            selection={selection}
            onToggle={onToggleSelection}
            dropTargetId={drag ? dropTargetId : undefined}
            onDropTargetRef={registerDropRef}
            onDragStart={onMoveToFolder ? handleDragStart : undefined}
          />
        ))}

        {/* Ungrouped items — styled like a folder, also a drop target */}
        {(ungroupedCount > 0 || folders.length > 0) && (
          <div>
            <div
              ref={noFolderRef}
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-colors ${
                drag && dropTargetId === null
                  ? "bg-accent/15 ring-1 ring-accent/40"
                  : "hover:bg-surface-0/20"
              }`}
            >
              <button
                onClick={() => setUngroupedExpanded(!ungroupedExpanded)}
                className="p-0.5 text-text-muted hover:text-text transition-colors"
              >
                <ChevronRight
                  size={14}
                  className={`transition-transform duration-200 ${ungroupedExpanded ? "rotate-90" : ""}`}
                />
              </button>
              <FolderOpen size={14} className="text-text-muted/40" />
              <span className="flex-1 text-xs font-medium text-text-muted/60">{t("settings.security.noFolder")}</span>
              <span className="text-[10px] text-text-muted/60 tabular-nums mr-1">({ungroupedCount})</span>
            </div>
            {ungroupedCount > 0 && (
              <div
                className="grid transition-[grid-template-rows] duration-200"
                style={{ gridTemplateRows: ungroupedExpanded ? "1fr" : "0fr" }}
              >
                <div className="overflow-hidden">
                  <div className="ml-4 pl-3 border-l border-surface-0/20 py-0.5">
                    {ungrouped.sessions.map((s) => (
                      <TreeItem
                        key={s.id} id={s.id} type="session" name={s.name}
                        subtitle={`${s.username}@${s.host}:${s.port}`}
                        selectionMode={selectionMode}
                        checked={selection?.sessions.has(s.id)}
                        onToggle={() => onToggleSelection?.("session", s.id)}
                        onDragStart={onMoveToFolder ? handleDragStart : undefined}
                      />
                    ))}
                    {ungrouped.sshKeys.map((k) => (
                      <TreeItem
                        key={k.id} id={k.id} type="sshKey" name={k.name} subtitle={k.keyPath}
                        selectionMode={selectionMode}
                        checked={selection?.sshKeys.has(k.id)}
                        onToggle={() => onToggleSelection?.("sshKey", k.id)}
                        onDragStart={onMoveToFolder ? handleDragStart : undefined}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* New folder button (hidden in selection mode) */}
      {!selectionMode && (
        <div className="mt-3 pt-3">
          {isCreatingFolder ? (
            <FolderCreateInput
              value={newFolderName}
              onChange={setNewFolderName}
              onSubmit={handleCreateFolder}
              onCancel={() => { setIsCreatingFolder(false); setNewFolderName(""); }}
              placeholder={t("settings.security.folderNamePlaceholder")}
            />
          ) : (
            <button
              onClick={() => setIsCreatingFolder(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-accent hover:bg-accent/10 rounded-lg transition-colors w-full"
            >
              <FolderPlus size={14} />
              {t("settings.security.createFolder")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
