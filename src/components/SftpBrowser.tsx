import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import { getErrorMessage } from "../utils";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { save } from "@tauri-apps/plugin-dialog";
import { useTranslation } from "react-i18next";
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
  Upload,
  Download,
  ShieldAlert,
  AlertTriangle,
  Eye,
  EyeOff,
  Copy,
  CheckCircle2,
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

interface SftpUploadProgress {
  session_id: string;
  file_name: string;
  bytes_sent: number;
  total_bytes: number;
  file_index: number;
  total_files: number;
  done: boolean;
  error: string | null;
}

function getRowHighlight(entryPath: string, index: number, contextMenuPath?: string, selectedPath?: string): string {
  if (contextMenuPath === entryPath) return "bg-blue/20 ring-1 ring-blue/40 ring-inset";
  if (selectedPath === entryPath) return "bg-blue/10";
  const zebra = index % 2 === 1 ? "bg-surface-0/5" : "";
  return `${zebra} hover:bg-surface-0/30`;
}

/** Returns a color class for file icons based on name/extension */
function getFileIconColor(name: string): string {
  const lower = name.toLowerCase();

  // Known dotfiles / shell configs → green (scripts)
  if ([".bashrc", ".zshrc", ".profile", ".bash_profile", ".bash_aliases",
       ".fishrc", ".cshrc", ".kshrc"].includes(lower)) return "text-green";
  // Known dotfiles → cyan (config)
  if ([".gitignore", ".gitattributes", ".gitmodules", ".editorconfig",
       ".eslintrc", ".prettierrc", ".npmrc", ".yarnrc", ".env",
       ".dockerignore", ".htaccess"].includes(lower)) return "text-cyan";
  // History / logs → dim
  if ([".bash_history", ".zsh_history", ".lesshst", ".viminfo",
       ".bash_logout"].includes(lower)) return "text-text-muted";
  // Known filenames
  if (["dockerfile", "docker-compose.yml", "docker-compose.yaml",
       "makefile", "cmakelists.txt", "rakefile", "gemfile",
       "vagrantfile", "procfile"].includes(lower)) return "text-cyan";
  if (["readme", "readme.md", "license", "licence", "changelog",
       "changelog.md", "contributing.md"].includes(lower)) return "text-teal";

  // Extension-based coloring
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  // Scripts / executables
  if (["sh", "bash", "zsh", "fish", "py", "rb", "pl", "lua"].includes(ext)) return "text-green";
  // Config
  if (["json", "yaml", "yml", "toml", "ini", "conf", "cfg", "env",
       "xml", "plist", "properties"].includes(ext)) return "text-cyan";
  // Web
  if (["html", "htm", "css", "scss", "less", "sass"].includes(ext)) return "text-orange";
  // Code
  if (["js", "ts", "tsx", "jsx", "rs", "go", "c", "cpp", "h", "hpp",
       "java", "kt", "swift", "cs", "php", "sql", "vue", "svelte"].includes(ext)) return "text-purple";
  // Docs / text
  if (["md", "txt", "log", "csv", "rst", "tex", "org"].includes(ext)) return "text-text-secondary";
  // Archives
  if (["zip", "tar", "gz", "bz2", "xz", "7z", "rar", "deb", "rpm",
       "dmg", "iso", "tgz"].includes(ext)) return "text-red";
  // Images
  if (["png", "jpg", "jpeg", "gif", "svg", "webp", "ico", "bmp",
       "tiff", "psd", "ai"].includes(ext)) return "text-pink";
  // Binary / data
  if (["bin", "dat", "db", "sqlite", "sqlite3", "so", "dylib", "dll",
       "exe", "o", "a"].includes(ext)) return "text-text-muted";
  // Keys / certs
  if (["pem", "crt", "key", "pub", "cer", "p12", "pfx"].includes(ext)) return "text-yellow";

  return "text-text-muted";
}

function getEditIndicator(status: string | undefined): { className: string; title: string } {
  if (status === "uploading") return { className: "bg-yellow animate-pulse", title: "Uploading..." };
  if (status === "error") return { className: "bg-red", title: "Upload failed" };
  return { className: "bg-teal", title: "Watching for changes" };
}

const TOOLBAR_BTN = "p-1.5 rounded hover:bg-surface-0/50 text-text-muted hover:text-text transition-colors";
const CTX_MENU_BTN = "w-full flex items-center gap-2 px-3 py-1.5 text-sm text-text hover:bg-surface-0/50 transition-colors text-left";

