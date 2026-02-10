/**
 * Plugin Panel Component
 *
 * Container for rendering plugin panels in the UI.
 *
 * SECURITY: Plugin content is sanitized using DOMPurify to prevent XSS attacks.
 * A MutationObserver monitors for any dynamic changes and sanitizes them.
 */

import { useEffect, useRef } from 'react';
import type { PanelRegistration } from './types';
import { sanitizeElement, observeAndSanitize, sanitizeHTML } from './sanitize';

interface PluginPanelProps {
  pluginId: string;
  panel: PanelRegistration;
  visible: boolean;
  onClose?: () => void;
}

export function PluginPanel({ pluginId, panel, visible, onClose }: Readonly<PluginPanelProps>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const observerCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (visible && containerRef.current) {
      // Clear previous content
      containerRef.current.innerHTML = '';

      // Stop any previous observer
      if (observerCleanupRef.current) {
        observerCleanupRef.current();
        observerCleanupRef.current = null;
      }

      // Call the render function
      try {
        const cleanup = panel.render(containerRef.current);
        if (typeof cleanup === 'function') {
          cleanupRef.current = cleanup;
        }

        // SECURITY: Sanitize the rendered content
        sanitizeElement(containerRef.current);

        // SECURITY: Set up observer for dynamic changes
        observerCleanupRef.current = observeAndSanitize(containerRef.current);
      } catch (error) {
        console.error(`Error rendering panel ${panel.id} from plugin ${pluginId}:`, error);
        if (containerRef.current) {
          // Use sanitized error message
          containerRef.current.innerHTML = sanitizeHTML(
            `<div class="text-red-400 p-4">Error loading panel</div>`
          );
        }
      }
    }

    return () => {
      // Cleanup observer
      if (observerCleanupRef.current) {
        observerCleanupRef.current();
        observerCleanupRef.current = null;
      }

      // Cleanup plugin
      if (cleanupRef.current) {
        try {
          cleanupRef.current();
        } catch (e) {
          console.error('Error cleaning up panel:', e);
        }
        cleanupRef.current = null;
      }
    };
  }, [visible, panel, pluginId]);

  if (!visible) return null;

  return (
    <div className="plugin-panel flex flex-col h-full bg-[#1a1a1a] border-l border-gray-700">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700 bg-[#252525]">
        <span className="text-sm font-medium text-gray-200">{panel.id}</span>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 transition-colors"
            aria-label="Close panel"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      <div
        ref={containerRef}
        className="flex-1 overflow-auto p-3 text-gray-300"
      />
    </div>
  );
}
