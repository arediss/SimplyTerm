import { useRef, useCallback, useEffect } from "react";

// ============================================================================
// Types
// ============================================================================

export type PaneNode =
  | { type: "terminal"; id: string; ptySessionId: string }
  | { type: "split"; id: string; direction: "horizontal" | "vertical"; children: PaneNode[]; sizes: number[] };

export interface SplitPaneProps {
  node: PaneNode;
  onNodeChange: (node: PaneNode) => void;
  renderTerminal: (paneId: string, ptySessionId: string, isFocused: boolean) => React.ReactNode;
  focusedPaneId: string | null;
  onFocusPane: (paneId: string) => void;
  onClosePane: (paneId: string) => void;
  depth?: number;
}

// ============================================================================
// Split Handle Component
// ============================================================================

interface SplitHandleProps {
  direction: "horizontal" | "vertical";
  onDrag: (delta: number) => void;
}

function SplitHandle({ direction, onDrag }: SplitHandleProps) {
  const handleRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startPos = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    startPos.current = direction === "horizontal" ? e.clientY : e.clientX;
    document.body.style.cursor = direction === "horizontal" ? "row-resize" : "col-resize";
    document.body.style.userSelect = "none";
  }, [direction]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const currentPos = direction === "horizontal" ? e.clientY : e.clientX;
      const delta = currentPos - startPos.current;
      startPos.current = currentPos;
      onDrag(delta);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [direction, onDrag]);

  return (
    <div
      ref={handleRef}
      onMouseDown={handleMouseDown}
      className={`
        ${direction === "horizontal" ? "h-1 cursor-row-resize" : "w-1 cursor-col-resize"}
        bg-surface-0/50 hover:bg-blue/50 active:bg-blue transition-colors
        flex-shrink-0
      `}
    />
  );
}

// ============================================================================
// Split Pane Component
// ============================================================================

export function SplitPane({
  node,
  onNodeChange,
  renderTerminal,
  focusedPaneId,
  onFocusPane,
  onClosePane,
  depth = 0,
}: SplitPaneProps) {
  // Terminal node - render the terminal
  if (node.type === "terminal") {
    return (
      <div
        className={`
          w-full h-full relative
          ${focusedPaneId === node.id ? "ring-1 ring-blue/50 ring-inset" : ""}
        `}
        onClick={() => onFocusPane(node.id)}
      >
        {renderTerminal(node.id, node.ptySessionId, focusedPaneId === node.id)}
      </div>
    );
  }

  // Split node - render children with handles
  const { direction, children, sizes } = node;

  const handleDrag = useCallback(
    (index: number, delta: number) => {
      const container = document.getElementById(`split-${node.id}`);
      if (!container) return;

      const totalSize = direction === "horizontal" ? container.clientHeight : container.clientWidth;
      const deltaPercent = (delta / totalSize) * 100;

      const newSizes = [...sizes];
      const minSize = 10; // Minimum 10% per pane

      // Adjust sizes
      newSizes[index] = Math.max(minSize, newSizes[index] + deltaPercent);
      newSizes[index + 1] = Math.max(minSize, newSizes[index + 1] - deltaPercent);

      // Normalize to ensure total is 100%
      const total = newSizes.reduce((a, b) => a + b, 0);
      const normalized = newSizes.map((s) => (s / total) * 100);

      onNodeChange({
        ...node,
        sizes: normalized,
      });
    },
    [node, sizes, direction, onNodeChange]
  );

  const handleChildChange = useCallback(
    (index: number, newChild: PaneNode) => {
      const newChildren = [...children];
      newChildren[index] = newChild;
      onNodeChange({
        ...node,
        children: newChildren,
      });
    },
    [node, children, onNodeChange]
  );

  return (
    <div
      id={`split-${node.id}`}
      className={`
        w-full h-full flex
        ${direction === "horizontal" ? "flex-col" : "flex-row"}
      `}
    >
      {children.map((child, index) => (
        <div key={child.id} className="contents">
          {/* Pane */}
          <div
            style={{
              [direction === "horizontal" ? "height" : "width"]: `${sizes[index]}%`,
            }}
            className="overflow-hidden"
          >
            <SplitPane
              node={child}
              onNodeChange={(newChild) => handleChildChange(index, newChild)}
              renderTerminal={renderTerminal}
              focusedPaneId={focusedPaneId}
              onFocusPane={onFocusPane}
              onClosePane={onClosePane}
              depth={depth + 1}
            />
          </div>

          {/* Handle between panes (not after the last one) */}
          {index < children.length - 1 && (
            <SplitHandle direction={direction} onDrag={(delta) => handleDrag(index, delta)} />
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

/** Generate a unique pane ID */
export function generatePaneId(): string {
  return `pane-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/** Create a terminal node */
export function createTerminalNode(ptySessionId: string): PaneNode {
  return {
    type: "terminal",
    id: generatePaneId(),
    ptySessionId,
  };
}

/** Split a pane */
export function splitPane(
  root: PaneNode,
  targetPaneId: string,
  direction: "horizontal" | "vertical",
  newPtySessionId: string
): PaneNode {
  // If this is the target terminal, split it
  if (root.type === "terminal" && root.id === targetPaneId) {
    return {
      type: "split",
      id: generatePaneId(),
      direction,
      children: [root, createTerminalNode(newPtySessionId)],
      sizes: [50, 50],
    };
  }

  // If this is a split, recurse into children
  if (root.type === "split") {
    return {
      ...root,
      children: root.children.map((child) => splitPane(child, targetPaneId, direction, newPtySessionId)),
    };
  }

  return root;
}

/** Close a pane and clean up the tree */
export function closePane(root: PaneNode, targetPaneId: string): PaneNode | null {
  // Can't close the root terminal
  if (root.type === "terminal") {
    return root.id === targetPaneId ? null : root;
  }

  // Filter out the closed pane from children
  const newChildren = root.children
    .map((child) => closePane(child, targetPaneId))
    .filter((child): child is PaneNode => child !== null);

  // If only one child left, collapse the split
  if (newChildren.length === 1) {
    return newChildren[0];
  }

  // If no children left (shouldn't happen normally)
  if (newChildren.length === 0) {
    return null;
  }

  // Redistribute sizes
  const totalSize = root.sizes.reduce((a, b) => a + b, 0);
  const newSizes = newChildren.map(() => totalSize / newChildren.length);

  return {
    ...root,
    children: newChildren,
    sizes: newSizes,
  };
}

/** Find a pane by ID */
export function findPane(root: PaneNode, paneId: string): PaneNode | null {
  if (root.id === paneId) return root;

  if (root.type === "split") {
    for (const child of root.children) {
      const found = findPane(child, paneId);
      if (found) return found;
    }
  }

  return null;
}

/** Get all terminal pane IDs */
export function getAllTerminalPaneIds(root: PaneNode): string[] {
  if (root.type === "terminal") {
    return [root.id];
  }

  return root.children.flatMap(getAllTerminalPaneIds);
}

/** Get all pty session IDs */
export function getAllPtySessionIds(root: PaneNode): string[] {
  if (root.type === "terminal") {
    return [root.ptySessionId];
  }

  return root.children.flatMap(getAllPtySessionIds);
}
