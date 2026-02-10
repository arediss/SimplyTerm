import { useState, useCallback, useMemo } from "react";
import type { WorkspaceNode, PaneGroup, PaneGroupTab } from "../types";
import {
  createGroup,
  createGroupNode,
  getAllGroupIds,
  splitGroupNode,
  closeGroupNode,
  resizeSplit,
} from "../utils/workspaceTree";
import { generateTabId } from "../utils";

interface WorkspaceState {
  tree: WorkspaceNode;
  groups: Map<string, PaneGroup>;
  focusedGroupId: string;
}

export interface WorkspaceActions {
  /** Add a tab to the currently focused group */
  addTabToFocusedGroup: (tab: Omit<PaneGroupTab, "id">) => PaneGroupTab;
  /** Add a tab to a specific group */
  addTabToGroup: (groupId: string, tab: Omit<PaneGroupTab, "id">) => PaneGroupTab;
  /** Close a tab by ID (searches all groups) */
  closeTab: (tabId: string) => PaneGroupTab | null;
  /** Select a tab within its group */
  selectTab: (groupId: string, tabId: string) => void;
  /** Split the focused group, creating a new empty group */
  splitFocusedGroup: (direction: "horizontal" | "vertical") => string;
  /** Close a group (all its tabs) */
  closeGroup: (groupId: string) => PaneGroupTab[];
  /** Focus a group */
  focusGroup: (groupId: string) => void;
  /** Open settings as a tab (reuse existing if found) */
  openSettings: () => void;
  /** Resize a split node */
  resizeSplitNode: (splitId: string, newSizes: number[]) => void;
  /** Rename a tab */
  renameTab: (tabId: string, newTitle: string) => void;
  /** Get all tabs across all groups */
  getAllTabs: () => PaneGroupTab[];
  /** Find which group contains a tab */
  findGroupForTab: (tabId: string) => string | null;
  /** Cycle tabs within focused group */
  cycleFocusedGroupTab: (direction: "next" | "prev") => void;
  /** Cycle focus between pane groups */
  cycleFocusedPaneGroup: (direction: "next" | "prev") => void;
}

export type UseWorkspaceReturn = WorkspaceState & WorkspaceActions;

