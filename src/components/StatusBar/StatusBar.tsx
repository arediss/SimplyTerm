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

  // Sort items by position and priority (ascending = lower order first)
  const leftItems = items
    .filter((item) => item.position === "left")
    .sort((a, b) => (a.priority || 0) - (b.priority || 0));

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
          h-7 px-2
          bg-mantle/95 backdrop-blur-sm
          border-b border-surface-0/30
          text-[11px] font-mono
        "
      >
        {/* Left section */}
        <div className="flex items-center">
          <StatusBarSection items={leftItems} />
        </div>

        {/* Center section */}
        <div className="flex items-center">
          <StatusBarSection items={centerItems} />
        </div>

        {/* Right section */}
        <div className="flex items-center">
          <StatusBarSection items={rightItems} />
        </div>
      </div>
    </div>
  );
}

function StatusBarSection({ items }: { items: StatusBarItem[] }) {
  if (items.length === 0) return null;

  return (
    <>
      {items.map((item, index) => (
        <div key={item.id} className="flex items-center">
          {index > 0 && (
            <span className="mx-1.5 text-surface-1/40 select-none">|</span>
          )}
          <StatusBarItemRenderer item={item} />
        </div>
      ))}
    </>
  );
}

function StatusBarItemRenderer({ item }: { item: StatusBarItem }) {
  const content = (
    <span className="text-subtext-0 tabular-nums tracking-tight">{item.content}</span>
  );

  if (item.onClick) {
    return (
      <button
        onClick={item.onClick}
        className="hover:text-text transition-colors px-1.5 py-0.5 rounded hover:bg-surface-0/30"
        title={item.tooltip}
      >
        {content}
      </button>
    );
  }

  return (
    <span title={item.tooltip} className="px-1.5 py-0.5">
      {content}
    </span>
  );
}
