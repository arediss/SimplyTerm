/**
 * Platform detection utilities for keyboard shortcuts
 */

// Detect if running on macOS
export const isMac = typeof navigator !== 'undefined' &&
  /Mac|iPod|iPhone|iPad/.test(navigator.platform);

// Get the modifier key symbol based on platform
export const modifierKey = isMac ? '⌘' : 'Ctrl';

// Get the modifier key name (for accessibility/screen readers)
export const modifierKeyName = isMac ? 'Command' : 'Control';

/**
 * Check if the correct modifier key is pressed based on platform
 * On macOS: checks metaKey (⌘)
 * On Windows/Linux: checks ctrlKey
 */
export function isModifierPressed(e: KeyboardEvent): boolean {
  return isMac ? e.metaKey : e.ctrlKey;
}