export function useWorkspace(): UseWorkspaceReturn {
  const [state, setState] = useState<WorkspaceState>(() => {
    const initialGroup = createGroup();
    return {
      tree: createGroupNode(initialGroup.id),
      groups: new Map([[initialGroup.id, initialGroup]]),
      focusedGroupId: initialGroup.id,
    };
  });

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const updateGroup = useCallback(
    (groupId: string, updater: (g: PaneGroup) => PaneGroup) => {
      setState((prev) => {
        const group = prev.groups.get(groupId);
        if (!group) return prev;
        const newGroups = new Map(prev.groups);
        newGroups.set(groupId, updater(group));
        return { ...prev, groups: newGroups };
      });
    },
    []
  );

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const addTabToGroup = useCallback(
    (groupId: string, tabData: Omit<PaneGroupTab, "id">): PaneGroupTab => {
      const tab: PaneGroupTab = { ...tabData, id: generateTabId() };
      setState((prev) => {
        const group = prev.groups.get(groupId);
        if (!group) return prev;
        const newGroups = new Map(prev.groups);
        newGroups.set(groupId, {
          ...group,
          tabs: [...group.tabs, tab],
          activeTabId: tab.id,
        });
        return { ...prev, groups: newGroups, focusedGroupId: groupId };
      });
      return tab;
    },
    []
  );

  const addTabToFocusedGroup = useCallback(
    (tabData: Omit<PaneGroupTab, "id">): PaneGroupTab => {
      // Read focusedGroupId from current state synchronously
      let resultTab: PaneGroupTab = { ...tabData, id: generateTabId() };
      setState((prev) => {
        const group = prev.groups.get(prev.focusedGroupId);
        if (!group) return prev;
        resultTab = { ...tabData, id: resultTab.id };
        const newGroups = new Map(prev.groups);
        newGroups.set(prev.focusedGroupId, {
          ...group,
          tabs: [...group.tabs, resultTab],
          activeTabId: resultTab.id,
        });
        return { ...prev, groups: newGroups };
      });
      return resultTab;
    },
    []
  );

  const closeTab = useCallback((tabId: string): PaneGroupTab | null => {
    let closedTab: PaneGroupTab | null = null;

    setState((prev) => {
      // Find the group containing the tab
      let targetGroupId: string | null = null;
      for (const [gid, group] of prev.groups) {
        if (group.tabs.some((t) => t.id === tabId)) {
          targetGroupId = gid;
          break;
        }
      }
      if (!targetGroupId) return prev;

      const group = prev.groups.get(targetGroupId)!;
      closedTab = group.tabs.find((t) => t.id === tabId) || null;
      const newTabs = group.tabs.filter((t) => t.id !== tabId);

      // If the group is now empty, remove it from the tree
      if (newTabs.length === 0) {
        const allIds = getAllGroupIds(prev.tree);
        // Don't remove the last group
        if (allIds.length <= 1) {
          const newGroups = new Map(prev.groups);
          newGroups.set(targetGroupId, { ...group, tabs: [], activeTabId: null });
          return { ...prev, groups: newGroups };
        }

        const newTree = closeGroupNode(prev.tree, targetGroupId);
        const newGroups = new Map(prev.groups);
        newGroups.delete(targetGroupId);

        // Update focus if we removed the focused group
        const newFocusedGroupId =
          prev.focusedGroupId === targetGroupId
            ? getAllGroupIds(newTree!)[0]
            : prev.focusedGroupId;

        return {
          tree: newTree!,
          groups: newGroups,
          focusedGroupId: newFocusedGroupId,
        };
      }

      // Update active tab if needed
      const newActiveTabId =
        group.activeTabId === tabId
          ? newTabs[Math.min(newTabs.length - 1, group.tabs.findIndex((t) => t.id === tabId))].id
          : group.activeTabId;

      const newGroups = new Map(prev.groups);
      newGroups.set(targetGroupId, { ...group, tabs: newTabs, activeTabId: newActiveTabId });
      return { ...prev, groups: newGroups };
    });

    return closedTab;
  }, []);

  const selectTab = useCallback(
    (groupId: string, tabId: string) => {
      updateGroup(groupId, (g) => ({ ...g, activeTabId: tabId }));
      setState((prev) => ({ ...prev, focusedGroupId: groupId }));
    },
    [updateGroup]
  );

  const splitFocusedGroup = useCallback(
    (direction: "horizontal" | "vertical"): string => {
      let newGroupId = "";
      setState((prev) => {
        const newGroup = createGroup();
        newGroupId = newGroup.id;
        const newTree = splitGroupNode(prev.tree, prev.focusedGroupId, direction, newGroup);
        const newGroups = new Map(prev.groups);
        newGroups.set(newGroup.id, newGroup);
        return {
          tree: newTree,
          groups: newGroups,
          focusedGroupId: newGroup.id,
        };
      });
      return newGroupId;
    },
    []
  );

  const closeGroup = useCallback((groupId: string): PaneGroupTab[] => {
    let closedTabs: PaneGroupTab[] = [];

    setState((prev) => {
      const group = prev.groups.get(groupId);
      if (!group) return prev;
      closedTabs = [...group.tabs];

      const allIds = getAllGroupIds(prev.tree);
      // Don't remove the last group
      if (allIds.length <= 1) {
        const newGroups = new Map(prev.groups);
        newGroups.set(groupId, { ...group, tabs: [], activeTabId: null });
        return { ...prev, groups: newGroups };
      }

      const newTree = closeGroupNode(prev.tree, groupId);
      const newGroups = new Map(prev.groups);
      newGroups.delete(groupId);

      const newFocusedGroupId =
        prev.focusedGroupId === groupId
          ? getAllGroupIds(newTree!)[0]
          : prev.focusedGroupId;

      return {
        tree: newTree!,
        groups: newGroups,
        focusedGroupId: newFocusedGroupId,
      };
    });

    return closedTabs;
  }, []);

  const focusGroup = useCallback((groupId: string) => {
    setState((prev) => ({ ...prev, focusedGroupId: groupId }));
  }, []);

  const openSettings = useCallback(() => {
    setState((prev) => {
      // Search for existing settings tab in all groups
      for (const [gid, group] of prev.groups) {
        const settingsTab = group.tabs.find((t) => t.type === "settings");
        if (settingsTab) {
          // Focus the existing settings tab
          const newGroups = new Map(prev.groups);
          newGroups.set(gid, { ...group, activeTabId: settingsTab.id });
          return { ...prev, groups: newGroups, focusedGroupId: gid };
        }
      }

      // No existing settings tab — create one in focused group
      const group = prev.groups.get(prev.focusedGroupId);
      if (!group) return prev;

      const tab: PaneGroupTab = {
        id: generateTabId(),
        type: "settings",
        title: "Settings",
        sessionId: "settings",
      };

      const newGroups = new Map(prev.groups);
      newGroups.set(prev.focusedGroupId, {
        ...group,
        tabs: [...group.tabs, tab],
        activeTabId: tab.id,
      });
      return { ...prev, groups: newGroups };
    });
  }, []);

  const resizeSplitNode = useCallback((splitId: string, newSizes: number[]) => {
    setState((prev) => ({
      ...prev,
      tree: resizeSplit(prev.tree, splitId, newSizes),
    }));
  }, []);

  const renameTab = useCallback((tabId: string, newTitle: string) => {
    setState((prev) => {
      for (const [gid, group] of prev.groups) {
        const idx = group.tabs.findIndex((t) => t.id === tabId);
        if (idx >= 0) {
          const newTabs = [...group.tabs];
          newTabs[idx] = { ...newTabs[idx], title: newTitle };
          const newGroups = new Map(prev.groups);
          newGroups.set(gid, { ...group, tabs: newTabs });
          return { ...prev, groups: newGroups };
        }
      }
      return prev;
    });
  }, []);

  const getAllTabs = useCallback((): PaneGroupTab[] => {
    const tabs: PaneGroupTab[] = [];
    for (const group of state.groups.values()) {
      tabs.push(...group.tabs);
    }
    return tabs;
  }, [state.groups]);

  const findGroupForTab = useCallback(
    (tabId: string): string | null => {
      for (const [gid, group] of state.groups) {
        if (group.tabs.some((t) => t.id === tabId)) return gid;
      }
      return null;
    },
    [state.groups]
  );

  const cycleFocusedGroupTab = useCallback(
    (direction: "next" | "prev") => {
      setState((prev) => {
        const group = prev.groups.get(prev.focusedGroupId);
        if (!group || group.tabs.length <= 1) return prev;

        const currentIndex = group.tabs.findIndex((t) => t.id === group.activeTabId);
        let nextIndex: number;
        if (direction === "next") {
          nextIndex = (currentIndex + 1) % group.tabs.length;
        } else {
          nextIndex = currentIndex <= 0 ? group.tabs.length - 1 : currentIndex - 1;
        }

        const newGroups = new Map(prev.groups);
        newGroups.set(prev.focusedGroupId, {
          ...group,
          activeTabId: group.tabs[nextIndex].id,
        });
        return { ...prev, groups: newGroups };
      });
    },
    []
  );

  const cycleFocusedPaneGroup = useCallback(
    (direction: "next" | "prev") => {
      setState((prev) => {
        const allIds = getAllGroupIds(prev.tree);
        if (allIds.length <= 1) return prev;

        const currentIndex = allIds.indexOf(prev.focusedGroupId);
        let nextIndex: number;
        if (direction === "next") {
          nextIndex = (currentIndex + 1) % allIds.length;
        } else {
          nextIndex = currentIndex <= 0 ? allIds.length - 1 : currentIndex - 1;
        }

        return { ...prev, focusedGroupId: allIds[nextIndex] };
      });
    },
    []
  );

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  return useMemo(
    () => ({
      tree: state.tree,
      groups: state.groups,
      focusedGroupId: state.focusedGroupId,
      addTabToFocusedGroup,
      addTabToGroup,
      closeTab,
      selectTab,
      splitFocusedGroup,
      closeGroup,
      focusGroup,
      openSettings,
      resizeSplitNode,
      renameTab,
      getAllTabs,
      findGroupForTab,
      cycleFocusedGroupTab,
      cycleFocusedPaneGroup,
    }),
    [
      state.tree,
      state.groups,
      state.focusedGroupId,
      addTabToFocusedGroup,
      addTabToGroup,
      closeTab,
      selectTab,
      splitFocusedGroup,
      closeGroup,
      focusGroup,
      openSettings,
      resizeSplitNode,
      renameTab,
      getAllTabs,
      findGroupForTab,
      cycleFocusedGroupTab,
      cycleFocusedPaneGroup,
    ]
  );
}
