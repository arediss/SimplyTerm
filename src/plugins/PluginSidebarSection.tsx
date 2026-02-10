/**
 * Plugin Sidebar Section Component
 *
 * Renders plugin-registered sidebar sections by providing a container
 * for each section's render function.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { pluginManager } from './PluginManager';
import type { SidebarSectionRegistration } from './types';

interface PluginSidebarSectionProps {
  pluginId: string;
  section: SidebarSectionRegistration;
}

/**
 * Single plugin sidebar section
 */
function PluginSidebarSection({ pluginId, section }: Readonly<PluginSidebarSectionProps>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | void>(undefined);
  const [isCollapsed, setIsCollapsed] = useState(section.config.defaultCollapsed ?? false);

  // Render the section content
  const renderContent = useCallback(() => {
    if (containerRef.current && section.render) {
      // Clean up previous render if any
      if (typeof cleanupRef.current === 'function') {
        cleanupRef.current();
        cleanupRef.current = undefined;
      }
      // Call the plugin's render function
      cleanupRef.current = section.render(containerRef.current);
    }
  }, [section]);

  // Render when section changes or when uncollapsed
  useEffect(() => {
    if (!isCollapsed) {
      // Use setTimeout to ensure the DOM is ready
      const timer = setTimeout(renderContent, 0);
      return () => clearTimeout(timer);
    }
  }, [isCollapsed, renderContent]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typeof cleanupRef.current === 'function') {
        cleanupRef.current();
      }
    };
  }, []);

  const { config } = section;
  const isCollapsible = config.collapsible !== false;

  return (
    <div className="plugin-sidebar-section mt-3" data-plugin={pluginId} data-section={config.id}>
      {/* Section header */}
      {isCollapsible ? (
        <button
          type="button"
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-text-muted uppercase tracking-wider cursor-pointer hover:text-text w-full bg-transparent border-none"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <span className="text-text-muted">
            {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
          </span>
          <span>{config.title}</span>
        </button>
      ) : (
        <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-text-muted uppercase tracking-wider">
          <span>{config.title}</span>
        </div>
      )}

      {/* Section content */}
      {!isCollapsed && (
        <div
          ref={containerRef}
          className="plugin-sidebar-content px-1"
        />
      )}
    </div>
  );
}

/**
 * Container for all plugin sidebar sections
 */
export function PluginSidebarSections() {
  const [sections, setSections] = useState<Map<string, { pluginId: string; section: SidebarSectionRegistration }>>(
    new Map(pluginManager.registeredSidebarSections)
  );

  useEffect(() => {
    // Subscribe to plugin events
    const unsubscribe = pluginManager.subscribe((event) => {
      if (event.type === 'sidebar:register' || event.type === 'sidebar:unregister') {
        // Update sections from pluginManager
        setSections(new Map(pluginManager.registeredSidebarSections));
      }
    });

    // Initial load - get current sections
    setSections(new Map(pluginManager.registeredSidebarSections));

    return unsubscribe;
  }, []);

  if (sections.size === 0) {
    return null;
  }

  // Sort sections by order
  const sortedSections = Array.from(sections.entries()).sort(
    ([, a], [, b]) => (a.section.config.order ?? 100) - (b.section.config.order ?? 100)
  );

  return (
    <>
      {sortedSections.map(([sectionId, { pluginId, section }]) => (
        <PluginSidebarSection
          key={sectionId}
          pluginId={pluginId}
          section={section}
        />
      ))}
    </>
  );
}
