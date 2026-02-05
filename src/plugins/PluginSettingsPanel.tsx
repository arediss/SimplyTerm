/**
 * Plugin Settings Panel Component
 *
 * Renders plugin-registered settings panels by providing a container
 * for each panel's render function.
 */

import { useEffect, useRef, useCallback } from 'react';
import type { SettingsPanelRegistration } from './types';

interface PluginSettingsPanelProps {
  pluginId: string;
  panel: SettingsPanelRegistration;
}

/**
 * Single plugin settings panel content renderer
 */
export function PluginSettingsPanel({ pluginId, panel }: PluginSettingsPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | void>();

  // Render the panel content
  const renderContent = useCallback(() => {
    if (containerRef.current && panel.render) {
      // Clean up previous render if any
      if (typeof cleanupRef.current === 'function') {
        cleanupRef.current();
        cleanupRef.current = undefined;
      }
      // Call the plugin's render function
      cleanupRef.current = panel.render(containerRef.current);
    }
  }, [panel]);

  // Render when panel is mounted or changes
  useEffect(() => {
    // Use setTimeout to ensure the DOM is ready
    const timer = setTimeout(renderContent, 0);
    return () => clearTimeout(timer);
  }, [renderContent]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typeof cleanupRef.current === 'function') {
        cleanupRef.current();
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="plugin-settings-panel"
      data-plugin={pluginId}
      data-panel={panel.config.id}
    />
  );
}
