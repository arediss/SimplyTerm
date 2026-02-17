import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import { getErrorMessage } from "../utils";
import { listen } from "@tauri-apps/api/event";
import { save } from "@tauri-apps/plugin-dialog";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  Folder,
  RefreshCw,
  Home,
  ArrowUp,
  Trash2,
  FolderPlus,
  FilePlus,
  Edit3,
  X,
  Check,
  Loader2,
  ExternalLink,
  Upload,
  Download,
  Shield,
  ShieldAlert,
  AlertTriangle,
  Eye,
  EyeOff,
  Copy,
  CheckCircle2,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  HardDrive,
} from "lucide-react";
import { getFileIcon } from "../utils/fileIcons";
import { LocalFileBrowser } from "./LocalFileBrowser";

interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified: number | null;
  permissions: string | null;
  uid: number | null;
  gid: number | null;
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


/** Builds a human-readable tooltip from a 9-char permission string like "rwxr-xr--" */
function formatPermissionsTooltip(perms: string | null): string | undefined {
  if (perms?.length !== 9) return undefined;
  const describe = (r: string, w: string, x: string) => {
    const parts: string[] = [];
    if (r === "r") parts.push("read");
    if (w === "w") parts.push("write");
    if (x === "x") parts.push("execute");
    return parts.length > 0 ? parts.join(", ") : "none";
  };
  return [
    `User:  ${describe(perms[0], perms[1], perms[2])}`,
    `Group: ${describe(perms[3], perms[4], perms[5])}`,
    `Other: ${describe(perms[6], perms[7], perms[8])}`,
  ].join("\n");
}

function getEditIndicator(status: string | undefined): { className: string; title: string } {
  if (status === "uploading") return { className: "bg-yellow animate-pulse", title: "Uploading..." };
  if (status === "error") return { className: "bg-red", title: "Upload failed" };
  return { className: "bg-teal", title: "Watching for changes" };
}

const TOOLBAR_BTN = "p-1.5 rounded hover:bg-surface-0/50 text-text-muted hover:text-text transition-colors";

