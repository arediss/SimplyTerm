/**
 * Plugin Manager - Frontend orchestration of plugins
 *
 * Handles loading, lifecycle, and communication with plugins.
 */

import { invoke } from '@tauri-apps/api/core';
import { createPluginAPI } from './PluginAPI';
import type {
  PluginManifest,
  LoadedPlugin,
  SessionInfo,
  ModalConfig,
  NotificationType,
  PanelRegistration,
  CommandRegistration,
  PluginEvent,
  PluginEventHandler,
} from './types';

export class PluginManager {
  private plugins: Map<string, LoadedPlugin> = new Map();
  private eventHandlers: Set<PluginEventHandler> = new Set();

  // External callbacks (set by App.tsx)
  public onShowNotification: (message: string, type: NotificationType) => void = () => {};
  public onShowModal: (config: ModalConfig) => Promise<unknown> = async () => null;
  public getSessions: () => SessionInfo[] = () => [];
  public getActiveSession: () => SessionInfo | null = () => null;

  // Panel and command registrations (observable by UI)
  public registeredPanels: Map<string, { pluginId: string; panel: PanelRegistration; position: string }> = new Map();
  public registeredCommands: Map<string, { pluginId: string; command: CommandRegistration }> = new Map();

  /**
   * Subscribe to plugin events
   */
  subscribe(handler: PluginEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  private emit(event: PluginEvent) {
    this.eventHandlers.forEach(handler => handler(event));
  }

  /**
   * List all installed plugins from backend
   */
  async listPlugins(): Promise<PluginManifest[]> {
    return invoke<PluginManifest[]>('list_plugins');
  }

  /**
   * Get a specific plugin manifest
   */
  async getPluginManifest(id: string): Promise<PluginManifest> {
    return invoke<PluginManifest>('get_plugin_manifest', { id });
  }

  /**
   * Enable a plugin (backend + frontend load)
   */
  async enablePlugin(id: string): Promise<void> {
    // Enable in backend
    await invoke('enable_plugin', { id });

    // Load in frontend
    await this.loadPlugin(id);
  }

  /**
   * Disable a plugin (backend + frontend unload)
   */
  async disablePlugin(id: string): Promise<void> {
    // Unload from frontend
    this.unloadPlugin(id);

    // Disable in backend
    await invoke('disable_plugin', { id });
  }

  /**
   * Load a plugin's frontend code
   */
  async loadPlugin(id: string): Promise<void> {
    try {
      // Get manifest
      const manifest = await this.getPluginManifest(id);

      if (manifest.status !== 'enabled') {
        throw new Error(`Plugin ${id} is not enabled`);
      }

      // Get plugin main file
      const mainFile = await invoke<string>('get_plugin_file', {
        pluginId: id,
        filePath: 'index.js',
      });

      // Create plugin state
      const pluginState: LoadedPlugin = {
        manifest,
        api: null as unknown as LoadedPlugin['api'], // Will be set below
        panels: new Map(),
        commands: new Map(),
        subscriptions: [],
      };

      // Create API for this plugin
      const api = createPluginAPI(manifest, pluginState, {
        onShowNotification: this.onShowNotification.bind(this),
        onShowModal: this.onShowModal.bind(this),
        onPanelRegister: this.handlePanelRegister.bind(this),
        onCommandRegister: this.handleCommandRegister.bind(this),
        onPanelShow: this.handlePanelShow.bind(this),
        onPanelHide: this.handlePanelHide.bind(this),
        getSessions: this.getSessions.bind(this),
        getActiveSession: this.getActiveSession.bind(this),
      });

      pluginState.api = api;

      // Store loaded plugin BEFORE executing code (so registerPanel can find it)
      this.plugins.set(id, pluginState);

      // Execute plugin code
      await this.executePluginCode(mainFile, api, id);

      // Call onLoad callback if registered
      if (pluginState.onLoadCallback) {
        pluginState.onLoadCallback();
      }

      this.emit({ type: 'plugin:loaded', pluginId: id });
    } catch (error) {
      console.error(`Failed to load plugin ${id}:`, error);
      this.emit({
        type: 'plugin:error',
        pluginId: id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Execute plugin code in a sandboxed context
   *
   * SECURITY WARNING: This uses `new Function()` which is similar to eval().
   * Plugins have full JavaScript execution capabilities within the renderer process.
   *
   * Mitigations in place:
   * 1. Plugins must be manually installed by the user in ~/.simplyterm/plugins/
   * 2. Plugin HTML output is sanitized via DOMPurify (see sanitize.ts)
   * 3. Plugins don't have direct filesystem access (must use Tauri API)
   * 4. CSP headers restrict external script loading
   *
   * Future improvements could include:
   * - Running plugins in isolated Web Workers (limits DOM access)
   * - Using sandboxed iframes with postMessage communication
   * - Implementing a capability-based permission system
   */
  private async executePluginCode(
    code: string,
    api: LoadedPlugin['api'],
    pluginId: string
  ): Promise<void> {
    try {
      // Create a function from the module code
      // The plugin exports a default function that receives the API
      const wrappedCode = `
        return (function(api) {
          ${code}
          if (typeof module !== 'undefined' && module.exports && typeof module.exports.default === 'function') {
            return module.exports.default(api);
          }
          if (typeof exports !== 'undefined' && typeof exports.default === 'function') {
            return exports.default(api);
          }
        })
      `;

      // Create a minimal module/exports context for CommonJS compatibility
      const moduleContext: { exports: { default: unknown } } = { exports: { default: null } };

      const fn = new Function('module', 'exports', 'api', wrappedCode);
      const initFn = fn(moduleContext, moduleContext.exports, api);

      if (typeof initFn === 'function') {
        await initFn(api);
      } else if (typeof moduleContext.exports.default === 'function') {
        await (moduleContext.exports.default as (api: LoadedPlugin['api']) => Promise<void>)(api);
      }
    } catch (error) {
      console.error(`Error executing plugin ${pluginId}:`, error);
      throw error;
    }
  }

  /**
   * Unload a plugin
   */
  unloadPlugin(id: string): void {
    const plugin = this.plugins.get(id);
    if (!plugin) return;

    // Call onUnload callback
    if (plugin.onUnloadCallback) {
      try {
        plugin.onUnloadCallback();
      } catch (e) {
        console.error(`Error in plugin ${id} onUnload:`, e);
      }
    }

    // Cleanup subscriptions
    plugin.subscriptions.forEach(unsub => {
      try {
        unsub();
      } catch (e) {
        console.error(`Error cleaning up subscription in plugin ${id}:`, e);
      }
    });

    // Remove registered panels and commands
    plugin.panels.forEach((_, panelId) => {
      this.registeredPanels.delete(panelId);
    });

    plugin.commands.forEach((_, commandId) => {
      this.registeredCommands.delete(commandId);
    });

    // Remove from loaded plugins
    this.plugins.delete(id);

    this.emit({ type: 'plugin:unloaded', pluginId: id });
  }

  /**
   * Refresh plugins list from backend
   */
  async refresh(): Promise<PluginManifest[]> {
    return invoke<PluginManifest[]>('refresh_plugins');
  }

  /**
   * Load all enabled plugins
   */
  async loadEnabledPlugins(): Promise<void> {
    const plugins = await this.listPlugins();
    const enabledPlugins = plugins.filter(p => p.status === 'enabled');

    for (const plugin of enabledPlugins) {
      try {
        await this.loadPlugin(plugin.id);
      } catch (error) {
        console.error(`Failed to load plugin ${plugin.id}:`, error);
      }
    }
  }

  /**
   * Get a loaded plugin
   */
  getLoadedPlugin(id: string): LoadedPlugin | undefined {
    return this.plugins.get(id);
  }

  /**
   * Get all loaded plugins
   */
  getLoadedPlugins(): LoadedPlugin[] {
    return Array.from(this.plugins.values());
  }

  // Panel registration handler
  private handlePanelRegister(pluginId: string, panel: PanelRegistration): void {
    // Get position from manifest
    const loadedPlugin = this.plugins.get(pluginId);
    const manifestPanel = loadedPlugin?.manifest.panels.find(p => p.id === panel.id);
    const position = manifestPanel?.position || 'right';

    this.registeredPanels.set(panel.id, { pluginId, panel, position });
    this.emit({ type: 'panel:register', pluginId, panelId: panel.id });
  }

  // Panel show handler
  private handlePanelShow(panelId: string): void {
    this.emit({ type: 'panel:show', panelId });
  }

  // Panel hide handler
  private handlePanelHide(panelId: string): void {
    this.emit({ type: 'panel:hide', panelId });
  }

  // Command registration handler
  private handleCommandRegister(pluginId: string, command: CommandRegistration): void {
    this.registeredCommands.set(command.id, { pluginId, command });
    this.emit({ type: 'command:register', pluginId, commandId: command.id });
  }

  /**
   * Execute a registered command
   */
  executeCommand(commandId: string): void {
    const entry = this.registeredCommands.get(commandId);
    if (entry) {
      this.emit({ type: 'command:execute', commandId });
      entry.command.handler();
    }
  }

  /**
   * Notify all plugins that a session has connected
   */
  notifySessionConnect(session: SessionInfo): void {
    for (const plugin of this.plugins.values()) {
      if (plugin.onSessionConnectCallback) {
        try {
          plugin.onSessionConnectCallback(session);
        } catch (error) {
          console.error(`[Plugin ${plugin.manifest.id}] Error in onSessionConnect:`, error);
        }
      }
    }
  }

  /**
   * Notify all plugins that a session has disconnected
   */
  notifySessionDisconnect(sessionId: string): void {
    for (const plugin of this.plugins.values()) {
      if (plugin.onSessionDisconnectCallback) {
        try {
          plugin.onSessionDisconnectCallback(sessionId);
        } catch (error) {
          console.error(`[Plugin ${plugin.manifest.id}] Error in onSessionDisconnect:`, error);
        }
      }
    }
  }
}

// Singleton instance
export const pluginManager = new PluginManager();
