/**
 * Plugin Widget Component
 *
 * Floating widget display for plugins (like DebugStats style).
 * Positioned at bottom-left or bottom-right of the screen.
 */

import { useEffect, useRef, useState } from 'react';
import type { PanelRegistration } from './types';

interface PluginWidgetProps {
  pluginId: string;
  panel: PanelRegistration;
  position: 'floating-left' | 'floating-right';
  visible: boolean;
}

export function PluginWidget({ pluginId, panel, position, visible }: PluginWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (visible && containerRef.current) {
      // Clear previous content
      containerRef.current.innerHTML = '';

      // Call the render function
      try {
        const cleanup = panel.render(containerRef.current);
        if (typeof cleanup === 'function') {
          cleanupRef.current = cleanup;
        }
      } catch (error) {
        console.error(`Error rendering widget ${panel.id} from plugin ${pluginId}:`, error);
        if (containerRef.current) {
          containerRef.current.innerHTML = `<span style="color: #e88b8b;">Error</span>`;
        }
      }
    }

    return () => {
      if (cleanupRef.current) {
        try {
          cleanupRef.current();
        } catch (e) {
          console.error('Error cleaning up widget:', e);
        }
        cleanupRef.current = null;
      }
    };
  }, [visible, panel, pluginId]);

  if (!visible) return null;

  const positionClass = position === 'floating-left' ? 'left-3' : 'right-3';

  return (
    <div
      className={`fixed bottom-3 ${positionClass} z-50`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`
          rounded-lg bg-crust/90 backdrop-blur-sm border border-surface-0/30
          text-xs font-mono transition-all duration-200
          ${isHovered ? 'opacity-100' : 'opacity-60'}
        `}
      >
        <div
          ref={containerRef}
          className="plugin-widget-content"
        />
      </div>
    </div>
  );
}