function formatSize(bytes: number): string {
  if (bytes === 0) return "-";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatDate(timestamp: number | null): string {
  if (!timestamp) return "-";
  return new Date(timestamp * 1000).toLocaleDateString();
}

/** Build an absolute child path from a parent directory + child name */
function buildChildPath(parentPath: string, childName: string): string {
  return parentPath === "/" ? `/${childName}` : `${parentPath}/${childName}`;
}

/** Format SFTP error — use friendly message for permission denied */
function formatSftpError(msg: string, path: string): string {
  return /permission denied|access denied|not permitted/i.test(msg) ? `Permission denied: ${path}` : msg;
}

/** Sort entries: directories first, then by column */
function compareEntries(a: FileEntry, b: FileEntry, sortColumn: string, sortAsc: boolean): number {
  if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
  let cmp = 0;
  if (sortColumn === "name") {
    cmp = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  } else if (sortColumn === "size") {
    cmp = a.size - b.size;
  } else if (sortColumn === "modified") {
    cmp = (a.modified ?? 0) - (b.modified ?? 0);
  }
  return sortAsc ? cmp : -cmp;
}
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

/** Context menu content — extracted to reduce SftpBrowser complexity */
function SftpContextMenuContent({ entry, onClose, actions, isEditing, getEditStatus, t }: Readonly<{
  entry: FileEntry | null;
  onClose: () => void;
  actions: {
    handleEditExternal: (e: FileEntry) => void | Promise<void>;
    handleDownload: (e: FileEntry) => void | Promise<void>;
    handleNavigate: (e: FileEntry) => void | Promise<void>;
    handleCopyPath: (e: FileEntry) => void | Promise<void>;
    setRenamingEntry: (e: FileEntry | null) => void;
    setRenameValue: (v: string) => void;
    handleDeleteRequest: (e: FileEntry) => void;
    setShowNewFolderDialog: (v: boolean) => void;
    setShowNewFileDialog: (v: boolean) => void;
    handleRefresh: () => void | Promise<void>;
  };
  isEditing: (path: string) => boolean;
  getEditStatus: (path: string) => string | undefined;
  t: TFunction;
}>) {
  if (!entry) {
    return (
      <>
        <ContextMenuItem icon={FolderPlus} iconClassName="text-yellow" label={t("sftp.newFolder", "New folder")}
          onClick={() => { actions.setShowNewFolderDialog(true); onClose(); }} />
        <ContextMenuItem icon={FilePlus} label={t("sftp.newFile", "New file")}
          onClick={() => { actions.setShowNewFileDialog(true); onClose(); }} />
        <div className="my-1 border-t border-surface-0/30" />
        <ContextMenuItem icon={RefreshCw} label={t("sftp.refresh", "Refresh")}
          onClick={() => { actions.handleRefresh(); onClose(); }} />
      </>
    );
  }

  const editing = isEditing(entry.path);
  const editLabel = editing ? t("sftp.openInEditor") : t("sftp.editExternally");
  const editIconClass = editing ? "text-teal" : "text-text-muted";
  const isUploading = getEditStatus(entry.path) === "uploading";

  const fileItems = !entry.is_dir && (
    <>
      <ContextMenuItem icon={ExternalLink} iconClassName={editIconClass} label={editLabel}
        onClick={() => { actions.handleEditExternal(entry); onClose(); }} disabled={isUploading}>
        {editing && <span className="ml-auto text-xs text-teal">{t("sftp.watching")}</span>}
      </ContextMenuItem>
      <ContextMenuItem icon={Download} label={t("sftp.download", "Download")}
        onClick={() => { actions.handleDownload(entry); onClose(); }} />
    </>
  );

  const folderItems = entry.is_dir && (
    <ContextMenuItem icon={Folder} iconClassName="text-yellow" label={t("sftp.open", "Open")}
      onClick={() => { actions.handleNavigate(entry); onClose(); }} />
  );

  return (
    <>
      {fileItems}
      {folderItems}
      <div className="my-1 border-t border-surface-0/30" />
      <ContextMenuItem icon={Copy} label={t("sftp.copyPath", "Copy path")}
        onClick={() => { actions.handleCopyPath(entry); onClose(); }} />
      <ContextMenuItem icon={Edit3} label={t("sftp.rename")}
        onClick={() => { actions.setRenamingEntry(entry); actions.setRenameValue(entry.name); onClose(); }} />
      <ContextMenuItem icon={Trash2} label={t("common.delete", "Delete")}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-red hover:bg-red/10 transition-colors text-left"
        onClick={() => { actions.handleDeleteRequest(entry); onClose(); }} />
    </>
  );
}

/** Delete confirmation modal — extracted to reduce SftpBrowser complexity */
function SftpDeleteModal({ target, deleting, onCancel, onConfirm, deleteModalRef, t }: Readonly<{
  target: FileEntry;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  deleteModalRef: React.RefObject<HTMLDivElement | null>;
  t: TFunction;
}>) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        ref={deleteModalRef}
        tabIndex={-1}
        className="bg-crust rounded-xl border border-surface-0/40 shadow-2xl p-5 mx-4 max-w-sm w-full outline-none"
      >
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-red/10">
            <Trash2 size={18} className="text-red" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-text">
              {t("sftp.deleteTitle", { type: target.is_dir ? "folder" : "file" })}
            </h3>
            <p className="mt-1 text-xs text-text-muted">
              {t("sftp.deleteConfirm", { name: target.name })}
            </p>
            <p className="mt-1.5 text-xs text-text-muted/60 truncate" title={target.path}>
              {target.path}
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onCancel} disabled={deleting}
            className="px-3 py-1.5 text-xs rounded-lg bg-surface-0/30 text-text-muted hover:bg-surface-0/50 transition-colors">
            {t("common.cancel", "Cancel")}
          </button>
          <button onClick={onConfirm} disabled={deleting}
            className="px-3 py-1.5 text-xs rounded-lg bg-red/20 text-red hover:bg-red/30 transition-colors flex items-center gap-1.5">
            {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            {t("common.delete", "Delete")}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Status bar — extracted to reduce SftpBrowser complexity */
function SftpStatusBar({ showHidden, entries, visibleEntries, editingFiles, selectedEntry, formatSize, t }: Readonly<{
  showHidden: boolean;
  entries: FileEntry[];
  visibleEntries: FileEntry[];
  editingFiles: Map<string, EditingFile>;
  selectedEntry: FileEntry | null;
  formatSize: (bytes: number) => string;
  t: TFunction;
}>) {
  return (
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
  );
}

/** Toolbar + breadcrumb — extracted to reduce SftpBrowser complexity */
function SftpToolbar({ currentPath, loading, showHidden, showDetails, editingPath, pathInputValue, pathCopied, onGoHome, onGoUp, onRefresh, onNewFolder, onNewFile, onToggleHidden, onToggleDetails, onEditPath, onPathInputChange, onPathSubmit, onCancelEdit, onCopyPath, onNavigatePath, t }: Readonly<{
  currentPath: string;
  loading: boolean;
  showHidden: boolean;
  showDetails: boolean;
  editingPath: boolean;
  pathInputValue: string;
  pathCopied: boolean;
  onGoHome: () => void;
  onGoUp: () => void;
  onRefresh: () => void;
  onNewFolder: () => void;
  onNewFile: () => void;
  onToggleHidden: () => void;
  onToggleDetails: () => void;
  onEditPath: () => void;
  onPathInputChange: (v: string) => void;
  onPathSubmit: (path: string) => void;
  onCancelEdit: () => void;
  onCopyPath: () => void;
  onNavigatePath: (path: string) => void;
  t: TFunction;
}>) {
  return (
    <div className="flex items-center gap-1 px-2 py-1.5 border-b border-surface-0/30">
      <button onClick={onGoHome} className={TOOLBAR_BTN} title={t("sftp.home")}>
        <Home size={14} />
      </button>
      <button onClick={onGoUp} className={TOOLBAR_BTN} title={t("sftp.goUp")} disabled={currentPath === "/"}>
        <ArrowUp size={14} />
      </button>
      <button onClick={onRefresh} className={TOOLBAR_BTN} title={t("sftp.refresh")}>
        <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
      </button>
      <div className="w-px h-4 bg-surface-0/30 mx-1" />
      <button onClick={onNewFolder} className={TOOLBAR_BTN} title={t("sftp.newFolder")}>
        <FolderPlus size={14} />
      </button>
      <button onClick={onNewFile} className={TOOLBAR_BTN} title={t("sftp.newFile", "New file")}>
        <FilePlus size={14} />
      </button>
      <button
        onClick={onToggleHidden}
        className={`p-1.5 rounded transition-colors ${
          showHidden
            ? "text-accent bg-accent/10 hover:bg-accent/20"
            : "text-text-muted hover:bg-surface-0/50 hover:text-text"
        }`}
        title={showHidden ? t("sftp.hideHidden", "Hide hidden files") : t("sftp.showHidden", "Show hidden files")}
      >
        {showHidden ? <Eye size={14} /> : <EyeOff size={14} />}
      </button>
      <button
        onClick={onToggleDetails}
        className={`p-1.5 rounded transition-colors ${
          showDetails
            ? "text-accent bg-accent/10 hover:bg-accent/20"
            : "text-text-muted hover:bg-surface-0/50 hover:text-text"
        }`}
        title={showDetails ? t("sftp.hideDetails", "Hide permissions") : t("sftp.showDetails", "Show permissions")}
      >
        <Shield size={14} />
      </button>

      {/* Path breadcrumb */}
      <div className="flex-1 mx-2 px-2 py-1 bg-surface-0/10 rounded border border-surface-0/20 text-xs text-text-muted flex items-center gap-0 min-w-0">
        {editingPath ? (
          <input
            type="text"
            value={pathInputValue}
            onChange={(e) => onPathInputChange(e.target.value)}
            className="flex-1 bg-transparent text-text outline-none min-w-0"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") onPathSubmit(pathInputValue.trim() || "/");
              if (e.key === "Escape") onCancelEdit();
            }}
            onBlur={onCancelEdit}
          />
        ) : (
          <div className="flex items-center gap-0 min-w-0 overflow-hidden flex-1">
            <button
              onClick={() => onNavigatePath("/")}
              className="shrink-0 hover:text-text transition-colors px-0.5"
              title="/"
            >
              <Folder size={11} className="text-blue/60" />
            </button>
            {currentPath !== "/" && currentPath.split("/").filter(Boolean).map((segment, i, arr) => {
              const targetPath = "/" + arr.slice(0, i + 1).join("/");
              const isLast = i === arr.length - 1;
              return (
                <span key={targetPath} className="flex items-center shrink-0">
                  <ChevronRight size={10} className="text-text-muted/40 mx-0.5" />
                  <button
                    onClick={() => onNavigatePath(targetPath)}
                    className={`hover:text-text transition-colors px-0.5 truncate max-w-30 ${isLast ? "text-text" : ""}`}
                    title={targetPath}
                  >
                    {segment}
                  </button>
                </span>
              );
            })}
          </div>
        )}
        <button
          onClick={onEditPath}
          className="shrink-0 ml-1 p-0.5 rounded hover:bg-surface-0/40 transition-colors text-text-muted hover:text-text"
          title={t("sftp.editPath", "Edit path")}
        >
          <Edit3 size={11} />
        </button>
        <button
          onClick={onCopyPath}
          className="shrink-0 ml-1 p-0.5 rounded hover:bg-surface-0/40 transition-colors"
          title={t("sftp.copyPath", "Copy path")}
        >
          {pathCopied ? <CheckCircle2 size={11} className="text-green" /> : <Copy size={11} />}
        </button>
      </div>
    </div>
  );
}

