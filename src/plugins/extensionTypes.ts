/**
 * Extension Types for SimplyTerm Plugin System
 *
 * These types define the extension points that plugins can use to
 * integrate with the SimplyTerm UI and core functionality.
 */

// ============================================================================
// Sidebar View (Tab) Extension Types
// ============================================================================

/**
 * Configuration for a sidebar view (tab) registered by a plugin
 */
export interface SidebarViewConfig {
  /** Unique view identifier */
  id: string;
  /** Display label for the tab */
  label: string;
  /** Icon name (from lucide-react) */
  icon?: string;
  /** Sort order (lower = more to the left) */
  order: number;
}

/**
 * Registration object for a sidebar view (tab)
 */
export interface SidebarViewRegistration {
  /** View configuration */
  config: SidebarViewConfig;
  /**
   * Render function called when the view tab is active
   * @param container - DOM element to render into
   * @returns Optional cleanup function called when tab is deactivated
   */
  render: (container: HTMLElement) => void | (() => void);
}

// ============================================================================
// Sidebar Section Extension Types (DEPRECATED - use SidebarView instead)
// ============================================================================

/**
 * Configuration for a sidebar section registered by a plugin
 * @deprecated Use SidebarViewConfig instead for tab-based UI
 */
export interface SidebarSectionConfig {
  /** Unique section identifier */
  id: string;
  /** Display title for the section header */
  title: string;
  /** Icon name (from lucide-react) */
  icon?: string;
  /** Sort order (lower = higher in sidebar) */
  order: number;
  /** Whether section is collapsible (default: true) */
  collapsible?: boolean;
  /** Initial collapsed state (default: false) */
  defaultCollapsed?: boolean;
}

/**
 * Registration object for a sidebar section
 * @deprecated Use SidebarViewRegistration instead for tab-based UI
 */
export interface SidebarSectionRegistration {
  /** Section configuration */
  config: SidebarSectionConfig;
  /**
   * Render function called when the section is mounted
   * @param container - DOM element to render into
   * @returns Optional cleanup function called on unmount
   */
  render: (container: HTMLElement) => void | (() => void);
}

// ============================================================================
// Settings Panel Extension Types
// ============================================================================

/**
 * Configuration for a settings panel registered by a plugin
 */
export interface SettingsPanelConfig {
  /** Unique panel identifier */
  id: string;
  /** Display title in settings navigation */
  title: string;
  /** Icon name (from lucide-react) */
  icon?: string;
  /** Sort order in settings list */
  order?: number;
  /** Category for grouping (e.g., "general", "plugins", "advanced") */
  category?: string;
}

/**
 * Registration object for a settings panel
 */
export interface SettingsPanelRegistration {
  /** Panel configuration */
  config: SettingsPanelConfig;
  /**
   * Render function called when the panel is shown
   * @param container - DOM element to render into
   * @returns Optional cleanup function called when panel is hidden
   */
  render: (container: HTMLElement) => void | (() => void);
}

// ============================================================================
// Context Menu Extension Types
// ============================================================================

/**
 * Configuration for a context menu item
 */
export interface ContextMenuItemConfig {
  /** Unique item identifier */
  id: string;
  /** Display label */
  label: string;
  /** Icon name (from lucide-react) */
  icon?: string;
  /** Keyboard shortcut hint */
  shortcut?: string;
  /** Whether item is disabled */
  disabled?: boolean;
  /** Handler when item is clicked */
  onClick: (context: ContextMenuContext) => void;
}

/**
 * Context information passed to menu item handlers
 */
export interface ContextMenuContext {
  /** Type of element that was right-clicked */
  type: "session" | "folder" | "tab" | "terminal";
  /** ID of the target element */
  targetId: string;
  /** Additional context data */
  data?: Record<string, unknown>;
}

// ============================================================================
// Session Metadata Types
// ============================================================================

/**
 * Session metadata stored by plugins
 * Each plugin has isolated storage for session metadata
 */
export interface SessionMetadata {
  /** Arbitrary JSON data */
  [key: string]: unknown;
}

/**
 * Session metadata API for plugins
 */
export interface SessionMetadataAPI {
  /**
   * Get metadata for a specific session
   * @param sessionId - Session ID
   * @returns Metadata object or null if not found
   */
  get(sessionId: string): Promise<SessionMetadata | null>;

