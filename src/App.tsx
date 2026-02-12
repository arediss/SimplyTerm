import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import Sidebar from "./components/Sidebar";
import HeaderBar from "./components/HeaderBar";
import TerminalPane from "./components/TerminalPane";
import Modal from "./components/Modal";
import { SshConnectionConfig } from "./types";
import { CommandPalette, useCommandPalette, CommandHandlers, CommandContext } from "./components/CommandPalette";
import { StatusBar, type StatusBarItem } from "./components/StatusBar";
import { pluginManager, type SessionInfo, type ModalConfig, type NotificationType, type PromptConfig, type HeaderActionItem } from "./plugins";
const PluginHost = lazy(() => import("./plugins/PluginHost").then(m => ({ default: m.PluginHost })));
// plugin-updater is lazy-imported in the auto-check useEffect below
const SftpBrowser = lazy(() => import("./components/SftpBrowser").then(m => ({ default: m.SftpBrowser })));
const TunnelManager = lazy(() => import("./components/TunnelManager"));
const TunnelSidebar = lazy(() => import("./components/TunnelSidebar"));
import { WorkspaceSplit } from "./components/WorkspaceSplit";
import { WorkspaceActionsContext, type WorkspaceActions } from "./components/PaneGroup";
import EmptyPaneSessions from "./components/EmptyPaneSessions";

// Lazy-loaded modals and settings (only shown on user action)
const HostKeyModal = lazy(() => import("./components/HostKeyModal"));
const NewConnectionModal = lazy(() => import("./components/NewConnectionModal"));
const PromptModal = lazy(() => import("./components/PromptModal"));
const PassphrasePromptModal = lazy(() => import("./components/PassphrasePromptModal"));
const PluginModal = lazy(() => import("./components/PluginModal"));
const SettingsTab = lazy(() => import("./components/Settings/SettingsTab"));
const VaultSetupModal = lazy(() => import("./components/Vault/VaultSetupModal"));
const VaultUnlockModal = lazy(() => import("./components/Vault/VaultUnlockModal"));
import { useSessions, useAppSettings, useVaultFlow, useHostKeyVerification, useWorkspace } from "./hooks";
import type { SshConnectionResult } from "./hooks";
import { SavedSession, TelnetConnectionConfig, SerialConnectionConfig, SshKeyProfile, ConnectionType, type PaneGroupTab } from "./types";
import { generateSessionId, expandHomeDir, isModifierPressed } from "./utils";
import { applyTheme } from "./themes";

const noop = () => {};

interface ShortcutEntry {
  mod?: boolean;
  ctrl?: boolean;
  shift: boolean;
  skipInput?: boolean;
  action: () => void;
}

function matchesShortcut(entry: ShortcutEntry, mod: boolean, e: KeyboardEvent, isInput: boolean): boolean {
  if (entry.mod && !mod) return false;
  if (entry.ctrl && !e.ctrlKey) return false;
  if (entry.shift !== e.shiftKey) return false;
  if (entry.skipInput && isInput) return false;
  return true;
}

function getConnectionModalTitle(
  editingSessionId: string | null,
  pendingSftpSession: unknown,
  t: (key: string) => string,
): string | undefined {
  if (editingSessionId) return t('app.editConnection');
  if (pendingSftpSession) return t('app.sftpConnection');
  return undefined;
}

