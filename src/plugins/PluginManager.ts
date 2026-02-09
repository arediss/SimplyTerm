/**
 * Plugin Manager - Frontend orchestration of plugins
 *
 * Handles loading, lifecycle, and communication with plugins.
 * Supports both legacy (module.exports.default) and new (window.SimplyTermPlugins) formats.
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
  PluginModule,
  SidebarViewRegistration,
  SidebarSectionRegistration,
  SettingsPanelRegistration,
  ContextMenuItemConfig,
  PromptConfig,
  StatusBarItemConfig,
  StatusBarItemHandle,
  HeaderActionConfig,
  HeaderActionHandle,
  QuickConnectSectionRegistration,
} from './types';
import type { StatusBarItem } from '../components/StatusBar';

/** Header action item exposed to the UI */
export interface HeaderActionItem {
  id: string;
  pluginId: string;
  icon: string;
  tooltip?: string;
  position: "left" | "right";
  order: number;
  onClick: (position: { x: number; y: number; right: number }) => void;
}

// Declare the global window property for plugins
declare global {
  interface Window {
    SimplyTermPlugins?: Record<string, PluginModule>;
  }
}

export class PluginManager {
  private plugins: Map<string, LoadedPlugin> = new Map();
  private eventHandlers: Set<PluginEventHandler> = new Set();

  // External callbacks (set by App.tsx)
  public onShowNotification: (message: string, type: NotificationType) => void = () => {};
  public onShowModal: (config: ModalConfig) => Promise<unknown> = async () => null;
  public onShowPrompt: (config: PromptConfig) => Promise<string | null> = async () => null;
  public getSessions: () => SessionInfo[] = () => [];
  public getActiveSession: () => SessionInfo | null = () => null;
  public onConnectSsh: (config: { host: string; port: number; username: string; name?: string }) => void = () => {};

  // Panel and command registrations (observable by UI)
  public registeredPanels: Map<string, { pluginId: string; panel: PanelRegistration; position: string }> = new Map();
  public registeredCommands: Map<string, { pluginId: string; command: CommandRegistration }> = new Map();
  public registeredSidebarViews: Map<string, { pluginId: string; view: SidebarViewRegistration }> = new Map();
  public registeredSidebarSections: Map<string, { pluginId: string; section: SidebarSectionRegistration }> = new Map(); // deprecated
  public registeredSettingsPanels: Map<string, { pluginId: string; panel: SettingsPanelRegistration }> = new Map();
  public registeredContextMenuItems: Map<string, { pluginId: string; item: ContextMenuItemConfig }> = new Map();
  public registeredQuickConnectSections: Map<string, { pluginId: string; section: QuickConnectSectionRegistration }> = new Map();

  // Status bar items
  public registeredStatusBarItems: Map<string, { pluginId: string; config: StatusBarItemConfig; visible: boolean }> = new Map();
  public onStatusBarItemsChanged: (items: StatusBarItem[]) => void = () => {};

