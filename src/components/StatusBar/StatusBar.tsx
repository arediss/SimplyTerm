/**
 * Status Bar Component
 *
 * A status bar positioned below the header bar.
 * Displays vault status, plugin widgets, and other system info.
 * Toggle button is in the header (FloatingTabs).
 */

import { useTranslation } from "react-i18next";
import { Lock, LockOpen } from "lucide-react";
import type { StatusBarProps, StatusBarItem } from "./types";

export function StatusBar({
  visible,
  items = [],
  vaultConfigured,
  vaultLocked,
  onVaultClick,
}: Omit<StatusBarProps, "onToggleVisibility">) {
  const { t } = useTranslation();

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

          {/* Vault status indicator */}
          {vaultConfigured && (
            <button
              onClick={onVaultClick}
              className={`
                flex items-center gap-1.5 px-2 py-1 rounded
                transition-colors
                ${vaultLocked
                  ? "text-text-muted hover:text-text hover:bg-surface-0/30"
                  : "text-success hover:bg-success/10"
                }
              `}
              title={vaultLocked ? t("statusBar.vaultLocked") : t("statusBar.vaultUnlocked")}
            >
              {vaultLocked ? (
                <>
                  <Lock size={12} />
                  <span className="hidden sm:inline">{t("statusBar.locked")}</span>
                </>
              ) : (
                <>
                  <LockOpen size={12} />
                  <span className="hidden sm:inline">{t("statusBar.unlocked")}</span>
                </>
              )}
            </button>
          )}
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
