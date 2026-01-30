import { useRef, useCallback, useEffect } from "react";
import { Columns2, Rows2, X, ArrowLeftRight } from "lucide-react";

// ============================================================================
// Types
// ============================================================================

export type PaneNode =
  | { type: "terminal"; id: string; ptySessionId: string }
  | { type: "sftp"; id: string; sessionId: string; initialPath: string }
  | { type: "pending"; id: string }
  | { type: "split"; id: string; direction: "horizontal" | "vertical"; children: PaneNode[]; sizes: number[] };

export interface SplitPaneProps {
  node: PaneNode;
  onNodeChange: (node: PaneNode) => void;
  renderTerminal: (paneId: string, ptySessionId: string, isFocused: boolean) => React.ReactNode;
  renderSftp?: (paneId: string, sessionId: string, initialPath: string) => React.ReactNode;
  renderPending?: (paneId: string) => React.ReactNode;
  focusedPaneId: string | null;
  onFocusPane: (paneId: string) => void;
  onClosePane: (paneId: string) => void;
  onSplitPane?: (paneId: string, direction: "horizontal" | "vertical") => void;
  depth?: number;
  // Tunnel support
  sessionType?: "local" | "ssh";
  onOpenTunnels?: () => void;
}

// ============================================================================
// Pane Toolbar Component
// ============================================================================

interface PaneToolbarProps {
  paneId: string;
  onSplitHorizontal: () => void;
  onSplitVertical: () => void;
  onClose: () => void;
  showTunnelButton?: boolean;
  onOpenTunnels?: () => void;
}