function App() {
  const { t } = useTranslation();

  // ============================================================================
  // Workspace (replaces old tabs/activeTabId state)
  // ============================================================================
  const workspace = useWorkspace();

  // Use extracted hooks
  const {
    savedSessions,
    loadSavedSessions,
    deleteSavedSession: handleDeleteSavedSession,
    clearAllSavedSessions,
  } = useSessions();

  const {
    settings: appSettings,
    updateSettings: handleSettingsChange,
  } = useAppSettings();

  const {
    vault,
    showVaultSetup,
    showVaultUnlock,
    handleVaultSetupSkip,
    handleVaultSetup,
    closeVaultSetup,
    closeVaultUnlock,
    openVaultUnlock,
    lockVault,
  } = useVaultFlow();

  // Apply theme and window blur effect together (blur must be set before theme)
  useEffect(() => {
    const effect = appSettings.appearance?.windowEffect ?? "none";
    const hasBlur = effect !== "none";

    document.documentElement.dataset.blur = hasBlur ? "true" : "false";

    const themeId = appSettings.appearance?.theme ?? "dark";
    applyTheme(themeId);

    invoke("set_window_effect", { effect }).catch((err) => {
      console.warn(`Failed to apply window effect "${effect}":`, err);
    });
  }, [appSettings.appearance?.theme, appSettings.appearance?.windowEffect]);

  // Sidebar state
  const [openSidebar, setOpenSidebar] = useState<"none" | "menu" | "tunnel">("none");
  const sidebarPinned = appSettings.ui?.sidebarPinned ?? false;
  const isSidebarOpen = sidebarPinned || openSidebar === "menu";
  const isTunnelSidebarOpen = openSidebar === "tunnel";

  const handleToggleSidebarPin = useCallback(() => {
    const newPinned = !sidebarPinned;
    handleSettingsChange({
      ...appSettings,
      ui: { ...appSettings.ui, sidebarPinned: newPinned },
    });
    // When pinning, ensure sidebar is shown; when unpinning, close overlay
    if (!newPinned) {
      setOpenSidebar("none");
    }
  }, [sidebarPinned, appSettings, handleSettingsChange]);

  // Host key verification
  const {
    hostKeyResult,
    isHostKeyModalOpen,
    hostKeyLoading,
    handleSshConnectionResult,
    checkHostKeyBeforeConnect,
    handleHostKeyAccept,
    handleHostKeyReject,
    setConnectionError,
    connectionError,
  } = useHostKeyVerification();

  // Modal state
  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [initialConnectionConfig, setInitialConnectionConfig] = useState<Partial<SshConnectionConfig> | null>(null);
  const [initialTelnetConfig, setInitialTelnetConfig] = useState<Partial<TelnetConnectionConfig> | null>(null);
  const [initialSerialConfig, setInitialSerialConfig] = useState<Partial<SerialConnectionConfig> | null>(null);
  const [connectionType, setConnectionType] = useState<ConnectionType>("ssh");

  // Save session modal state
  const [pendingSaveConfig, setPendingSaveConfig] = useState<SshConnectionConfig | null>(null);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);

  // Edit/connecting session state
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [connectingSessionId, setConnectingSessionId] = useState<string | null>(null);
  const [pendingSftpSession, setPendingSftpSession] = useState<SavedSession | null>(null);

  // Tunnel count for badge
  const [activeTunnelCount, setActiveTunnelCount] = useState(0);

  // Notification state (for plugins)
  const [notification, setNotification] = useState<{ message: string; type: NotificationType } | null>(null);

  // Prompt modal state (for plugins)
  const [promptModal, setPromptModal] = useState<{
    config: PromptConfig;
    resolve: (value: string | null) => void;
  } | null>(null);

  // Passphrase prompt state (for SSH key management)
  const [passphrasePrompt, setPassphrasePrompt] = useState<{
    keyName: string;
    resolve: (value: string | null) => void;
  } | null>(null);

  // Plugin modal state
  const [pluginModal, setPluginModal] = useState<{
    config: ModalConfig;
    resolve: (value: string | null) => void;
  } | null>(null);

  // ============================================================================
  // Tab creation helpers (workspace.addTabToFocusedGroup)
  // ============================================================================

  const handleNewLocalTab = useCallback(() => {
    const ptySessionId = generateSessionId("pty");
    workspace.addTabToFocusedGroup({
      type: "local",
      title: "Terminal",
      sessionId: "local",
      ptySessionId,
    });
    setOpenSidebar("none");
  }, [workspace]);

  // Prompt for passphrase (returns a promise)
  const promptForPassphrase = (keyName: string): Promise<string | null> => {
    return new Promise((resolve) => {
      setPassphrasePrompt({ keyName, resolve });
    });
  };

  // Resolve SSH key credentials from vault, prompting for passphrase if needed
  const resolveSshKey = async (sshKeyId: string): Promise<{ keyPath: string; passphrase: string | null } | null> => {
    try {
      const keyProfile = await invoke<SshKeyProfile | null>("get_ssh_key_credentials", { id: sshKeyId });
      if (!keyProfile) return null;

      let passphrase: string | null = keyProfile.passphrase || null;
      if (keyProfile.require_passphrase_prompt) {
        passphrase = await promptForPassphrase(keyProfile.name);
        if (passphrase === null) return null;
      }

      return { keyPath: keyProfile.key_path, passphrase };
    } catch (err) {
      console.error("Failed to resolve SSH key:", err);
      return null;
    }
  };

  // Helper: resolve SSH keys, register session, and open tab
  const registerSshAndOpenTab = async (
    saved: SavedSession,
    credentials: { password: string | null; key_passphrase: string | null },
    tabType: "sftp" | "tunnel",
    titlePrefix: string,
  ) => {
    const sessionId = generateSessionId(tabType);

    let keyPath: string | null = null;
    let keyPassphrase: string | null = null;

    if (saved.ssh_key_id && saved.auth_type === "key") {
      const resolved = await resolveSshKey(saved.ssh_key_id);
      if (!resolved) return;
      keyPath = (await expandHomeDir(resolved.keyPath)) || null;
      keyPassphrase = resolved.passphrase;
    } else if (saved.auth_type === "key") {
      keyPath = (await expandHomeDir(saved.key_path)) || null;
      keyPassphrase = credentials.key_passphrase;
    }

    await invoke("register_sftp_session", {
      sessionId,
      host: saved.host,
      port: saved.port,
      username: saved.username,
      password: saved.auth_type === "password" ? credentials.password : null,
      keyPath,
      keyPassphrase,
    });

    workspace.addTabToFocusedGroup({
      type: tabType,
      title: `${titlePrefix} - ${saved.name}`,
      sessionId,
      sshConfig: {
        name: saved.name,
        host: saved.host,
        port: saved.port,
        username: saved.username,
        authType: saved.auth_type,
        keyPath: saved.key_path,
      },
    });
  };

  // ============================================================================
  // Connection handlers
  // ============================================================================

  // Open SFTP tab for a saved session
  const handleOpenSftpTab = async (saved: SavedSession) => {
    setOpenSidebar("none");

    const openSftpConnectionForm = () => {
      setPendingSftpSession(saved);
      setInitialConnectionConfig({
        name: saved.name,
        host: saved.host,
        port: saved.port,
        username: saved.username,
        authType: saved.auth_type,
        keyPath: saved.key_path,
        sshKeyId: saved.ssh_key_id,
      });
      setConnectionError(t('app.enterPasswordSftp'));
      setIsConnectionModalOpen(true);
    };

    try {
      let credentials: { password: string | null; key_passphrase: string | null };
      try {
        credentials = await invoke<{ password: string | null; key_passphrase: string | null }>(
          "get_session_credentials",
          { id: saved.id }
        );
      } catch {
        openSftpConnectionForm();
        return;
      }

      const needsPassword = saved.auth_type === "password" && !credentials.password;
      if (needsPassword) {
        openSftpConnectionForm();
        return;
      }

      await checkHostKeyBeforeConnect(saved.host, saved.port, () =>
        registerSshAndOpenTab(saved, credentials, "sftp", "SFTP")
      );
    } catch (error) {
      console.error("Failed to open SFTP tab:", error);
    }
  };

  // Open Tunnel-only tab for a saved session
  const handleOpenTunnelTab = async (saved: SavedSession) => {
    setOpenSidebar("none");

    try {
      let credentials: { password: string | null; key_passphrase: string | null };
      try {
        credentials = await invoke<{ password: string | null; key_passphrase: string | null }>(
          "get_session_credentials",
          { id: saved.id }
        );
      } catch {
        return;
      }

      const needsPassword = saved.auth_type === "password" && !credentials.password;
      if (needsPassword) return;

      await checkHostKeyBeforeConnect(saved.host, saved.port, () =>
        registerSshAndOpenTab(saved, credentials, "tunnel", "Tunnels")
      );
    } catch (error) {
      console.error("Failed to open Tunnel tab:", error);
    }
  };

  const handleSftpConnectFromPending = async (config: SshConnectionConfig) => {
    const saved = pendingSftpSession!;
    setPendingSftpSession(null);

    try {
      const sessionId = generateSessionId("sftp");
      const keyPath = await expandHomeDir(config.keyPath);

      await invoke("register_sftp_session", {
        sessionId,
        host: config.host,
        port: config.port,
        username: config.username,
        password: config.authType === "password" ? config.password : null,
        keyPath: config.authType === "key" ? keyPath : null,
        keyPassphrase: config.authType === "key" ? config.keyPassphrase : null,
      });

      workspace.addTabToFocusedGroup({
        type: "sftp",
        title: `SFTP - ${saved.name}`,
        sessionId,
        sshConfig: config,
      });

      setIsConnectionModalOpen(false);
      setOpenSidebar("none");
      setIsConnecting(false);
      setInitialConnectionConfig(null);

      try {
        await invoke("save_session", {
          id: saved.id,
          name: config.name,
          host: config.host,
          port: config.port,
          username: config.username,
          authType: config.authType,
          keyPath: config.keyPath,
          password: config.password,
          keyPassphrase: config.keyPassphrase,
          sshKeyId: config.sshKeyId || null,
        });
        await loadSavedSessions();
      } catch (err) {
        console.error("[SFTP] Failed to save credentials:", err);
      }
    } catch (error) {
      console.error("Failed to open SFTP:", error);
      setConnectionError(t('app.sftpError', { error }));
      setIsConnecting(false);
    }
  };

  const buildJumpHostParams = (config: SshConnectionConfig, jumpKeyPath: string | undefined) => {
    if (!config.useJumpHost) {
      return { jumpHost: null, jumpPort: null, jumpUsername: null, jumpPassword: null, jumpKeyPath: null, jumpKeyPassphrase: null };
    }
    return {
      jumpHost: config.jumpHost,
      jumpPort: config.jumpPort,
      jumpUsername: config.jumpUsername || config.username,
      jumpPassword: config.jumpAuthType === "password" ? config.jumpPassword : null,
      jumpKeyPath: config.jumpAuthType === "key" ? jumpKeyPath : null,
      jumpKeyPassphrase: config.jumpAuthType === "key" ? config.jumpKeyPassphrase : null,
    };
  };

  const saveSessionAfterConnect = (config: SshConnectionConfig) => {
    if (editingSessionId) {
      (async () => {
        try {
          await invoke("save_session", {
            id: editingSessionId,
            name: config.name,
            host: config.host,
            port: config.port,
            username: config.username,
            authType: config.authType,
            keyPath: config.keyPath,
            password: config.password,
            keyPassphrase: config.keyPassphrase,
            sshKeyId: config.sshKeyId || null,
          });
          await loadSavedSessions();
        } catch (err) {
          console.error("[SavedSession] Failed to save credentials:", err);
        }
      })();
      setEditingSessionId(null);
    } else {
      const isAlreadySaved = savedSessions.some(
        (s) => s.host === config.host && s.username === config.username && s.port === config.port
      );
      if (!isAlreadySaved) {
        setPendingSaveConfig(config);
        setIsSaveModalOpen(true);
      }
    }
  };

  const handleSshConnect = async (config: SshConnectionConfig) => {
    setIsConnecting(true);
    setConnectionError(undefined);

    if (pendingSftpSession) {
      await handleSftpConnectFromPending(config);
      return;
    }

    const ptySessionId = generateSessionId("ssh");

    try {
      let resolvedKeyPath = config.keyPath;
      let resolvedKeyPassphrase = config.keyPassphrase;

      if (config.sshKeyId) {
        const resolved = await resolveSshKey(config.sshKeyId);
        if (!resolved) {
          setIsConnecting(false);
          return;
        }
        resolvedKeyPath = resolved.keyPath;
        resolvedKeyPassphrase = resolved.passphrase || undefined;
      }

      const keyPath = await expandHomeDir(resolvedKeyPath);
      const jumpKeyPath = config.useJumpHost ? await expandHomeDir(config.jumpKeyPath) : undefined;

      const result = await invoke<SshConnectionResult>("create_ssh_session", {
        sessionId: ptySessionId,
        host: config.host,
        port: config.port,
        username: config.username,
        password: config.password,
        keyPath,
        keyPassphrase: resolvedKeyPassphrase,
        ...buildJumpHostParams(config, jumpKeyPath),
      });

      const onConnected = () => {
        workspace.addTabToFocusedGroup({
          type: "ssh",
          title: config.name,
          sessionId: `ssh-${config.host}`,
          ptySessionId,
          sshConfig: config,
        });

        setIsConnectionModalOpen(false);
        setOpenSidebar("none");
        setIsConnecting(false);

        pluginManager.notifySessionConnect({
          id: ptySessionId,
          type: 'ssh',
          host: config.host,
          port: config.port,
          username: config.username,
          status: 'connected',
        });

        saveSessionAfterConnect(config);
      };

      handleSshConnectionResult(result, onConnected, ptySessionId);
    } catch (error) {
      console.error("SSH connection failed:", error);
      setConnectionError(String(error));
      setIsConnecting(false);
    }
  };

  const handleTelnetConnect = async (config: TelnetConnectionConfig) => {
    setIsConnecting(true);
    setConnectionError(undefined);

    const ptySessionId = generateSessionId("telnet");

    try {
      await invoke("create_telnet_session", {
        sessionId: ptySessionId,
        host: config.host,
        port: config.port,
      });

      workspace.addTabToFocusedGroup({
        type: "telnet",
        title: config.name,
        sessionId: `telnet-${config.host}`,
        ptySessionId,
        telnetConfig: config,
      });

      setIsConnectionModalOpen(false);
      setOpenSidebar("none");
      setIsConnecting(false);

      pluginManager.notifySessionConnect({
        id: ptySessionId,
        type: "ssh",
        host: config.host,
        port: config.port,
        status: "connected",
      });
    } catch (error) {
      console.error("Telnet connection failed:", error);
      setConnectionError(String(error));
      setIsConnecting(false);
    }
  };

  const handleSerialConnect = async (config: SerialConnectionConfig) => {
    setIsConnecting(true);
    setConnectionError(undefined);

    const ptySessionId = generateSessionId("serial");

    try {
      await invoke("create_serial_session", {
        sessionId: ptySessionId,
        port: config.port,
        baudRate: config.baudRate,
        dataBits: config.dataBits,
        stopBits: config.stopBits,
        parity: config.parity,
        flowControl: config.flowControl,
      });

      workspace.addTabToFocusedGroup({
        type: "serial",
        title: config.name,
        sessionId: `serial-${config.port}`,
        ptySessionId,
        serialConfig: config,
      });

      setIsConnectionModalOpen(false);
      setOpenSidebar("none");
      setIsConnecting(false);

      pluginManager.notifySessionConnect({
        id: ptySessionId,
        type: "local",
        status: "connected",
      });
    } catch (error) {
      console.error("Serial connection failed:", error);
      setConnectionError(String(error));
      setIsConnecting(false);
    }
  };

  // Dismiss save modal
  const handleDismissSaveModal = useCallback(() => {
    setIsSaveModalOpen(false);
    setPendingSaveConfig(null);
    setEditingSessionId(null);
  }, []);

  // Save session
  const handleSaveSession = async () => {
    if (!pendingSaveConfig) return;

    const config = pendingSaveConfig;
    const sessionId = editingSessionId || generateSessionId("saved");

    try {
      await invoke("save_session", {
        id: sessionId,
        name: config.name,
        host: config.host,
        port: config.port,
        username: config.username,
        authType: config.authType,
        keyPath: config.keyPath,
        password: config.password,
        keyPassphrase: config.keyPassphrase,
        sshKeyId: config.sshKeyId || null,
      });

      await loadSavedSessions();
      setIsSaveModalOpen(false);
      setPendingSaveConfig(null);
      setEditingSessionId(null);
    } catch (error) {
      console.error("Failed to save session:", error);
    }
  };

  // Edit saved session
  const handleEditSavedSession = (saved: SavedSession) => {
    setEditingSessionId(saved.id);
    setInitialConnectionConfig({
      name: saved.name,
      host: saved.host,
      port: saved.port,
      username: saved.username,
      authType: saved.auth_type,
      keyPath: saved.key_path,
      sshKeyId: saved.ssh_key_id,
    });
    setConnectionError(undefined);
    setIsConnectionModalOpen(true);
    setOpenSidebar("none");
  };

  // Connect to saved session
  const handleConnectToSavedSession = async (saved: SavedSession) => {
    setConnectingSessionId(saved.id);

    const openConnectionForm = (message: string) => {
      setConnectingSessionId(null);
      setEditingSessionId(saved.id);
      setInitialConnectionConfig({
        name: saved.name,
        host: saved.host,
        port: saved.port,
        username: saved.username,
        authType: saved.auth_type,
        keyPath: saved.key_path,
        sshKeyId: saved.ssh_key_id,
      });
      setConnectionError(message);
      setIsConnectionModalOpen(true);
    };

    try {
      let credentials: { password: string | null; key_passphrase: string | null };
      try {
        credentials = await invoke<{ password: string | null; key_passphrase: string | null }>(
          "get_session_credentials",
          { id: saved.id }
        );
      } catch {
        openConnectionForm(t('app.enterPasswordConnect'));
        return;
      }

      const needsPassword = saved.auth_type === "password" && !credentials.password;
      if (needsPassword) {
        openConnectionForm(t('app.pleaseEnterPassword'));
        return;
      }

      setIsConnecting(true);
      setConnectionError(undefined);

      const ptySessionId = generateSessionId("ssh");

      let keyPath: string | null = null;
      let keyPassphrase: string | null = null;

      if (saved.ssh_key_id && saved.auth_type === "key") {
        const resolved = await resolveSshKey(saved.ssh_key_id);
        if (!resolved) {
          setIsConnecting(false);
          setConnectingSessionId(null);
          return;
        }
        keyPath = (await expandHomeDir(resolved.keyPath)) || null;
        keyPassphrase = resolved.passphrase;
      } else if (saved.auth_type === "key") {
        keyPath = (await expandHomeDir(saved.key_path)) || null;
        keyPassphrase = credentials.key_passphrase;
      }

      const result = await invoke<SshConnectionResult>("create_ssh_session", {
        sessionId: ptySessionId,
        host: saved.host,
        port: saved.port,
        username: saved.username,
        password: saved.auth_type === "password" ? credentials.password : null,
        keyPath,
        keyPassphrase,
      });

      const onConnected = () => {
        workspace.addTabToFocusedGroup({
          type: "ssh",
          title: saved.name,
          sessionId: `ssh-${saved.host}`,
          ptySessionId,
          sshConfig: {
            name: saved.name,
            host: saved.host,
            port: saved.port,
            username: saved.username,
            authType: saved.auth_type,
            keyPath: saved.key_path,
          },
        });

        setIsConnecting(false);
        setConnectingSessionId(null);
        setOpenSidebar("none");

        pluginManager.notifySessionConnect({
          id: ptySessionId,
          type: 'ssh',
          host: saved.host,
          port: saved.port,
          username: saved.username,
          status: 'connected',
        });
      };

      handleSshConnectionResult(result, onConnected, ptySessionId);
    } catch (error) {
      console.error("[SavedSession] SSH connection failed:", error);
      setConnectionError(String(error));
      setIsConnecting(false);
      setConnectingSessionId(null);
    }
  };

  // ============================================================================
  // Stable handler refs (ref pattern for complex handlers with many deps)
  // ============================================================================

  const handleOpenSftpTabRef = useRef(handleOpenSftpTab);
  handleOpenSftpTabRef.current = handleOpenSftpTab;
  const stableHandleOpenSftpTab = useCallback((s: SavedSession) => handleOpenSftpTabRef.current(s), []);

  const handleOpenTunnelTabRef = useRef(handleOpenTunnelTab);
  handleOpenTunnelTabRef.current = handleOpenTunnelTab;
  const stableHandleOpenTunnelTab = useCallback((s: SavedSession) => handleOpenTunnelTabRef.current(s), []);

  const handleConnectToSavedSessionRef = useRef(handleConnectToSavedSession);
  handleConnectToSavedSessionRef.current = handleConnectToSavedSession;
  const stableHandleConnectToSavedSession = useCallback((s: SavedSession) => handleConnectToSavedSessionRef.current(s), []);

  const handleEditSavedSessionRef = useRef(handleEditSavedSession);
  handleEditSavedSessionRef.current = handleEditSavedSession;
  const stableHandleEditSavedSession = useCallback((s: SavedSession) => handleEditSavedSessionRef.current(s), []);

  const handleSshConnectRef = useRef(handleSshConnect);
  handleSshConnectRef.current = handleSshConnect;
  const stableHandleSshConnect = useCallback((c: SshConnectionConfig) => handleSshConnectRef.current(c), []);

  const handleTelnetConnectRef = useRef(handleTelnetConnect);
  handleTelnetConnectRef.current = handleTelnetConnect;
  const stableHandleTelnetConnect = useCallback((c: TelnetConnectionConfig) => handleTelnetConnectRef.current(c), []);

  const handleSerialConnectRef = useRef(handleSerialConnect);
  handleSerialConnectRef.current = handleSerialConnect;
  const stableHandleSerialConnect = useCallback((c: SerialConnectionConfig) => handleSerialConnectRef.current(c), []);

  // Plugin connectSsh
  const handlePluginConnectSsh = useCallback((config: { host: string; port: number; username: string; name?: string }) => {
    const saved = savedSessions.find(
      s => s.host === config.host && s.port === config.port && s.username === config.username
    );
    if (saved) {
      stableHandleConnectToSavedSession(saved);
    } else {
      setInitialConnectionConfig({
        name: config.name || `${config.username}@${config.host}`,
        host: config.host,
        port: config.port,
        username: config.username,
        authType: 'password',
      });
      setConnectionError(undefined);
      setIsConnectionModalOpen(true);
      setOpenSidebar("none");
    }
  }, [savedSessions, stableHandleConnectToSavedSession]);

  // ============================================================================
  // Tab close handler
  // ============================================================================

  const handleCloseTab = useCallback((tabId: string) => {
    const closedTab = workspace.closeTab(tabId);
    if (closedTab?.ptySessionId) {
      invoke("close_pty_session", { sessionId: closedTab.ptySessionId }).catch(console.error);
      pluginManager.notifySessionDisconnect(closedTab.ptySessionId);
    }
  }, [workspace]);

  const handleOpenConnectionModal = useCallback(() => {
    setConnectionError(undefined);
    setInitialConnectionConfig(null);
    setInitialTelnetConfig(null);
    setInitialSerialConfig(null);
    setConnectionType("ssh");
    setEditingSessionId(null);
    setIsConnectionModalOpen(true);
    setOpenSidebar("none");
  }, [setConnectionError]);

  // ============================================================================
  // Keyboard shortcuts
  // ============================================================================

  useEffect(() => {
    const closeActiveTab = () => {
      const g = workspace.groups.get(workspace.focusedGroupId);
      if (g?.activeTabId) handleCloseTab(g.activeTabId);
    };

    const shortcuts: Record<string, ShortcutEntry[]> = {
      t: [{ mod: true, shift: false, action: handleNewLocalTab }],
      n: [{ mod: true, shift: false, skipInput: true, action: handleOpenConnectionModal }],
      w: [{ mod: true, shift: false, action: closeActiveTab }],
      Tab: [
        { ctrl: true, shift: false, action: () => workspace.cycleFocusedGroupTab("next") },
        { ctrl: true, shift: true, action: () => workspace.cycleFocusedGroupTab("prev") },
      ],
      ",": [{ mod: true, shift: false, action: () => workspace.openSettings() }],
      D: [{ mod: true, shift: true, action: () => workspace.splitFocusedGroup("vertical") }],
      E: [{ mod: true, shift: true, action: () => workspace.splitFocusedGroup("horizontal") }],
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA";
      const mod = isModifierPressed(e);

      const entries = shortcuts[e.key];
      if (!entries) return;

      const match = entries.find(entry => matchesShortcut(entry, mod, e, isInput));
      if (match) {
        e.preventDefault();
        match.action();
      }
    };

    globalThis.addEventListener("keydown", handleKeyDown);
    return () => globalThis.removeEventListener("keydown", handleKeyDown);
  }, [workspace, handleNewLocalTab, handleCloseTab, handleOpenConnectionModal]);

  // ============================================================================
  // Command Palette
  // ============================================================================

  const focusedGroup = workspace.groups.get(workspace.focusedGroupId);
  const activeTab = focusedGroup?.tabs.find((t) => t.id === focusedGroup.activeTabId);
  const allTabs = workspace.getAllTabs();

  // Ref to track notification timeout for cleanup
  const notifTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Ref to avoid identity-based deps on activeTab (created fresh each render by .find())
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  const commandHandlers: CommandHandlers = useMemo(
    () => ({
      newSshConnection: handleOpenConnectionModal,
      closeTab: () => {
        const tab = activeTabRef.current;
        if (tab) handleCloseTab(tab.id);
      },
      duplicateTab: () => {
        const tab = activeTabRef.current;
        if (tab?.sshConfig) {
          setInitialConnectionConfig(tab.sshConfig);
          setIsConnectionModalOpen(true);
        }
      },
      renameTab: () => {
        const tab = activeTabRef.current;
        if (tab) {
          const newName = globalThis.prompt("Enter new tab name:", tab.title);
          if (newName?.trim()) {
            workspace.renameTab(tab.id, newName.trim());
          }
        }
      },
      splitPane: () => workspace.splitFocusedGroup("vertical"),
      focusNextPane: () => {
        workspace.cycleFocusedPaneGroup("next");
      },
      focusPrevPane: () => {
        workspace.cycleFocusedPaneGroup("prev");
      },
      nextTab: () => workspace.cycleFocusedGroupTab("next"),
      prevTab: () => workspace.cycleFocusedGroupTab("prev"),
      openSettings: () => workspace.openSettings(),
      openSftp: () => {
        const tab = activeTabRef.current;
        if (tab?.type === "ssh" && tab.sshConfig) {
          const matchingSaved = savedSessions.find(
            (s) =>
              s.host === tab.sshConfig?.host &&
              s.username === tab.sshConfig?.username
          );
          if (matchingSaved) {
            stableHandleOpenSftpTab(matchingSaved);
          }
        }
      },
    }),
    [savedSessions, handleCloseTab, workspace, stableHandleOpenSftpTab]
  );

  const activeTabId = activeTab?.id;
  const activeTabType = activeTab?.type;
  const commandContext: CommandContext = useMemo(
    () => ({
      hasActiveTab: !!activeTabId,
      hasMultipleTabs: allTabs.length > 1,
      hasMultiplePanes: workspace.groups.size > 1,
      isActiveTabSsh: activeTabType === "ssh",
    }),
    [activeTabId, activeTabType, allTabs.length, workspace.groups.size]
  );

  const commandPalette = useCommandPalette({
    handlers: commandHandlers,
    context: commandContext,
  });

  // Global keyboard shortcut for Command Palette (Mod+Shift+P)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (isModifierPressed(e) && e.shiftKey && e.key === "P") {
        e.preventDefault();
        commandPalette.toggle();
      }
    };

    globalThis.addEventListener("keydown", handleGlobalKeyDown);
    return () => globalThis.removeEventListener("keydown", handleGlobalKeyDown);
  }, [commandPalette.toggle]);

  // Auto-check for updates on startup (lazy-loads plugin-updater)
  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        const { check } = await import("@tauri-apps/plugin-updater");
        const update = await check();
        if (update) {
          setNotification({
            message: t("settings.about.updateAvailable") + ` v${update.version}`,
            type: "info",
          });
          if (notifTimeoutRef.current) clearTimeout(notifTimeoutRef.current);
          notifTimeoutRef.current = setTimeout(() => setNotification(null), 5000);
        }
      } catch {
        // Ignore update check failures
      }
    };
    const timer = setTimeout(checkForUpdates, 3000);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ============================================================================
  // Plugin callbacks
  // ============================================================================

  const handleShowNotification = useCallback((message: string, type: NotificationType) => {
    setNotification({ message, type });
    if (notifTimeoutRef.current) clearTimeout(notifTimeoutRef.current);
    notifTimeoutRef.current = setTimeout(() => setNotification(null), 3000);
  }, []);

  const handleShowModal = useCallback((config: ModalConfig): Promise<unknown> => {
    return new Promise((resolve) => {
      setPluginModal({ config, resolve });
    });
  }, []);

  const handleModalButtonClick = useCallback(async (index: number) => {
    if (pluginModal) {
      const cfgButtons = pluginModal.config.buttons;
      const buttons = cfgButtons?.length
        ? cfgButtons
        : [{ label: "Close", variant: "secondary" as const }];
      const button = buttons[index];
      if (button?.onClick) {
        await button.onClick();
      }
      pluginModal.resolve(button?.label ?? null);
      setPluginModal(null);
    }
  }, [pluginModal]);

  const handleModalClose = useCallback(() => {
    if (pluginModal) {
      pluginModal.resolve(null);
      setPluginModal(null);
    }
  }, [pluginModal]);

  const handleShowPrompt = useCallback((config: PromptConfig): Promise<string | null> => {
    return new Promise((resolve) => {
      setPromptModal({ config, resolve });
    });
  }, []);

  const handlePromptConfirm = useCallback((value: string) => {
    if (promptModal) {
      promptModal.resolve(value);
      setPromptModal(null);
    }
  }, [promptModal]);

  const handlePromptCancel = useCallback(() => {
    if (promptModal) {
      promptModal.resolve(null);
      setPromptModal(null);
    }
  }, [promptModal]);

  const getSessions = useCallback((): SessionInfo[] => {
    return allTabs
      .filter((tab): tab is PaneGroupTab & { ptySessionId: string } => !!tab.ptySessionId)
      .map((tab) => ({
        id: tab.ptySessionId,
        type: tab.type === "local" ? "local" as const : "ssh" as const,
        host: tab.sshConfig?.host,
        port: tab.sshConfig?.port,
        username: tab.sshConfig?.username,
        status: "connected" as const,
      }));
  }, [allTabs]);

  const getActiveSessionInfo = useCallback((): SessionInfo | null => {
    if (!activeTab || !activeTab.ptySessionId) return null;
    return {
      id: activeTab.ptySessionId,
      type: activeTab.type === "local" ? "local" : "ssh",
      host: activeTab.sshConfig?.host,
      port: activeTab.sshConfig?.port,
      username: activeTab.sshConfig?.username,
      status: "connected" as const,
    };
  }, [activeTab]);

  // Status bar
  const [statusBarItems, setStatusBarItems] = useState<StatusBarItem[]>([]);
  const handleStatusBarItemsChanged = useCallback((items: StatusBarItem[]) => {
    setStatusBarItems(items);
  }, []);
  const statusBarVisible = (appSettings.ui?.statusBarVisible ?? false) || statusBarItems.length > 0;

  // Header actions (from plugins)
  const [headerActions, setHeaderActions] = useState<HeaderActionItem[]>([]);
  const handleHeaderActionsChanged = useCallback((items: HeaderActionItem[]) => {
    setHeaderActions(items);
  }, []);

  // ============================================================================
  // Stable workspace callbacks for WorkspaceSplit
  // ============================================================================

  const handleTabSelect = useCallback(
    (groupId: string, tabId: string) => workspace.selectTab(groupId, tabId),
    [workspace.selectTab]
  );
  const handleFocusGroup = useCallback(
    (groupId: string) => workspace.focusGroup(groupId),
    [workspace.focusGroup]
  );
  const handleResizeSplit = useCallback(
    (splitId: string, sizes: number[]) => workspace.resizeSplitNode(splitId, sizes),
    [workspace.resizeSplitNode]
  );
  const handleToggleTunnelSidebar = useCallback(
    () => setOpenSidebar((prev) => prev === "tunnel" ? "none" : "tunnel"),
    []
  );
  const handleSplitVertical = useCallback(
    () => workspace.splitFocusedGroup("vertical"),
    [workspace.splitFocusedGroup]
  );
  const handleSplitHorizontal = useCallback(
    () => workspace.splitFocusedGroup("horizontal"),
    [workspace.splitFocusedGroup]
  );
  const handleClosePane = useCallback(
    (groupId: string) => {
      const closedTabs = workspace.closeGroup(groupId);
      for (const tab of closedTabs) {
        if (tab.ptySessionId) {
          invoke("close_pty_session", { sessionId: tab.ptySessionId }).catch(console.error);
          pluginManager.notifySessionDisconnect(tab.ptySessionId);
        }
      }
    },
    [workspace.closeGroup]
  );

  // Memoized render functions (consumed via WorkspaceActionsContext)
  const terminalTheme = appSettings.appearance?.theme ?? "dark";
  const terminalSettings = appSettings.terminal;

  const renderTerminal = useCallback(
    (ptySessionId: string, isActive: boolean, type: string) => (
      <TerminalPane
        key={ptySessionId}
        sessionId={ptySessionId}
        type={type === "ssh" ? "ssh" : "local"}
        isActive={isActive}
        appTheme={terminalTheme}
        terminalSettings={terminalSettings}
      />
    ),
    [terminalTheme, terminalSettings]
  );

  const renderSftp = useCallback(
    (sessionId: string) => (
      <Suspense fallback={null}>
        <SftpBrowser key={sessionId} sessionId={sessionId} initialPath="/" />
      </Suspense>
    ),
    []
  );

  const renderTunnel = useCallback(
    (sessionId: string, sessionName: string) => (
      <Suspense fallback={null}>
        <div className="w-full h-full flex items-center justify-center bg-base p-6">
          <div className="w-full max-w-2xl h-full">
            <TunnelManager
              isOpen={true}
              onClose={noop}
              sessionId={sessionId}
              sessionName={sessionName}
              embedded={true}
            />
          </div>
        </div>
      </Suspense>
    ),
    []
  );

  const renderSettings = useCallback(
    () => (
      <Suspense fallback={null}>
        <SettingsTab
          settings={appSettings}
          onSettingsChange={handleSettingsChange}
          savedSessionsCount={savedSessions.length}
          onClearAllSessions={clearAllSavedSessions}
        />
      </Suspense>
    ),
    [appSettings, handleSettingsChange, savedSessions.length, clearAllSavedSessions]
  );

  const renderEmpty = useCallback(
    () => (
      <EmptyPaneSessions
        savedSessions={savedSessions}
        connectingSessionId={connectingSessionId}
        onConnect={stableHandleConnectToSavedSession}
        onNewConnection={handleOpenConnectionModal}
        onLocalTerminal={handleNewLocalTab}
        onEdit={stableHandleEditSavedSession}
        onDelete={handleDeleteSavedSession}
        onSftp={stableHandleOpenSftpTab}
        onTunnel={stableHandleOpenTunnelTab}
      />
    ),
    [savedSessions, connectingSessionId, stableHandleConnectToSavedSession, handleOpenConnectionModal, handleNewLocalTab, stableHandleEditSavedSession, handleDeleteSavedSession, stableHandleOpenSftpTab, stableHandleOpenTunnelTab]
  );

  // WorkspaceActionsContext value — global actions + render fns shared by all pane groups
  const workspaceActions: WorkspaceActions = useMemo(() => ({
    onNewConnection: handleOpenConnectionModal,
    onLocalTerminal: handleNewLocalTab,
    onToggleTunnelSidebar: handleToggleTunnelSidebar,
    isTunnelSidebarOpen,
    activeTunnelCount,
    onSplitVertical: handleSplitVertical,
    onSplitHorizontal: handleSplitHorizontal,
    renderTerminal,
    renderSftp,
    renderTunnel,
    renderSettings,
    renderEmpty,
  }), [
    handleOpenConnectionModal, handleNewLocalTab, handleToggleTunnelSidebar,
    isTunnelSidebarOpen, activeTunnelCount,
    handleSplitVertical, handleSplitHorizontal,
    renderTerminal, renderSftp, renderTunnel, renderSettings, renderEmpty,
  ]);

  // ============================================================================
  // Stable callbacks for render props
  // ============================================================================

  const handleToggleSidebar = useCallback(() => {
    if (sidebarPinned) {
      handleToggleSidebarPin();
    } else {
      setOpenSidebar(prev => prev === "menu" ? "none" : "menu");
    }
  }, [sidebarPinned, handleToggleSidebarPin]);

  const handleOpenSettingsTab = useCallback(() => workspace.openSettings(), [workspace]);

  const handleVaultToggle = useCallback(
    () => vault.status?.isUnlocked ? lockVault() : openVaultUnlock(),
    [vault.status?.isUnlocked, lockVault, openVaultUnlock]
  );

  const handleCloseSidebar = useCallback(() => setOpenSidebar("none"), []);

  const handleCloseConnectionModal = useCallback(() => {
    setIsConnectionModalOpen(false);
    setInitialConnectionConfig(null);
    setInitialTelnetConfig(null);
    setInitialSerialConfig(null);
    setConnectionError(undefined);
    setEditingSessionId(null);
    setPendingSftpSession(null);
    setConnectionType("ssh");
  }, []);

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="relative h-screen bg-terminal overflow-hidden">
      {/* Header bar (simplified, no tab pills) */}
      <HeaderBar
        onToggleSidebar={handleToggleSidebar}
        isSidebarOpen={isSidebarOpen}
        onOpenSettings={handleOpenSettingsTab}
        headerActions={headerActions}
        vaultExists={vault.status?.exists}
        vaultUnlocked={vault.status?.isUnlocked}
        onVaultToggle={handleVaultToggle}
      />

      {/* Main area: pinned sidebar + workspace */}
      <div className={`absolute inset-x-0 bottom-0 flex ${statusBarVisible ? "top-[72px]" : "top-10"}`}>
        {/* Pinned sidebar (rendered as flex child) */}
        {sidebarPinned && (
          <Sidebar
            isOpen={true}
            onClose={noop}
            mode="pinned"
            onTogglePin={handleToggleSidebarPin}
            savedSessions={savedSessions}
            connectingSessionId={connectingSessionId}
            onSavedSessionConnect={stableHandleConnectToSavedSession}
            onSavedSessionEdit={stableHandleEditSavedSession}
            onSavedSessionDelete={handleDeleteSavedSession}
            onSavedSessionSftp={stableHandleOpenSftpTab}
            onSavedSessionTunnel={stableHandleOpenTunnelTab}
          />
        )}

        {/* Workspace area */}
        <div className="flex-1 overflow-hidden m-1.5 mt-0 rounded-xl">
          <WorkspaceActionsContext.Provider value={workspaceActions}>
            <WorkspaceSplit
              node={workspace.tree}
              groups={workspace.groups}
              focusedGroupId={workspace.focusedGroupId}
              onTabSelect={handleTabSelect}
              onTabClose={handleCloseTab}
              onFocusGroup={handleFocusGroup}
              onResizeSplit={handleResizeSplit}
              onClosePane={handleClosePane}
            />
          </WorkspaceActionsContext.Provider>
        </div>
      </div>

      {/* Sidebar overlay (only when not pinned) */}
      {!sidebarPinned && (
        <Sidebar
          isOpen={openSidebar === "menu"}
          onClose={handleCloseSidebar}
          mode="overlay"
          onTogglePin={handleToggleSidebarPin}
          savedSessions={savedSessions}
          connectingSessionId={connectingSessionId}
          onSavedSessionConnect={stableHandleConnectToSavedSession}
          onSavedSessionEdit={stableHandleEditSavedSession}
          onSavedSessionDelete={handleDeleteSavedSession}
          onSavedSessionSftp={stableHandleOpenSftpTab}
          onSavedSessionTunnel={stableHandleOpenTunnelTab}
        />
      )}

      {/* Connection Modal */}
      {isConnectionModalOpen && (
        <Suspense fallback={null}>
          <NewConnectionModal
            isOpen={isConnectionModalOpen}
            onClose={handleCloseConnectionModal}
            onSshConnect={stableHandleSshConnect}
            onTelnetConnect={stableHandleTelnetConnect}
            onSerialConnect={stableHandleSerialConnect}
            isConnecting={isConnecting}
            error={connectionError}
            initialSshConfig={initialConnectionConfig}
            initialTelnetConfig={initialTelnetConfig}
            initialSerialConfig={initialSerialConfig}
            initialConnectionType={connectionType}
            title={getConnectionModalTitle(editingSessionId, pendingSftpSession, t)}
          />
        </Suspense>
      )}

      {/* Save Session Modal */}
      <Modal
        isOpen={isSaveModalOpen}
        onClose={handleDismissSaveModal}
        title={editingSessionId ? t('app.updateConnection') : t('app.saveConnection')}
        width="sm"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-muted">
            {editingSessionId
              ? t('app.updateConnectionDesc')
              : t('app.saveConnectionDesc')
            }
          </p>
          {pendingSaveConfig && (
            <div className="px-3 py-2 bg-surface-0/30 rounded-lg text-sm">
              <span className="text-text font-medium">{pendingSaveConfig.name}</span>
              <span className="text-text-muted ml-2">
                ({pendingSaveConfig.username}@{pendingSaveConfig.host})
              </span>
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={handleDismissSaveModal}
              className="flex-1 py-2.5 bg-surface-0/50 text-text-secondary text-sm rounded-lg hover:bg-surface-0 transition-colors"
            >
              {t('app.noThanks')}
            </button>
            <button
              onClick={handleSaveSession}
              className="flex-1 py-2.5 bg-accent text-base font-medium text-sm rounded-lg hover:bg-accent/90 transition-colors"
            >
              {editingSessionId ? t('app.update') : t('common.save')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Host Key Verification Modal */}
      {isHostKeyModalOpen && (
        <Suspense fallback={null}>
          <HostKeyModal
            isOpen={isHostKeyModalOpen}
            result={hostKeyResult}
            onAccept={handleHostKeyAccept}
            onReject={handleHostKeyReject}
            isLoading={hostKeyLoading}
          />
        </Suspense>
      )}

      {/* Passphrase Prompt Modal */}
      {!!passphrasePrompt && (
        <Suspense fallback={null}>
          <PassphrasePromptModal
            isOpen={!!passphrasePrompt}
            keyName={passphrasePrompt?.keyName || ""}
            onConfirm={(passphrase) => {
              passphrasePrompt?.resolve(passphrase);
              setPassphrasePrompt(null);
            }}
            onCancel={() => {
              passphrasePrompt?.resolve(null);
              setPassphrasePrompt(null);
            }}
          />
        </Suspense>
      )}

      {/* Command Palette */}
      <CommandPalette
        isOpen={commandPalette.isOpen}
        query={commandPalette.query}
        onQueryChange={commandPalette.setQuery}
        selectedIndex={commandPalette.selectedIndex}
        onSelectedIndexChange={commandPalette.setSelectedIndex}
        filteredCommands={commandPalette.filteredCommands}
        onClose={commandPalette.close}
        onExecuteCommand={commandPalette.executeCommand}
        onKeyDown={commandPalette.handleKeyDown}
      />

      {/* Tunnel Sidebar (standalone tunnels) */}
      <Suspense fallback={null}>
        <TunnelSidebar
          isOpen={isTunnelSidebarOpen}
          onClose={handleCloseSidebar}
          savedSessions={savedSessions}
          onTunnelCountChange={setActiveTunnelCount}
        />
      </Suspense>

      {/* Plugin Host (lazy-loaded) */}
      <Suspense fallback={null}>
        <PluginHost
          onShowNotification={handleShowNotification}
          onShowModal={handleShowModal}
          onShowPrompt={handleShowPrompt}
          getSessions={getSessions}
          getActiveSession={getActiveSessionInfo}
          onStatusBarItemsChanged={handleStatusBarItemsChanged}
          onHeaderActionsChanged={handleHeaderActionsChanged}
          onConnectSsh={handlePluginConnectSsh}
        />
      </Suspense>

      {/* Plugin Notification Toast */}
      {notification && (
        <div
          className={`
            fixed bottom-4 right-4 px-4 py-2 rounded-lg shadow-lg text-sm z-50
            animate-fade-in
            ${notification.type === "success" ? "bg-success text-white" : ""}
            ${notification.type === "error" ? "bg-error text-white" : ""}
            ${notification.type === "warning" ? "bg-warning text-black" : ""}
            ${notification.type === "info" ? "bg-accent text-white" : ""}
          `}
        >
          {notification.message}
        </div>
      )}

      {/* Plugin Prompt Modal */}
      {!!promptModal && (
        <Suspense fallback={null}>
          <PromptModal
            isOpen={!!promptModal}
            config={promptModal?.config || { title: '' }}
            onConfirm={handlePromptConfirm}
            onCancel={handlePromptCancel}
          />
        </Suspense>
      )}

      {/* Plugin Modal */}
      {!!pluginModal && (
        <Suspense fallback={null}>
          <PluginModal
            isOpen={!!pluginModal}
            config={pluginModal?.config || { title: '', content: '' }}
            onButtonClick={handleModalButtonClick}
            onClose={handleModalClose}
          />
        </Suspense>
      )}

      {/* Vault Setup Modal */}
      {showVaultSetup && (
        <Suspense fallback={null}>
          <VaultSetupModal
            isOpen={showVaultSetup}
            onClose={closeVaultSetup}
            onSetup={handleVaultSetup}
            onSkip={handleVaultSetupSkip}
            canSkip={true}
          />
        </Suspense>
      )}

      {/* Vault Unlock Modal */}
      {showVaultUnlock && (
        <Suspense fallback={null}>
          <VaultUnlockModal
            isOpen={showVaultUnlock}
            onClose={closeVaultUnlock}
            unlockMethods={vault.status?.unlockMethods || []}
            pinAttemptsRemaining={vault.status?.pinAttemptsRemaining}
            pinLength={vault.status?.pinLength}
            onUnlockWithPassword={vault.unlockWithPassword}
            onUnlockWithPin={vault.unlockWithPin}
            onUnlockWithSecurityKey={vault.unlockWithSecurityKey}
          />
        </Suspense>
      )}

      {/* Status Bar */}
      <StatusBar visible={statusBarVisible} items={statusBarItems} />
    </div>
  );
}

export default App;