  // Header action items
  public registeredHeaderActions: Map<string, { pluginId: string; config: HeaderActionConfig; visible: boolean }> = new Map();
  public onHeaderActionsChanged: (items: HeaderActionItem[]) => void = () => {};

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
    // Grant all permissions (for now - in the future we might want to show a permissions dialog)
    await invoke('grant_plugin_permissions', { id });

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
        filePath: manifest.main || 'index.js',
      });

      // Create plugin state
      const pluginState: LoadedPlugin = {
        manifest,
        api: null as unknown as LoadedPlugin['api'], // Will be set below
        panels: new Map(),
        commands: new Map(),
        sidebarViews: new Map(),
        sidebarSections: new Map(),
        settingsPanels: new Map(),
        contextMenuItems: new Map(),
        quickConnectSections: new Map(),
        subscriptions: [],
      };

      // Create API for this plugin
      const api = createPluginAPI(manifest, pluginState, {
        // Arrow functions for property-based callbacks (late-binding: reads current value at call time)
        onShowNotification: (msg, type) => this.onShowNotification(msg, type),
        onShowModal: (config) => this.onShowModal(config),
        onShowPrompt: (config) => this.onShowPrompt(config),
        // .bind(this) for class methods (stable references, just needs correct `this`)
        onPanelRegister: this.handlePanelRegister.bind(this),
        onCommandRegister: this.handleCommandRegister.bind(this),
        onPanelShow: this.handlePanelShow.bind(this),
        onPanelHide: this.handlePanelHide.bind(this),
        onSidebarViewRegister: this.handleSidebarViewRegister.bind(this),
        onSidebarViewUnregister: this.handleSidebarViewUnregister.bind(this),
        onSidebarSectionRegister: this.handleSidebarSectionRegister.bind(this),
        onSidebarSectionUnregister: this.handleSidebarSectionUnregister.bind(this),
        onSettingsPanelRegister: this.handleSettingsPanelRegister.bind(this),
        onSettingsPanelUnregister: this.handleSettingsPanelUnregister.bind(this),
        onContextMenuItemRegister: this.handleContextMenuItemRegister.bind(this),
        onContextMenuItemUnregister: this.handleContextMenuItemUnregister.bind(this),
        onQuickConnectSectionRegister: this.handleQuickConnectSectionRegister.bind(this),
        onQuickConnectSectionUnregister: this.handleQuickConnectSectionUnregister.bind(this),
        onAddStatusBarItem: this.handleAddStatusBarItem.bind(this),
        onAddHeaderAction: this.handleAddHeaderAction.bind(this),
        // Arrow functions for property-based callbacks
        getSessions: () => this.getSessions(),
        getActiveSession: () => this.getActiveSession(),
        onConnectSsh: (config) => this.onConnectSsh(config),
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
   * Execute plugin code
   *
   * Supports two formats:
   * 1. New format (v1): window.SimplyTermPlugins[id] = { init, cleanup }
   * 2. Legacy format: module.exports.default = (api) => {}
   *
   * SECURITY NOTE: Plugins have full JavaScript execution within the renderer.
   * Mitigations:
   * - Plugins must be manually installed by the user
   * - HTML output is sanitized via DOMPurify
   * - No direct filesystem access (must use Tauri API)
   * - CSP headers restrict external script loading
   */
  private async executePluginCode(
    code: string,
    api: LoadedPlugin['api'],
    pluginId: string
  ): Promise<void> {
    try {
      // Initialize global plugins object
      window.SimplyTermPlugins = window.SimplyTermPlugins || {};

      // Execute the plugin code in global context
      // This allows plugins to register themselves on window.SimplyTermPlugins
      const wrappedCode = `
        (function() {
          // Provide CommonJS-like environment for legacy plugins
          var module = { exports: { default: null } };
          var exports = module.exports;

          ${code}

          // If legacy format was used, convert to new format
          if (typeof module.exports.default === 'function') {
            window.SimplyTermPlugins = window.SimplyTermPlugins || {};
            window.SimplyTermPlugins['${pluginId}'] = {
              init: function(api) {
                return module.exports.default(api);
              }
            };
          }
        })();
      `;

      // Execute the code
      // eslint-disable-next-line no-new-func
      new Function(wrappedCode)();

      // Check if plugin registered itself
      const pluginModule = window.SimplyTermPlugins?.[pluginId];
      if (pluginModule && typeof pluginModule.init === 'function') {
        // Pass the API object to the init function
        await pluginModule.init(api);
      } else {
        console.warn(`[Plugin ${pluginId}] No init function found`);
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

    // Call cleanup if available
    const pluginModule = window.SimplyTermPlugins?.[id];
    if (pluginModule?.cleanup) {
      try {
        pluginModule.cleanup();
      } catch (e) {
        console.error(`Error in plugin ${id} cleanup:`, e);
      }
    }

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

    // Remove registered sidebar views (emit events so UI reacts)
    plugin.sidebarViews.forEach((_, viewId) => {
      this.registeredSidebarViews.delete(viewId);
      this.emit({ type: 'sidebar-view:unregister', pluginId: id, viewId });
    });

    // Remove registered sidebar sections (deprecated)
    plugin.sidebarSections.forEach((_, sectionId) => {
      this.registeredSidebarSections.delete(sectionId);
      this.emit({ type: 'sidebar:unregister', pluginId: id, sectionId });
    });

    // Remove registered settings panels (emit events so UI reacts)
    plugin.settingsPanels.forEach((_, panelId) => {
      this.registeredSettingsPanels.delete(panelId);
      this.emit({ type: 'settings:unregister', pluginId: id, panelId });
    });

    // Remove registered context menu items (emit events so UI reacts)
    plugin.contextMenuItems.forEach((_, itemId) => {
      this.registeredContextMenuItems.delete(itemId);
      this.emit({ type: 'context-menu:unregister', pluginId: id, itemId });
    });

    // Remove registered quick-connect sections
    plugin.quickConnectSections.forEach((_, sectionId) => {
      this.registeredQuickConnectSections.delete(sectionId);
      this.emit({ type: 'quick-connect:unregister', pluginId: id, sectionId });
    });

    // Remove registered status bar items for this plugin
    let statusBarChanged = false;
    for (const [itemId, entry] of this.registeredStatusBarItems) {
      if (entry.pluginId === id) {
        this.registeredStatusBarItems.delete(itemId);
        statusBarChanged = true;
      }
    }
    if (statusBarChanged) {
      this.notifyStatusBarChanged();
    }

    // Remove registered header actions for this plugin
    let headerActionsChanged = false;
    for (const [itemId, entry] of this.registeredHeaderActions) {
      if (entry.pluginId === id) {
        this.registeredHeaderActions.delete(itemId);
        headerActionsChanged = true;
      }
    }
    if (headerActionsChanged) {
      this.notifyHeaderActionsChanged();
    }

    // Remove from loaded plugins
    this.plugins.delete(id);

    // Remove from global registry
    if (window.SimplyTermPlugins) {
      delete window.SimplyTermPlugins[id];
    }

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
        // Ensure permissions are granted before loading
        await invoke('grant_plugin_permissions', { id: plugin.id });
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
    // Default position if not specified in manifest
    const position = 'right';

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

  // Sidebar view (tab) registration handlers
  private handleSidebarViewRegister(pluginId: string, view: SidebarViewRegistration): void {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      plugin.sidebarViews.set(view.config.id, view);
      this.registeredSidebarViews.set(view.config.id, { pluginId, view });
      this.emit({ type: 'sidebar-view:register', pluginId, viewId: view.config.id });
    }
  }

  private handleSidebarViewUnregister(pluginId: string, viewId: string): void {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      plugin.sidebarViews.delete(viewId);
      this.registeredSidebarViews.delete(viewId);
      this.emit({ type: 'sidebar-view:unregister', pluginId, viewId });
    }
  }

  // Sidebar section registration handlers (deprecated)
  private handleSidebarSectionRegister(pluginId: string, section: SidebarSectionRegistration): void {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      plugin.sidebarSections.set(section.config.id, section);
      this.registeredSidebarSections.set(section.config.id, { pluginId, section });
      this.emit({ type: 'sidebar:register', pluginId, sectionId: section.config.id });
    }
  }

  private handleSidebarSectionUnregister(pluginId: string, sectionId: string): void {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      plugin.sidebarSections.delete(sectionId);
      this.registeredSidebarSections.delete(sectionId);
      this.emit({ type: 'sidebar:unregister', pluginId, sectionId });
    }
  }

  // Settings panel registration handlers
  private handleSettingsPanelRegister(pluginId: string, panel: SettingsPanelRegistration): void {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      plugin.settingsPanels.set(panel.config.id, panel);
      this.registeredSettingsPanels.set(panel.config.id, { pluginId, panel });
      this.emit({ type: 'settings:register', pluginId, panelId: panel.config.id });
    }
  }

  private handleSettingsPanelUnregister(pluginId: string, panelId: string): void {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      plugin.settingsPanels.delete(panelId);
      this.registeredSettingsPanels.delete(panelId);
      this.emit({ type: 'settings:unregister', pluginId, panelId });
    }
  }

  // Context menu item registration handlers
  private handleContextMenuItemRegister(pluginId: string, item: ContextMenuItemConfig): void {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      plugin.contextMenuItems.set(item.id, item);
      this.registeredContextMenuItems.set(item.id, { pluginId, item });
      this.emit({ type: 'context-menu:register', pluginId, itemId: item.id });
    }
  }

  private handleContextMenuItemUnregister(pluginId: string, itemId: string): void {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      plugin.contextMenuItems.delete(itemId);
      this.registeredContextMenuItems.delete(itemId);
      this.emit({ type: 'context-menu:unregister', pluginId, itemId });
    }
  }

  // QuickConnect section registration handlers
  private handleQuickConnectSectionRegister(pluginId: string, section: QuickConnectSectionRegistration): void {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      plugin.quickConnectSections.set(section.config.id, section);
      this.registeredQuickConnectSections.set(section.config.id, { pluginId, section });
      this.emit({ type: 'quick-connect:register', pluginId, sectionId: section.config.id });
    }
  }

  private handleQuickConnectSectionUnregister(pluginId: string, sectionId: string): void {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      plugin.quickConnectSections.delete(sectionId);
      this.registeredQuickConnectSections.delete(sectionId);
      this.emit({ type: 'quick-connect:unregister', pluginId, sectionId });
    }
  }

  // Status bar item handler
  handleAddStatusBarItem(pluginId: string, config: StatusBarItemConfig): StatusBarItemHandle {
    const itemId = `${pluginId}:${config.id}`;
    this.registeredStatusBarItems.set(itemId, { pluginId, config, visible: true });
    this.notifyStatusBarChanged();
    this.emit({ type: 'statusbar:changed' });

    return {
      setText: (text: string) => {
        const entry = this.registeredStatusBarItems.get(itemId);
        if (entry) {
          entry.config = { ...entry.config, text };
          this.notifyStatusBarChanged();
        }
      },
      setIcon: (icon: string) => {
        const entry = this.registeredStatusBarItems.get(itemId);
        if (entry) {
          entry.config = { ...entry.config, icon };
          this.notifyStatusBarChanged();
        }
      },
      setTooltip: (tooltip: string) => {
        const entry = this.registeredStatusBarItems.get(itemId);
        if (entry) {
          entry.config = { ...entry.config, tooltip };
          this.notifyStatusBarChanged();
        }
      },
      setVisible: (visible: boolean) => {
        const entry = this.registeredStatusBarItems.get(itemId);
        if (entry) {
          entry.visible = visible;
          this.notifyStatusBarChanged();
        }
      },
      dispose: () => {
        this.registeredStatusBarItems.delete(itemId);
        this.notifyStatusBarChanged();
        this.emit({ type: 'statusbar:changed' });
      },
    };
  }

  private notifyStatusBarChanged() {
    const items: StatusBarItem[] = [];
    for (const [itemId, entry] of this.registeredStatusBarItems) {
      if (!entry.visible) continue;
      items.push({
        id: itemId,
        content: entry.config.text || '',
        position: (entry.config.position === 'left' || entry.config.position === 'right') ? entry.config.position : 'left',
        priority: entry.config.order || 0,
        tooltip: entry.config.tooltip,
        onClick: entry.config.onClick,
      });
    }
    this.onStatusBarItemsChanged(items);
  }

  // Header action handler
  handleAddHeaderAction(pluginId: string, config: HeaderActionConfig): HeaderActionHandle {
    const itemId = `${pluginId}:${config.id}`;
    this.registeredHeaderActions.set(itemId, { pluginId, config, visible: true });
    this.notifyHeaderActionsChanged();
    this.emit({ type: 'headeractions:changed' });

    return {
      setIcon: (icon: string) => {
        const entry = this.registeredHeaderActions.get(itemId);
        if (entry) {
          entry.config = { ...entry.config, icon };
          this.notifyHeaderActionsChanged();
        }
      },
      setTooltip: (tooltip: string) => {
        const entry = this.registeredHeaderActions.get(itemId);
        if (entry) {
          entry.config = { ...entry.config, tooltip };
          this.notifyHeaderActionsChanged();
        }
      },
      setVisible: (visible: boolean) => {
        const entry = this.registeredHeaderActions.get(itemId);
        if (entry) {
          entry.visible = visible;
          this.notifyHeaderActionsChanged();
        }
      },
      dispose: () => {
        this.registeredHeaderActions.delete(itemId);
        this.notifyHeaderActionsChanged();
        this.emit({ type: 'headeractions:changed' });
      },
    };
  }

  private notifyHeaderActionsChanged() {
    const items: HeaderActionItem[] = [];
    for (const [itemId, entry] of this.registeredHeaderActions) {
      if (!entry.visible) continue;
      items.push({
        id: itemId,
        pluginId: entry.pluginId,
        icon: entry.config.icon,
        tooltip: entry.config.tooltip,
        position: entry.config.position || 'right',
        order: entry.config.order ?? 50,
        onClick: entry.config.onClick,
      });
    }
    items.sort((a, b) => a.order - b.order);
    this.onHeaderActionsChanged(items);
  }

  /**
   * Get context menu items for a specific context type
   */
  getContextMenuItems(_contextType: string): { pluginId: string; item: ContextMenuItemConfig }[] {
    return Array.from(this.registeredContextMenuItems.values());
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
