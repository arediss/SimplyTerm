import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { SavedSession, SessionFolder, RecentSession } from "../types";

export function useSessions() {
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>([]);
  const [folders, setFolders] = useState<SessionFolder[]>([]);
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);

  const loadSavedSessions = useCallback(async () => {
    try {
      const sessions = await invoke<SavedSession[]>("load_saved_sessions");
      setSavedSessions(sessions);
    } catch (err) {
      console.error("Failed to load saved sessions:", err);
    }
  }, []);

  const loadFolders = useCallback(async () => {
    try {
      const loadedFolders = await invoke<SessionFolder[]>("get_folders");
      setFolders(loadedFolders);
    } catch (err) {
      console.error("Failed to load folders:", err);
    }
  }, []);

  const loadRecentSessions = useCallback(async () => {
    try {
      const recent = await invoke<RecentSession[]>("get_recent_sessions");
      setRecentSessions(recent);
    } catch (err) {
      console.error("Failed to load recent sessions:", err);
    }
  }, []);

  // Load all on mount
  useEffect(() => {
    loadSavedSessions();
    loadFolders();
    loadRecentSessions();
  }, [loadSavedSessions, loadFolders, loadRecentSessions]);

  // Folder operations
  const createFolder = useCallback(async (name: string, color?: string, parentId?: string) => {
    try {
      await invoke("create_folder", { name, color, parentId });
      await loadFolders();
    } catch (err) {
      console.error("Failed to create folder:", err);
    }
  }, [loadFolders]);

  const updateFolder = useCallback(async (id: string, name?: string, color?: string, expanded?: boolean) => {
    try {
      await invoke("update_folder", { id, name, color, expanded });
      await loadFolders();
    } catch (err) {
      console.error("Failed to update folder:", err);
    }
  }, [loadFolders]);

  const deleteFolder = useCallback(async (id: string) => {
    try {
      await invoke("delete_folder", { id });
      await loadFolders();
      await loadSavedSessions();
    } catch (err) {
      console.error("Failed to delete folder:", err);
    }
  }, [loadFolders, loadSavedSessions]);

  const moveSessionToFolder = useCallback(async (sessionId: string, folderId: string | null) => {
    try {
      await invoke("update_session_folder", { sessionId, folderId });
      await loadSavedSessions();
    } catch (err) {
      console.error("Failed to move session:", err);
    }
  }, [loadSavedSessions]);

  // Session operations
  const deleteSavedSession = useCallback(async (sessionId: string) => {
    try {
      await invoke("delete_saved_session", { id: sessionId });
      await loadSavedSessions();
    } catch (err) {
      console.error("Failed to delete session:", err);
    }
  }, [loadSavedSessions]);

  const deleteRecentSession = useCallback(async (sessionId: string) => {
    try {
      await invoke("remove_from_recent", { id: sessionId });
      await loadRecentSessions();
    } catch (err) {
      console.error("Failed to delete recent session:", err);
    }
  }, [loadRecentSessions]);

  const clearRecentSessions = useCallback(async () => {
    try {
      await invoke("clear_recent");
      setRecentSessions([]);
    } catch (err) {
      console.error("Failed to clear recent sessions:", err);
    }
  }, []);

  const clearAllSavedSessions = useCallback(async (sessions: SavedSession[]) => {
    try {
      // Delete each session one by one
      for (const session of sessions) {
        await invoke("delete_saved_session", { id: session.id });
      }
      setSavedSessions([]);
      // Also clear recent
      await invoke("clear_recent");
      setRecentSessions([]);
    } catch (err) {
      console.error("Failed to clear all sessions:", err);
    }
  }, []);

  const addToRecentSessions = useCallback(async (session: {
    name: string;
    host: string;
    port: number;
    username: string;
    authType: "password" | "key";
    keyPath?: string;
  }) => {
    try {
      await invoke("add_to_recent", {
        name: session.name,
        host: session.host,
        port: session.port,
        username: session.username,
        authType: session.authType,
        keyPath: session.keyPath,
      });
      await loadRecentSessions();
    } catch (err) {
      console.error("Failed to add to recent sessions:", err);
    }
  }, [loadRecentSessions]);

  return {
    savedSessions,
    folders,
    recentSessions,
    loadSavedSessions,
    loadFolders,
    loadRecentSessions,
    createFolder,
    updateFolder,
    deleteFolder,
    moveSessionToFolder,
    deleteSavedSession,
    deleteRecentSession,
    clearRecentSessions,
    clearAllSavedSessions,
    addToRecentSessions,
  };
}
