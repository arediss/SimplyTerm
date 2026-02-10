/**
 * Core sessions hook
 *
 * Provides CRUD operations for saved sessions (connection info only).
 * Folder/tag/recent functionality is now handled by plugins via sessionMetadata API.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { SavedSession } from "../types";

export function useSessions() {
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>([]);
  const isMountedRef = useRef(true);

  const loadSavedSessions = useCallback(async () => {
    try {
      const sessions = await invoke<SavedSession[]>("load_saved_sessions");
      if (isMountedRef.current) {
        setSavedSessions(sessions);
      }
    } catch (err) {
      if (isMountedRef.current) {
        console.error("Failed to load saved sessions:", err);
      }
    }
  }, []);

  // Load on mount
  useEffect(() => {
    isMountedRef.current = true;
    void loadSavedSessions();
    return () => {
      isMountedRef.current = false;
    };
  }, [loadSavedSessions]);

  const deleteSavedSession = useCallback(async (sessionId: string) => {
    try {
      await invoke("delete_saved_session", { id: sessionId });
      await loadSavedSessions();
    } catch (err) {
      console.error("Failed to delete session:", err);
    }
  }, [loadSavedSessions]);

  const clearAllSavedSessions = useCallback(async () => {
    try {
      for (const session of savedSessions) {
        await invoke("delete_saved_session", { id: session.id });
      }
      setSavedSessions([]);
    } catch (err) {
      console.error("Failed to clear all sessions:", err);
    }
  }, [savedSessions]);

  return {
    savedSessions,
    loadSavedSessions,
    deleteSavedSession,
    clearAllSavedSessions,
  };
}
