/**
 * Plugin Host Component
 *
 * Manages plugin loading and provides containers for plugin panels and widgets.
 */

import { useEffect, useState, useCallback } from 'react';
import { pluginManager } from './PluginManager';
import { PluginPanel } from './PluginPanel';
import { PluginWidget } from './PluginWidget';
import type { PluginManifest, PanelRegistration, SessionInfo, ModalConfig, NotificationType } from './types';

interface PanelEntry {
  pluginId: string;
  panel: PanelRegistration;
  position: string;
}

interface PluginHostProps {
  // Callbacks from App.tsx
  onShowNotification: (message: string, type: NotificationType) => void;
  onShowModal: (config: ModalConfig) => Promise<unknown>;
  getSessions: () => SessionInfo[];
  getActiveSession: () => SessionInfo | null;
}

export function PluginHost({
  onShowNotification,
  onShowModal,
  getSessions,
  getActiveSession,
}: PluginHostProps) {
  const [panels, setPanels] = useState<Map<string, PanelEntry>>(new Map());
  const [visiblePanels, setVisiblePanels] = useState<Set<string>>(new Set());

  // Initialize plugin manager callbacks
  useEffect(() => {
    pluginManager.onShowNotification = onShowNotification;
    pluginManager.onShowModal = onShowModal;
    pluginManager.getSessions = getSessions;
    pluginManager.getActiveSession = getActiveSession;
  }, [onShowNotification, onShowModal, getSessions, getActiveSession]);

  // Subscribe to plugin events
  useEffect(() => {
    const unsubscribe = pluginManager.subscribe((event) => {
      switch (event.type) {
        case 'panel:register':
          setPanels(new Map(pluginManager.registeredPanels));
          // Auto-show floating widgets
          const entry = pluginManager.registeredPanels.get(event.panelId);
          if (entry?.position.startsWith('floating')) {
            setVisiblePanels((prev) => new Set([...prev, event.panelId]));
          }
          break;
        case 'panel:show':
          setVisiblePanels((prev) => new Set([...prev, event.panelId]));
          break;
        case 'panel:hide':
          setVisiblePanels((prev) => {
            const next = new Set(prev);
            next.delete(event.panelId);
            return next;
          });
          break;
        case 'plugin:unloaded':
          // Remove panels from this plugin
          setPanels((prev) => {
            const next = new Map(prev);
            for (const [panelId, entry] of next) {
              if (entry.pluginId === event.pluginId) {
                next.delete(panelId);
              }
            }
            return next;
          });
          break;
      }
    });

    return unsubscribe;
  }, []);

  // Load enabled plugins on mount
  useEffect(() => {
    pluginManager.loadEnabledPlugins().catch((error) => {
      console.error('Failed to load enabled plugins:', error);
    });
  }, []);

  const hidePanel = useCallback((panelId: string) => {
    setVisiblePanels((prev) => {
      const next = new Set(prev);
      next.delete(panelId);
      return next;
    });
  }, []);

  // Separate panels by type
  const sidePanels = Array.from(panels.entries()).filter(
    ([panelId, entry]) =>
      visiblePanels.has(panelId) &&
      !entry.position.startsWith('floating')
  );

  const floatingWidgets = Array.from(panels.entries()).filter(
    ([panelId, entry]) =>
      visiblePanels.has(panelId) &&
      entry.position.startsWith('floating')
  );

  return (
    <>
      {/* Floating widgets (like DebugStats) */}
      {floatingWidgets.map(([panelId, entry]) => (
        <PluginWidget
          key={panelId}
          pluginId={entry.pluginId}
          panel={entry.panel}
          position={entry.position as 'floating-left' | 'floating-right'}
          visible={true}
        />
      ))}

      {/* Side panels */}
      {sidePanels.length > 0 && (
        <div className="plugin-panels-container flex">
          {sidePanels.map(([panelId, entry]) => (
            <div key={panelId} className="w-64 h-full">
              <PluginPanel
                pluginId={entry.pluginId}
                panel={entry.panel}
                visible={true}
                onClose={() => hidePanel(panelId)}
              />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/**
 * Hook to interact with the plugin system from other components
 */
export function usePlugins() {
  const [plugins, setPlugins] = useState<PluginManifest[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await pluginManager.listPlugins();
      setPlugins(list);
    } catch (error) {
      console.error('Failed to list plugins:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const enablePlugin = useCallback(async (id: string) => {
    await pluginManager.enablePlugin(id);
    await refresh();
  }, [refresh]);

  const disablePlugin = useCallback(async (id: string) => {
    await pluginManager.disablePlugin(id);
    await refresh();
  }, [refresh]);

  return {
    plugins,
    loading,
    refresh,
    enablePlugin,
    disablePlugin,
    registeredPanels: pluginManager.registeredPanels,
    registeredCommands: pluginManager.registeredCommands,
    executeCommand: pluginManager.executeCommand.bind(pluginManager),
  };
}
