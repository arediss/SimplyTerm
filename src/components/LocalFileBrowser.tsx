import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import { getErrorMessage } from "../utils";
import { useTranslation } from "react-i18next";
import {
  Folder,
  RefreshCw,
  Home,
  ArrowUp,
  Loader2,
  Eye,
  EyeOff,
  Copy,
  CheckCircle2,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  HardDrive,
  FolderPlus,
  FilePlus,
  Edit3,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { getFileIcon } from "../utils/fileIcons";

interface LocalFileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified: number | null;
  permissions: string | null;
}

interface LocalFileBrowserProps {
  onDragStartFile: (localPath: string, fileName: string) => void;
  onClose: () => void;
  remoteDragging: { path: string; name: string; isDir: boolean } | null;
  localCurrentPathRef: React.RefObject<string>;
  refreshTrigger: number;
}


const TOOLBAR_BTN = "p-1.5 rounded hover:bg-surface-0/50 text-text-muted hover:text-text transition-colors";

export function LocalFileBrowser({ onDragStartFile, onClose, remoteDragging, localCurrentPathRef, refreshTrigger }: Readonly<LocalFileBrowserProps>) {
  const { t } = useTranslation();
  const [currentPath, setCurrentPath] = useState("");
  const [entries, setEntries] = useState<LocalFileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [editingPath, setEditingPath] = useState(false);
  const [pathInputValue, setPathInputValue] = useState("");
  const [pathCopied, setPathCopied] = useState(false);

  // Context menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; entry: LocalFileEntry | null } | null>(null);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFileDialog, setShowNewFileDialog] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<LocalFileEntry | null>(null);
  const [renamingEntry, setRenamingEntry] = useState<LocalFileEntry | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const fileListRef = useRef<HTMLDivElement>(null);
  const ctxMenuRef = useRef<HTMLElement>(null);

  // Sorting
  const [sortColumn, setSortColumn] = useState<"name" | "size" | "modified">("name");
  const [sortAsc, setSortAsc] = useState(true);
  const handleSort = (col: "name" | "size" | "modified") => {
    if (sortColumn === col) { setSortAsc((v) => !v); }
    else { setSortColumn(col); setSortAsc(true); }
  };

  const loadDirectory = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<LocalFileEntry[]>("local_list_dir", { path });
      setEntries(result);
      setCurrentPath(path);
      localCurrentPathRef.current = path;
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [localCurrentPathRef]);

  // Load home directory on mount
  useEffect(() => {
    invoke<string>("get_home_dir").then((home) => {
      loadDirectory(home);
    }).catch((err) => setError(getErrorMessage(err)));
  }, [loadDirectory]);

  // Refresh when parent signals (e.g. after SFTP download)
  useEffect(() => {
    if (refreshTrigger > 0 && currentPath) {
      loadDirectory(currentPath);
    }
  }, [refreshTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGoUp = () => {
    // Normalize separators for cross-platform
    const normalized = currentPath.replaceAll("\\", "/");
    const parts = normalized.split("/").filter(Boolean);
    if (parts.length <= 1) {
      // On Windows, going up from C:/ stays at C:/
      const drive = parts[0] ?? "";
      if (drive.includes(":")) {
        loadDirectory(drive + "/");
      }
      return;
    }
    parts.pop();
    const parent = parts.join("/");
    // Keep drive letter format on Windows (C:/)
    loadDirectory(parent.includes(":") ? parent + "/" : "/" + parent);
  };

  const handleGoHome = () => {
    invoke<string>("get_home_dir").then((home) => {
      loadDirectory(home);
    }).catch((err) => setError(getErrorMessage(err)));
  };

  // Close context menu on click outside + attach menu event handlers imperatively (avoids S6847)
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    globalThis.addEventListener("click", close);
    const el = ctxMenuRef.current;
    if (el) {
      const stopProp = (e: Event) => e.stopPropagation();
      const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setContextMenu(null); };
      el.addEventListener("click", stopProp);
      el.addEventListener("keydown", onKey);
      return () => { globalThis.removeEventListener("click", close); el.removeEventListener("click", stopProp); el.removeEventListener("keydown", onKey); };
    }
    return () => globalThis.removeEventListener("click", close);
  }, [contextMenu]);

  const handleContextMenu = (e: React.MouseEvent, entry: LocalFileEntry | null) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, entry });
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    const sep = currentPath.includes("\\") ? "\\" : "/";
    const normalizedCurrent = currentPath.endsWith(sep) ? currentPath.slice(0, -1) : currentPath;
    const fullPath = `${normalizedCurrent}${sep}${newFolderName.trim()}`;
    try {
      await invoke("local_mkdir", { path: fullPath });
      setShowNewFolderDialog(false);
      setNewFolderName("");
      loadDirectory(currentPath);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleCreateFile = async () => {
    if (!newFileName.trim()) return;
    const sep = currentPath.includes("\\") ? "\\" : "/";
    const normalizedCurrent = currentPath.endsWith(sep) ? currentPath.slice(0, -1) : currentPath;
    const fullPath = `${normalizedCurrent}${sep}${newFileName.trim()}`;
    try {
      await invoke("local_create_file", { path: fullPath });
      setShowNewFileDialog(false);
      setNewFileName("");
      loadDirectory(currentPath);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await invoke("local_delete", { path: deleteTarget.path, isDir: deleteTarget.is_dir });
      setDeleteTarget(null);
      loadDirectory(currentPath);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleRename = async () => {
    if (!renamingEntry || !renameValue.trim()) return;
    const sep = currentPath.includes("\\") ? "\\" : "/";
    const normalizedCurrent = currentPath.endsWith(sep) ? currentPath.slice(0, -1) : currentPath;
    const newPath = `${normalizedCurrent}${sep}${renameValue.trim()}`;
    try {
      await invoke("local_rename", { oldPath: renamingEntry.path, newPath });
      setRenamingEntry(null);
      setRenameValue("");
      loadDirectory(currentPath);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const visibleEntries = useMemo(() => {
    const filtered = showHidden ? entries : entries.filter((e) => !e.name.startsWith("."));
    return [...filtered].sort((a, b) => {
      if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
      let cmp = 0;
      if (sortColumn === "name") cmp = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
      else if (sortColumn === "size") cmp = a.size - b.size;
      else if (sortColumn === "modified") cmp = (a.modified ?? 0) - (b.modified ?? 0);
      return sortAsc ? cmp : -cmp;
    });
  }, [entries, showHidden, sortColumn, sortAsc]);

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return "-";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  };

  const formatDate = (timestamp: number | null): string => {
    if (!timestamp) return "-";
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  // Breadcrumb segments
  const pathSegments = useMemo(() => {
    const normalized = currentPath.replaceAll("\\", "/");
    const parts = normalized.split("/").filter(Boolean);
    return parts.map((segment, i) => {
      const targetPath = parts.slice(0, i + 1).join("/");
      // Keep drive letter format on Windows
      const fullPath = targetPath.includes(":") ? targetPath + "/" : "/" + targetPath;
      return { segment, targetPath: fullPath };
    });
  }, [currentPath]);

  // Attach drag-over and context menu handlers imperatively to avoid S6848 (non-native interactive div)
  useEffect(() => {
    const el = fileListRef.current;
    if (!el) return;
    const onDragOver = (e: DragEvent) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = "copy"; };
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY, entry: null });
    };
    el.addEventListener("dragover", onDragOver);
    el.addEventListener("contextmenu", onContextMenu);
    return () => { el.removeEventListener("dragover", onDragOver); el.removeEventListener("contextmenu", onContextMenu); };
  }, []);

  return (
    <section
      aria-label="Local file browser"
      className={`h-full flex flex-col text-text relative ${remoteDragging ? "ring-2 ring-inset ring-accent/50 bg-accent/5" : ""}`}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-surface-0/30">
        <button
          onClick={onClose}
          className="shrink-0 p-1.5 rounded transition-colors text-green bg-green/10 hover:bg-green/20"
          title={t("sftp.hideLocal", "Hide local files")}
        >
          <HardDrive size={14} />
        </button>
        <div className="w-px h-4 bg-surface-0/30 mx-1" />
        <button onClick={handleGoHome} className={TOOLBAR_BTN} title={t("sftp.home")}>
          <Home size={14} />
        </button>
        <button onClick={handleGoUp} className={TOOLBAR_BTN} title={t("sftp.goUp")}>
          <ArrowUp size={14} />
        </button>
        <button onClick={() => loadDirectory(currentPath)} className={TOOLBAR_BTN} title={t("sftp.refresh")}>
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
        <div className="w-px h-4 bg-surface-0/30 mx-1" />
        <button
          onClick={() => setShowHidden((v) => !v)}
          className={`p-1.5 rounded transition-colors ${showHidden ? "text-accent bg-accent/10 hover:bg-accent/20" : "text-text-muted hover:bg-surface-0/50 hover:text-text"}`}
          title={showHidden ? t("sftp.hideHidden", "Hide hidden files") : t("sftp.showHidden", "Show hidden files")}
        >
          {showHidden ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
        <div className="w-px h-4 bg-surface-0/30 mx-1" />
        <button onClick={() => { setShowNewFolderDialog(true); setNewFolderName(""); }} className={TOOLBAR_BTN} title={t("sftp.newFolder")}>
          <FolderPlus size={14} />
        </button>
        <button onClick={() => { setShowNewFileDialog(true); setNewFileName(""); }} className={TOOLBAR_BTN} title={t("sftp.newFile", "New file")}>
          <FilePlus size={14} />
        </button>

        {/* Path breadcrumb */}
        <div className="flex-1 mx-2 px-2 py-1 bg-surface-0/10 rounded border border-surface-0/20 text-xs text-text-muted flex items-center gap-0 min-w-0">
          {editingPath ? (
            <input
              type="text"
              value={pathInputValue}
              onChange={(e) => setPathInputValue(e.target.value)}
              className="flex-1 bg-transparent text-text outline-none min-w-0"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") { setEditingPath(false); loadDirectory(pathInputValue.trim() || currentPath); }
                if (e.key === "Escape") setEditingPath(false);
              }}
              onBlur={() => setEditingPath(false)}
            />
          ) : (
            <div className="flex items-center gap-0 min-w-0 overflow-hidden flex-1">
              {pathSegments.map(({ segment, targetPath }, i) => (
                <span key={targetPath} className="flex items-center shrink-0">
                  {i > 0 && <ChevronRight size={10} className="text-text-muted/40 mx-0.5" />}
                  <button
                    onClick={() => loadDirectory(targetPath)}
                    className={`hover:text-text transition-colors px-0.5 truncate max-w-[100px] ${i === pathSegments.length - 1 ? "text-text" : ""}`}
                    title={targetPath}
                  >
                    {segment}
                  </button>
                </span>
              ))}
            </div>
          )}
          <button
            onClick={() => { setEditingPath(true); setPathInputValue(currentPath); }}
            className="shrink-0 ml-1 p-0.5 rounded hover:bg-surface-0/40 transition-colors text-text-muted hover:text-text"
            title={t("sftp.editPath", "Edit path")}
          >
            <Edit3 size={11} />
          </button>
          <button
            onClick={async () => {
              await navigator.clipboard.writeText(currentPath);
              setPathCopied(true);
              setTimeout(() => setPathCopied(false), 1500);
            }}
            className="shrink-0 ml-1 p-0.5 rounded hover:bg-surface-0/40 transition-colors"
            title={t("sftp.copyPath", "Copy path")}
          >
            {pathCopied ? <CheckCircle2 size={11} className="text-green" /> : <Copy size={11} />}
          </button>
        </div>
      </div>

      {/* Drop overlay when SFTP drag is active */}
      {remoteDragging && (
        <div className="absolute inset-0 z-40 bg-accent/10 border-2 border-dashed border-accent/50 rounded flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-2 text-accent">
            <HardDrive size={28} />
            <span className="text-sm font-medium">{t("sftp.dropToDownload", "Release here to download")}</span>
            <span className="text-xs text-accent/60">{remoteDragging.name}</span>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-3 py-2 border-b bg-red/10 border-red/20 text-red text-xs">
          {error}
        </div>
      )}

      {/* File list */}
      <div
        ref={fileListRef}
        className="flex-1 overflow-auto"
      >
        {loading && entries.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <Loader2 size={24} className="animate-spin text-text-muted" />
          </div>
        )}
        {!loading && visibleEntries.length === 0 && (
          <div className="flex items-center justify-center h-full text-text-muted text-sm">
            {t("sftp.emptyDirectory")}
          </div>
        )}
        {visibleEntries.length > 0 && (
          <table className="w-full text-sm">
            <thead className="sticky top-0 text-text-muted text-xs bg-crust/80 backdrop-blur-sm">
              <tr className="border-b border-surface-0/30">
                <th className="text-left px-3 py-1.5 font-medium cursor-pointer select-none hover:text-text transition-colors" onClick={() => handleSort("name")}>
                  <span className="inline-flex items-center gap-1">{t("sftp.colName")} {sortColumn === "name" && (sortAsc ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}</span>
                </th>
                <th className="text-right px-3 py-1.5 font-medium w-20 cursor-pointer select-none hover:text-text transition-colors" onClick={() => handleSort("size")}>
                  <span className="inline-flex items-center gap-1 justify-end">{t("sftp.colSize")} {sortColumn === "size" && (sortAsc ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}</span>
                </th>
                <th className="text-right px-3 py-1.5 font-medium w-24 cursor-pointer select-none hover:text-text transition-colors" onClick={() => handleSort("modified")}>
                  <span className="inline-flex items-center gap-1 justify-end">{t("sftp.colModified")} {sortColumn === "modified" && (sortAsc ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleEntries.map((entry, index) => (
                <tr
                  key={entry.path}
                  draggable={!entry.is_dir}
                  onDragStart={(e) => {
                    if (entry.is_dir) return;
                    e.dataTransfer.setData("text/x-local-path", entry.path);
                    e.dataTransfer.setData("text/x-local-name", entry.name);
                    e.dataTransfer.effectAllowed = "copy";
                    onDragStartFile(entry.path, entry.name);
                  }}
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
                  className={`
                    border-b border-surface-0/10 cursor-pointer transition-colors
${index % 2 === 1 ? "bg-surface-0/5" : ""} hover:bg-surface-0/30
                  `}
                  onDoubleClick={() => { if (entry.is_dir) loadDirectory(entry.path); }}
                  onContextMenu={(e) => handleContextMenu(e, entry)}
                >
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      {entry.is_dir ? (
                        <Folder size={14} className="text-yellow shrink-0" />
                      ) : (
                        (() => { const { icon: FileIcon, color } = getFileIcon(entry.name); return <FileIcon size={14} className={`${color} shrink-0`} />; })()
                      )}
                      {renamingEntry?.path === entry.path ? (
                        <input
                          ref={renameInputRef}
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          className="flex-1 bg-surface-0/20 text-text text-sm px-1 py-0 rounded border border-accent/40 outline-none min-w-0"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRename();
                            if (e.key === "Escape") { setRenamingEntry(null); setRenameValue(""); }
                          }}
                          onBlur={() => { setRenamingEntry(null); setRenameValue(""); }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className="truncate">{entry.name}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-1.5 text-right text-text-muted text-xs">
                    {entry.is_dir ? "-" : formatSize(entry.size)}
                  </td>
                  <td className="px-3 py-1.5 text-right text-text-muted text-xs">
                    {formatDate(entry.modified)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Status bar */}
      <div className="px-3 py-1 border-t border-surface-0/30 text-xs text-text-muted">
        {visibleEntries.length} {t("sftp.items", { count: visibleEntries.length })}
      </div>

      {/* Context menu */}
      {contextMenu && createPortal(
        <menu
          ref={ctxMenuRef}
          tabIndex={-1}
          className="fixed z-9999 bg-mantle border border-surface-0/40 rounded-lg shadow-xl py-1 min-w-44 text-sm list-none m-0 p-0 py-1"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.entry ? (
            <>
              {contextMenu.entry.is_dir && (
                <button
                  className="w-full text-left px-3 py-1.5 hover:bg-surface-0/30 flex items-center gap-2"
                  onClick={() => { loadDirectory(contextMenu.entry!.path); setContextMenu(null); }}
                >
                  <Folder size={14} className="text-yellow" /> {t("sftp.open", "Open")}
                </button>
              )}
              <button
                className="w-full text-left px-3 py-1.5 hover:bg-surface-0/30 flex items-center gap-2"
                onClick={() => {
                  setRenamingEntry(contextMenu.entry);
                  setRenameValue(contextMenu.entry!.name);
                  setContextMenu(null);
                }}
              >
                <Edit3 size={14} className="text-text-muted" /> {t("sftp.rename")}
              </button>
              <button
                className="w-full text-left px-3 py-1.5 hover:bg-surface-0/30 flex items-center gap-2"
                onClick={async () => {
                  await navigator.clipboard.writeText(contextMenu.entry!.path);
                  setContextMenu(null);
                }}
              >
                <Copy size={14} className="text-text-muted" /> {t("sftp.copyPath", "Copy path")}
              </button>
              <div className="border-t border-surface-0/30 my-1" />
              <button
                className="w-full text-left px-3 py-1.5 hover:bg-red/10 flex items-center gap-2 text-red"
                onClick={() => { setDeleteTarget(contextMenu.entry); setContextMenu(null); }}
              >
                <Trash2 size={14} /> {t("sftp.delete")}
              </button>
            </>
          ) : (
            <>
              <button
                className="w-full text-left px-3 py-1.5 hover:bg-surface-0/30 flex items-center gap-2"
                onClick={() => { setShowNewFolderDialog(true); setNewFolderName(""); setContextMenu(null); }}
              >
                <FolderPlus size={14} className="text-yellow" /> {t("sftp.newFolder")}
              </button>
              <button
                className="w-full text-left px-3 py-1.5 hover:bg-surface-0/30 flex items-center gap-2"
                onClick={() => { setShowNewFileDialog(true); setNewFileName(""); setContextMenu(null); }}
              >
                <FilePlus size={14} className="text-text-muted" /> {t("sftp.newFile", "New file")}
              </button>
              <div className="border-t border-surface-0/30 my-1" />
              <button
                className="w-full text-left px-3 py-1.5 hover:bg-surface-0/30 flex items-center gap-2"
                onClick={() => { loadDirectory(currentPath); setContextMenu(null); }}
              >
                <RefreshCw size={14} className="text-text-muted" /> {t("sftp.refresh")}
              </button>
            </>
          )}
        </menu>,
        document.body
      )}

      {/* New folder dialog */}
      {showNewFolderDialog && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
          <div className="bg-mantle border border-surface-0/40 rounded-xl shadow-2xl p-5 w-[340px]">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <FolderPlus size={16} className="text-yellow" /> {t("sftp.newFolder")}
            </h3>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder={t("sftp.folderNamePlaceholder", "Folder name")}
              className="w-full px-3 py-2 bg-surface-0/20 border border-surface-0/40 rounded-lg text-text text-sm outline-none focus:border-accent/50"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateFolder();
                if (e.key === "Escape") setShowNewFolderDialog(false);
              }}
            />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowNewFolderDialog(false)} className="px-3 py-1.5 text-sm text-text-muted hover:text-text transition-colors">
                {t("common.cancel")}
              </button>
              <button onClick={handleCreateFolder} disabled={!newFolderName.trim()} className="px-3 py-1.5 text-sm bg-accent/20 text-accent rounded-lg hover:bg-accent/30 transition-colors disabled:opacity-40">
                {t("common.create", "Create")}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* New file dialog */}
      {showNewFileDialog && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
          <div className="bg-mantle border border-surface-0/40 rounded-xl shadow-2xl p-5 w-[340px]">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <FilePlus size={16} className="text-text-muted" /> {t("sftp.newFile", "New file")}
            </h3>
            <input
              type="text"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              placeholder={t("sftp.fileNamePlaceholder", "File name")}
              className="w-full px-3 py-2 bg-surface-0/20 border border-surface-0/40 rounded-lg text-text text-sm outline-none focus:border-accent/50"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateFile();
                if (e.key === "Escape") setShowNewFileDialog(false);
              }}
            />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowNewFileDialog(false)} className="px-3 py-1.5 text-sm text-text-muted hover:text-text transition-colors">
                {t("common.cancel")}
              </button>
              <button onClick={handleCreateFile} disabled={!newFileName.trim()} className="px-3 py-1.5 text-sm bg-accent/20 text-accent rounded-lg hover:bg-accent/30 transition-colors disabled:opacity-40">
                {t("common.create", "Create")}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Delete confirmation */}
      {deleteTarget && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
          <div className="bg-mantle border border-surface-0/40 rounded-xl shadow-2xl p-5 w-[380px]">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-red">
              <AlertTriangle size={16} /> {t("sftp.confirmDelete", "Confirm deletion")}
            </h3>
            <p className="text-sm text-text-secondary mb-1">
              {t("sftp.deleteConfirmMessage", "Are you sure you want to delete:")}
            </p>
            <p className="text-sm text-text font-mono bg-surface-0/20 rounded px-2 py-1 mb-1 truncate">
              {deleteTarget.name}
            </p>
            {deleteTarget.is_dir && (
              <p className="text-xs text-red/80 mt-2">
                {t("sftp.deleteFolderWarning", "This will permanently delete the folder and all its contents.")}
              </p>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setDeleteTarget(null)} className="px-3 py-1.5 text-sm text-text-muted hover:text-text transition-colors">
                {t("common.cancel")}
              </button>
              <button onClick={handleDelete} className="px-3 py-1.5 text-sm bg-red/20 text-red rounded-lg hover:bg-red/30 transition-colors">
                {t("sftp.delete")}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </section>
  );
}
