import { useState, useEffect, useRef, forwardRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Menu, Plus, X, Minus, Square, Copy, ChevronDown, Terminal, Clock, ArrowLeftRight, PanelBottomClose, PanelBottomOpen } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Tab, RecentSession } from "../types";

interface FloatingTabsProps {
  tabs: Tab[];
  activeTabId: string | null;
  onTabSelect: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onNewTab: () => void;
  onLocalTerminal: () => void;
  onRecentSessionConnect: (session: RecentSession) => void;
  recentSessions: RecentSession[];
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
  onToggleTunnelSidebar: () => void;
  isTunnelSidebarOpen: boolean;
  activeTunnelCount: number;
  statusBarVisible: boolean;
  onToggleStatusBar: () => void;
}

function FloatingTabs({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  onNewTab,
  onLocalTerminal,
  onRecentSessionConnect,
  recentSessions,
  onToggleSidebar,
  isSidebarOpen,
  onToggleTunnelSidebar,
  isTunnelSidebarOpen,
  activeTunnelCount,
  statusBarVisible,
  onToggleStatusBar,
}: FloatingTabsProps) {
  const { t } = useTranslation();
  const [isMaximized, setIsMaximized] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<{ x: number; y: number } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownButtonRef = useRef<HTMLButtonElement>(null);
  const dropdownMenuRef = useRef<HTMLDivElement>(null);

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

  // Check initial maximized state
  useEffect(() => {
    getCurrentWindow()
      .isMaximized()
      .then(setIsMaximized);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const isInsideButton = dropdownRef.current?.contains(target);
      const isInsideMenu = dropdownMenuRef.current?.contains(target);
      if (!isInsideButton && !isInsideMenu) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isDropdownOpen]);

  return (
    <div className="absolute top-0 left-0 right-0 z-20 h-10 bg-mantle/80 backdrop-blur-sm border-b border-surface-0/30">
      {/* Drag region - toute la barre sauf les contrôles */}
      <div className="absolute inset-0 drag-region" />

      {/* Container principal */}
      <div className="relative h-full flex items-center justify-between px-2">
        {/* Partie gauche - Menu + Tabs */}
        <div className="flex items-center gap-1.5 no-drag">
          {/* Bouton menu sidebar */}
          <button
            onClick={onToggleSidebar}
            className={`
              shrink-0 w-7 h-7 flex items-center justify-center rounded-lg
              transition-all duration-200 hover:bg-surface-0/50
              ${isSidebarOpen ? "text-accent" : "text-text-muted hover:text-text"}
            `}
            title="Menu"
          >
            <Menu size={14} />
          </button>

          {/* Bouton tunnels avec badge */}
          <button
            onClick={onToggleTunnelSidebar}
            className={`
              relative shrink-0 w-7 h-7 flex items-center justify-center rounded-lg
              transition-all duration-200 hover:bg-surface-0/50
              ${isTunnelSidebarOpen ? "text-accent" : "text-text-muted hover:text-text"}
            `}
            title="Port Forwarding (Tunnels)"
          >
            <ArrowLeftRight size={14} />
            {activeTunnelCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] flex items-center justify-center px-1 text-[9px] font-bold bg-accent text-crust rounded-full">
                {activeTunnelCount}
              </span>
            )}
          </button>

          {/* Bouton toggle status bar */}
          <button
            onClick={onToggleStatusBar}
            className={`
              shrink-0 w-7 h-7 flex items-center justify-center rounded-lg
              transition-all duration-200 hover:bg-surface-0/50
              ${statusBarVisible ? "text-accent" : "text-text-muted hover:text-text"}
            `}
            title={statusBarVisible ? t("statusBar.hide") : t("statusBar.show")}
          >
            {statusBarVisible ? <PanelBottomClose size={14} /> : <PanelBottomOpen size={14} />}
          </button>

          {/* Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto hide-scrollbar max-w-[calc(100vw-200px)]">
            {tabs.map((tab) => (
              <TabPill
                key={tab.id}
                tab={tab}
                isActive={tab.id === activeTabId}
                onSelect={() => onTabSelect(tab.id)}
                onClose={() => onTabClose(tab.id)}
              />
            ))}

            {/* Bouton split: nouvelle connexion + dropdown */}
            <div className="relative flex items-center bg-terminal rounded-lg" ref={dropdownRef}>
              {/* Bouton principal + */}
              <button
                onClick={onNewTab}
                className="shrink-0 w-7 h-7 flex items-center justify-center rounded-l-lg text-text-muted hover:text-text hover:bg-white/5 transition-all duration-200"
                title="Nouvelle connexion SSH"
              >
                <Plus size={14} />
              </button>
              
              {/* Séparateur */}
              <div className="w-px h-4 bg-surface-0/30" />
              
              {/* Bouton dropdown */}
              <button
                ref={dropdownButtonRef}
                onClick={() => {
                  if (!isDropdownOpen && dropdownButtonRef.current) {
                    const rect = dropdownButtonRef.current.getBoundingClientRect();
                    setDropdownPosition({ x: rect.left, y: rect.bottom + 4 });
                  }
                  setIsDropdownOpen(!isDropdownOpen);
                }}
                className={`shrink-0 w-7 h-7 flex items-center justify-center rounded-r-lg transition-all duration-200 ${
                  isDropdownOpen
                    ? "bg-white/10 text-text"
                    : "text-text-muted hover:text-text hover:bg-white/5"
                }`}
                title="Connexions rapides"
              >
                <ChevronDown size={12} className={`transition-transform duration-200 ${isDropdownOpen ? "rotate-180" : ""}`} />
              </button>
            </div>

          </div>
        </div>

        {/* Partie droite - Window controls */}
        <div className="flex items-center no-drag">
          {/* Minimize */}
          <button
            onClick={handleMinimize}
            className="w-11 h-10 flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-0/50 transition-colors"
            title="Réduire"
          >
            <Minus size={14} />
          </button>

          {/* Maximize/Restore */}
          <button
            onClick={handleMaximize}
            className="w-11 h-10 flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-0/50 transition-colors"
            title={isMaximized ? "Restaurer" : "Agrandir"}
          >
            {isMaximized ? <Square size={12} /> : <Copy size={13} className="rotate-90" />}
          </button>

          {/* Close */}
          <button
            onClick={handleClose}
            className="w-11 h-10 flex items-center justify-center text-text-muted hover:text-white hover:bg-error transition-colors"
            title="Fermer"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Dropdown menu - rendered via Portal to escape overflow clipping */}
      {isDropdownOpen && dropdownPosition && createPortal(
        <QuickConnectDropdown
          ref={dropdownMenuRef}
          position={dropdownPosition}
          onLocalTerminal={() => {
            onLocalTerminal();
            setIsDropdownOpen(false);
          }}
          onNewConnection={() => {
            onNewTab();
            setIsDropdownOpen(false);
          }}
          recentSessions={recentSessions}
          onRecentSessionConnect={(session) => {
            onRecentSessionConnect(session);
            setIsDropdownOpen(false);
          }}
        />,
        document.body
      )}
    </div>
  );
}

