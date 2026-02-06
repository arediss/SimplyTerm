import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { SshKeyProfileInfo, SshKeyProfile } from "../types";

export function useSshKeys() {
  const [keys, setKeys] = useState<SshKeyProfileInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await invoke<SshKeyProfileInfo[]>("list_ssh_keys");
      setKeys(result);
    } catch {
      setKeys([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createKey = useCallback(
    async (
      name: string,
      keyPath: string,
      passphrase: string | null,
      requirePassphrasePrompt: boolean
    ): Promise<SshKeyProfileInfo> => {
      const result = await invoke<SshKeyProfileInfo>("create_ssh_key", {
        name,
        keyPath,
        passphrase,
        requirePassphrasePrompt,
      });
      await refresh();
      return result;
    },
    [refresh]
  );

  const updateKey = useCallback(
    async (
      id: string,
      name?: string,
      keyPath?: string,
      passphrase?: string,
      requirePassphrasePrompt?: boolean
    ): Promise<boolean> => {
      const result = await invoke<boolean>("update_ssh_key", {
        id,
        name: name ?? null,
        keyPath: keyPath ?? null,
        passphrase: passphrase ?? null,
        requirePassphrasePrompt: requirePassphrasePrompt ?? null,
      });
      await refresh();
      return result;
    },
    [refresh]
  );

  const deleteKey = useCallback(
    async (id: string): Promise<boolean> => {
      const result = await invoke<boolean>("delete_ssh_key", { id });
      await refresh();
      return result;
    },
    [refresh]
  );

  const getKeyCredentials = useCallback(
    async (id: string): Promise<SshKeyProfile | null> => {
      return invoke<SshKeyProfile | null>("get_ssh_key_credentials", { id });
    },
    []
  );

  return {
    keys,
    isLoading,
    refresh,
    createKey,
    updateKey,
    deleteKey,
    getKeyCredentials,
  };
}
