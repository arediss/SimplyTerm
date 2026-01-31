/**
 * Status Bar Component
 *
 * A status bar positioned below the header bar.
 * Hidden by default, reserved for plugin widgets.
 * Can be enabled in settings when plugins need to display widgets.
 */

import type { StatusBarProps, StatusBarItem } from "./types";

export function StatusBar({ visible, items = [] }: StatusBarProps) {
  if (!visible) {
    return null;
  }

  // Sort items by position and priority
  const leftItems = items
    .filter((item) => item.position === "left")
    .sort((a, b) => (b.priority || 0) - (a.priority || 0));

  const centerItems = items
    .filter((item) => item.position === "center")
    .sort((a, b) => (a.priority || 0) - (b.priority || 0));

  const rightItems = items
    .filter((item) => item.position === "right")
    .sort((a, b) => (a.priority || 0) - (b.priority || 0));

  return (
    <div className="fixed top-10 left-0 right-0 z-30">
      {/* Status bar */}
      <div
        className="
          flex items-center justify-between
          h-8 px-3
          bg-mantle/95 backdrop-blur-sm
          border-b border-surface-0/30
          text-xs
        "
      >
        {/* Left section */}
        <div className="flex items-center gap-3">
          {leftItems.map((item) => (
            <StatusBarItemRenderer key={item.id} item={item} />
          ))}
        </div>

        {/* Center section */}
        <div className="flex items-center gap-3">
          {centerItems.map((item) => (
            <StatusBarItemRenderer key={item.id} item={item} />
          ))}
        </div>

        {/* Right section */}
        <div className="flex items-center gap-3">
          {rightItems.map((item) => (
            <StatusBarItemRenderer key={item.id} item={item} />
          ))}
        </div>
      </div>
    </div>
  );
}

function StatusBarItemRenderer({ item }: { item: StatusBarItem }) {
  const content = (
    <span className="text-text-secondary">{item.content}</span>
  );

  if (item.onClick) {
    return (
      <button
        onClick={item.onClick}
        className="hover:text-text transition-colors px-1 py-0.5 rounded hover:bg-surface-0/30"
        title={item.tooltip}
      >
        {content}
      </button>
    );
  }

  return (
    <span title={item.tooltip} className="px-1">
      {content}
    </span>
  );
}
