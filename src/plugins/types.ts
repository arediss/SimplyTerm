/**
 * Plugin System Types for SimplyTerm
 */

// ============================================================================
// Manifest Types (from backend)
// ============================================================================

export type PluginStatus = 'disabled' | 'enabled' | 'error';

export interface PanelConfig {
  id: string;
  title: string;
  icon?: string;
  position: 'left' | 'right' | 'bottom' | 'floating-left' | 'floating-right';
}

export interface CommandConfig {
  id: string;
  title: string;
  shortcut?: string;
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  author?: string;
  description?: string;
  status: PluginStatus;
  permissions: string[];
  panels: PanelConfig[];
  commands: CommandConfig[];
}

// ============================================================================
// Plugin API Types
// ============================================================================

export interface SessionInfo {
  id: string;
  type: 'local' | 'ssh' | 'sftp';
  host?: string;
  port?: number;
  username?: string;
  status: 'connected' | 'disconnected' | 'connecting';
}

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
// Plugin API Interface
// ============================================================================

export interface SimplyTermPluginAPI {
  // Lifecycle
  onLoad(callback: () => void): void;
  onUnload(callback: () => void): void;

  // Panels
  registerPanel(config: PanelRegistration): void;
  showPanel(panelId: string): void;
  hidePanel(panelId: string): void;

  // Commands
  registerCommand(config: CommandRegistration): void;
  executeCommand(commandId: string): void;

  // Terminal hooks
  onTerminalOutput(sessionId: string, callback: (data: string) => void): Unsubscribe;
  onTerminalInput(sessionId: string, callback: (data: string) => void): Unsubscribe;
  writeToTerminal(sessionId: string, data: string): Promise<void>;

  // Background command execution (doesn't pollute terminal)
  execCommand(sessionId: string, command: string): Promise<string>;

  // Session events
  onSessionConnect(callback: (session: SessionInfo) => void): Unsubscribe;
  onSessionDisconnect(callback: (sessionId: string) => void): Unsubscribe;
  getActiveSession(): SessionInfo | null;
  getAllSessions(): SessionInfo[];

  // Backend bridge
  invokeBackend<T>(command: string, args?: Record<string, unknown>): Promise<T>;

  // Storage (plugin-scoped)
  storage: {
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, value: T): Promise<void>;
    delete(key: string): Promise<void>;
  };

  // UI utilities
  showNotification(message: string, type?: NotificationType): void;
  showModal(config: ModalConfig): Promise<unknown>;
}

// ============================================================================
// Plugin Registration Types
// ============================================================================

export interface PanelRegistration {
  id: string;
  render: (container: HTMLElement) => void | (() => void);
}

export interface CommandRegistration {
  id: string;
  handler: () => void | Promise<void>;
}

// ============================================================================
// Plugin Module Types
// ============================================================================

export interface PluginModule {
  default: (api: SimplyTermPluginAPI) => void | Promise<void>;
}

// ============================================================================
// Internal Plugin State
// ============================================================================

export interface LoadedPlugin {
  manifest: PluginManifest;
  api: SimplyTermPluginAPI;
  panels: Map<string, PanelRegistration>;
  commands: Map<string, CommandRegistration>;
  subscriptions: Unsubscribe[];
  onLoadCallback?: () => void;
  onUnloadCallback?: () => void;
  onSessionConnectCallback?: (session: SessionInfo) => void;
  onSessionDisconnectCallback?: (sessionId: string) => void;
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
  | { type: 'command:execute'; commandId: string };

export type PluginEventHandler = (event: PluginEvent) => void;

// ============================================================================
// Message Types (for iframe communication)
// ============================================================================

export interface PluginMessage {
  type: string;
  id: string;
  pluginId: string;
  payload?: unknown;
}

export interface PluginResponse {
  type: 'response';
  id: string;
  success: boolean;
  result?: unknown;
  error?: string;
}