function ContextMenuItem({ icon: Icon, label, onClick, iconClassName = "text-text-muted", className, disabled, children }: Readonly<{
  icon: React.ComponentType<{ size: number; className?: string }>;
  label: string;
  onClick: () => void;
  iconClassName?: string;
  className?: string;
  disabled?: boolean;
  children?: React.ReactNode;
}>) {
  return (
    <button onClick={onClick} className={className ?? CTX_MENU_BTN} disabled={disabled}>
      <Icon size={14} className={iconClassName} />
      <span>{label}</span>
      {children}
    </button>
  );
}

export function SftpBrowser({ sessionId, initialPath = "/" }: Readonly<SftpBrowserProps>) {
  const { t } = useTranslation();
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<FileEntry | null>(null);
  const [showHidden, setShowHidden] = useState(() => {
    const saved = localStorage.getItem("sftp-show-hidden");
    return saved !== null ? saved === "true" : true;
  });

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

  // Delete confirmation modal
  const [deleteTarget, setDeleteTarget] = useState<FileEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Download / copy feedback
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);

  // Drag & drop state
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<SftpUploadProgress | null>(null);

  const isMountedRef = useRef(true);
  useEffect(() => { isMountedRef.current = true; return () => { isMountedRef.current = false; }; }, []);

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
      const msg = getErrorMessage(err);
      const isPermission = /permission denied|access denied|not permitted/i.test(msg);
      setError(isPermission ? `Permission denied: ${path}` : msg);
      // Don't clear listing on permission denied — keep showing current directory
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    loadDirectory(currentPath);
  }, []);

  // Note: no sftp_disconnect on unmount — the pool is shared across panes
  // and cleaned up by SessionManager when the SSH session closes.

  // Listen for file upload events (external editor)
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

  // Listen for upload progress events (drag & drop)
  useEffect(() => {
    let isMounted = true;
    let unlistenFn: (() => void) | null = null;

    (async () => {
      const unlisten = await listen<SftpUploadProgress>("sftp-upload-progress", (event) => {
        if (!isMounted) return;
        if (event.payload.session_id !== sessionId) return;

        if (event.payload.done && event.payload.file_index === event.payload.total_files - 1) {
          // Last file done — clear progress after a short delay
          setTimeout(() => {
            if (isMounted) setUploadProgress(null);
          }, 1500);
          // Refresh the listing
          loadDirectory(currentPath);
        }
        setUploadProgress(event.payload);
      });
      if (isMounted) {
        unlistenFn = unlisten;
      } else {
        unlisten();
      }
    })();

    return () => {
      isMounted = false;
      unlistenFn?.();
    };
  }, [sessionId, currentPath, loadDirectory]);

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

  const handleDeleteRequest = (entry: FileEntry) => {
    setDeleteTarget(entry);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await invoke("sftp_remove", {
        sessionId,
        path: deleteTarget.path,
        isDir: deleteTarget.is_dir,
      });
      setDeleteTarget(null);
      await loadDirectory(currentPath);
    } catch (err) {
      setError(getErrorMessage(err));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
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

  const handleDownload = async (entry: FileEntry) => {
    try {
      // Open native "Save As" dialog
      const savePath = await save({ defaultPath: entry.name });
      if (!savePath) return; // User cancelled

      await invoke("sftp_download", {
        sessionId,
        remotePath: entry.path,
        localPath: savePath,
      });

      const fileName = savePath.split(/[\\/]/).pop() ?? entry.name;
      setDownloadNotice(t("sftp.downloaded", { name: fileName }));
      setTimeout(() => setDownloadNotice(null), 3000);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleCopyPath = async (entry: FileEntry) => {
    try {
      await navigator.clipboard.writeText(entry.path);
      setDownloadNotice(t("sftp.pathCopied", "Path copied"));
      setTimeout(() => setDownloadNotice(null), 2000);
    } catch {
      // Fallback for non-HTTPS contexts
      setError("Failed to copy to clipboard");
    }
  };

  // Internal drag-to-folder (move file into a subfolder)
  const [draggingEntry, setDraggingEntry] = useState<string | null>(null);

  const handleInternalDragStart = (e: React.DragEvent, entry: FileEntry) => {
    e.dataTransfer.setData("text/x-sftp-path", entry.path);
    e.dataTransfer.setData("text/x-sftp-name", entry.name);
    e.dataTransfer.effectAllowed = "move";
    setDraggingEntry(entry.path);
  };

  const handleInternalDragEnd = () => {
    setDraggingEntry(null);
    setDragOverFolder(null);
  };

  const handleFolderDragOver = (e: React.DragEvent, entry: FileEntry) => {
    if (!entry.is_dir) return;
    if (!e.dataTransfer.types.includes("text/x-sftp-path")) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    setDragOverFolder(entry.path);
  };

  const handleFolderDragLeave = () => {
    setDragOverFolder(null);
  };

  const handleFolderDrop = async (e: React.DragEvent, targetFolder: FileEntry) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolder(null);

    const sourcePath = e.dataTransfer.getData("text/x-sftp-path");
    const sourceName = e.dataTransfer.getData("text/x-sftp-name");
    if (!sourcePath || !sourceName || sourcePath === targetFolder.path) return;

    const newPath = targetFolder.path.endsWith("/")
      ? `${targetFolder.path}${sourceName}`
      : `${targetFolder.path}/${sourceName}`;

    try {
      await invoke("sftp_rename", {
        sessionId,
        oldPath: sourcePath,
        newPath,
      });
      await loadDirectory(currentPath);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

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

  // ====== Drag & Drop via Tauri native API ======

  useEffect(() => {
    let isMounted = true;
    let unlistenFn: (() => void) | null = null;

    const setup = async () => {
      const unlisten = await getCurrentWebview().onDragDropEvent((event) => {
        if (!isMounted) return;

        if (event.payload.type === "enter") {
          setIsDragOver(true);
        } else if (event.payload.type === "leave") {
          setIsDragOver(false);
        } else if (event.payload.type === "drop") {
          setIsDragOver(false);
          const paths = event.payload.paths;
          if (paths.length === 0) return;

          invoke("sftp_upload_files", {
            sessionId,
            remoteDir: currentPath,
            localPaths: paths,
          }).catch((err) => {
            if (isMounted) setError(getErrorMessage(err));
          });
        }
      });

      if (isMounted) {
        unlistenFn = unlisten;
      } else {
        unlisten();
      }
    };

    setup();

    return () => {
      isMounted = false;
      unlistenFn?.();
    };
  }, [sessionId, currentPath]);

  const visibleEntries = useMemo(
    () => showHidden ? entries : entries.filter((e) => !e.name.startsWith(".")),
    [entries, showHidden],
  );

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
    <div
      className="h-full flex flex-col text-text relative"
    >
      {/* Drag overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-40 bg-blue/10 border-2 border-dashed border-blue/50 rounded-lg flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-2 text-blue">
            <Upload size={32} />
            <span className="text-sm font-medium">
              {t("sftp.dropToUpload", "Drop files to upload")}
            </span>
            <span className="text-xs text-text-muted">
              {t("sftp.uploadTo", "Upload to {{path}}", { path: currentPath })}
            </span>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-surface-0/30">
        <button onClick={handleGoHome} className={TOOLBAR_BTN} title={t("sftp.home")}>
          <Home size={14} />
        </button>
        <button onClick={handleGoUp} className={TOOLBAR_BTN} title={t("sftp.goUp")} disabled={currentPath === "/"}>
          <ArrowUp size={14} />
        </button>
        <button onClick={handleRefresh} className={TOOLBAR_BTN} title={t("sftp.refresh")}>
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
        <div className="w-px h-4 bg-surface-0/30 mx-1" />
        <button onClick={() => setShowNewFolderDialog(true)} className={TOOLBAR_BTN} title={t("sftp.newFolder")}>
          <FolderPlus size={14} />
        </button>
        <button
          onClick={() => setShowHidden((v) => { const next = !v; localStorage.setItem("sftp-show-hidden", String(next)); return next; })}
          className={`p-1.5 rounded transition-colors ${
            showHidden
              ? "text-accent bg-accent/10 hover:bg-accent/20"
              : "text-text-muted hover:bg-surface-0/50 hover:text-text"
          }`}
          title={showHidden ? t("sftp.hideHidden", "Hide hidden files") : t("sftp.showHidden", "Show hidden files")}
        >
          {showHidden ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>

        {/* Path breadcrumb */}
        <div className="flex-1 mx-2 px-2 py-1 bg-surface-0/10 rounded border border-surface-0/20 text-xs text-text-muted truncate flex items-center gap-1.5">
          <Folder size={11} className="text-blue/60 shrink-0" />
          <span>{currentPath}</span>
        </div>
      </div>

      {/* Upload progress bar */}
      {uploadProgress && !uploadProgress.done && (
        <div className="px-3 py-1.5 bg-surface-0/20 border-b border-surface-0/30 flex items-center gap-2">
          <Upload size={12} className="text-blue shrink-0" />
          <span className="text-xs text-text truncate">
            {t("sftp.uploading", "Uploading")} {uploadProgress.file_name}
          </span>
          <div className="flex-1 h-1.5 bg-surface-0/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue rounded-full transition-all duration-200"
              style={{
                width: uploadProgress.total_bytes > 0
                  ? `${Math.round((uploadProgress.bytes_sent / uploadProgress.total_bytes) * 100)}%`
                  : "100%",
              }}
            />
          </div>
          <span className="text-xs text-text-muted shrink-0">
            {uploadProgress.file_index + 1}/{uploadProgress.total_files}
          </span>
          {uploadProgress.error && (
            <span className="text-xs text-red truncate">{uploadProgress.error}</span>
          )}
        </div>
      )}

      {/* Download / copy success notice */}
      {downloadNotice && (
        <div className="px-3 py-1.5 bg-green/10 border-b border-green/20 text-xs text-green flex items-center gap-2">
          <CheckCircle2 size={13} className="shrink-0" />
          <span className="flex-1 truncate">{downloadNotice}</span>
        </div>
      )}

      {/* Error message */}
      {error && (() => {
        const isPermDenied = error.startsWith("Permission denied");
        const ErrorIcon = isPermDenied ? ShieldAlert : AlertTriangle;
        const colorClasses = isPermDenied
          ? "bg-yellow/10 border-yellow/20 text-yellow"
          : "bg-red/10 border-red/20 text-red";
        return (
          <div className={`px-3 py-2 border-b text-xs flex items-center gap-2 ${colorClasses}`}>
            <ErrorIcon size={13} className="shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} className="p-0.5 hover:bg-surface-0/30 rounded shrink-0">
              <X size={12} />
            </button>
          </div>
        );
      })()}

      {/* New folder dialog */}
      {showNewFolderDialog && (
        <div className="px-3 py-2 bg-surface-0/30 border-b border-surface-0/30 flex items-center gap-2">
          <FolderPlus size={14} className="text-text-muted" />
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder={t("sftp.newFolderPlaceholder")}
            className="flex-1 bg-crust px-2 py-1 rounded text-sm text-text placeholder:text-text-muted outline-none focus:ring-1 focus:ring-blue/50"
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
            className="p-1.5 rounded bg-surface-0/50 text-text-muted hover:bg-surface-0 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* File list */}
      <div className="flex-1 overflow-auto">
        {loading && entries.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <Loader2 size={24} className="animate-spin text-text-muted" />
          </div>
        )}
        {!loading && visibleEntries.length === 0 && (
          <div className="flex items-center justify-center h-full text-text-muted text-sm">
            {entries.length > 0 ? t("sftp.allHidden") : t("sftp.emptyDirectory")}
          </div>
        )}
        {visibleEntries.length > 0 && (
          <table className="w-full text-sm">
            <thead className="sticky top-0 text-text-muted text-xs bg-crust/80 backdrop-blur-sm">
              <tr className="border-b border-surface-0/30">
                <th className="text-left px-3 py-1.5 font-medium">{t("sftp.colName")}</th>
                <th className="text-right px-3 py-1.5 font-medium w-20">{t("sftp.colSize")}</th>
                <th className="text-right px-3 py-1.5 font-medium w-24">{t("sftp.colModified")}</th>
              </tr>
            </thead>
            <tbody>
              {visibleEntries.map((entry, index) => (
                <tr
                  key={entry.path}
                  draggable
                  onDragStart={(e) => handleInternalDragStart(e, entry)}
                  onDragEnd={handleInternalDragEnd}
                  onDragOver={(e) => handleFolderDragOver(e, entry)}
                  onDragLeave={handleFolderDragLeave}
                  onDrop={(e) => { if (entry.is_dir) handleFolderDrop(e, entry); }}
                  className={`
                    border-b border-surface-0/10 cursor-pointer transition-opacity
                    ${draggingEntry === entry.path ? "opacity-40" : ""}
                    ${dragOverFolder === entry.path
                      ? "bg-accent/20 ring-1 ring-accent/40 ring-inset"
                      : getRowHighlight(entry.path, index, contextMenu?.entry.path, selectedEntry?.path)}
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
                        <File size={14} className={`${getFileIconColor(entry.name)} shrink-0`} />
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
                            className="p-1 rounded bg-surface-0/50 text-text-muted hover:bg-surface-0 shrink-0"
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

      {/* Context Menu (portal to avoid transform/filter offset issues) */}
      {contextMenu && createPortal(
        <div
          className="fixed z-[9999] min-w-[160px] py-1 bg-crust rounded-lg border border-surface-0/50 shadow-xl"
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
            <ContextMenuItem
              icon={ExternalLink}
              iconClassName={isEditing(contextMenu.entry.path) ? "text-teal" : "text-text-muted"}
              label={isEditing(contextMenu.entry.path) ? t("sftp.openInEditor") : t("sftp.editExternally")}
              onClick={() => { handleEditExternal(contextMenu.entry); setContextMenu(null); }}
              disabled={getEditStatus(contextMenu.entry.path) === "uploading"}
            >
              {isEditing(contextMenu.entry.path) && (
                <span className="ml-auto text-xs text-teal">{t("sftp.watching")}</span>
              )}
            </ContextMenuItem>
          )}

          {/* Download (files only) */}
          {!contextMenu.entry.is_dir && (
            <ContextMenuItem
              icon={Download}
              label={t("sftp.download", "Download")}
              onClick={() => { handleDownload(contextMenu.entry); setContextMenu(null); }}
            />
          )}

          {/* Open folder */}
          {contextMenu.entry.is_dir && (
            <ContextMenuItem
              icon={Folder}
              iconClassName="text-yellow"
              label={t("sftp.open", "Open")}
              onClick={() => { handleNavigate(contextMenu.entry); setContextMenu(null); }}
            />
          )}

          <div className="my-1 border-t border-surface-0/30" />

          {/* Copy path */}
          <ContextMenuItem
            icon={Copy}
            label={t("sftp.copyPath", "Copy path")}
            onClick={() => { handleCopyPath(contextMenu.entry); setContextMenu(null); }}
          />

          {/* Rename */}
          <ContextMenuItem
            icon={Edit3}
            label={t("sftp.rename")}
            onClick={() => { setRenamingEntry(contextMenu.entry); setRenameValue(contextMenu.entry.name); setContextMenu(null); }}
          />

          {/* Delete */}
          <ContextMenuItem
            icon={Trash2}
            label={t("common.delete", "Delete")}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-red hover:bg-red/10 transition-colors text-left"
            onClick={() => { handleDeleteRequest(contextMenu.entry); setContextMenu(null); }}
          />
        </div>,
        document.body,
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40">
          <div
            className="bg-crust rounded-xl border border-surface-0/40 shadow-2xl p-5 mx-4 max-w-sm w-full"
            onKeyDown={(e) => { if (e.key === "Escape") setDeleteTarget(null); }}
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-red/10">
                <Trash2 size={18} className="text-red" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-text">
                  {t("sftp.deleteTitle", "Delete {{type}}", {
                    type: deleteTarget.is_dir ? "folder" : "file",
                  })}
                </h3>
                <p className="mt-1 text-xs text-text-muted">
                  {t("sftp.deleteConfirm", "Are you sure you want to delete \"{{name}}\"? This action cannot be undone.", {
                    name: deleteTarget.name,
                  })}
                </p>
                <p className="mt-1.5 text-xs text-text-muted/60 truncate" title={deleteTarget.path}>
                  {deleteTarget.path}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-3 py-1.5 text-xs rounded-lg bg-surface-0/30 text-text-muted hover:bg-surface-0/50 transition-colors"
              >
                {t("common.cancel", "Cancel")}
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="px-3 py-1.5 text-xs rounded-lg bg-red/20 text-red hover:bg-red/30 transition-colors flex items-center gap-1.5"
              >
                {deleting ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Trash2 size={12} />
                )}
                {t("common.delete", "Delete")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status bar */}
      <div className="px-3 py-1 border-t border-surface-0/30 text-xs text-text-muted flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green" title={t("sftp.connected")} />
            {!showHidden && entries.length !== visibleEntries.length
              ? t("sftp.itemsHidden", { count: visibleEntries.length, hidden: entries.length - visibleEntries.length })
              : t("sftp.items", { count: visibleEntries.length })
            }
          </span>
          {editingFiles.size > 0 && (
            <span className="flex items-center gap-1 text-teal">
              <ExternalLink size={10} />
              {t("sftp.editing", { count: editingFiles.size })}
            </span>
          )}
        </div>
        {selectedEntry && (
          <span className="text-text/70">
            {selectedEntry.name} - {selectedEntry.is_dir ? t("sftp.folder") : formatSize(selectedEntry.size)}
          </span>
        )}
      </div>
    </div>
  );
}
