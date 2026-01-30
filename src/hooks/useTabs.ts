import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Tab } from "../types";
import {
  PaneNode,
  createTerminalNode,
  splitPaneWithPending,
  replacePendingWithTerminal,
  replacePendingWithSftp,
  closePane,
  getAllTerminalPaneIds,
  getAllPtySessionIds,
  getAllPendingPaneIds,
  getAllSftpPaneIds,
} from "../components/SplitPane";
import { pluginManager } from "../plugins";
import { generateSessionId, generateTabId } from "../utils";

export function useTabs() {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId) || null;

  // Create a new local terminal tab
  const createLocalTab = useCallback(() => {
    const ptySessionId = generateSessionId("pty");
    const paneTree = createTerminalNode(ptySessionId);

    const newTab: Tab = {
      id: generateTabId(),
      sessionId: ptySessionId,
      paneTree,
      title: "Local",
      type: "local",
      focusedPaneId: paneTree.id,
    };

    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);

    // Create PTY session
    invoke("create_pty_session", { sessionId: ptySessionId }).catch(console.error);

    return newTab;
  }, []);

  // Add an existing tab (for SSH, SFTP, etc.)
  const addTab = useCallback((tab: Tab) => {
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(tab.id);
  }, []);

  // Close a tab
  const closeTab = useCallback((tabId: string) => {
    setTabs((prev) => {
      const tabToClose = prev.find((t) => t.id === tabId);
      if (tabToClose) {
        // Close all PTY sessions in the pane tree
        const ptySessionIds = getAllPtySessionIds(tabToClose.paneTree);
        ptySessionIds.forEach((ptySessionId) => {
          invoke("close_pty_session", { sessionId: ptySessionId }).catch(console.error);
          pluginManager.notifySessionDisconnect(ptySessionId);
        });
      }

      const newTabs = prev.filter((t) => t.id !== tabId);
      return newTabs;
    });

    setActiveTabId((currentActiveId) => {
      if (currentActiveId === tabId) {
        const remainingTabs = tabs.filter((t) => t.id !== tabId);
        return remainingTabs.length > 0 ? remainingTabs[remainingTabs.length - 1].id : null;
      }
      return currentActiveId;
    });
  }, [tabs]);

  // Split a pane
  const splitPane = useCallback((direction: "horizontal" | "vertical", paneId?: string) => {
    setTabs((prev) => {
      const tab = prev.find((t) => t.id === activeTabId);
      if (!tab) return prev;

      const targetPaneId = paneId || tab.focusedPaneId;
      if (!targetPaneId) return prev;

      const { tree: newPaneTree, pendingPaneId } = splitPaneWithPending(
        tab.paneTree,
        targetPaneId,
        direction
      );

      return prev.map((t) =>
        t.id === activeTabId
          ? { ...t, paneTree: newPaneTree, focusedPaneId: pendingPaneId }
          : t
      );
    });
  }, [activeTabId]);

  // Close a pane
  const closePaneById = useCallback((paneId: string) => {
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab) return;

    // Count all leaf panes
    const terminalPaneIds = getAllTerminalPaneIds(tab.paneTree);
    const sftpPaneIds = getAllSftpPaneIds(tab.paneTree);
    const pendingPaneIds = getAllPendingPaneIds(tab.paneTree);
    const totalLeafPanes = terminalPaneIds.length + sftpPaneIds.length + pendingPaneIds.length;

    if (totalLeafPanes <= 1) {
      // Last pane - close the whole tab
      closeTab(activeTabId!);
      return;
    }

    const newPaneTree = closePane(tab.paneTree, paneId);
    if (!newPaneTree) {
      closeTab(activeTabId!);
      return;
    }

    // Close the PTY session for this pane
    const oldPtyIds = getAllPtySessionIds(tab.paneTree);
    const newPtyIds = getAllPtySessionIds(newPaneTree);
    const removedPtyIds = oldPtyIds.filter((id) => !newPtyIds.includes(id));
    removedPtyIds.forEach((ptyId) => {
      invoke("close_pty_session", { sessionId: ptyId }).catch(console.error);
      pluginManager.notifySessionDisconnect(ptyId);
    });

    // Update focus
    const remainingTerminalIds = getAllTerminalPaneIds(newPaneTree);
    const remainingSftpIds = getAllSftpPaneIds(newPaneTree);
    const remainingPendingIds = getAllPendingPaneIds(newPaneTree);
    const newFocusedPaneId =
      tab.focusedPaneId === paneId
        ? (remainingTerminalIds[0] || remainingSftpIds[0] || remainingPendingIds[0])
        : tab.focusedPaneId;

    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabId
          ? { ...t, paneTree: newPaneTree, focusedPaneId: newFocusedPaneId }
          : t
      )
    );
  }, [tabs, activeTabId, closeTab]);

  // Focus a pane
  const focusPane = useCallback((paneId: string) => {
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabId ? { ...t, focusedPaneId: paneId } : t
      )
    );
  }, [activeTabId]);

  // Update pane tree
  const updatePaneTree = useCallback((newTree: PaneNode) => {
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabId ? { ...t, paneTree: newTree } : t
      )
    );
  }, [activeTabId]);

  // Replace pending pane with local terminal
  const replacePendingWithLocal = useCallback((pendingPaneId: string) => {
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab) return null;

    const newPtySessionId = generateSessionId("pty");
    const newPaneTree = replacePendingWithTerminal(tab.paneTree, pendingPaneId, newPtySessionId);

    invoke("create_pty_session", { sessionId: newPtySessionId }).catch(console.error);

    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabId
          ? { ...t, paneTree: newPaneTree, focusedPaneId: pendingPaneId }
          : t
      )
    );

    return newPtySessionId;
  }, [tabs, activeTabId]);

  // Replace pending pane with SFTP browser
  const replacePendingWithSftpPane = useCallback((pendingPaneId: string, sftpSessionId: string) => {
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab) return;

    const newPaneTree = replacePendingWithSftp(tab.paneTree, pendingPaneId, sftpSessionId);

    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabId
          ? { ...t, paneTree: newPaneTree, focusedPaneId: pendingPaneId }
          : t
      )
    );
  }, [tabs, activeTabId]);

  // Replace pending pane with SSH terminal
  const replacePendingWithSsh = useCallback((pendingPaneId: string, ptySessionId: string) => {
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab) return;

    const newPaneTree = replacePendingWithTerminal(tab.paneTree, pendingPaneId, ptySessionId);

    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabId
          ? { ...t, paneTree: newPaneTree, focusedPaneId: pendingPaneId }
          : t
      )
    );
  }, [tabs, activeTabId]);

  return {
    tabs,
    activeTabId,
    activeTab,
    setActiveTabId,
    createLocalTab,
    addTab,
    closeTab,
    splitPane,
    closePaneById,
    focusPane,
    updatePaneTree,
    replacePendingWithLocal,
    replacePendingWithSftpPane,
    replacePendingWithSsh,
  };
}