/** File name cell content — icon + name/rename/edit indicator */
function SftpFileNameCell({ entry, renamingEntry, renameValue, onRenameValueChange, onRename, onCancelRename, isEditing, getEditStatus }: Readonly<{
  entry: FileEntry;
  renamingEntry: FileEntry | null;
  renameValue: string;
  onRenameValueChange: (v: string) => void;
  onRename: () => void;
  onCancelRename: () => void;
  isEditing: boolean;
  getEditStatus: string | undefined;
}>) {
  const isRenaming = renamingEntry?.path === entry.path;
  return (
    <div className="flex items-center gap-2">
      {entry.is_dir ? (
        <Folder size={14} className="text-yellow shrink-0" />
      ) : (
        (() => { const { icon: FileIcon, color } = getFileIcon(entry.name); return <FileIcon size={14} className={`${color} shrink-0`} />; })()
      )}
      {isRenaming ? (
        <>
          <input
            type="text"
            value={renameValue}
            onChange={(e) => onRenameValueChange(e.target.value)}
            className="flex-1 bg-crust px-1.5 py-0.5 rounded text-sm outline-none focus:ring-1 focus:ring-blue/50"
            autoFocus
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") onRename();
              if (e.key === "Escape") onCancelRename();
            }}
          />
          <button
            onClick={(e) => { e.stopPropagation(); onRename(); }}
            className="p-1 rounded bg-green/20 text-green hover:bg-green/30 shrink-0"
          >
            <Check size={12} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onCancelRename(); }}
            className="p-1 rounded bg-surface-0/50 text-text-muted hover:bg-surface-0 shrink-0"
          >
            <X size={12} />
          </button>
        </>
      ) : (
        <>
          <span className="truncate">{entry.name}</span>
          {isEditing && (() => {
            const indicator = getEditIndicator(getEditStatus);
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
  );
}

/** Inline dialog bar for creating a new folder or file */
function SftpNewItemDialog({ icon: Icon, value, onChange, placeholder, onSubmit, onCancel }: Readonly<{
  icon: React.ComponentType<{ size: number; className?: string }>;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  onSubmit: () => void;
  onCancel: () => void;
}>) {
  return (
    <div className="px-3 py-2 bg-surface-0/30 border-b border-surface-0/30 flex items-center gap-2">
      <Icon size={14} className="text-text-muted" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-crust px-2 py-1 rounded text-sm text-text placeholder:text-text-muted outline-none focus:ring-1 focus:ring-blue/50"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit();
          if (e.key === "Escape") onCancel();
        }}
      />
      <button
        onClick={onSubmit}
        className="p-1.5 rounded bg-green/20 text-green hover:bg-green/30 transition-colors"
      >
        <Check size={14} />
      </button>
      <button
        onClick={onCancel}
        className="p-1.5 rounded bg-surface-0/50 text-text-muted hover:bg-surface-0 transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  );
}

/** Notification bars (upload progress, downloading, download notice, error) — extracted to reduce SftpBrowser complexity */
function SftpNotificationBars({ uploadProgress, downloadingFile, downloadNotice, error, onClearError, t }: Readonly<{
  uploadProgress: SftpUploadProgress | null;
  downloadingFile: string | null;
  downloadNotice: string | null;
  error: string | null;
  onClearError: () => void;
  t: TFunction;
}>) {
  return (
    <>
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

      {/* Download in progress */}
      {downloadingFile && (
        <div className="px-3 py-1.5 bg-blue/10 border-b border-blue/20 text-xs text-blue flex items-center gap-2">
          <Loader2 size={13} className="shrink-0 animate-spin" />
          <span className="flex-1 truncate">{t("sftp.downloading", "Downloading {{name}}...", { name: downloadingFile })}</span>
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
            <button onClick={onClearError} className="p-0.5 hover:bg-surface-0/30 rounded shrink-0">
              <X size={12} />
            </button>
          </div>
        );
      })()}
    </>
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
    return localStorage.getItem("sftp-show-hidden") !== "false";
  });
  const [showDetails, setShowDetails] = useState(() => {
    return localStorage.getItem("sftp-show-details") === "true";
  });

  // Column sorting
  const [sortColumn, setSortColumn] = useState<"name" | "size" | "modified">("name");
  const [sortAsc, setSortAsc] = useState(true);
  const handleSort = (col: "name" | "size" | "modified") => {
    setSortAsc(sortColumn === col ? !sortAsc : true);
    setSortColumn(col);
  };

  // New folder dialog
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  // New file dialog
  const [showNewFileDialog, setShowNewFileDialog] = useState(false);
  const [newFileName, setNewFileName] = useState("");

  // Local file browser panel
  const [showLocalPanel, setShowLocalPanel] = useState(false);

  // Breadcrumb edit mode
  const [editingPath, setEditingPath] = useState(false);
  const [pathInputValue, setPathInputValue] = useState("");
  const [pathCopied, setPathCopied] = useState(false);

  // Rename dialog
  const [renamingEntry, setRenamingEntry] = useState<FileEntry | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // External editing state
  const [editingFiles, setEditingFiles] = useState<Map<string, EditingFile>>(new Map());

  // Context menu state (entry is null for background context menu)
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    entry: FileEntry | null;
  } | null>(null);

  // Delete confirmation modal
  const [deleteTarget, setDeleteTarget] = useState<FileEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Download / copy feedback
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);

  // Drag & drop state
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  // Shared state for cross-panel drag
  const remoteDragRef = useRef<{ path: string; name: string; isDir: boolean } | null>(null);
  const [remoteDragging, setRemoteDragging] = useState<{ path: string; name: string; isDir: boolean } | null>(null);
  const localPanelRef = useRef<HTMLDivElement>(null);
  const localCurrentPathRef = useRef<string>("");
  const [localRefreshTrigger, setLocalRefreshTrigger] = useState(0);
  const [uploadProgress, setUploadProgress] = useState<SftpUploadProgress | null>(null);

  const isMountedRef = useRef(true);
  const deleteModalRef = useRef<HTMLDivElement>(null);
  const fileListRef = useRef<HTMLDivElement>(null);
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
      setError(formatSftpError(getErrorMessage(err), path));
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

    const handleProgress = (event: { payload: SftpUploadProgress }) => {
      if (!isMounted) return;
      if (event.payload.session_id !== sessionId) return;

      if (event.payload.done && event.payload.file_index === event.payload.total_files - 1) {
        // Last file done — clear progress after a short delay
        setTimeout(() => { if (isMounted) setUploadProgress(null); }, 1500);
        loadDirectory(currentPath);
      }
      setUploadProgress(event.payload);
    };

    listen<SftpUploadProgress>("sftp-upload-progress", handleProgress).then((unlisten) => {
      if (isMounted) { unlistenFn = unlisten; } else { unlisten(); }
    });

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

  // Imperatively attach Escape key handler to delete modal (avoids S6847)
  useEffect(() => {
    const el = deleteModalRef.current;
    if (!el) return;
    el.focus();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDeleteTarget(null);
    };
    el.addEventListener("keydown", handleKeyDown);
    return () => el.removeEventListener("keydown", handleKeyDown);
  }, [deleteTarget]);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    const path = buildChildPath(currentPath, newFolderName);
    try {
      await invoke("sftp_mkdir", { sessionId, path });
      setShowNewFolderDialog(false);
      setNewFolderName("");
      await loadDirectory(currentPath);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleCreateFile = async () => {
    if (!newFileName.trim()) return;
    const path = buildChildPath(currentPath, newFileName);
    try {
      await invoke("sftp_write", { sessionId, path, data: [] });
      setShowNewFileDialog(false);
      setNewFileName("");
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
    e.dataTransfer.setData("text/x-sftp-remote-path", entry.path);
    e.dataTransfer.setData("text/x-sftp-remote-name", entry.name);
    e.dataTransfer.effectAllowed = "copyMove";
    setDraggingEntry(entry.path);
    // Store for cross-panel drag (WebView2 workaround)
    remoteDragRef.current = { path: entry.path, name: entry.name, isDir: entry.is_dir };
    setRemoteDragging({ path: entry.path, name: entry.name, isDir: entry.is_dir });
  };

  const handleInternalDragEnd = (e: React.DragEvent) => {
    // Check if drag ended over the local panel
    if (remoteDragRef.current && showLocalPanel && localPanelRef.current) {
      const rect = localPanelRef.current.getBoundingClientRect();
      if (e.clientX >= rect.left && e.clientX <= rect.right &&
          e.clientY >= rect.top && e.clientY <= rect.bottom) {
        const dragData = remoteDragRef.current;
        const localDir = localCurrentPathRef.current;
        handleDropFromRemote(dragData.path, dragData.name, localDir, dragData.isDir).then(() => {
          setLocalRefreshTrigger((c) => c + 1);
        });
      }
    }
    setDraggingEntry(null);
    setDragOverFolder(null);
    remoteDragRef.current = null;
    setRemoteDragging(null);
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

  // Handle right-click context menu on a file/folder
  const handleContextMenu = (e: React.MouseEvent, entry: FileEntry) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, entry });
    setSelectedEntry(entry);
  };

  // Handle right-click on empty area
  // Attach context menu handler imperatively to avoid S6848 (non-native interactive div)
  useEffect(() => {
    const el = fileListRef.current;
    if (!el) return;
    const handler = (e: MouseEvent) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, entry: null });
    };
    el.addEventListener("contextmenu", handler);
    return () => el.removeEventListener("contextmenu", handler);
  }, []);

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

  // Note: Tauri native drag-drop (onDragDropEvent) disabled via dragDropEnabled:false
  // to fix WebView2 HTML5 DnD cursor issues. Use the local file browser panel for uploads.

  const visibleEntries = useMemo(() => {
    const filtered = showHidden ? entries : entries.filter((e) => !e.name.startsWith("."));
    return [...filtered].sort((a, b) => compareEntries(a, b, sortColumn, sortAsc));
  }, [entries, showHidden, sortColumn, sortAsc]);

  // formatSize / formatDate are module-level functions (above)

  const handleLocalDragStart = useCallback((_localPath: string, _fileName: string) => {
    // Handled via dataTransfer in LocalFileBrowser
  }, []);

  const handleDropFromRemote = useCallback(async (remotePath: string, remoteName: string, localDir: string, isDir?: boolean) => {
    const normalized = localDir.replaceAll("\\", "/").replace(/\/$/, "");
    const localPath = `${normalized}/${remoteName}`;
    setDownloadingFile(remoteName);
    try {
      if (isDir) {
        await invoke("sftp_download_dir", { sessionId, remotePath, localPath });
      } else {
        await invoke("sftp_download", { sessionId, remotePath, localPath });
      }
      setDownloadNotice(t("sftp.downloaded", { name: remoteName }));
      setTimeout(() => setDownloadNotice(null), 3000);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDownloadingFile(null);
    }
  }, [sessionId, t]);

  // Handle drop from local panel onto remote SFTP
  const handleLocalToRemoteDrop = useCallback(async (e: React.DragEvent) => {
    const localPath = e.dataTransfer.getData("text/x-local-path");
    if (!localPath) return;
    e.preventDefault();
    e.stopPropagation();
    invoke("sftp_upload_files", { sessionId, remoteDir: currentPath, localPaths: [localPath] })
      .catch((err: unknown) => setError(getErrorMessage(err)));
  }, [sessionId, currentPath]);

  const handleLocalDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("text/x-local-path")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  }, []);

  return (
    <div className="h-full flex border-t border-surface-0/30">
      {/* Local file browser panel */}
      {showLocalPanel ? (
        <div ref={localPanelRef} className="w-1/2 h-full">
          <LocalFileBrowser
            onDragStartFile={handleLocalDragStart}
            onClose={() => setShowLocalPanel(false)}
            remoteDragging={remoteDragging}
            localCurrentPathRef={localCurrentPathRef}
            refreshTrigger={localRefreshTrigger}
          />
        </div>
      ) : (
        <button
          onClick={() => setShowLocalPanel(true)}
          className="shrink-0 h-full w-7 flex flex-col items-center justify-center gap-2 bg-surface-0/5 hover:bg-surface-0/20 border-r border-surface-0/30 text-text-muted hover:text-green transition-colors cursor-pointer"
          title={t("sftp.showLocal", "Show local files")}
        >
          <HardDrive size={14} />
          <span className="text-[10px] font-medium tracking-wider" style={{ writingMode: "vertical-lr" }}>
            Local
          </span>
        </button>
      )}

      {/* Remote SFTP panel */}
      <section
        aria-label="Remote SFTP browser"
        className={`${showLocalPanel ? "w-1/2 border-l border-surface-0/30" : "w-full"} h-full flex flex-col text-text relative`}
        onDragOver={handleLocalDragOver}
        onDrop={handleLocalToRemoteDrop}
      >
      {/* Drag overlay removed — OS file drop disabled, use local file browser panel */}

      <SftpToolbar
        currentPath={currentPath}
        loading={loading}
        showHidden={showHidden}
        showDetails={showDetails}
        editingPath={editingPath}
        pathInputValue={pathInputValue}
        pathCopied={pathCopied}
        onGoHome={handleGoHome}
        onGoUp={handleGoUp}
        onRefresh={handleRefresh}
        onNewFolder={() => setShowNewFolderDialog(true)}
        onNewFile={() => setShowNewFileDialog(true)}
        onToggleHidden={() => setShowHidden((v) => { const next = !v; localStorage.setItem("sftp-show-hidden", String(next)); return next; })}
        onToggleDetails={() => setShowDetails((v) => { const next = !v; localStorage.setItem("sftp-show-details", String(next)); return next; })}
        onEditPath={() => { setEditingPath(true); setPathInputValue(currentPath); }}
        onPathInputChange={setPathInputValue}
        onPathSubmit={(path) => { setEditingPath(false); loadDirectory(path); }}
        onCancelEdit={() => setEditingPath(false)}
        onCopyPath={async () => {
          await navigator.clipboard.writeText(currentPath);
          setPathCopied(true);
          setTimeout(() => setPathCopied(false), 1500);
        }}
        onNavigatePath={loadDirectory}
        t={t}
      />

      <SftpNotificationBars
        uploadProgress={uploadProgress}
        downloadingFile={downloadingFile}
        downloadNotice={downloadNotice}
        error={error}
        onClearError={() => setError(null)}
        t={t}
      />

      {/* New folder dialog */}
      {showNewFolderDialog && (
        <SftpNewItemDialog
          icon={FolderPlus}
          value={newFolderName}
          onChange={setNewFolderName}
          placeholder={t("sftp.newFolderPlaceholder")}
          onSubmit={handleCreateFolder}
          onCancel={() => setShowNewFolderDialog(false)}
        />
      )}

      {/* New file dialog */}
      {showNewFileDialog && (
        <SftpNewItemDialog
          icon={FilePlus}
          value={newFileName}
          onChange={setNewFileName}
          placeholder={t("sftp.newFilePlaceholder", "File name")}
          onSubmit={handleCreateFile}
          onCancel={() => setShowNewFileDialog(false)}
        />
      )}

      {/* File list */}
      <div ref={fileListRef} className="flex-1 overflow-auto">
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
                <th className="text-left px-3 py-1.5 font-medium cursor-pointer select-none hover:text-text transition-colors" onClick={() => handleSort("name")}>
                  <span className="inline-flex items-center gap-1">{t("sftp.colName")} {sortColumn === "name" && (sortAsc ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}</span>
                </th>
                {showDetails && (
                  <>
                    <th className="text-left px-3 py-1.5 font-medium w-24">{t("sftp.colPermissions", "Permissions")}</th>
                    <th className="text-right px-3 py-1.5 font-medium w-16">{t("sftp.colUid", "UID")}</th>
                    <th className="text-right px-3 py-1.5 font-medium w-16">{t("sftp.colGid", "GID")}</th>
                  </>
                )}
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
                      : getRowHighlight(entry.path, index, contextMenu?.entry?.path, selectedEntry?.path)}
                  `}
                  onClick={() => setSelectedEntry(entry)}
                  onDoubleClick={() => handleNavigate(entry)}
                  onContextMenu={(e) => handleContextMenu(e, entry)}
                >
                  <td className="px-3 py-1.5">
                    <SftpFileNameCell
                      entry={entry}
                      renamingEntry={renamingEntry}
                      renameValue={renameValue}
                      onRenameValueChange={setRenameValue}
                      onRename={handleRename}
                      onCancelRename={() => setRenamingEntry(null)}
                      isEditing={isEditing(entry.path)}
                      getEditStatus={getEditStatus(entry.path)}
                    />
                  </td>
                  {showDetails && (
                    <>
                      <td
                        className="px-3 py-1.5 text-text-muted text-xs font-mono cursor-help"
                        title={formatPermissionsTooltip(entry.permissions)}
                      >
                        {entry.permissions ?? "-"}
                      </td>
                      <td className="px-3 py-1.5 text-right text-text-muted text-xs">
                        {entry.uid ?? "-"}
                      </td>
                      <td className="px-3 py-1.5 text-right text-text-muted text-xs">
                        {entry.gid ?? "-"}
                      </td>
                    </>
                  )}
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
          className="fixed z-9999 min-w-40 py-1 bg-crust rounded-lg border border-surface-0/50 shadow-xl"
          style={{
            left: Math.min(contextMenu.x, globalThis.innerWidth - 180),
            top: Math.min(contextMenu.y, globalThis.innerHeight - 200),
          }}
          role="menu"
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => { if (e.key === 'Escape') setContextMenu(null); }}
        >
          <SftpContextMenuContent
            entry={contextMenu.entry}
            onClose={() => setContextMenu(null)}
            actions={{ handleEditExternal, handleDownload, handleNavigate, handleCopyPath, setRenamingEntry, setRenameValue, handleDeleteRequest, setShowNewFolderDialog, setShowNewFileDialog, handleRefresh }}
            isEditing={isEditing}
            getEditStatus={getEditStatus}
            t={t}
          />
        </div>,
        document.body,
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <SftpDeleteModal
          target={deleteTarget}
          deleting={deleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDeleteConfirm}
          deleteModalRef={deleteModalRef}
          t={t}
        />
      )}

      {/* Status bar */}
      <SftpStatusBar
        showHidden={showHidden}
        entries={entries}
        visibleEntries={visibleEntries}
        editingFiles={editingFiles}
        selectedEntry={selectedEntry}
        formatSize={formatSize}
        t={t}
      />
      </section>
    </div>
  );
}
