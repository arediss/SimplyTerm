/**
 * Plugin API Implementation
 *
 * Provides the SimplyTermPluginAPI to plugins in a sandboxed manner.
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
} from './types';

/**
 * Create a Plugin API instance for a specific plugin
 */
export function createPluginAPI(
  manifest: PluginManifest,
  pluginState: LoadedPlugin,
  callbacks: {
    onShowNotification: (message: string, type: NotificationType) => void;
    onShowModal: (config: ModalConfig) => Promise<unknown>;
    onPanelRegister: (pluginId: string, panel: PanelRegistration) => void;
    onCommandRegister: (pluginId: string, command: CommandRegistration) => void;
    onPanelShow: (panelId: string) => void;
    onPanelHide: (panelId: string) => void;
    getSessions: () => SessionInfo[];
    getActiveSession: () => SessionInfo | null;
  }
): SimplyTermPluginAPI {
  const pluginId = manifest.id;
  const hasPermission = (perm: string) => manifest.permissions.includes(perm);

  const api: SimplyTermPluginAPI = {
    // Lifecycle
    onLoad(callback: () => void) {
      pluginState.onLoadCallback = callback;
    },

    onUnload(callback: () => void) {
      pluginState.onUnloadCallback = callback;
    },

    // Panels
    registerPanel(config: PanelRegistration) {
      if (!hasPermission('panel:register')) {
        console.warn(`[Plugin ${pluginId}] Missing permission: panel:register`);
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

    // Commands
    registerCommand(config: CommandRegistration) {
      if (!hasPermission('command:register')) {
        console.warn(`[Plugin ${pluginId}] Missing permission: command:register`);
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
      if (!hasPermission('terminal:read')) {
        console.warn(`[Plugin ${pluginId}] Missing permission: terminal:read`);
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
      if (!hasPermission('terminal:read')) {
        console.warn(`[Plugin ${pluginId}] Missing permission: terminal:read`);
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

    async writeToTerminal(sessionId: string, data: string): Promise<void> {
      if (!hasPermission('terminal:write')) {
        throw new Error('Missing permission: terminal:write');
      }

      await invoke('write_to_pty', { sessionId, data });
    },

    async execCommand(sessionId: string, command: string): Promise<string> {
      if (!hasPermission('backend:exec')) {
        throw new Error('Missing permission: backend:exec');
      }

      return invoke<string>('ssh_exec_command', { sessionId, command });
    },

    // Session events - callbacks are stored on pluginState and called by PluginManager
    onSessionConnect(callback: (session: SessionInfo) => void): Unsubscribe {
      if (!hasPermission('session:info')) {
        console.warn(`[Plugin ${pluginId}] Missing permission: session:info`);
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
      if (!hasPermission('session:info')) {
        console.warn(`[Plugin ${pluginId}] Missing permission: session:info`);
        return () => {};
      }

      pluginState.onSessionDisconnectCallback = callback;

      const unsubscribe = () => {
        pluginState.onSessionDisconnectCallback = undefined;
      };

      pluginState.subscriptions.push(unsubscribe);
      return unsubscribe;
    },

    getActiveSession(): SessionInfo | null {
      if (!hasPermission('session:info')) {
        console.warn(`[Plugin ${pluginId}] Missing permission: session:info`);
        return null;
      }
      return callbacks.getActiveSession();
    },

    getAllSessions(): SessionInfo[] {
      if (!hasPermission('session:info')) {
        console.warn(`[Plugin ${pluginId}] Missing permission: session:info`);
        return [];
      }
      return callbacks.getSessions();
    },

    // Backend bridge
    async invokeBackend<T>(command: string, args?: Record<string, unknown>): Promise<T> {
      if (!hasPermission('backend:exec')) {
        throw new Error('Missing permission: backend:exec');
      }

      return invoke<T>('plugin_invoke', {
        pluginId,
        command,
        args: args || {},
      });
    },

    // Storage
    storage: {
      async get<T>(key: string): Promise<T | null> {
        if (!hasPermission('storage:read')) {
          throw new Error('Missing permission: storage:read');
        }
        return invoke<T | null>('plugin_storage_get', { pluginId, key });
      },

      async set<T>(key: string, value: T): Promise<void> {
        if (!hasPermission('storage:write')) {
          throw new Error('Missing permission: storage:write');
        }
        await invoke('plugin_storage_set', { pluginId, key, value });
      },

      async delete(key: string): Promise<void> {
        if (!hasPermission('storage:write')) {
          throw new Error('Missing permission: storage:write');
        }
        await invoke('plugin_storage_delete', { pluginId, key });
      },
    },

    // UI utilities
    showNotification(message: string, type: NotificationType = 'info') {
      callbacks.onShowNotification(message, type);
    },

    showModal(config: ModalConfig): Promise<unknown> {
      return callbacks.onShowModal(config);
    },
  };

  return api;
}
