import type { WorkspaceNode, PaneGroup, PaneGroupTab } from "../types/workspace";

// ============================================================================
// ID Generation
// ============================================================================

let counter = 0;

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${++counter}`;
}

export function generateGroupId(): string {
  return uid("grp");
}

export function generateTabId(): string {
  return uid("tab");
}

function generateSplitId(): string {
  return uid("split");
}

// ============================================================================
// Group Creation
// ============================================================================

/** Create a new empty PaneGroup */
export function createGroup(initialTab?: PaneGroupTab): PaneGroup {
  const id = generateGroupId();
  return {
    id,
    tabs: initialTab ? [initialTab] : [],
    activeTabId: initialTab?.id ?? null,
  };
}

/** Create a WorkspaceNode leaf pointing to a group */
export function createGroupNode(groupId: string): WorkspaceNode {
  return { type: "group", id: groupId };
}

// ============================================================================
// Tree Queries
// ============================================================================

/** Get all group IDs from the workspace tree */
export function getAllGroupIds(node: WorkspaceNode): string[] {
  if (node.type === "group") return [node.id];
  return node.children.flatMap(getAllGroupIds);
}

/** Find the WorkspaceNode for a given group ID */
export function findGroupNode(node: WorkspaceNode, groupId: string): WorkspaceNode | null {
  if (node.type === "group") return node.id === groupId ? node : null;
  for (const child of node.children) {
    const found = findGroupNode(child, groupId);
    if (found) return found;
  }
  return null;
}

// ============================================================================
// Tree Mutations (immutable — return new trees)
// ============================================================================

/**
 * Split a group node into two: the original group + a new empty group.
 * Returns the new tree and the new group.
 */
export function splitGroupNode(
  tree: WorkspaceNode,
  targetGroupId: string,
  direction: "horizontal" | "vertical",
  newGroup: PaneGroup
): WorkspaceNode {
  if (tree.type === "group") {
    if (tree.id === targetGroupId) {
      return {
        type: "split",
        id: generateSplitId(),
        direction,
        children: [tree, createGroupNode(newGroup.id)],
        sizes: [50, 50],
      };
    }
    return tree;
  }

  // Recurse into split children
  return {
    ...tree,
    children: tree.children.map((child) =>
      splitGroupNode(child, targetGroupId, direction, newGroup)
    ),
  };
}

/**
 * Remove a group from the tree.
 * If the parent split ends up with a single child, collapse it.
 */
export function closeGroupNode(tree: WorkspaceNode, targetGroupId: string): WorkspaceNode | null {
  if (tree.type === "group") {
    return tree.id === targetGroupId ? null : tree;
  }

  const newChildren = tree.children
    .map((child) => closeGroupNode(child, targetGroupId))
    .filter((child): child is WorkspaceNode => child !== null);

  if (newChildren.length === 0) return null;
  if (newChildren.length === 1) return newChildren[0];

  // Redistribute sizes evenly
  const newSizes = newChildren.map(() => 100 / newChildren.length);

  return { ...tree, children: newChildren, sizes: newSizes };
}

/**
 * Resize a split node's children by index.
 */
export function resizeSplit(
  tree: WorkspaceNode,
  splitId: string,
  newSizes: number[]
): WorkspaceNode {
  if (tree.type === "group") return tree;

  if (tree.id === splitId) {
    return { ...tree, sizes: newSizes };
  }

  return {
    ...tree,
    children: tree.children.map((child) => resizeSplit(child, splitId, newSizes)),
  };
}
