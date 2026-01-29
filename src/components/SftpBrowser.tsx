import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
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

export function SftpBrowser({ sessionId, initialPath = "/" }: SftpBrowserProps) {
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

  const loadDirectory = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<FileEntry[]>("sftp_list", {
        sessionId,
        path,
      });
      setEntries(result);
      setCurrentPath(path);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    loadDirectory(currentPath);
  }, []);

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
      loadDirectory(currentPath);
    } catch (err) {
      setError(String(err));
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
      loadDirectory(currentPath);
    } catch (err) {
      setError(String(err));
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
      loadDirectory(currentPath);
    } catch (err) {
      setError(String(err));
    }
  };

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
              if (e.key === "Enter") handleCreateFolder();
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
        {loading && entries.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 size={24} className="animate-spin text-subtext-0" />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex items-center justify-center h-full text-subtext-0 text-sm">
            Empty directory
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-mantle text-subtext-0 text-xs">
              <tr>
                <th className="text-left px-3 py-1.5 font-medium">Name</th>
                <th className="text-right px-3 py-1.5 font-medium w-20">Size</th>
                <th className="text-right px-3 py-1.5 font-medium w-24">Modified</th>
                <th className="text-center px-3 py-1.5 font-medium w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={entry.path}
                  className={`
                    border-b border-surface-0/10 cursor-pointer
                    ${selectedEntry?.path === entry.path ? "bg-blue/10" : "hover:bg-surface-0/30"}
                  `}
                  onClick={() => setSelectedEntry(entry)}
                  onDoubleClick={() => handleNavigate(entry)}
                >
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      {entry.is_dir ? (
                        <Folder size={14} className="text-yellow shrink-0" />
                      ) : (
                        <File size={14} className="text-subtext-0 shrink-0" />
                      )}
                      {renamingEntry?.path === entry.path ? (
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
                            if (e.key === "Enter") handleRename();
                            if (e.key === "Escape") setRenamingEntry(null);
                          }}
                        />
                      ) : (
                        <span className="truncate">{entry.name}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-1.5 text-right text-subtext-0 text-xs">
                    {entry.is_dir ? "-" : formatSize(entry.size)}
                  </td>
                  <td className="px-3 py-1.5 text-right text-subtext-0 text-xs">
                    {formatDate(entry.modified)}
                  </td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center justify-center gap-1">
                      {renamingEntry?.path === entry.path ? (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRename();
                            }}
                            className="p-1 rounded bg-green/20 text-green hover:bg-green/30"
                          >
                            <Check size={12} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setRenamingEntry(null);
                            }}
                            className="p-1 rounded bg-surface-0/50 text-subtext-0 hover:bg-surface-0"
                          >
                            <X size={12} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setRenamingEntry(entry);
                              setRenameValue(entry.name);
                            }}
                            className="p-1 rounded hover:bg-surface-0/50 text-subtext-0 hover:text-text"
                            title="Rename"
                          >
                            <Edit3 size={12} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(entry);
                            }}
                            className="p-1 rounded hover:bg-red/20 text-subtext-0 hover:text-red"
                            title="Delete"
                          >
                            <Trash2 size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Status bar */}
      <div className="px-3 py-1 bg-mantle border-t border-surface-0/30 text-xs text-subtext-0 flex items-center justify-between">
        <span>{entries.length} items</span>
        {selectedEntry && (
          <span>
            {selectedEntry.name} - {selectedEntry.is_dir ? "Folder" : formatSize(selectedEntry.size)}
          </span>
        )}
      </div>
    </div>
  );
}
