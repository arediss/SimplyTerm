import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { HostKeyCheckResult } from "../components/HostKeyModal";

export interface HostKeyVerification {
  hostKeyResult: HostKeyCheckResult | null;
  isHostKeyModalOpen: boolean;
  hostKeyLoading: boolean;
  checkHostKeyBeforeConnect: (
    host: string,
    port: number,
    onTrusted: () => Promise<void>
  ) => Promise<boolean>;
  handleHostKeyAccept: () => Promise<void>;
  handleHostKeyReject: () => Promise<void>;
  setConnectionError: (error: string | undefined) => void;
  connectionError: string | undefined;
}

export function useHostKeyVerification(): HostKeyVerification {
  const [hostKeyResult, setHostKeyResult] = useState<HostKeyCheckResult | null>(null);
  const [isHostKeyModalOpen, setIsHostKeyModalOpen] = useState(false);
  const [hostKeyLoading, setHostKeyLoading] = useState(false);
  const [pendingHostKeyAction, setPendingHostKeyAction] = useState<(() => Promise<void>) | null>(null);
  const [connectionError, setConnectionError] = useState<string | undefined>();

  const checkHostKeyBeforeConnect = useCallback(async (
    host: string,
    port: number,
    onTrusted: () => Promise<void>
  ): Promise<boolean> => {
    try {
      const result = await invoke<HostKeyCheckResult>("check_host_key", { host, port });

      if (result.status === "trusted") {
        await onTrusted();
        return true;
      } else if (result.status === "unknown" || result.status === "mismatch") {
        setHostKeyResult(result);
        setPendingHostKeyAction(() => onTrusted);
        setIsHostKeyModalOpen(true);
        return false;
      } else {
        setConnectionError(result.message || "Failed to check host key");
        return false;
      }
    } catch (error) {
      setConnectionError(`Host key check failed: ${error}`);
      return false;
    }
  }, []);

  const handleHostKeyAccept = useCallback(async () => {
    if (!hostKeyResult || !pendingHostKeyAction) return;

    setHostKeyLoading(true);
    try {
      const { host, port, status } = hostKeyResult;

      if (status === "unknown") {
        await invoke("trust_host_key", { host, port });
      } else if (status === "mismatch") {
        await invoke("update_host_key", { host, port });
      }

      setIsHostKeyModalOpen(false);
      setHostKeyResult(null);

      await pendingHostKeyAction();
    } catch (error) {
      setConnectionError(`Failed to save host key: ${error}`);
    } finally {
      setHostKeyLoading(false);
      setPendingHostKeyAction(null);
    }
  }, [hostKeyResult, pendingHostKeyAction]);

  const handleHostKeyReject = useCallback(async () => {
    if (hostKeyResult) {
      try {
        await invoke("reject_host_key", { host: hostKeyResult.host, port: hostKeyResult.port });
      } catch {
        // Ignore errors on rejection
      }
    }
    setIsHostKeyModalOpen(false);
    setHostKeyResult(null);
    setPendingHostKeyAction(null);
    setConnectionError("Connection cancelled: host key not trusted");
  }, [hostKeyResult]);

  return {
    hostKeyResult,
    isHostKeyModalOpen,
    hostKeyLoading,
    checkHostKeyBeforeConnect,
    handleHostKeyAccept,
    handleHostKeyReject,
    setConnectionError,
    connectionError,
  };
}
