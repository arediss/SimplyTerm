import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Menu, Minus, Square, Copy, X, Settings, KeyRound } from "lucide-react";
import DynamicLucideIcon from "./DynamicLucideIcon";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { HeaderActionItem } from "../plugins";
import { isMac } from "../utils";

interface HeaderBarProps {
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
  onOpenSettings: () => void;
  headerActions?: HeaderActionItem[];
  vaultExists?: boolean;
  vaultUnlocked?: boolean;
  onVaultToggle?: () => void;
}

export default function HeaderBar({
  onToggleSidebar,
  isSidebarOpen,
  onOpenSettings,
  headerActions = [],
  vaultExists,
  vaultUnlocked,
  onVaultToggle,
}: Readonly<HeaderBarProps>) {
  const { t } = useTranslation();
  const [isMaximized, setIsMaximized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleMinimize = async () => {
    await getCurrentWindow().minimize();
  };

  const handleMaximize = async () => {
    const win = getCurrentWindow();
    await win.toggleMaximize();
    setIsMaximized(await win.isMaximized());
  };

  const handleClose = async () => {
    await getCurrentWindow().close();
  };

  useEffect(() => {
    let isMounted = true;
    const win = getCurrentWindow();
    win.isMaximized().then((v) => { if (isMounted) setIsMaximized(v); });
    win.isFullscreen().then((v) => { if (isMounted) setIsFullscreen(v); });

    const unlisten = win.onResized(async () => {
      const [maximized, fullscreen] = await Promise.all([
        win.isMaximized(),
        win.isFullscreen(),
      ]);
      if (isMounted) {
        setIsMaximized(maximized);
        setIsFullscreen(fullscreen);
      }
    });

    return () => { isMounted = false; unlisten.then((fn) => fn()); };
  }, []);

  const leftActions = useMemo(() => headerActions.filter((a) => a.position === "left"), [headerActions]);
  const rightActions = useMemo(() => headerActions.filter((a) => a.position === "right"), [headerActions]);

  const renderHeaderActions = (actions: HeaderActionItem[]) =>
    actions.map((action) => (
      <button
        key={action.id}
        onClick={(e) => {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          action.onClick({ x: rect.left, y: rect.bottom + 4, right: rect.right });
        }}
        className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-text-muted hover:text-text hover:bg-surface-0/50 transition-colors"
        title={action.tooltip}
      >
        <DynamicLucideIcon name={action.icon} size={14} />
      </button>
    ));

  return (
    <div
      className="absolute top-0 left-0 right-0 z-20 h-10"
      role="toolbar"
      onMouseDown={(e) => {
        if (e.buttons === 1 && !(e.target as HTMLElement).closest(".no-drag")) {
          if (e.detail === 2) {
            handleMaximize();
          } else {
            getCurrentWindow().startDragging();
          }
        }
      }}
    >
      <div className="relative h-full flex items-center justify-between px-2">
        {/* Left side */}
        <div className={`flex items-center no-drag ${isMac && !isFullscreen ? "ml-[70px]" : ""}`}>
          {/* Menu button */}
          <button
            onClick={onToggleSidebar}
            className={`
              shrink-0 w-8 h-7 flex items-center justify-center rounded-lg
              transition-colors hover:bg-surface-0/50
              ${isSidebarOpen ? "text-accent" : "text-text-muted hover:text-text"}
            `}
            title={t("header.menu")}
          >
            <Menu size={15} />
          </button>

          {/* Settings cog */}
          <button
            onClick={onOpenSettings}
            className="shrink-0 w-8 h-7 flex items-center justify-center rounded-lg text-text-muted hover:text-text hover:bg-surface-0/50 transition-colors"
            title={t("sidebar.settings")}
          >
            <Settings size={15} />
          </button>

          {/* Vault status */}
          {vaultExists && (
            <button
              onClick={onVaultToggle}
              className="relative shrink-0 w-8 h-7 flex items-center justify-center rounded-lg text-text-muted hover:text-text hover:bg-surface-0/50 transition-colors"
              title={vaultUnlocked ? t("sidebar.vaultUnlocked") : t("sidebar.vaultLocked")}
            >
              <KeyRound size={15} />
              <span className={`absolute top-1.5 right-1 w-1.5 h-1.5 rounded-full ${
                vaultUnlocked ? "bg-success" : "bg-warning"
              }`} />
            </button>
          )}

          {/* Plugin left actions */}
          {leftActions.length > 0 && renderHeaderActions(leftActions)}
        </div>

        {/* Right side */}
        <div className="flex items-center no-drag">
          {rightActions.length > 0 && (
            <>
              {renderHeaderActions(rightActions)}
              {!isMac && <div className="w-px h-5 bg-surface-0/40 mx-0.5" />}
            </>
          )}

          {/* Window controls — hidden on macOS */}
          {!isMac && (
            <>
              <button
                onClick={handleMinimize}
                className="w-11 h-10 flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-0/50 transition-colors"
                title={t("header.minimize")}
              >
                <Minus size={14} />
              </button>
              <button
                onClick={handleMaximize}
                className="w-11 h-10 flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-0/50 transition-colors"
                title={isMaximized ? t("header.restore") : t("header.maximize")}
              >
                {isMaximized ? <Square size={12} /> : <Copy size={13} className="rotate-90" />}
              </button>
              <button
                onClick={handleClose}
                className="w-11 h-10 flex items-center justify-center text-text-muted hover:text-white hover:bg-error transition-colors"
                title={t("header.close")}
              >
                <X size={15} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
