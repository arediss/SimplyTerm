import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getErrorMessage } from "../utils";
import { listen } from "@tauri-apps/api/event";
import {
  Folder,
  File,
  RefreshCw,
  Home,
  ArrowUp,
  Trash2,
  FolderPlus,
  Edit3,
  X,
  Check,
  Loader2,
  ExternalLink,
} from "lucide-react";

interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified: number | null;
  permissions: string | null;
}

interface SftpBrowserProps {
  sessionId: string;
  initialPath?: string;
}

interface EditingFile {
  remotePath: string;
  localPath: string;
  status: "synced" | "uploading" | "error";
  error?: string;
}

interface FileUploadedEvent {
  session_id: string;
  remote_path: string;
  local_path: string;
  success: boolean;
  error?: string;
}

function getRowHighlight(entryPath: string, contextMenuPath?: string, selectedPath?: string): string {
  if (contextMenuPath === entryPath) return "bg-blue/20 ring-1 ring-blue/40 ring-inset";
  if (selectedPath === entryPath) return "bg-blue/10";
  return "hover:bg-surface-0/30";
}

function getEditIndicator(status: string | undefined): { className: string; title: string } {
  if (status === "uploading") return { className: "bg-yellow animate-pulse", title: "Uploading..." };
  if (status === "error") return { className: "bg-red", title: "Upload failed" };
  return { className: "bg-teal", title: "Watching for changes" };
}

