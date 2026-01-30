import { invoke } from "@tauri-apps/api/core";

/**
 * Expand ~ to home directory in a path
 */
export async function expandHomeDir(path: string | undefined): Promise<string | undefined> {
  if (!path) return path;
  if (!path.startsWith("~")) return path;

  try {
    const home = await invoke<string>("get_home_dir");
    if (home) {
      return path.replace("~", home);
    }
  } catch {
    // Ignore error, return original path
  }
  return path;
}