function PaneToolbar({ onSplitHorizontal, onSplitVertical, onClose, showTunnelButton, onOpenTunnels }: PaneToolbarProps) {
  return (
    <div className="absolute top-1 right-1 z-10 flex items-center gap-0.5 bg-crust/80 backdrop-blur-sm rounded-md p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
      {/* Tunnel button for SSH sessions */}
      {showTunnelButton && onOpenTunnels && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenTunnels();
            }}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-blue/20 text-blue hover:text-blue transition-colors"
            title="Port Forwarding (Tunnels)"
          >
            <ArrowLeftRight size={14} />
          </button>
          {/* Separator */}
          <div className="w-px h-4 bg-surface-0/50 mx-0.5" />
        </>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onSplitVertical();
        }}
        className="w-6 h-6 flex items-center justify-center rounded hover:bg-surface-0/50 text-subtext-0 hover:text-text transition-colors"
        title="Split vertical (Ctrl+Shift+D)"
      >
        <Columns2 size={14} />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onSplitHorizontal();
        }}
        className="w-6 h-6 flex items-center justify-center rounded hover:bg-surface-0/50 text-subtext-0 hover:text-text transition-colors"
        title="Split horizontal (Ctrl+Shift+E)"
      >
        <Rows2 size={14} />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="w-6 h-6 flex items-center justify-center rounded hover:bg-red/20 text-subtext-0 hover:text-red transition-colors"
        title="Close pane (Ctrl+Shift+W)"
      >
        <X size={14} />
      </button>
    </div>
  );
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
  renderSftp,
  renderPending,
  focusedPaneId,
  onFocusPane,
  onClosePane,
  onSplitPane,
  depth = 0,
  sessionType,
  onOpenTunnels,
}: SplitPaneProps) {
  const isFocused = focusedPaneId === node.id;

  // Terminal node - render the terminal
  if (node.type === "terminal") {
    return (
      <div
        className={`
          w-full h-full relative group
          ${isFocused ? "ring-1 ring-blue/50 ring-inset" : ""}
        `}
        onClick={() => onFocusPane(node.id)}
      >
        {renderTerminal(node.id, node.ptySessionId, isFocused)}
        {onSplitPane && (
          <PaneToolbar
            paneId={node.id}
            onSplitHorizontal={() => onSplitPane(node.id, "horizontal")}
            onSplitVertical={() => onSplitPane(node.id, "vertical")}
            onClose={() => onClosePane(node.id)}
            showTunnelButton={sessionType === "ssh"}
            onOpenTunnels={onOpenTunnels}
          />
        )}
      </div>
    );
  }

  // SFTP node - render the SFTP browser
  if (node.type === "sftp") {
    return (
      <div
        className={`
          w-full h-full relative group
          ${isFocused ? "ring-1 ring-blue/50 ring-inset" : ""}
        `}
        onClick={() => onFocusPane(node.id)}
      >
        {renderSftp ? renderSftp(node.id, node.sessionId, node.initialPath) : <div className="w-full h-full bg-base" />}
        {onSplitPane && (
          <PaneToolbar
            paneId={node.id}
            onSplitHorizontal={() => onSplitPane(node.id, "horizontal")}
            onSplitVertical={() => onSplitPane(node.id, "vertical")}
            onClose={() => onClosePane(node.id)}
          />
        )}
      </div>
    );
  }

  // Pending node - render the picker
  if (node.type === "pending") {
    return (
      <div
        className={`
          w-full h-full relative group
          ${isFocused ? "ring-1 ring-blue/50 ring-inset" : ""}
        `}
        onClick={() => onFocusPane(node.id)}
      >
        {renderPending ? renderPending(node.id) : <div className="w-full h-full bg-base" />}
        {onSplitPane && (
          <PaneToolbar
            paneId={node.id}
            onSplitHorizontal={() => onSplitPane(node.id, "horizontal")}
            onSplitVertical={() => onSplitPane(node.id, "vertical")}
            onClose={() => onClosePane(node.id)}
          />
        )}
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
              renderSftp={renderSftp}
              renderPending={renderPending}
              focusedPaneId={focusedPaneId}
              onFocusPane={onFocusPane}
              onClosePane={onClosePane}
              onSplitPane={onSplitPane}
              depth={depth + 1}
              sessionType={sessionType}
              onOpenTunnels={onOpenTunnels}
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

/** Create a pending node (awaiting user selection) */
export function createPendingNode(): PaneNode {
  return {
    type: "pending",
    id: generatePaneId(),
  };
}

/** Create an SFTP node */
export function createSftpNode(sessionId: string, initialPath: string = "/"): PaneNode {
  return {
    type: "sftp",
    id: generatePaneId(),
    sessionId,
    initialPath,
  };
}

/** Split a pane with a new terminal */
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

/** Split a pane with a pending node (user will select connection type) */
export function splitPaneWithPending(
  root: PaneNode,
  targetPaneId: string,
  direction: "horizontal" | "vertical"
): { tree: PaneNode; pendingPaneId: string } {
  const pendingNode = createPendingNode();

  function doSplit(node: PaneNode): PaneNode {
    // If this is the target pane (terminal, sftp, or pending), split it
    if ((node.type === "terminal" || node.type === "sftp" || node.type === "pending") && node.id === targetPaneId) {
      return {
        type: "split",
        id: generatePaneId(),
        direction,
        children: [node, pendingNode],
        sizes: [50, 50],
      };
    }

    // If this is a split, recurse into children
    if (node.type === "split") {
      return {
        ...node,
        children: node.children.map((child) => doSplit(child)),
      };
    }

    return node;
  }

  return { tree: doSplit(root), pendingPaneId: pendingNode.id };
}

/** Replace a pending pane with a terminal */
export function replacePendingWithTerminal(
  root: PaneNode,
  pendingPaneId: string,
  ptySessionId: string
): PaneNode {
  // If this is the target pending pane, convert to terminal
  if (root.type === "pending" && root.id === pendingPaneId) {
    return {
      type: "terminal",
      id: root.id, // Keep the same ID for focus management
      ptySessionId,
    };
  }

  // If this is a split, recurse into children
  if (root.type === "split") {
    return {
      ...root,
      children: root.children.map((child) => replacePendingWithTerminal(child, pendingPaneId, ptySessionId)),
    };
  }

  return root;
}

/** Replace a pending pane with an SFTP browser */
export function replacePendingWithSftp(
  root: PaneNode,
  pendingPaneId: string,
  sessionId: string,
  initialPath: string = "/"
): PaneNode {
  // If this is the target pending pane, convert to SFTP
  if (root.type === "pending" && root.id === pendingPaneId) {
    return {
      type: "sftp",
      id: root.id, // Keep the same ID for focus management
      sessionId,
      initialPath,
    };
  }

  // If this is a split, recurse into children
  if (root.type === "split") {
    return {
      ...root,
      children: root.children.map((child) => replacePendingWithSftp(child, pendingPaneId, sessionId, initialPath)),
    };
  }

  return root;
}

/** Close a pane and clean up the tree */
export function closePane(root: PaneNode, targetPaneId: string): PaneNode | null {
  // Handle terminal pane
  if (root.type === "terminal") {
    return root.id === targetPaneId ? null : root;
  }

  // Handle SFTP pane
  if (root.type === "sftp") {
    return root.id === targetPaneId ? null : root;
  }

  // Handle pending pane
  if (root.type === "pending") {
    return root.id === targetPaneId ? null : root;
  }

  // Handle split pane - filter out the closed pane from children
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
  const totalSize = root.sizes.reduce((a: number, b: number) => a + b, 0);
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

  if (root.type === "pending" || root.type === "sftp") {
    return [];
  }

  return root.children.flatMap(getAllTerminalPaneIds);
}

/** Get all pty session IDs */
export function getAllPtySessionIds(root: PaneNode): string[] {
  if (root.type === "terminal") {
    return [root.ptySessionId];
  }

  if (root.type === "pending" || root.type === "sftp") {
    return [];
  }

  return root.children.flatMap(getAllPtySessionIds);
}

/** Get all pending pane IDs */
export function getAllPendingPaneIds(root: PaneNode): string[] {
  if (root.type === "pending") {
    return [root.id];
  }

  if (root.type === "terminal" || root.type === "sftp") {
    return [];
  }

  return root.children.flatMap(getAllPendingPaneIds);
}

/** Get all SFTP pane IDs */
export function getAllSftpPaneIds(root: PaneNode): string[] {
  if (root.type === "sftp") {
    return [root.id];
  }

  if (root.type === "terminal" || root.type === "pending") {
    return [];
  }

  return root.children.flatMap(getAllSftpPaneIds);
}

/** Get all SFTP session IDs */
export function getAllSftpSessionIds(root: PaneNode): string[] {
  if (root.type === "sftp") {
    return [root.sessionId];
  }

  if (root.type === "terminal" || root.type === "pending") {
    return [];
  }

  return root.children.flatMap(getAllSftpSessionIds);
}
