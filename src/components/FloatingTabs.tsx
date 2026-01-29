import { useState } from "react";
import { Menu, Plus, X, Minus, Square, Maximize2 } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Tab } from "../App";

interface FloatingTabsProps {
  tabs: Tab[];
  activeTabId: string | null;
  onTabSelect: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onNewTab: () => void;
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
}

function FloatingTabs({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  onNewTab,
  onToggleSidebar,
  isSidebarOpen,
}: FloatingTabsProps) {
  const [isMaximized, setIsMaximized] = useState(false);

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
  useState(() => {
    getCurrentWindow()
      .isMaximized()
      .then(setIsMaximized);
  });

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

            {/* Bouton nouveau tab */}
            <button
              onClick={onNewTab}
              className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-text-muted hover:text-text hover:bg-surface-0/50 transition-all duration-200"
              title="Nouvelle connexion"
            >
              <Plus size={14} />
            </button>
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
            {isMaximized ? <Square size={12} /> : <Maximize2 size={13} />}
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

export default FloatingTabs;
