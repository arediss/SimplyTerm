/**
 * Plugin System Types for SimplyTerm
 *
 * API v1 - Unified types for backend and frontend plugin system
 */

import type { SidebarSectionRegistration, SidebarViewRegistration, SettingsPanelRegistration, ContextMenuItemConfig, StatusBarItemConfig, StatusBarItemHandle } from './extensionTypes';

// Re-export extension types
export type { SidebarSectionRegistration, SidebarViewRegistration, SettingsPanelRegistration, ContextMenuItemConfig, StatusBarItemConfig, StatusBarItemHandle } from './extensionTypes';
export type { ContextMenuContext } from './extensionTypes';

// ============================================================================
// Manifest Types (from backend)
// ============================================================================

export type PluginStatus = 'disabled' | 'enabled' | 'error';

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  apiVersion: string;
  author: string;
  description: string;
  homepage?: string;
  main: string;
  icon?: string;
  permissions: string[];
  status: PluginStatus;
  errorMessage?: string;
}

// ============================================================================
// Permission Types
// ============================================================================

export type Permission =
  // Sessions
  | 'sessions_read'
  | 'sessions_write'
  | 'sessions_connect'
  | 'sessions_metadata_read'
  | 'sessions_metadata_write'
  // Vault
  | 'vault_status'
  | 'vault_read'
  | 'vault_write'
  // Settings
  | 'settings_read'
  | 'settings_write'
  // Events
  | 'events_subscribe'
  | 'events_emit'
  // Shell
  | 'shell_execute'
  // Network
  | 'network_http'
  | 'network_websocket'
  // File System
  | 'fs_read'
  | 'fs_write'
  // UI
  | 'ui_menu'
  | 'ui_notifications'
  | 'ui_settings'
  | 'ui_panels'
  | 'ui_commands'
  | 'ui_modals'
  | 'ui_sidebar'
  | 'ui_context_menu'
  // Terminal
  | 'terminal_read'
  | 'terminal_write'
  // Clipboard
  | 'clipboard_read'
  | 'clipboard_write'
  // Bastions
  | 'bastions_read'
  | 'bastions_write'
  // Known Hosts
  | 'known_hosts_read'
  | 'known_hosts_write';

// ============================================================================
// Session Types
// ============================================================================

export interface SessionInfo {
  id: string;
  type: 'local' | 'ssh' | 'sftp' | 'telnet' | 'serial';
  host?: string;
  port?: number;
  username?: string;
  status: 'connected' | 'disconnected' | 'connecting';
}

/**
 * Core saved session (connection info only)
 * Plugin-managed metadata is stored via sessionMetadata API
 */
export interface SavedSession {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: 'password' | 'key';
  keyPath?: string;
}

/**
 * Session metadata stored by plugins
 */
export interface SessionMetadata {
  [key: string]: unknown;
}

// ============================================================================
// UI Types
// ============================================================================

export interface ModalConfig {
  title: string;
  content: string | HTMLElement;
  buttons?: ModalButton[];
}

export interface ModalButton {
  label: string;
  variant?: 'primary' | 'secondary' | 'danger';
  onClick?: () => void | Promise<void>;
}

export type NotificationType = 'info' | 'success' | 'error' | 'warning';

export type Unsubscribe = () => void;

// ============================================================================
// Panel & Command Registration
// ============================================================================

export interface PanelConfig {
  id: string;
  title: string;
  icon?: string;
  position: 'left' | 'right' | 'bottom' | 'floating-left' | 'floating-right';
}

export interface PanelRegistration {
  id: string;
  render: (container: HTMLElement) => void | (() => void);
}

export interface CommandRegistration {
  id: string;
  title?: string;
  shortcut?: string;
  handler: () => void | Promise<void>;
}

// ============================================================================
// Plugin API Interface
// ============================================================================

export interface SimplyTermPluginAPI {
  // Plugin ID
  readonly pluginId: string;

  // Lifecycle
  onLoad(callback: () => void): void;
  onUnload(callback: () => void): void;

  // Panels (requires ui_panels)
  registerPanel(config: PanelRegistration): void;
  showPanel(panelId: string): void;
  hidePanel(panelId: string): void;

  // Sidebar views/tabs (requires ui_sidebar) - recommended
  registerSidebarView(config: SidebarViewRegistration): void;
  unregisterSidebarView(viewId: string): void;

  // Sidebar sections (requires ui_sidebar) - deprecated, use registerSidebarView
  registerSidebarSection(config: SidebarSectionRegistration): void;
  unregisterSidebarSection(sectionId: string): void;

  // Settings panels (requires ui_settings)
  registerSettingsPanel(config: SettingsPanelRegistration): void;
  unregisterSettingsPanel(panelId: string): void;

  // Context menu items (requires ui_context_menu)
  registerContextMenuItem(config: ContextMenuItemConfig): void;
  unregisterContextMenuItem(itemId: string): void;

  // Commands (requires ui_commands)
  registerCommand(config: CommandRegistration): void;
  executeCommand(commandId: string): void;

