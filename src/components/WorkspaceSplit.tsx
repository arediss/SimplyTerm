import { useCallback } from "react";
import type { WorkspaceNode, PaneGroup as PaneGroupType } from "../types/workspace";

import { PaneGroupComponent } from "./PaneGroup";
import { SplitHandle } from "./SplitHandle";

interface WorkspaceSplitProps {
  node: WorkspaceNode;
  groups: Map<string, PaneGroupType>;
  focusedGroupId: string;
  onTabSelect: (groupId: string, tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onFocusGroup: (groupId: string) => void;
  onResizeSplit: (splitId: string, newSizes: number[]) => void;
  onNewConnection: () => void;
  onLocalTerminal: () => void;
  onToggleTunnelSidebar: () => void;
  isTunnelSidebarOpen: boolean;
  activeTunnelCount: number;
  onSplitVertical: () => void;
  onSplitHorizontal: () => void;
  onClosePane: (groupId: string) => void;
  // Content renderers passed through to PaneGroup
  renderTerminal: (ptySessionId: string, isActive: boolean, type: string) => React.ReactNode;
  renderSftp: (sessionId: string) => React.ReactNode;
  renderTunnel: (sessionId: string, sessionName: string) => React.ReactNode;
  renderSettings: () => React.ReactNode;
  renderEmpty: () => React.ReactNode;
}

export function WorkspaceSplit({
  node,
  groups,
  focusedGroupId,
  onTabSelect,
  onTabClose,
  onFocusGroup,
  onResizeSplit,
  onNewConnection,
  onLocalTerminal,
  onToggleTunnelSidebar,
  isTunnelSidebarOpen,
  activeTunnelCount,
  onSplitVertical,
  onSplitHorizontal,
  onClosePane,
  renderTerminal,
  renderSftp,
  renderTunnel,
  renderSettings,
  renderEmpty,
}: WorkspaceSplitProps) {
  // Leaf node — render the PaneGroup
  if (node.type === "group") {
    const group = groups.get(node.id);
    if (!group) return <div className="w-full h-full bg-base" />;

    return (
      <PaneGroupComponent
        group={group}
        isFocused={node.id === focusedGroupId}
        onTabSelect={(tabId) => onTabSelect(node.id, tabId)}
        onTabClose={onTabClose}
        onFocus={() => onFocusGroup(node.id)}
        onNewConnection={onNewConnection}
        onLocalTerminal={onLocalTerminal}
        onToggleTunnelSidebar={onToggleTunnelSidebar}
        isTunnelSidebarOpen={isTunnelSidebarOpen}
        activeTunnelCount={activeTunnelCount}
        onSplitVertical={onSplitVertical}
        onSplitHorizontal={onSplitHorizontal}
        onClosePane={() => onClosePane(node.id)}
        renderTerminal={renderTerminal}
        renderSftp={renderSftp}
        renderTunnel={renderTunnel}
        renderSettings={renderSettings}
        renderEmpty={renderEmpty}
      />
    );
  }

  // Split node — render children with handles
  const { direction, children, sizes } = node;

  const handleDrag = useCallback(
    (index: number, delta: number) => {
      const container = document.getElementById(`wsplit-${node.id}`);
      if (!container) return;

      const totalSize = direction === "horizontal" ? container.clientHeight : container.clientWidth;
      const deltaPercent = (delta / totalSize) * 100;
      const minSize = 10;

      const newSizes = [...sizes];
      newSizes[index] = Math.max(minSize, newSizes[index] + deltaPercent);
      newSizes[index + 1] = Math.max(minSize, newSizes[index + 1] - deltaPercent);

      // Normalize
      const total = newSizes.reduce((a, b) => a + b, 0);
      const normalized = newSizes.map((s) => (s / total) * 100);

      onResizeSplit(node.id, normalized);
    },
    [node.id, sizes, direction, onResizeSplit]
  );

  return (
    <div
      id={`wsplit-${node.id}`}
      className={`w-full h-full flex ${direction === "horizontal" ? "flex-col" : "flex-row"}`}
    >
      {children.map((child, index) => (
        <div key={child.id} className="contents">
          <div
            style={{
              [direction === "horizontal" ? "height" : "width"]: `${sizes[index]}%`,
            }}
            className="overflow-hidden"
          >
            <WorkspaceSplit
              node={child}
              groups={groups}
              focusedGroupId={focusedGroupId}
              onTabSelect={onTabSelect}
              onTabClose={onTabClose}
              onFocusGroup={onFocusGroup}
              onResizeSplit={onResizeSplit}
              onNewConnection={onNewConnection}
              onLocalTerminal={onLocalTerminal}
              onToggleTunnelSidebar={onToggleTunnelSidebar}
              isTunnelSidebarOpen={isTunnelSidebarOpen}
              activeTunnelCount={activeTunnelCount}
              onSplitVertical={onSplitVertical}
              onSplitHorizontal={onSplitHorizontal}
              onClosePane={onClosePane}
              renderTerminal={renderTerminal}
              renderSftp={renderSftp}
              renderTunnel={renderTunnel}
              renderSettings={renderSettings}
              renderEmpty={renderEmpty}
            />
          </div>

          {index < children.length - 1 && (
            <SplitHandle direction={direction} onDrag={(delta) => handleDrag(index, delta)} />
          )}
        </div>
      ))}
    </div>
  );
}
