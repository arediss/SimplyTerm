import { useState, useRef, useEffect, useCallback, forwardRef, memo } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Plus, X, ChevronDown, Terminal, ArrowLeftRight, Columns2, Rows2, XCircle, Home } from "lucide-react";
import type { PaneGroupTab } from "../../types";
import { pluginManager } from "../../plugins";
import type { QuickConnectSectionRegistration } from "../../plugins";

interface PaneGroupTabBarProps {
  tabs: PaneGroupTab[];
  activeTabId: string | null;
  onTabSelect: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onNewConnection: () => void;
  onLocalTerminal: () => void;
  onToggleTunnelSidebar: () => void;
  isTunnelSidebarOpen: boolean;
  activeTunnelCount: number;
  onSplitVertical: () => void;
  onSplitHorizontal: () => void;
  onClosePane: () => void;
  onHome: () => void;
}

export function PaneGroupTabBar({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  onNewConnection,
  onLocalTerminal,
  onToggleTunnelSidebar,
  isTunnelSidebarOpen,
  activeTunnelCount,
  onSplitVertical,
  onSplitHorizontal,
  onClosePane,
  onHome,
}: Readonly<PaneGroupTabBarProps>) {
  const { t } = useTranslation();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<{ x: number; y: number } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownButtonRef = useRef<HTMLButtonElement>(null);
  const dropdownMenuRef = useRef<HTMLDivElement>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!dropdownRef.current?.contains(target) && !dropdownMenuRef.current?.contains(target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isDropdownOpen]);

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (!contextMenuRef.current?.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [contextMenu]);

  const handleDropdownToggle = useCallback(() => {
    if (!isDropdownOpen && dropdownButtonRef.current) {
      const rect = dropdownButtonRef.current.getBoundingClientRect();
      setDropdownPosition({ x: rect.left, y: rect.bottom + 4 });
    }
    setIsDropdownOpen(prev => !prev);
  }, [isDropdownOpen]);

  const handleTabBarContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const getTabTypeColor = (type: PaneGroupTab["type"]) => {
    switch (type) {
      case "ssh": return "bg-accent";
      case "local": return "bg-success";
      case "sftp": return "bg-blue";
      case "tunnel": return "bg-blue";
      case "telnet": return "bg-warning";
      case "serial": return "bg-warning";
      case "settings": return "bg-text-muted";
      case "home": return "bg-accent";
      default: return "bg-success";
    }
  };

  return (
    <div className="flex items-center h-10" role="tablist" tabIndex={0} onContextMenu={handleTabBarContextMenu}>
      {/* New tab split button */}
      <div className="flex items-center shrink-0 ml-1.5" ref={dropdownRef}>
        <button
          onClick={onNewConnection}
          className="w-7 h-7 flex items-center justify-center rounded-l text-text-muted hover:text-text hover:bg-surface-0/40 transition-colors"
          title={t("header.newSshConnection")}
        >
          <Plus size={15} />
        </button>
        <div className="w-px h-4 bg-surface-0/30" />
        <button
          ref={dropdownButtonRef}
          onClick={handleDropdownToggle}
          className={`w-7 h-7 flex items-center justify-center rounded-r transition-colors ${
            isDropdownOpen
              ? "bg-surface-0/50 text-text"
              : "text-text-muted hover:text-text hover:bg-surface-0/40"
          }`}
          title={t("header.quickConnections")}
        >
          <ChevronDown size={12} className={`transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} />
        </button>
      </div>

      {/* Home button — acts as the Home tab itself */}
      {(() => {
        const homeTab = tabs.find((t) => t.type === "home");
        const isHomeActive = homeTab ? homeTab.id === activeTabId : false;
        return (
          <button
            onClick={onHome}
            className={`shrink-0 w-7 h-7 flex items-center justify-center rounded-lg transition-colors ml-0.5 ${
              isHomeActive
                ? "bg-surface-0/50 text-accent"
                : "text-text-muted hover:text-text hover:bg-surface-0/40"
            }`}
            title={t("header.home")}
          >
            <Home size={14} />
          </button>
        );
      })()}

      {/* Tabs scrollable (home tab excluded — represented by the Home button above) */}
      <div className="flex-1 flex items-center gap-0.5 px-1.5 overflow-x-auto hide-scrollbar">
        {tabs.filter((tab) => tab.type !== "home").map((tab) => (
          <TabPillWrapper
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTabId}
            typeColor={getTabTypeColor(tab.type)}
            onTabSelect={onTabSelect}
            onTabClose={onTabClose}
          />
        ))}
      </div>

      {/* Dropdown portal */}
      {isDropdownOpen && dropdownPosition && createPortal(
        <QuickConnectDropdown
          ref={dropdownMenuRef}
          position={dropdownPosition}
          onLocalTerminal={() => { onLocalTerminal(); setIsDropdownOpen(false); }}
          onNewConnection={() => { onNewConnection(); setIsDropdownOpen(false); }}
          onToggleTunnels={() => { onToggleTunnelSidebar(); setIsDropdownOpen(false); }}
          isTunnelSidebarOpen={isTunnelSidebarOpen}
          activeTunnelCount={activeTunnelCount}
        />,
        document.body
      )}

      {/* Tab bar context menu */}
      {contextMenu && createPortal(
        <div
          ref={contextMenuRef}
          className="fixed z-[100] min-w-[180px] bg-crust/95 backdrop-blur-xl border border-surface-0/50 rounded-xl shadow-xl py-1.5 overflow-hidden"
          style={{ transform: `translate3d(${contextMenu.x}px, ${contextMenu.y}px, 0)`, left: 0, top: 0 }}
          role="menu"
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => { if (e.key === 'Escape') setContextMenu(null); }}
        >
          <button
            onClick={() => { onSplitVertical(); setContextMenu(null); }}
            className="w-full flex items-center gap-3 px-3 py-2 text-xs text-text hover:bg-surface-0/50 transition-colors"
          >
            <Columns2 size={13} className="text-text-muted" />
            <span>{t("header.splitVertical")}</span>
          </button>
          <button
            onClick={() => { onSplitHorizontal(); setContextMenu(null); }}
            className="w-full flex items-center gap-3 px-3 py-2 text-xs text-text hover:bg-surface-0/50 transition-colors"
          >
            <Rows2 size={13} className="text-text-muted" />
            <span>{t("header.splitHorizontal")}</span>
          </button>
          <div className="h-px bg-surface-0/30 my-1 mx-1.5" />
          <button
            onClick={() => { onClosePane(); setContextMenu(null); }}
            className="w-full flex items-center gap-3 px-3 py-2 text-xs text-error hover:bg-error/10 transition-colors"
          >
            <XCircle size={13} />
            <span>{t("header.closePane")}</span>
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TabPill
// ---------------------------------------------------------------------------

interface TabPillWrapperProps {
  tab: PaneGroupTab;
  isActive: boolean;
  typeColor: string;
  onTabSelect: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
}

const TabPillWrapper = memo(function TabPillWrapper({ tab, isActive, typeColor, onTabSelect, onTabClose }: TabPillWrapperProps) {
  const handleSelect = useCallback(() => onTabSelect(tab.id), [tab.id, onTabSelect]);
  const handleClose = useCallback(() => onTabClose(tab.id), [tab.id, onTabClose]);
  return <TabPill tab={tab} isActive={isActive} typeColor={typeColor} onSelect={handleSelect} onClose={handleClose} />;
});

interface TabPillProps {
  tab: PaneGroupTab;
  isActive: boolean;
  typeColor: string;
  onSelect: () => void;
  onClose: () => void;
}

const TabPill = memo(function TabPill({ tab, isActive, typeColor, onSelect, onClose }: TabPillProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={`
        group flex items-center gap-2 pl-2.5 pr-1.5 py-1.5 rounded-lg cursor-pointer
        transition-colors duration-150 shrink-0
        ${isActive
          ? "bg-surface-0/50 text-text"
          : "text-text-muted hover:text-text-secondary hover:bg-surface-0/25"
        }
      `}
      role="tab"
      tabIndex={0}
      aria-selected={isActive}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span className={`w-2 h-2 rounded-full shrink-0 ${typeColor}`} />
      <span className="text-[13px] font-medium truncate max-w-[120px]">{tab.title}</span>
      <button
        className={`
          w-3.5 h-3.5 flex items-center justify-center rounded shrink-0
          transition-[colors,opacity] duration-100
          ${isActive || isHovered
            ? "opacity-50 hover:opacity-100 hover:bg-white/10"
            : "opacity-0 w-0 overflow-hidden"
          }
        `}
        onClick={(e) => { e.stopPropagation(); onClose(); }}
      >
        <X size={9} />
      </button>
    </div>
  );
});

// ---------------------------------------------------------------------------
// QuickConnectDropdown
// ---------------------------------------------------------------------------

interface QuickConnectDropdownProps {
  position: { x: number; y: number };
  onLocalTerminal: () => void;
  onNewConnection: () => void;
  onToggleTunnels: () => void;
  isTunnelSidebarOpen: boolean;
  activeTunnelCount: number;
}

const QuickConnectDropdown = forwardRef<HTMLDivElement, QuickConnectDropdownProps>(({
  position,
  onLocalTerminal,
  onNewConnection,
  onToggleTunnels,
  isTunnelSidebarOpen,
  activeTunnelCount,
}, ref) => {
  const pluginContainerRef = useRef<HTMLDivElement>(null);
  const cleanupsRef = useRef<Array<() => void>>([]);

  const getSections = useCallback((): Array<{ id: string; section: QuickConnectSectionRegistration }> => {
    return Array.from(pluginManager.registeredQuickConnectSections.entries())
      .sort(([, a], [, b]) => (a.section.config.order ?? 100) - (b.section.config.order ?? 100))
      .map(([id, { section }]) => ({ id, section }));
  }, []);

  useEffect(() => {
    const container = pluginContainerRef.current;
    if (!container) return;

    const sections = getSections();
    if (sections.length === 0) return;

    for (const { id, section } of sections) {
      const divider = document.createElement("div");
      divider.className = "h-px bg-surface-0/30 mx-1.5";
      container.appendChild(divider);

      const sectionEl = document.createElement("div");
      sectionEl.className = "p-1.5";
      sectionEl.dataset.quickConnectSection = id;
      container.appendChild(sectionEl);

      const cleanup = section.render(sectionEl);
      if (typeof cleanup === "function") cleanupsRef.current.push(cleanup);
    }

    return () => {
      cleanupsRef.current.forEach((fn) => { try { fn(); } catch {} });
      cleanupsRef.current = [];
      container.innerHTML = "";
    };
  }, [getSections]);

  return (
    <div
      ref={ref}
      className="fixed w-52 bg-crust/95 backdrop-blur-xl border border-surface-0/50 rounded-xl shadow-xl overflow-hidden z-50"
      style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0)`, left: 0, top: 0 }}
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

        <div className="h-px bg-surface-0/30 my-1" />

        <button
          onClick={onToggleTunnels}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-0/50 transition-colors ${isTunnelSidebarOpen ? "text-accent" : ""}`}
        >
          <ArrowLeftRight size={14} className={isTunnelSidebarOpen ? "text-accent" : "text-text-muted"} />
          <span className="text-sm text-text flex-1 text-left">Tunnels</span>
          {activeTunnelCount > 0 && (
            <span className="min-w-[18px] h-[18px] flex items-center justify-center px-1 text-[10px] font-bold bg-accent text-crust rounded-full">
              {activeTunnelCount}
            </span>
          )}
        </button>
      </div>
      <div ref={pluginContainerRef} />
    </div>
  );
});

export default PaneGroupTabBar;
