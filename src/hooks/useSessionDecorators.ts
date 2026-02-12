import { useEffect, useRef } from 'react';
import { pluginManager } from '../plugins/PluginManager';

/**
 * Hook that renders plugin session decorators (e.g., tag pills) into a container.
 * Returns a ref to attach to the decorator container element.
 */
export function useSessionDecorators(sessionId: string) {
  const decoratorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = decoratorRef.current;
    if (!container) return;

    const cleanups: (() => void)[] = [];

    const renderDecorators = () => {
      cleanups.forEach(fn => fn());
      cleanups.length = 0;
      container.replaceChildren();

      const decorators = pluginManager.getSessionDecorators();
      for (const { decorator } of decorators) {
        const cleanup = decorator.render(sessionId, container);
        if (cleanup) cleanups.push(cleanup);
      }
    };

    renderDecorators();

    const unsubscribe = pluginManager.subscribe((event) => {
      if (event.type === 'session-decorator:register' || event.type === 'session-decorator:unregister') {
        renderDecorators();
      }
    });

    const handleDecoratorChanged = () => renderDecorators();
    globalThis.addEventListener('plugin-decorators-changed', handleDecoratorChanged);

    return () => {
      unsubscribe();
      globalThis.removeEventListener('plugin-decorators-changed', handleDecoratorChanged);
      cleanups.forEach(fn => fn());
    };
  }, [sessionId]);

  return decoratorRef;
}
