/**
 * Plugin System exports
 */

export type { SessionInfo, ModalConfig, NotificationType, PromptConfig, PluginManifest, Unsubscribe, PluginEvent, PluginEventHandler, LoadedPlugin, CommandRegistration, PanelRegistration } from './types';
export type { SidebarViewRegistration, SettingsPanelRegistration, ContextMenuItemConfig, StatusBarItemConfig, StatusBarItemHandle, HeaderActionConfig, HeaderActionHandle, QuickConnectSectionRegistration, SessionDecoratorRegistration, ContextMenuContext, SidebarSectionRegistration } from './types';
export { createPluginAPI } from './PluginAPI';
export { PluginManager, pluginManager, type HeaderActionItem } from './PluginManager';
export { PluginHost, usePlugins } from './PluginHost';
export { PluginPanel } from './PluginPanel';
export { PluginWidget } from './PluginWidget';
export { PluginSidebarSections } from './PluginSidebarSection';
export { PluginSettingsPanel } from './PluginSettingsPanel';
export { sanitizeHTML, sanitizeElement, observeAndSanitize } from './sanitize';