  /**
   * Get metadata for all sessions
   * @returns Map of session ID to metadata
   */
  getAll(): Promise<Map<string, SessionMetadata>>;

  /**
   * Set metadata for a session (overwrites existing)
   * @param sessionId - Session ID
   * @param data - Metadata to store
   */
  set(sessionId: string, data: SessionMetadata): Promise<void>;

  /**
   * Update specific fields in session metadata (merge)
   * @param sessionId - Session ID
   * @param updates - Fields to update
   * @returns Updated metadata
   */
  update(sessionId: string, updates: SessionMetadata): Promise<SessionMetadata>;

  /**
   * Delete metadata for a session
   * @param sessionId - Session ID
   * @returns True if metadata existed and was deleted
   */
  delete(sessionId: string): Promise<boolean>;
}

// ============================================================================
// Event Types for Extensions
// ============================================================================

/**
 * Session-related events
 */
export interface SessionEvents {
  /** Fired when a session is created */
  "session:created": { sessionId: string };
  /** Fired when a session is deleted */
  "session:deleted": { sessionId: string };
  /** Fired when a session connection is established */
  "session:connected": { sessionId: string };
  /** Fired when a session connection is closed */
  "session:disconnected": { sessionId: string };
}

/**
 * UI-related events
 */
export interface UIEvents {
  /** Fired when sidebar visibility changes */
  "sidebar:toggle": { visible: boolean };
  /** Fired when a tab is activated */
  "tab:activated": { tabId: string };
  /** Fired when a tab is closed */
  "tab:closed": { tabId: string };
}

/**
 * All extension events
 */
export type ExtensionEvent = SessionEvents & UIEvents;

// ============================================================================
// Header Action Extension Types
// ============================================================================

/**
 * Configuration for a header action button registered by a plugin.
 * Rendered as an icon button in the header bar (before window controls).
 */
export interface HeaderActionConfig {
  /** Unique action identifier */
  id: string;
  /** Icon name (from lucide-react) */
  icon: string;
  /** Tooltip text */
  tooltip?: string;
  /** Position in header: 'left' (after menu) or 'right' (before window controls). Default: 'right' */
  position?: "left" | "right";
  /** Sort order (lower = more to the left/first) */
  order?: number;
  /** Handler when the button is clicked. Receives the position of the button for anchoring dropdowns. */
  onClick: (position: { x: number; y: number; right: number }) => void;
}

/**
 * Handle for updating a header action after registration
 */
export interface HeaderActionHandle {
  /** Update the icon */
  setIcon(icon: string): void;
  /** Update the tooltip */
  setTooltip(tooltip: string): void;
  /** Show or hide the action */
  setVisible(visible: boolean): void;
  /** Remove the action */
  dispose(): void;
}

// ============================================================================
// Toolbar Extension Types
// ============================================================================

/**
 * Configuration for a toolbar button
 */
export interface ToolbarButtonConfig {
  /** Unique button identifier */
  id: string;
  /** Tooltip text */
  tooltip: string;
  /** Icon name (from lucide-react) */
  icon: string;
  /** Position in toolbar */
  position?: "left" | "right";
  /** Sort order within position */
  order?: number;
  /** Handler when button is clicked */
  onClick: () => void;
}

// ============================================================================
// Status Bar Extension Types
// ============================================================================

/**
 * Configuration for a status bar item
 */
export interface StatusBarItemConfig {
  /** Unique item identifier */
  id: string;
  /** Initial text content */
  text?: string;
  /** Icon name (from lucide-react) */
  icon?: string;
  /** Tooltip text */
  tooltip?: string;
  /** Position in status bar */
  position?: "left" | "right";
  /** Sort order within position */
  order?: number;
  /** Handler when item is clicked */
  onClick?: () => void;
}

/**
 * Handle for updating a status bar item
 */
export interface StatusBarItemHandle {
  /** Update the item text */
  setText(text: string): void;
  /** Update the item icon */
  setIcon(icon: string): void;
  /** Update the tooltip */
  setTooltip(tooltip: string): void;
  /** Show or hide the item */
  setVisible(visible: boolean): void;
  /** Remove the item */
  dispose(): void;
}
