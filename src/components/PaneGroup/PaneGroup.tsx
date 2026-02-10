import { memo } from "react";
import type { PaneGroup as PaneGroupType } from "../../types/workspace";
import { PaneGroupTabBar } from "./PaneGroupTabBar";
import { PaneGroupContent } from "./PaneGroupContent";
import { useWorkspaceActions } from "./WorkspaceActionsContext";

interface PaneGroupProps {
  group: PaneGroupType;
  isFocused: boolean;
  onTabSelect: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onFocus: () => void;
  onClosePane: () => void;
}

export const PaneGroupComponent = memo(function PaneGroupComponent({
  group,
  isFocused,
  onTabSelect,
  onTabClose,
  onFocus,
  onClosePane,
}: PaneGroupProps) {
  const {
    onNewConnection,
    onLocalTerminal,
    onToggleTunnelSidebar,
    isTunnelSidebarOpen,
    activeTunnelCount,
    onSplitVertical,
    onSplitHorizontal,
    renderTerminal,
    renderSftp,
    renderTunnel,
    renderSettings,
    renderEmpty,
  } = useWorkspaceActions();

  return (
    <div
      className="w-full h-full flex flex-col overflow-hidden rounded-xl"
      style={{ backgroundColor: "var(--color-panel)" }}
      role="group"
      onClick={onFocus}
      onKeyDown={onFocus}
    >
      {/* Tab bar */}
      <PaneGroupTabBar
        tabs={group.tabs}
        activeTabId={group.activeTabId}
        onTabSelect={onTabSelect}
        onTabClose={onTabClose}
        onNewConnection={onNewConnection}
        onLocalTerminal={onLocalTerminal}
        onToggleTunnelSidebar={onToggleTunnelSidebar}
        isTunnelSidebarOpen={isTunnelSidebarOpen}
        activeTunnelCount={activeTunnelCount}
        onSplitVertical={onSplitVertical}
        onSplitHorizontal={onSplitHorizontal}
        onClosePane={onClosePane}
      />

      {/* Content area — render ALL tabs, hide inactive (preserve terminal state) */}
      <div className="flex-1 relative overflow-hidden [contain:strict]">
        {group.tabs.length === 0 ? (
          <PaneGroupContent
            tab={null}
            isGroupFocused={isFocused}
            renderTerminal={renderTerminal}
            renderSftp={renderSftp}
            renderTunnel={renderTunnel}
            renderSettings={renderSettings}
            renderEmpty={renderEmpty}
          />
        ) : (
          group.tabs.map((tab) => {
            const isActive = tab.id === group.activeTabId;
            // Terminals need invisible (not hidden) to keep xterm.js instances mounted
            const isTerminal = ["local", "ssh", "telnet", "serial"].includes(tab.type) && !!tab.ptySessionId;
            const hideClass = isTerminal ? "invisible z-0" : "hidden";
            return (
            <div
              key={tab.id}
              className={`absolute inset-0 ${isActive ? "visible z-10" : hideClass}`}
            >
              <PaneGroupContent
                tab={tab}
                isGroupFocused={isFocused && tab.id === group.activeTabId}
                renderTerminal={renderTerminal}
                renderSftp={renderSftp}
                renderTunnel={renderTunnel}
                renderSettings={renderSettings}
                renderEmpty={renderEmpty}
              />
            </div>
            );
          })
        )}
      </div>
    </div>
  );
});
