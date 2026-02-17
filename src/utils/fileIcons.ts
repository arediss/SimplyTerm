import type { LucideIcon } from "lucide-react";
import {
  File,
  FileText,
  FileCode,
  FileCode2,
  FileJson,
  FileImage,
  FileArchive,
  FileKey,
  FileCog,
  FileTerminal,
  FileType,
  FileSpreadsheet,
  Database,
  Globe,
  Container,
  Settings,
} from "lucide-react";

interface FileIconResult {
  icon: LucideIcon;
  color: string;
}

/** Map of exact lowercase filenames → icon + color */
const FILENAME_MAP: Record<string, FileIconResult> = Object.fromEntries([
  // Shell configs
  ...[".bashrc", ".zshrc", ".profile", ".bash_profile", ".bash_aliases",
      ".fishrc", ".cshrc", ".kshrc"].map(
    (n) => [n, { icon: FileTerminal, color: "text-green" }] as const
  ),
  // Dotfile configs
  ...[".gitignore", ".gitattributes", ".gitmodules", ".editorconfig",
      ".eslintrc", ".prettierrc", ".npmrc", ".yarnrc", ".env",
      ".dockerignore", ".htaccess"].map(
    (n) => [n, { icon: FileCog, color: "text-cyan" }] as const
  ),
  // History / logs
  ...[".bash_history", ".zsh_history", ".lesshst", ".viminfo",
      ".bash_logout"].map(
    (n) => [n, { icon: FileText, color: "text-text-muted" }] as const
  ),
  // Docker
  ...["dockerfile", "docker-compose.yml", "docker-compose.yaml",
      "compose.yml", "compose.yaml"].map(
    (n) => [n, { icon: Container, color: "text-blue" }] as const
  ),
  // Build / task files
  ...["makefile", "cmakelists.txt", "rakefile", "gemfile",
      "vagrantfile", "procfile"].map(
    (n) => [n, { icon: Settings, color: "text-cyan" }] as const
  ),
  // Docs
  ...["readme", "readme.md", "license", "licence", "changelog",
      "changelog.md", "contributing.md"].map(
    (n) => [n, { icon: FileText, color: "text-teal" }] as const
  ),
]);

/** Map of file extensions → icon + color */
const EXTENSION_MAP: Record<string, FileIconResult> = Object.fromEntries([
  ...["sh", "bash", "zsh", "fish"].map(
    (e) => [e, { icon: FileTerminal, color: "text-green" }] as const
  ),
  ...["py", "rb", "pl", "lua"].map(
    (e) => [e, { icon: FileCode, color: "text-green" }] as const
  ),
  ...["json"].map(
    (e) => [e, { icon: FileJson, color: "text-cyan" }] as const
  ),
  ...["yaml", "yml", "toml", "ini", "conf", "cfg", "env",
      "xml", "plist", "properties"].map(
    (e) => [e, { icon: FileCog, color: "text-cyan" }] as const
  ),
  ...["html", "htm"].map(
    (e) => [e, { icon: Globe, color: "text-orange" }] as const
  ),
  ...["css", "scss", "less", "sass"].map(
    (e) => [e, { icon: FileType, color: "text-orange" }] as const
  ),
  ...["ts", "tsx", "js", "jsx"].map(
    (e) => [e, { icon: FileCode2, color: "text-purple" }] as const
  ),
  ...["rs", "go", "c", "cpp", "h", "hpp", "java", "kt", "swift",
      "cs", "php", "vue", "svelte"].map(
    (e) => [e, { icon: FileCode, color: "text-purple" }] as const
  ),
  ...["sql"].map(
    (e) => [e, { icon: Database, color: "text-purple" }] as const
  ),
  ...["md", "txt", "rst", "tex", "org"].map(
    (e) => [e, { icon: FileText, color: "text-text-secondary" }] as const
  ),
  ...["log"].map(
    (e) => [e, { icon: FileText, color: "text-text-muted" }] as const
  ),
  ...["csv", "tsv"].map(
    (e) => [e, { icon: FileSpreadsheet, color: "text-text-secondary" }] as const
  ),
  ...["zip", "tar", "gz", "bz2", "xz", "7z", "rar", "deb", "rpm",
      "dmg", "iso", "tgz"].map(
    (e) => [e, { icon: FileArchive, color: "text-red" }] as const
  ),
  ...["png", "jpg", "jpeg", "gif", "svg", "webp", "ico", "bmp",
      "tiff", "psd", "ai"].map(
    (e) => [e, { icon: FileImage, color: "text-pink" }] as const
  ),
  ...["bin", "dat", "db", "sqlite", "sqlite3", "so", "dylib", "dll",
      "exe", "o", "a"].map(
    (e) => [e, { icon: Database, color: "text-text-muted" }] as const
  ),
  ...["pem", "crt", "key", "pub", "cer", "p12", "pfx"].map(
    (e) => [e, { icon: FileKey, color: "text-yellow" }] as const
  ),
]);

const DEFAULT_ICON: FileIconResult = { icon: File, color: "text-text-muted" };

/** Returns icon component + color class for a file based on name/extension */
export function getFileIcon(name: string): FileIconResult {
  const lower = name.toLowerCase();
  const byName = FILENAME_MAP[lower];
  if (byName) return byName;

  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_MAP[ext] ?? DEFAULT_ICON;
}
