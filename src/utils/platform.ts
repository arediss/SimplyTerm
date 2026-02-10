/**
 * Platform detection utilities for keyboard shortcuts
 */

// Detect if running on macOS (using userAgent instead of deprecated navigator.platform)
export const isMac = typeof navigator !== 'undefined' &&
  /Macintosh|Mac OS|iPod|iPhone|iPad/.test(navigator.userAgent);

// Detect if running on Windows
export const isWindows = typeof navigator !== 'undefined' &&
  /Windows/.test(navigator.userAgent);

// Get the modifier key symbol based on platform
export const modifierKey = isMac ? '⌘' : 'Ctrl';

/**
 * Check if the correct modifier key is pressed based on platform
 * On macOS: checks metaKey (⌘)
 * On Windows/Linux: checks ctrlKey
 */
export function isModifierPressed(e: KeyboardEvent): boolean {
  return isMac ? e.metaKey : e.ctrlKey;
}
