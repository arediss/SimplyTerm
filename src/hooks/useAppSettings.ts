import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AppSettings, defaultSettings } from "../types/settings";

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  // Load settings on mount
  useEffect(() => {
    let active = true;
    const loadSettings = async () => {
      try {
        const loaded = await invoke<AppSettings>("load_settings");
        if (active) {
          setSettings(loaded);
        }
      } catch (err) {
        if (active) {
          console.error("Failed to load settings:", err);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };
    loadSettings();
    return () => {
      active = false;
    };
  }, []);

  const updateSettings = useCallback(async (newSettings: AppSettings) => {
    setSettings(newSettings);
    try {
      await invoke("save_settings", { settings: newSettings });
    } catch (err) {
      console.error("Failed to save settings:", err);
    }
  }, []);

  return {
    settings,
    isLoading,
    updateSettings,
  };
}
