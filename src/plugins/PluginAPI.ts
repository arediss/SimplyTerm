/**
 * Plugin API Implementation
 *
 * Provides the SimplyTermPluginAPI to plugins.
 * Uses the new v1 API with permission checking on the backend.
 */

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type {
  SimplyTermPluginAPI,
  SessionInfo,
  ModalConfig,
  NotificationType,
  Unsubscribe,
  PanelRegistration,
  CommandRegistration,
  LoadedPlugin,
  PluginManifest,
  FileEntry,
  SessionMetadata,
  PromptConfig,
  StatusBarItemConfig,
  StatusBarItemHandle,
  HeaderActionConfig,
  HeaderActionHandle,
} from './types';
import type { SidebarViewRegistration, SidebarSectionRegistration, SettingsPanelRegistration, ContextMenuItemConfig, QuickConnectSectionRegistration } from './extensionTypes';

/**
 * Check if a plugin has a specific permission
 */
function hasPermission(permissions: string[], perm: string): boolean {
  return permissions.includes(perm);
}

/**
 * Create a Plugin API instance for a specific plugin
 */
export function createPluginAPI(
  manifest: PluginManifest,
  pluginState: LoadedPlugin,
  callbacks: {
    onShowNotification: (message: string, type: NotificationType) => void;
    onShowModal: (config: ModalConfig) => Promise<unknown>;
    onShowPrompt: (config: PromptConfig) => Promise<string | null>;
    onPanelRegister: (pluginId: string, panel: PanelRegistration) => void;
    onCommandRegister: (pluginId: string, command: CommandRegistration) => void;
    onPanelShow: (panelId: string) => void;
    onPanelHide: (panelId: string) => void;
    onSidebarViewRegister: (pluginId: string, view: SidebarViewRegistration) => void;
    onSidebarViewUnregister: (pluginId: string, viewId: string) => void;
    onSidebarSectionRegister: (pluginId: string, section: SidebarSectionRegistration) => void;
    onSidebarSectionUnregister: (pluginId: string, sectionId: string) => void;
    onSettingsPanelRegister: (pluginId: string, panel: SettingsPanelRegistration) => void;
    onSettingsPanelUnregister: (pluginId: string, panelId: string) => void;
    onContextMenuItemRegister: (pluginId: string, item: ContextMenuItemConfig) => void;
    onContextMenuItemUnregister: (pluginId: string, itemId: string) => void;
    onQuickConnectSectionRegister: (pluginId: string, section: QuickConnectSectionRegistration) => void;
    onQuickConnectSectionUnregister: (pluginId: string, sectionId: string) => void;
    onAddStatusBarItem: (pluginId: string, config: StatusBarItemConfig) => StatusBarItemHandle;
    onAddHeaderAction: (pluginId: string, config: HeaderActionConfig) => HeaderActionHandle;
    getSessions: () => SessionInfo[];
    getActiveSession: () => SessionInfo | null;
    onConnectSsh: (config: { host: string; port: number; username: string; name?: string }) => void;
  }
): SimplyTermPluginAPI {
  const pluginId = manifest.id;
  const permissions = manifest.permissions;

  const api: SimplyTermPluginAPI = {
    // Plugin ID
    pluginId,

    // Lifecycle
    onLoad(callback: () => void) {
      pluginState.onLoadCallback = callback;
    },

    onUnload(callback: () => void) {
      pluginState.onUnloadCallback = callback;
    },

    // Panels
    registerPanel(config: PanelRegistration) {
      if (!hasPermission(permissions, 'ui_panels')) {
        console.warn(`[Plugin ${pluginId}] Missing permission: ui_panels`);
        return;
      }
      pluginState.panels.set(config.id, config);
      callbacks.onPanelRegister(pluginId, config);
    },

    showPanel(panelId: string) {
      callbacks.onPanelShow(panelId);
    },

    hidePanel(panelId: string) {
      callbacks.onPanelHide(panelId);
    },

    // Sidebar views (tabs) - recommended
    registerSidebarView(config: SidebarViewRegistration) {
      if (!hasPermission(permissions, 'ui_sidebar')) {
        console.warn(`[Plugin ${pluginId}] Missing permission: ui_sidebar`);
        return;
      }
      pluginState.sidebarViews.set(config.config.id, config);
      callbacks.onSidebarViewRegister(pluginId, config);
    },

    unregisterSidebarView(viewId: string) {
      pluginState.sidebarViews.delete(viewId);
      callbacks.onSidebarViewUnregister(pluginId, viewId);
    },

    // Sidebar sections (deprecated - use registerSidebarView)
    registerSidebarSection(config: SidebarSectionRegistration) {
      if (!hasPermission(permissions, 'ui_sidebar')) {
        console.warn(`[Plugin ${pluginId}] Missing permission: ui_sidebar`);
        return;
      }
      pluginState.sidebarSections.set(config.config.id, config);
      callbacks.onSidebarSectionRegister(pluginId, config);
    },

    unregisterSidebarSection(sectionId: string) {
      pluginState.sidebarSections.delete(sectionId);
      callbacks.onSidebarSectionUnregister(pluginId, sectionId);
    },

    // Settings panels
    registerSettingsPanel(config: SettingsPanelRegistration) {
      if (!hasPermission(permissions, 'ui_settings')) {
        console.warn(`[Plugin ${pluginId}] Missing permission: ui_settings`);
        return;
      }
      pluginState.settingsPanels.set(config.config.id, config);
      callbacks.onSettingsPanelRegister(pluginId, config);
    },

    unregisterSettingsPanel(panelId: string) {
      pluginState.settingsPanels.delete(panelId);
      callbacks.onSettingsPanelUnregister(pluginId, panelId);
    },

    // Context menu items
    registerContextMenuItem(config: ContextMenuItemConfig) {
      if (!hasPermission(permissions, 'ui_context_menu')) {
        console.warn(`[Plugin ${pluginId}] Missing permission: ui_context_menu`);
        return;
      }
      pluginState.contextMenuItems.set(config.id, config);
      callbacks.onContextMenuItemRegister(pluginId, config);
    },

    unregisterContextMenuItem(itemId: string) {
      pluginState.contextMenuItems.delete(itemId);
      callbacks.onContextMenuItemUnregister(pluginId, itemId);
    },

    // QuickConnect sections
    registerQuickConnectSection(config: QuickConnectSectionRegistration) {
      if (!hasPermission(permissions, 'ui_quick_connect')) {
        console.warn(`[Plugin ${pluginId}] Missing permission: ui_quick_connect`);
        return;
      }
      pluginState.quickConnectSections.set(config.config.id, config);
      callbacks.onQuickConnectSectionRegister(pluginId, config);
    },

    unregisterQuickConnectSection(sectionId: string) {
      pluginState.quickConnectSections.delete(sectionId);
      callbacks.onQuickConnectSectionUnregister(pluginId, sectionId);
    },

    // Commands
    registerCommand(config: CommandRegistration) {
      if (!hasPermission(permissions, 'ui_commands')) {
        console.warn(`[Plugin ${pluginId}] Missing permission: ui_commands`);
        return;
      }
      pluginState.commands.set(config.id, config);
      callbacks.onCommandRegister(pluginId, config);
    },

    executeCommand(commandId: string) {
      const cmd = pluginState.commands.get(commandId);
      if (cmd) {
        cmd.handler();
      }
    },

    // Terminal hooks
    onTerminalOutput(sessionId: string, callback: (data: string) => void): Unsubscribe {
      if (!hasPermission(permissions, 'terminal_read')) {
        console.warn(`[Plugin ${pluginId}] Missing permission: terminal_read`);
        return () => {};
      }

      let unlisten: (() => void) | null = null;

      listen<string>(`pty-output-${sessionId}`, (event) => {
        callback(event.payload);
      }).then((fn) => {
        unlisten = fn;
      });

      const unsubscribe = () => {
        if (unlisten) unlisten();
      };

      pluginState.subscriptions.push(unsubscribe);
      return unsubscribe;
    },

    onTerminalInput(sessionId: string, callback: (data: string) => void): Unsubscribe {
      if (!hasPermission(permissions, 'terminal_read')) {
        console.warn(`[Plugin ${pluginId}] Missing permission: terminal_read`);
        return () => {};
      }

      let unlisten: (() => void) | null = null;

      listen<string>(`pty-input-${sessionId}`, (event) => {
        callback(event.payload);
      }).then((fn) => {
        unlisten = fn;
      });

      const unsubscribe = () => {
        if (unlisten) unlisten();
      };

      pluginState.subscriptions.push(unsubscribe);
      return unsubscribe;
    },

    onAnyTerminalInput(callback: (sessionId: string, data: string) => void): Unsubscribe {
      if (!hasPermission(permissions, 'terminal_read')) {
        console.warn(`[Plugin ${pluginId}] Missing permission: terminal_read`);
        return () => {};
      }

      let unlisten: (() => void) | null = null;

      listen<{ sessionId: string; data: string }>('terminal-input', (event) => {
        callback(event.payload.sessionId, event.payload.data);
      }).then((fn) => {
        unlisten = fn;
      });

      const unsubscribe = () => {
        if (unlisten) unlisten();
      };

      pluginState.subscriptions.push(unsubscribe);
      return unsubscribe;
    },

    async writeToTerminal(sessionId: string, data: string): Promise<void> {
      if (!hasPermission(permissions, 'terminal_write')) {
        throw new Error('Missing permission: terminal_write');
      }

      await invoke('plugin_api_write_to_terminal', { pluginId, sessionId, data });
    },

    // Session events
    onSessionConnect(callback: (session: SessionInfo) => void): Unsubscribe {
      if (!hasPermission(permissions, 'events_subscribe')) {
        console.warn(`[Plugin ${pluginId}] Missing permission: events_subscribe`);
        return () => {};
      }

      pluginState.onSessionConnectCallback = callback;

      const unsubscribe = () => {
        pluginState.onSessionConnectCallback = undefined;
      };

      pluginState.subscriptions.push(unsubscribe);
      return unsubscribe;
    },

    onSessionDisconnect(callback: (sessionId: string) => void): Unsubscribe {
      if (!hasPermission(permissions, 'events_subscribe')) {
        console.warn(`[Plugin ${pluginId}] Missing permission: events_subscribe`);
        return () => {};
      }

      pluginState.onSessionDisconnectCallback = callback;

      const unsubscribe = () => {
        pluginState.onSessionDisconnectCallback = undefined;
      };

      pluginState.subscriptions.push(unsubscribe);
      return unsubscribe;
    },

    onSessionCreated(callback: (sessionId: string) => void): Unsubscribe {
      if (!hasPermission(permissions, 'events_subscribe')) {
        console.warn(`[Plugin ${pluginId}] Missing permission: events_subscribe`);
        return () => {};
      }

      pluginState.onSessionCreatedCallback = callback;

      const unsubscribe = () => {
        pluginState.onSessionCreatedCallback = undefined;
      };

      pluginState.subscriptions.push(unsubscribe);
      return unsubscribe;
    },

    onSessionDeleted(callback: (sessionId: string) => void): Unsubscribe {
      if (!hasPermission(permissions, 'events_subscribe')) {
        console.warn(`[Plugin ${pluginId}] Missing permission: events_subscribe`);
        return () => {};
      }

      pluginState.onSessionDeletedCallback = callback;

      const unsubscribe = () => {
        pluginState.onSessionDeletedCallback = undefined;
      };

      pluginState.subscriptions.push(unsubscribe);
      return unsubscribe;
    },

    getActiveSession(): SessionInfo | null {
      return callbacks.getActiveSession();
    },

    getAllSessions(): SessionInfo[] {
      return callbacks.getSessions();
    },

    // Backend API bridge
    async invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
      // Add pluginId to all calls for permission checking on backend
      return invoke<T>(command, { pluginId, ...args });
    },

    // Storage (sandboxed)
    storage: {
      async read(path: string): Promise<string> {
        if (!hasPermission(permissions, 'fs_read')) {
          throw new Error('Missing permission: fs_read');
        }
        return invoke<string>('plugin_storage_read', { pluginId, path });
      },

      async write(path: string, content: string): Promise<void> {
        if (!hasPermission(permissions, 'fs_write')) {
          throw new Error('Missing permission: fs_write');
        }
        await invoke('plugin_storage_write', { pluginId, path, content });
      },

      async delete(path: string): Promise<void> {
        if (!hasPermission(permissions, 'fs_write')) {
          throw new Error('Missing permission: fs_write');
        }
        await invoke('plugin_storage_delete', { pluginId, path });
      },

      async list(path: string): Promise<FileEntry[]> {
        if (!hasPermission(permissions, 'fs_read')) {
          throw new Error('Missing permission: fs_read');
        }
        return invoke<FileEntry[]>('plugin_storage_list', { pluginId, path });
      },
    },

    // Session metadata (sandboxed per plugin)
    sessionMetadata: {
      async get(sessionId: string): Promise<SessionMetadata | null> {
        if (!hasPermission(permissions, 'sessions_metadata_read')) {
          throw new Error('Missing permission: sessions_metadata_read');
        }
        return invoke<SessionMetadata | null>('plugin_api_get_session_metadata', { pluginId, sessionId });
      },

      async getAll(): Promise<Map<string, SessionMetadata>> {
        if (!hasPermission(permissions, 'sessions_metadata_read')) {
          throw new Error('Missing permission: sessions_metadata_read');
        }
        const data = await invoke<Record<string, SessionMetadata>>('plugin_api_get_all_session_metadata', { pluginId });
        return new Map(Object.entries(data));
      },

      async set(sessionId: string, data: SessionMetadata): Promise<void> {
        if (!hasPermission(permissions, 'sessions_metadata_write')) {
          throw new Error('Missing permission: sessions_metadata_write');
        }
        await invoke('plugin_api_set_session_metadata', { pluginId, sessionId, metadata: data });
      },

      async update(sessionId: string, updates: SessionMetadata): Promise<SessionMetadata> {
        if (!hasPermission(permissions, 'sessions_metadata_write')) {
          throw new Error('Missing permission: sessions_metadata_write');
        }
        return invoke<SessionMetadata>('plugin_api_update_session_metadata', { pluginId, sessionId, updates });
      },

      async delete(sessionId: string): Promise<boolean> {
        if (!hasPermission(permissions, 'sessions_metadata_write')) {
          throw new Error('Missing permission: sessions_metadata_write');
        }
        return invoke<boolean>('plugin_api_delete_session_metadata', { pluginId, sessionId });
      },
    },

    // Status bar
    addStatusBarItem(config: StatusBarItemConfig): StatusBarItemHandle {
      if (!hasPermission(permissions, 'ui_notifications')) {
        console.warn(`[Plugin ${pluginId}] Missing permission: ui_notifications`);
        return {
          setText: () => {},
          setIcon: () => {},
          setTooltip: () => {},
          setVisible: () => {},
          dispose: () => {},
        };
      }
      return callbacks.onAddStatusBarItem(pluginId, config);
    },

    // Header actions
    addHeaderAction(config: HeaderActionConfig): HeaderActionHandle {
      if (!hasPermission(permissions, 'ui_notifications')) {
        console.warn(`[Plugin ${pluginId}] Missing permission: ui_notifications`);
        return {
          setIcon: () => {},
          setTooltip: () => {},
          setVisible: () => {},
          dispose: () => {},
        };
      }
      return callbacks.onAddHeaderAction(pluginId, config);
    },

    // SSH connection
    connectSsh(config: { host: string; port: number; username: string; name?: string }) {
      if (!hasPermission(permissions, 'sessions_connect')) {
        console.warn(`[Plugin ${pluginId}] Missing permission: sessions_connect`);
        return;
      }
      callbacks.onConnectSsh(config);
    },

    // UI utilities
    showNotification(message: string, type: NotificationType = 'info') {
      if (!hasPermission(permissions, 'ui_notifications')) {
        console.warn(`[Plugin ${pluginId}] Missing permission: ui_notifications`);
        return;
      }
      callbacks.onShowNotification(message, type);
    },

    showModal(config: ModalConfig): Promise<unknown> {
      if (!hasPermission(permissions, 'ui_modals')) {
        console.warn(`[Plugin ${pluginId}] Missing permission: ui_modals`);
        return Promise.resolve(null);
      }
      return callbacks.onShowModal(config);
    },

    showPrompt(config: PromptConfig): Promise<string | null> {
      if (!hasPermission(permissions, 'ui_modals')) {
        console.warn(`[Plugin ${pluginId}] Missing permission: ui_modals`);
        return Promise.resolve(null);
      }
      return callbacks.onShowPrompt(config);
    },
  };

  return api;
}
