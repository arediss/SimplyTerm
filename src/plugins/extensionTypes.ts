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
 * Legacy API - prefer SidebarViewConfig for new plugins
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
 * Legacy API - prefer SidebarViewRegistration for new plugins
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
// QuickConnect Section Extension Types
// ============================================================================

/**
 * Configuration for a quick-connect section registered by a plugin.
 * Rendered inside the QuickConnect dropdown (the "+" arrow menu).
 */
export interface QuickConnectSectionConfig {
  /** Unique section identifier */
  id: string;
  /** Sort order (lower = higher in dropdown) */
  order?: number;
}

/**
 * Registration object for a quick-connect section
 */
export interface QuickConnectSectionRegistration {
  /** Section configuration */
  config: QuickConnectSectionConfig;
  /**
   * Render function called when the dropdown is shown
   * @param container - DOM element to render into
   * @returns Optional cleanup function called when dropdown is hidden
   */
  render: (container: HTMLElement) => void | (() => void);
}

// ============================================================================
// Session Decorator Extension Types
// ============================================================================

/**
 * Configuration for a session decorator registered by a plugin.
 * Decorators render visual elements (e.g., tag pills) into session cards.
 */
export interface SessionDecoratorConfig {
  /** Unique decorator identifier */
  id: string;
  /** Sort order (lower = rendered first) */
  order?: number;
}

/**
 * Registration object for a session decorator
 */
export interface SessionDecoratorRegistration {
  /** Decorator configuration */
  config: SessionDecoratorConfig;
  /**
   * Render function called for each session card
   * @param sessionId - The session's unique ID
   * @param container - DOM element to render into
   * @returns Optional cleanup function called on unmount
   */
  render: (sessionId: string, container: HTMLElement) => void | (() => void);
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
