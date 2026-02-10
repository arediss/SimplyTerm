import { useCallback, useRef, memo } from "react";
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
  onClosePane: (groupId: string) => void;
}

/** Wrapper to avoid inline closures on SplitHandle */
const SplitHandleWithIndex = memo(function SplitHandleWithIndex({
  index,
  direction,
  onDrag,
  onDragStart,
}: {
  index: number;
  direction: "horizontal" | "vertical";
  onDrag: (index: number, delta: number) => void;
  onDragStart: () => void;
}) {
  const handleDrag = useCallback(
    (delta: number) => onDrag(index, delta),
    [index, onDrag]
  );
  return <SplitHandle direction={direction} onDrag={handleDrag} onDragStart={onDragStart} />;
});

export const WorkspaceSplit = memo(function WorkspaceSplit({
  node,
  groups,
  focusedGroupId,
  onTabSelect,
  onTabClose,
  onFocusGroup,
  onResizeSplit,
  onClosePane,
}: WorkspaceSplitProps) {
  // Cached container dimension — set once at drag start, used on every drag move
  const cachedTotalSize = useRef(0);

  // Stable callbacks for PaneGroupComponent (avoids inline closures)
  const handleGroupTabSelect = useCallback(
    (tabId: string) => onTabSelect(node.id, tabId),
    [node.id, onTabSelect]
  );
  const handleGroupFocus = useCallback(
    () => onFocusGroup(node.id),
    [node.id, onFocusGroup]
  );
  const handleGroupClosePane = useCallback(
    () => onClosePane(node.id),
    [node.id, onClosePane]
  );

  // Split-specific data (safe to read even for group nodes — just unused)
  const { direction, children, sizes } = node.type === "split"
    ? node
    : { direction: "horizontal" as const, children: [] as WorkspaceNode[], sizes: [] as number[] };

  // Cache the container dimension once when a drag begins (avoids layout thrashing on every mousemove)
  const handleDragStart = useCallback(() => {
    const container = document.getElementById(`wsplit-${node.id}`);
    if (!container) return;
    cachedTotalSize.current =
      direction === "horizontal" ? container.clientHeight : container.clientWidth;
  }, [node.id, direction]);

  const handleDrag = useCallback(
    (index: number, delta: number) => {
      const totalSize = cachedTotalSize.current;
      if (totalSize === 0) return;

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
    [node.id, sizes, onResizeSplit]
  );

  // Leaf node — render the PaneGroup
  if (node.type === "group") {
    const group = groups.get(node.id);
    if (!group) return <div className="w-full h-full bg-base" />;

    return (
      <PaneGroupComponent
        group={group}
        isFocused={node.id === focusedGroupId}
        onTabSelect={handleGroupTabSelect}
        onTabClose={onTabClose}
        onFocus={handleGroupFocus}
        onClosePane={handleGroupClosePane}
      />
    );
  }

  // Split node — render children with handles

  return (
    <div
      id={`wsplit-${node.id}`}
      className={`w-full h-full flex ${direction === "horizontal" ? "flex-col" : "flex-row"}`}
    >
      {children.map((child, index) => (
        <div key={child.id} className="contents">
          <div
            className="split-pane overflow-hidden"
            style={{ "--split-size": `${sizes[index]}%` } as React.CSSProperties}
          >
            <WorkspaceSplit
              node={child}
              groups={groups}
              focusedGroupId={focusedGroupId}
              onTabSelect={onTabSelect}
              onTabClose={onTabClose}
              onFocusGroup={onFocusGroup}
              onResizeSplit={onResizeSplit}
              onClosePane={onClosePane}
            />
          </div>

          {index < children.length - 1 && (
            <SplitHandleWithIndex
              index={index}
              direction={direction}
              onDrag={handleDrag}
              onDragStart={handleDragStart}
            />
          )}
        </div>
      ))}
    </div>
  );
});
