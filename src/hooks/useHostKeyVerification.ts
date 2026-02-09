import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { HostKeyCheckResult } from "../components/HostKeyModal";

/** Result returned by `create_ssh_session` (matches Rust SshConnectionResult) */
export type SshConnectionResult =
  | { type: "Connected" }
  | { type: "HostKeyCheck"; cache_id: string } & HostKeyCheckResult;

export interface HostKeyVerification {
  hostKeyResult: HostKeyCheckResult | null;
  isHostKeyModalOpen: boolean;
  hostKeyLoading: boolean;
  /** For SSH sessions — handles the SshConnectionResult from create_ssh_session */
  handleSshConnectionResult: (
    result: SshConnectionResult,
    onConnected: () => void,
    sessionId: string,
  ) => void;
  /** For SFTP/tunnel — standalone host key check (separate connection) */
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
  // For SSH single-connection flow
  const [pendingCacheId, setPendingCacheId] = useState<string | null>(null);
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const [pendingOnConnected, setPendingOnConnected] = useState<(() => void) | null>(null);
  // For SFTP/tunnel standalone flow
  const [pendingHostKeyAction, setPendingHostKeyAction] = useState<(() => Promise<void>) | null>(null);
  const [connectionError, setConnectionError] = useState<string | undefined>();

  // --- SSH sessions: new single-connection flow ---
  const handleSshConnectionResult = useCallback((
    result: SshConnectionResult,
    onConnected: () => void,
    sessionId: string,
  ) => {
    if (result.type === "Connected") {
      onConnected();
    } else {
      setHostKeyResult({
        status: result.status,
        host: result.host,
        port: result.port,
        key_type: result.key_type,
        fingerprint: result.fingerprint,
        expected_fingerprint: result.expected_fingerprint,
        message: result.message,
      });
      setPendingCacheId(result.cache_id);
      setPendingSessionId(sessionId);
      setPendingOnConnected(() => onConnected);
      setIsHostKeyModalOpen(true);
    }
  }, []);

  // --- SFTP/tunnel: standalone check (uses separate check_host_key command) ---
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

  // --- Accept handler: works for both flows ---
  const handleHostKeyAccept = useCallback(async () => {
    if (!hostKeyResult) return;

    setHostKeyLoading(true);
    try {
      const { host, port, status } = hostKeyResult;

      // Save the key to known_hosts
      if (status === "unknown") {
        await invoke("trust_host_key", { host, port });
      } else if (status === "mismatch") {
        await invoke("update_host_key", { host, port });
      }

      if (pendingCacheId && pendingSessionId) {
        // SSH flow: finalize the cached connection (auth + PTY on same TCP session)
        await invoke("finalize_ssh_session", {
          cacheId: pendingCacheId,
          sessionId: pendingSessionId,
        });
        setIsHostKeyModalOpen(false);
        setHostKeyResult(null);
        if (pendingOnConnected) pendingOnConnected();
      } else if (pendingHostKeyAction) {
        // SFTP/tunnel flow: just run the pending action
        setIsHostKeyModalOpen(false);
        setHostKeyResult(null);
        await pendingHostKeyAction();
      }
    } catch (error) {
      setConnectionError(`Failed to finalize connection: ${error}`);
    } finally {
      setHostKeyLoading(false);
      setPendingCacheId(null);
      setPendingSessionId(null);
      setPendingOnConnected(null);
      setPendingHostKeyAction(null);
    }
  }, [hostKeyResult, pendingCacheId, pendingSessionId, pendingOnConnected, pendingHostKeyAction]);

  // --- Reject handler: works for both flows ---
  const handleHostKeyReject = useCallback(async () => {
    if (pendingCacheId) {
      try {
        await invoke("abort_ssh_connection", { cacheId: pendingCacheId });
      } catch {
        // Ignore
      }
    }
    if (hostKeyResult) {
      try {
        await invoke("reject_host_key", { host: hostKeyResult.host, port: hostKeyResult.port });
      } catch {
        // Ignore
      }
    }
    setIsHostKeyModalOpen(false);
    setHostKeyResult(null);
    setPendingCacheId(null);
    setPendingSessionId(null);
    setPendingOnConnected(null);
    setPendingHostKeyAction(null);
    setConnectionError("Connection cancelled: host key not trusted");
  }, [hostKeyResult, pendingCacheId]);

  return {
    hostKeyResult,
    isHostKeyModalOpen,
    hostKeyLoading,
    handleSshConnectionResult,
    checkHostKeyBeforeConnect,
    handleHostKeyAccept,
    handleHostKeyReject,
    setConnectionError,
    connectionError,
  };
}