export function SftpBrowser({ sessionId, initialPath = "/" }: Readonly<SftpBrowserProps>) {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<FileEntry | null>(null);

  // New folder dialog
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  // Rename dialog
  const [renamingEntry, setRenamingEntry] = useState<FileEntry | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // External editing state
  const [editingFiles, setEditingFiles] = useState<Map<string, EditingFile>>(new Map());

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    entry: FileEntry;
  } | null>(null);

  const isMountedRef = useRef(true);
  useEffect(() => { return () => { isMountedRef.current = false; }; }, []);

  const loadDirectory = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<FileEntry[]>("sftp_list", {
        sessionId,
        path,
      });
      if (!isMountedRef.current) return;
      setEntries(result);
      setCurrentPath(path);
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(getErrorMessage(err));
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    loadDirectory(currentPath);
  }, []);

  // Listen for file upload events
  useEffect(() => {
    let isMounted = true;
    let unlistenFn: (() => void) | null = null;
    const pendingTimeouts = new Set<ReturnType<typeof setTimeout>>();

    const updateFileStatus = (remotePath: string, status: "synced" | "error", error?: string) => {
      setEditingFiles((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(remotePath);
        if (existing) {
          newMap.set(remotePath, { ...existing, status, error });
        }
        return newMap;
      });
    };

    const handleFileUploaded = (event: { payload: FileUploadedEvent }) => {
      if (!isMounted) return;
      const { session_id, remote_path, success, error } = event.payload;
      if (session_id !== sessionId) return;

      updateFileStatus(remote_path, success ? "synced" : "error", error);

      if (success) {
        const t = setTimeout(() => {
          pendingTimeouts.delete(t);
          if (!isMounted) return;
          updateFileStatus(remote_path, "synced");
        }, 3000);
        pendingTimeouts.add(t);
      }
    };

    (async () => {
      const unlisten = await listen<FileUploadedEvent>("sftp-file-uploaded", handleFileUploaded);
      if (isMounted) {
        unlistenFn = unlisten;
      } else {
        unlisten();
      }
    })();

    return () => {
      isMounted = false;
      unlistenFn?.();
      pendingTimeouts.forEach(clearTimeout);
      pendingTimeouts.clear();
    };
  }, [sessionId]);

  // Load editing files on mount
  useEffect(() => {
    const loadEditingFiles = async () => {
      try {
        const files = await invoke<Array<{ session_id: string; remote_path: string; local_path: string }>>(
          "sftp_get_editing_files",
          { sessionId }
        );
        const newMap = new Map<string, EditingFile>();
        for (const f of files) {
          newMap.set(f.remote_path, {
            remotePath: f.remote_path,
            localPath: f.local_path,
            status: "synced",
          });
        }
        setEditingFiles(newMap);
      } catch (err) {
        console.error("Failed to load editing files:", err);
      }
    };
    loadEditingFiles();
  }, [sessionId]);

  const handleNavigate = (entry: FileEntry) => {
    if (entry.is_dir) {
      loadDirectory(entry.path);
      setSelectedEntry(null);
    }
  };

  const handleGoUp = () => {
    if (currentPath === "/") return;
    const parts = currentPath.split("/").filter(Boolean);
    parts.pop();
    const newPath = "/" + parts.join("/");
    loadDirectory(newPath || "/");
  };

  const handleGoHome = () => {
    loadDirectory("/");
  };

  const handleRefresh = () => {
    loadDirectory(currentPath);
  };

  const handleDelete = async (entry: FileEntry) => {
    if (!confirm(`Delete ${entry.is_dir ? "folder" : "file"} "${entry.name}"?`)) {
      return;
    }
    try {
      await invoke("sftp_remove", {
        sessionId,
        path: entry.path,
        isDir: entry.is_dir,
      });
      await loadDirectory(currentPath);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    const path = currentPath === "/"
      ? `/${newFolderName}`
      : `${currentPath}/${newFolderName}`;
    try {
      await invoke("sftp_mkdir", { sessionId, path });
      setShowNewFolderDialog(false);
      setNewFolderName("");
      await loadDirectory(currentPath);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleRename = async () => {
    if (!renamingEntry || !renameValue.trim()) return;
    const parentPath = renamingEntry.path.substring(0, renamingEntry.path.lastIndexOf("/"));
    const newPath = parentPath ? `${parentPath}/${renameValue}` : `/${renameValue}`;
    try {
      await invoke("sftp_rename", {
        sessionId,
        oldPath: renamingEntry.path,
        newPath,
      });
      setRenamingEntry(null);
      setRenameValue("");
      await loadDirectory(currentPath);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleEditExternal = async (entry: FileEntry) => {
    if (entry.is_dir) return;

    // Set initial uploading state
    setEditingFiles((prev) => {
      const newMap = new Map(prev);
      newMap.set(entry.path, {
        remotePath: entry.path,
        localPath: "",
        status: "uploading",
      });
      return newMap;
    });

    try {
      const result = await invoke<{ local_path: string; remote_path: string }>(
        "sftp_edit_external",
        {
          sessionId,
          remotePath: entry.path,
        }
      );

      setEditingFiles((prev) => {
        const newMap = new Map(prev);
        newMap.set(entry.path, {
          remotePath: result.remote_path,
          localPath: result.local_path,
          status: "synced",
        });
        return newMap;
      });
    } catch (err) {
      setError(getErrorMessage(err));
      setEditingFiles((prev) => {
        const newMap = new Map(prev);
        newMap.delete(entry.path);
        return newMap;
      });
    }
  };

  const isEditing = (path: string) => editingFiles.has(path);
  const getEditStatus = (path: string) => editingFiles.get(path)?.status;

  // Handle right-click context menu
  const handleContextMenu = (e: React.MouseEvent, entry: FileEntry) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, entry });
    setSelectedEntry(entry);
  };

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextMenu(null);
    };

    if (contextMenu) {
      document.addEventListener("click", handleClick);
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextMenu]);

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

  return (
    <div className="h-full flex flex-col bg-base text-text">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5 bg-mantle border-b border-surface-0/30">
        <button
          onClick={handleGoHome}
          className="p-1.5 rounded hover:bg-surface-0/50 text-subtext-0 hover:text-text transition-colors"
          title="Home"
        >
          <Home size={14} />
        </button>
        <button
          onClick={handleGoUp}
          className="p-1.5 rounded hover:bg-surface-0/50 text-subtext-0 hover:text-text transition-colors"
          title="Go up"
          disabled={currentPath === "/"}
        >
          <ArrowUp size={14} />
        </button>
        <button
          onClick={handleRefresh}
          className="p-1.5 rounded hover:bg-surface-0/50 text-subtext-0 hover:text-text transition-colors"
          title="Refresh"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
        <div className="w-px h-4 bg-surface-0/30 mx-1" />
        <button
          onClick={() => setShowNewFolderDialog(true)}
          className="p-1.5 rounded hover:bg-surface-0/50 text-subtext-0 hover:text-text transition-colors"
          title="New folder"
        >
          <FolderPlus size={14} />
        </button>

        {/* Path breadcrumb */}
        <div className="flex-1 mx-2 px-2 py-1 bg-crust rounded text-xs text-subtext-0 truncate">
          {currentPath}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="px-3 py-2 bg-red/10 border-b border-red/20 text-red text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="p-0.5 hover:bg-red/20 rounded">
            <X size={12} />
          </button>
        </div>
      )}

      {/* New folder dialog */}
      {showNewFolderDialog && (
        <div className="px-3 py-2 bg-surface-0/30 border-b border-surface-0/30 flex items-center gap-2">
          <FolderPlus size={14} className="text-subtext-0" />
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="New folder name..."
            className="flex-1 bg-crust px-2 py-1 rounded text-sm text-text placeholder:text-subtext-0 outline-none focus:ring-1 focus:ring-blue/50"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleCreateFolder();
              if (e.key === "Escape") setShowNewFolderDialog(false);
            }}
          />
          <button
            onClick={handleCreateFolder}
            className="p-1.5 rounded bg-green/20 text-green hover:bg-green/30 transition-colors"
          >
            <Check size={14} />
          </button>
          <button
            onClick={() => setShowNewFolderDialog(false)}
            className="p-1.5 rounded bg-surface-0/50 text-subtext-0 hover:bg-surface-0 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* File list */}
      <div className="flex-1 overflow-auto">
        {loading && entries.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <Loader2 size={24} className="animate-spin text-subtext-0" />
          </div>
        )}
        {!loading && entries.length === 0 && (
          <div className="flex items-center justify-center h-full text-subtext-0 text-sm">
            Empty directory
          </div>
        )}
        {entries.length > 0 && (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-mantle text-subtext-0 text-xs">
              <tr>
                <th className="text-left px-3 py-1.5 font-medium">Name</th>
                <th className="text-right px-3 py-1.5 font-medium w-20">Size</th>
                <th className="text-right px-3 py-1.5 font-medium w-24">Modified</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={entry.path}
                  className={`
                    border-b border-surface-0/10 cursor-pointer
                    ${getRowHighlight(entry.path, contextMenu?.entry.path, selectedEntry?.path)}
                  `}
                  onClick={() => setSelectedEntry(entry)}
                  onDoubleClick={() => handleNavigate(entry)}
                  onContextMenu={(e) => handleContextMenu(e, entry)}
                >
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      {entry.is_dir ? (
                        <Folder size={14} className="text-yellow shrink-0" />
                      ) : (
                        <File size={14} className="text-subtext-0 shrink-0" />
                      )}
                      {renamingEntry?.path === entry.path ? (
                        <>
                          <input
                            type="text"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            className="flex-1 bg-crust px-1.5 py-0.5 rounded text-sm outline-none focus:ring-1 focus:ring-blue/50"
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                            onDoubleClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              e.stopPropagation();
                              if (e.key === "Enter") void handleRename();
                              if (e.key === "Escape") setRenamingEntry(null);
                            }}
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRename();
                            }}
                            className="p-1 rounded bg-green/20 text-green hover:bg-green/30 shrink-0"
                          >
                            <Check size={12} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setRenamingEntry(null);
                            }}
                            className="p-1 rounded bg-surface-0/50 text-subtext-0 hover:bg-surface-0 shrink-0"
                          >
                            <X size={12} />
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="truncate">{entry.name}</span>
                          {isEditing(entry.path) && (() => {
                            const indicator = getEditIndicator(getEditStatus(entry.path));
                            return (
                              <span
                                className={`ml-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${indicator.className}`}
                                title={indicator.title}
                              />
                            );
                          })()}
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-1.5 text-right text-subtext-0 text-xs">
                    {entry.is_dir ? "-" : formatSize(entry.size)}
                  </td>
                  <td className="px-3 py-1.5 text-right text-subtext-0 text-xs">
                    {formatDate(entry.modified)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 min-w-[160px] py-1 bg-crust rounded-lg border border-surface-0/50 shadow-xl"
          style={{
            left: Math.min(contextMenu.x, globalThis.innerWidth - 180),
            top: Math.min(contextMenu.y, globalThis.innerHeight - 200),
          }}
          role="menu"
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => { if (e.key === 'Escape') setContextMenu(null); }}
        >
          {/* Edit externally (only for files) */}
          {!contextMenu.entry.is_dir && (
            <button
              onClick={() => {
                handleEditExternal(contextMenu.entry);
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-text hover:bg-surface-0/50 transition-colors text-left"
              disabled={getEditStatus(contextMenu.entry.path) === "uploading"}
            >
              <ExternalLink size={14} className={isEditing(contextMenu.entry.path) ? "text-teal" : "text-subtext-0"} />
              <span>{isEditing(contextMenu.entry.path) ? "Open in editor" : "Edit externally"}</span>
              {isEditing(contextMenu.entry.path) && (
                <span className="ml-auto text-xs text-teal">watching</span>
              )}
            </button>
          )}

          {/* Open folder */}
          {contextMenu.entry.is_dir && (
            <button
              onClick={() => {
                handleNavigate(contextMenu.entry);
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-text hover:bg-surface-0/50 transition-colors text-left"
            >
              <Folder size={14} className="text-yellow" />
              <span>Open</span>
            </button>
          )}

          <div className="my-1 border-t border-surface-0/30" />

          {/* Rename */}
          <button
            onClick={() => {
              setRenamingEntry(contextMenu.entry);
              setRenameValue(contextMenu.entry.name);
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-text hover:bg-surface-0/50 transition-colors text-left"
          >
            <Edit3 size={14} className="text-subtext-0" />
            <span>Rename</span>
          </button>

          {/* Delete */}
          <button
            onClick={() => {
              handleDelete(contextMenu.entry);
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-red hover:bg-red/10 transition-colors text-left"
          >
            <Trash2 size={14} />
            <span>Delete</span>
          </button>
        </div>
      )}

      {/* Status bar */}
      <div className="px-3 py-1 bg-mantle border-t border-surface-0/30 text-xs text-subtext-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span>{entries.length} items</span>
          {editingFiles.size > 0 && (
            <span className="flex items-center gap-1 text-teal">
              <ExternalLink size={10} />
              {editingFiles.size} editing
            </span>
          )}
        </div>
        {selectedEntry && (
          <span>
            {selectedEntry.name} - {selectedEntry.is_dir ? "Folder" : formatSize(selectedEntry.size)}
          </span>
        )}
      </div>
    </div>
  );
}