interface TabPillProps {
  tab: Tab;
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
}

function TabPill({ tab, isActive, onSelect, onClose }: TabPillProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={`
        group flex items-center gap-1.5 pl-2.5 pr-1.5 py-1.5 rounded-lg cursor-pointer
        transition-all duration-200 shrink-0
        ${
          isActive
            ? "bg-surface-0/60 text-text"
            : "text-text-muted hover:text-text-secondary hover:bg-surface-0/30"
        }
      `}
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Icône de type */}
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
          tab.type === "ssh" ? "bg-accent" : "bg-success"
        }`}
      />

      {/* Titre */}
      <span className="text-[11px] font-medium truncate max-w-[80px]">
        {tab.title}
      </span>

      {/* Bouton fermer */}
      <button
        className={`
          w-4 h-4 flex items-center justify-center rounded shrink-0
          transition-all duration-150
          ${
            isActive || isHovered
              ? "opacity-60 hover:opacity-100 hover:bg-white/10"
              : "opacity-0 w-0 overflow-hidden"
          }
        `}
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        <X size={10} />
      </button>
    </div>
  );
}

interface QuickConnectDropdownProps {
  position: { x: number; y: number };
  onLocalTerminal: () => void;
  onNewConnection: () => void;
  recentSessions: RecentSession[];
  onRecentSessionConnect: (session: RecentSession) => void;
}

const QuickConnectDropdown = forwardRef<HTMLDivElement, QuickConnectDropdownProps>(({
  position,
  onLocalTerminal,
  onNewConnection,
  recentSessions,
  onRecentSessionConnect,
}, ref) => {
  // Limiter l'affichage des récentes
  const displayedRecent = recentSessions.slice(0, 4);

  return (
    <div
      ref={ref}
      className="fixed w-52 bg-crust/95 backdrop-blur-xl border border-surface-0/50 rounded-xl shadow-xl overflow-hidden z-50"
      style={{ left: position.x, top: position.y }}
    >
      <div className="p-1.5">
        <button
          onClick={onLocalTerminal}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-0/50 transition-colors"
        >
          <Terminal size={14} className="text-success" />
          <span className="text-sm text-text">Terminal local</span>
        </button>
        <button
          onClick={onNewConnection}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-0/50 transition-colors"
        >
          <Plus size={14} className="text-accent" />
          <span className="text-sm text-text">Nouvelle connexion</span>
        </button>
      </div>

      {/* Section Récentes - format compact */}
      {displayedRecent.length > 0 && (
        <>
          <div className="h-px bg-surface-0/30" />
          <div className="p-1.5">
            {displayedRecent.map((session) => (
              <button
                key={session.id}
                onClick={() => onRecentSessionConnect(session)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-0/50 transition-colors"
              >
                <Clock size={14} className="text-text-muted" />
                <span className="text-sm text-text truncate">{session.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
});

export default FloatingTabs;