  // Terminal hooks (requires terminal_read/terminal_write)
  onTerminalOutput(sessionId: string, callback: (data: string) => void): Unsubscribe;
  onTerminalInput(sessionId: string, callback: (data: string) => void): Unsubscribe;
  writeToTerminal(sessionId: string, data: string): Promise<void>;

  // Session events (requires events_subscribe)
  onSessionConnect(callback: (session: SessionInfo) => void): Unsubscribe;
  onSessionDisconnect(callback: (sessionId: string) => void): Unsubscribe;
  onSessionCreated(callback: (sessionId: string) => void): Unsubscribe;
  onSessionDeleted(callback: (sessionId: string) => void): Unsubscribe;
  getActiveSession(): SessionInfo | null;
  getAllSessions(): SessionInfo[];

  // Backend API (direct invoke with permission checking on backend)
  invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;

  // Storage (requires fs_read/fs_write) - sandboxed
  storage: {
    read(path: string): Promise<string>;
    write(path: string, content: string): Promise<void>;
    delete(path: string): Promise<void>;
    list(path: string): Promise<FileEntry[]>;
  };

  // Session metadata (requires sessions_metadata_read/sessions_metadata_write) - sandboxed per plugin
  sessionMetadata: {
    get(sessionId: string): Promise<SessionMetadata | null>;
    getAll(): Promise<Map<string, SessionMetadata>>;
    set(sessionId: string, data: SessionMetadata): Promise<void>;
    update(sessionId: string, updates: SessionMetadata): Promise<SessionMetadata>;
    delete(sessionId: string): Promise<boolean>;
  };

  // Status bar (requires ui_notifications)
  addStatusBarItem(config: StatusBarItemConfig): StatusBarItemHandle;

  // UI utilities (requires ui_notifications/ui_modals)
  showNotification(message: string, type?: NotificationType): void;
  showModal(config: ModalConfig): Promise<unknown>;
  showPrompt(config: PromptConfig): Promise<string | null>;
}

export interface PromptConfig {
  title: string;
  message?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

export interface FileEntry {
  name: string;
  isDirectory: boolean;
  size: number;
  modified: number;
}

// ============================================================================
// Plugin Module Types
// ============================================================================

export interface PluginModule {
  init: (api: SimplyTermPluginAPI) => void | Promise<void>;
  cleanup?: () => void;
}

// ============================================================================
// Internal Plugin State
// ============================================================================

export interface LoadedPlugin {
  manifest: PluginManifest;
  api: SimplyTermPluginAPI;
  panels: Map<string, PanelRegistration>;
  commands: Map<string, CommandRegistration>;
  sidebarViews: Map<string, SidebarViewRegistration>;
  sidebarSections: Map<string, SidebarSectionRegistration>; // deprecated
  settingsPanels: Map<string, SettingsPanelRegistration>;
  contextMenuItems: Map<string, ContextMenuItemConfig>;
  subscriptions: Unsubscribe[];
  onLoadCallback?: () => void;
  onUnloadCallback?: () => void;
  onSessionConnectCallback?: (session: SessionInfo) => void;
  onSessionDisconnectCallback?: (sessionId: string) => void;
  onSessionCreatedCallback?: (sessionId: string) => void;
  onSessionDeletedCallback?: (sessionId: string) => void;
}

// ============================================================================
// Plugin Events
// ============================================================================

export type PluginEvent =
  | { type: 'plugin:loaded'; pluginId: string }
  | { type: 'plugin:unloaded'; pluginId: string }
  | { type: 'plugin:error'; pluginId: string; error: string }
  | { type: 'panel:register'; pluginId: string; panelId: string }
  | { type: 'panel:show'; panelId: string }
  | { type: 'panel:hide'; panelId: string }
  | { type: 'command:register'; pluginId: string; commandId: string }
  | { type: 'command:execute'; commandId: string }
  | { type: 'sidebar-view:register'; pluginId: string; viewId: string }
  | { type: 'sidebar-view:unregister'; pluginId: string; viewId: string }
  | { type: 'sidebar:register'; pluginId: string; sectionId: string } // deprecated
  | { type: 'sidebar:unregister'; pluginId: string; sectionId: string } // deprecated
  | { type: 'settings:register'; pluginId: string; panelId: string }
  | { type: 'settings:unregister'; pluginId: string; panelId: string }
  | { type: 'context-menu:register'; pluginId: string; itemId: string }
  | { type: 'context-menu:unregister'; pluginId: string; itemId: string }
  | { type: 'statusbar:changed' };

export type PluginEventHandler = (event: PluginEvent) => void;

// ============================================================================
// Vault Types
// ============================================================================

export interface VaultStatus {
  exists: boolean;
  isUnlocked: boolean;
}

// ============================================================================
// Settings Types
// ============================================================================

export interface AppSettings {
  terminal: {
    fontSize: number;
    fontFamily: string;
    cursorStyle: string;
    cursorBlink: boolean;
    scrollback: number;
  };
  appearance: {
    theme: string;
    accentColor: string;
  };
  ui: {
    statusBarVisible: boolean;
  };
}
