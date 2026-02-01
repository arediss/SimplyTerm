import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import Sidebar from "./components/Sidebar";
import FloatingTabs from "./components/FloatingTabs";
import TerminalPane from "./components/TerminalPane";
import Modal from "./components/Modal";
import HostKeyModal, { HostKeyCheckResult } from "./components/HostKeyModal";
import ConnectionForm, { SshConnectionConfig } from "./components/ConnectionForm";
import SettingsModal from "./components/SettingsModal";
import { CommandPalette, useCommandPalette, CommandHandlers, CommandContext } from "./components/CommandPalette";
import { StatusBar } from "./components/StatusBar";
import { PluginHost, pluginManager, type SessionInfo, type ModalConfig, type NotificationType } from "./plugins";
import {
  SplitPane,
  type PaneNode,
  createTerminalNode,
  splitPaneWithPending,
  replacePendingWithTerminal,
  replacePendingWithSftp,
  closePane,
  getAllTerminalPaneIds,
  getAllPtySessionIds,
  getAllPendingPaneIds,
  getAllSftpPaneIds,
} from "./components/SplitPane";
import { SftpBrowser } from "./components/SftpBrowser";
import { PanePicker, type ActiveConnection } from "./components/PanePicker";
import { VaultSetupModal, VaultUnlockModal } from "./components/vault";
import TunnelManager from "./components/TunnelManager";
import TunnelSidebar from "./components/TunnelSidebar";
import { useSessions, useAppSettings, useVaultFlow } from "./hooks";
import { SavedSession, RecentSession, Tab } from "./types";
import { generateSessionId, generateTabId, expandHomeDir } from "./utils";
import { applyTheme } from "./themes";

function App() {
  const { t } = useTranslation();
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  // Use extracted hooks
  const {
    savedSessions,
    folders,
    recentSessions,
    loadSavedSessions,
    createFolder,
    updateFolder,
    deleteFolder,
    moveSessionToFolder,
    deleteSavedSession: handleDeleteSavedSession,
    deleteRecentSession: handleDeleteRecentSession,
    clearRecentSessions: handleClearRecentSessions,
    clearAllSavedSessions,
    addToRecentSessions,
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

  // Apply theme
  useEffect(() => {
    const themeId = appSettings.appearance?.theme ?? "dark";
    applyTheme(themeId);
  }, [appSettings.appearance?.theme]);

  // Sidebar state - un seul sidebar ouvert à la fois
  const [openSidebar, setOpenSidebar] = useState<"none" | "menu" | "tunnel">("none");
  const isSidebarOpen = openSidebar === "menu";
  const isTunnelSidebarOpen = openSidebar === "tunnel";

  // Modal state
  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | undefined>();
  const [initialConnectionConfig, setInitialConnectionConfig] = useState<Partial<SshConnectionConfig> | null>(null);

  // Save session modal state
  const [pendingSaveConfig, setPendingSaveConfig] = useState<SshConnectionConfig | null>(null);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);

  // Edit session state
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);

  // Pending SFTP session (when credentials are needed)
  const [pendingSftpSession, setPendingSftpSession] = useState<SavedSession | null>(null);

  // Settings state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Host key verification state
  const [hostKeyResult, setHostKeyResult] = useState<HostKeyCheckResult | null>(null);
  const [isHostKeyModalOpen, setIsHostKeyModalOpen] = useState(false);
  const [hostKeyLoading, setHostKeyLoading] = useState(false);
  const [pendingHostKeyAction, setPendingHostKeyAction] = useState<(() => Promise<void>) | null>(null);

  // Tunnel manager state
  const [tunnelManagerTabId, setTunnelManagerTabId] = useState<string | null>(null);

  // Tunnel count for badge
  const [activeTunnelCount, setActiveTunnelCount] = useState(0);

  // Notification state (for plugins)
  const [notification, setNotification] = useState<{ message: string; type: NotificationType } | null>(null);

  // Helper to check host key before SSH connection
  const checkHostKeyBeforeConnect = async (
    host: string,
    port: number,
    onTrusted: () => Promise<void>
  ): Promise<boolean> => {
    try {
      const result = await invoke<HostKeyCheckResult>("check_host_key", { host, port });

      if (result.status === "trusted") {
        // Host is already trusted, proceed with connection
        await onTrusted();
        return true;
      } else if (result.status === "unknown" || result.status === "mismatch") {
        // Show modal for user confirmation
        setHostKeyResult(result);
        setPendingHostKeyAction(() => onTrusted);
        setIsHostKeyModalOpen(true);
        return false; // Connection will proceed after user confirmation
      } else {
        // Error checking host key
        setConnectionError(result.message || "Failed to check host key");
        return false;
      }
    } catch (error) {
      setConnectionError(`Host key check failed: ${error}`);
      return false;
    }
  };

  // Handle host key acceptance
  const handleHostKeyAccept = async () => {
    if (!hostKeyResult || !pendingHostKeyAction) return;

    setHostKeyLoading(true);
    try {
      const { host, port, status } = hostKeyResult;

      if (status === "unknown") {
        await invoke("trust_host_key", { host, port });
      } else if (status === "mismatch") {
        await invoke("update_host_key", { host, port });
      }

      // Close modal and proceed with connection
      setIsHostKeyModalOpen(false);
      setHostKeyResult(null);

      // Execute the pending connection action
      await pendingHostKeyAction();
    } catch (error) {
      setConnectionError(`Failed to save host key: ${error}`);
    } finally {
      setHostKeyLoading(false);
      setPendingHostKeyAction(null);
    }
  };

  // Handle host key rejection
  const handleHostKeyReject = async () => {
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
  };

  const handleNewLocalTab = () => {
    const ptySessionId = generateSessionId("pty");
    const paneTree = createTerminalNode(ptySessionId);
    const newTab: Tab = {
      id: generateTabId(),
      sessionId: "local",
      paneTree,
      title: "Terminal",
      type: "local",
      focusedPaneId: paneTree.id,
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(newTab.id);
    setOpenSidebar("none");
  };

  // Open SFTP tab for a saved session
  const handleOpenSftpTab = async (saved: SavedSession) => {
    setOpenSidebar("none");

    // Helper pour ouvrir le formulaire de connexion SFTP
    const openSftpConnectionForm = () => {
      setPendingSftpSession(saved);
      setInitialConnectionConfig({
        name: saved.name,
        host: saved.host,
        port: saved.port,
        username: saved.username,
        authType: saved.auth_type,
        keyPath: saved.key_path,
      });
      setConnectionError(t('app.enterPasswordSftp'));
      setIsConnectionModalOpen(true);
    };

    try {
      // Get credentials for this saved session
      let credentials: { password: string | null; key_passphrase: string | null };
      try {
        credentials = await invoke<{ password: string | null; key_passphrase: string | null }>(
          "get_session_credentials",
          { id: saved.id }
        );
      } catch (err) {
        // Vault probablement verrouillé - ouvrir le formulaire

        openSftpConnectionForm();
        return;
      }

      const needsPassword = saved.auth_type === "password" && !credentials.password;
      if (needsPassword) {
        openSftpConnectionForm();
        return;
      }

      // Helper function to perform the SFTP connection
      const performSftpConnection = async () => {
        const sessionId = generateSessionId("sftp");
        const keyPath = await expandHomeDir(saved.key_path);

        // Register the SSH config for SFTP use
        await invoke("register_sftp_session", {
          sessionId,
          host: saved.host,
          port: saved.port,
          username: saved.username,
          password: saved.auth_type === "password" ? credentials.password : null,
          keyPath: saved.auth_type === "key" ? keyPath : null,
          keyPassphrase: saved.auth_type === "key" ? credentials.key_passphrase : null,
        });

        // Create SFTP tab - no paneTree needed, we render SftpBrowser directly
        const newTab: Tab = {
          id: generateTabId(),
          sessionId,
          paneTree: createTerminalNode(sessionId), // Placeholder, not used for SFTP
          title: `SFTP - ${saved.name}`,
          type: "sftp",
          sshConfig: {
            name: saved.name,
            host: saved.host,
            port: saved.port,
            username: saved.username,
            authType: saved.auth_type,
            keyPath: saved.key_path,
          },
          focusedPaneId: null,
        };

        setTabs((prev) => [...prev, newTab]);
        setActiveTabId(newTab.id);
      };

      // Check host key before connecting
      await checkHostKeyBeforeConnect(saved.host, saved.port, performSftpConnection);
    } catch (error) {
      console.error("Failed to open SFTP tab:", error);
    }
  };

  // Open Tunnel-only tab for a saved session
  const handleOpenTunnelTab = async (saved: SavedSession) => {
    setOpenSidebar("none");

    try {
      // Get credentials for this saved session
      let credentials: { password: string | null; key_passphrase: string | null };
      try {
        credentials = await invoke<{ password: string | null; key_passphrase: string | null }>(
          "get_session_credentials",
          { id: saved.id }
        );
      } catch (err) {

        // For now, show an error. In the future, we could open a credential prompt.
        return;
      }

      const needsPassword = saved.auth_type === "password" && !credentials.password;
      if (needsPassword) {

        return;
      }

      // Helper function to perform the tunnel connection
      const performTunnelConnection = async () => {
        const sessionId = generateSessionId("tunnel");
        const keyPath = await expandHomeDir(saved.key_path);

        // Register the SSH config for tunnel use (reuses SFTP registration)
        await invoke("register_sftp_session", {
          sessionId,
          host: saved.host,
          port: saved.port,
          username: saved.username,
          password: saved.auth_type === "password" ? credentials.password : null,
          keyPath: saved.auth_type === "key" ? keyPath : null,
          keyPassphrase: saved.auth_type === "key" ? credentials.key_passphrase : null,
        });

        // Create Tunnel tab
        const newTab: Tab = {
          id: generateTabId(),
          sessionId,
          paneTree: createTerminalNode(sessionId), // Placeholder, not used for tunnel
          title: `Tunnels - ${saved.name}`,
          type: "tunnel",
          sshConfig: {
            name: saved.name,
            host: saved.host,
            port: saved.port,
            username: saved.username,
            authType: saved.auth_type,
            keyPath: saved.key_path,
          },
          focusedPaneId: null,
        };

        setTabs((prev) => [...prev, newTab]);
        setActiveTabId(newTab.id);
      };

      // Check host key before connecting
      await checkHostKeyBeforeConnect(saved.host, saved.port, performTunnelConnection);
    } catch (error) {
      console.error("Failed to open Tunnel tab:", error);
    }
  };

  const handleSshConnect = async (config: SshConnectionConfig) => {
    setIsConnecting(true);
    setConnectionError(undefined);

    // Check if this is for SFTP (credentials were requested for SFTP)
    if (pendingSftpSession) {
      const saved = pendingSftpSession;
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

        const newTab: Tab = {
          id: generateTabId(),
          sessionId,
          paneTree: createTerminalNode(sessionId),
          title: `SFTP - ${saved.name}`,
          type: "sftp",
          sshConfig: config,
          focusedPaneId: null,
        };

        setTabs((prev) => [...prev, newTab]);
        setActiveTabId(newTab.id);
        setIsConnectionModalOpen(false);
        setOpenSidebar("none");
        setIsConnecting(false);
        setInitialConnectionConfig(null);

        // Sauvegarder les credentials pour la session SFTP existante
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
          });

          await loadSavedSessions();
        } catch (err) {
          console.error("[SFTP] Failed to save credentials:", err);
        }
        return;
      } catch (error) {
        console.error("Failed to open SFTP:", error);
        setConnectionError(t('app.sftpError', { error }));
        setIsConnecting(false);
        return;
      }
    }

    // Helper function to perform the actual connection
    const performSshConnection = async () => {
      const ptySessionId = generateSessionId("ssh");

      try {
        const keyPath = await expandHomeDir(config.keyPath);

        await invoke("create_ssh_session", {
          sessionId: ptySessionId,
          host: config.host,
          port: config.port,
          username: config.username,
          password: config.password,
          keyPath,
          keyPassphrase: config.keyPassphrase,
        });

        const paneTree = createTerminalNode(ptySessionId);
        const newTab: Tab = {
          id: generateTabId(),
          sessionId: `ssh-${config.host}`,
          paneTree,
          title: config.name,
          type: "ssh",
          sshConfig: config,
          focusedPaneId: paneTree.id,
        };

        setTabs((prev) => [...prev, newTab]);
        setActiveTabId(newTab.id);
        setIsConnectionModalOpen(false);
        setOpenSidebar("none");
        setIsConnecting(false);

        // Notify plugins of session connect (use ptySessionId for backend commands)
        pluginManager.notifySessionConnect({
          id: ptySessionId,
          type: 'ssh',
          host: config.host,
          port: config.port,
          username: config.username,
          status: 'connected',
        });

        // Ajouter aux sessions récentes
        await addToRecentSessions({
          name: config.name,
          host: config.host,
          port: config.port,
          username: config.username,
          authType: config.authType,
          keyPath: config.keyPath,
        });

        // Si on était en mode édition (reconnexion à une session existante), sauvegarder directement les credentials
        if (editingSessionId) {
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
            });

            await loadSavedSessions();
          } catch (err) {
            console.error("[SavedSession] Failed to save credentials:", err);
          }
          setEditingSessionId(null);
        } else {
          // Proposer de sauvegarder si pas déjà sauvegardée
          const isAlreadySaved = savedSessions.some(
            (s) => s.host === config.host && s.username === config.username && s.port === config.port
          );
          if (!isAlreadySaved) {
            setPendingSaveConfig(config);
            setIsSaveModalOpen(true);
          }
        }
      } catch (error) {
        console.error("SSH connection failed:", error);
        setConnectionError(String(error));
        setIsConnecting(false);
      }
    };

    // Check host key before connecting
    await checkHostKeyBeforeConnect(config.host, config.port, performSshConnection);
  };

  // Sauvegarder une session
  const handleSaveSession = async () => {
    if (!pendingSaveConfig) return;

    const config = pendingSaveConfig;
    // Utiliser l'ID existant si on édite, sinon en générer un nouveau
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
      });

      await loadSavedSessions();
      setIsSaveModalOpen(false);
      setPendingSaveConfig(null);
      setEditingSessionId(null);
    } catch (error) {
      console.error("Failed to save session:", error);
    }
  };

  // Éditer une session sauvegardée
  const handleEditSavedSession = (saved: SavedSession) => {
    setEditingSessionId(saved.id);
    setInitialConnectionConfig({
      name: saved.name,
      host: saved.host,
      port: saved.port,
      username: saved.username,
      authType: saved.auth_type,
      keyPath: saved.key_path,
    });
    setConnectionError(undefined);
    setIsConnectionModalOpen(true);
    setOpenSidebar("none");
  };

  // Se connecter à une session sauvegardée
  const handleConnectToSavedSession = async (saved: SavedSession) => {
    setOpenSidebar("none");

    // Helper pour ouvrir le formulaire de connexion
    const openConnectionForm = (message: string) => {

      setEditingSessionId(saved.id); // Important: marquer qu'on édite cette session pour sauvegarder les credentials
      setInitialConnectionConfig({
        name: saved.name,
        host: saved.host,
        port: saved.port,
        username: saved.username,
        authType: saved.auth_type,
        keyPath: saved.key_path,
      });
      setConnectionError(message);
      setIsConnectionModalOpen(true);
    };

    try {
      // Récupérer les credentials (peut échouer si vault verrouillé)
      let credentials: { password: string | null; key_passphrase: string | null };
      try {
        credentials = await invoke<{ password: string | null; key_passphrase: string | null }>(
          "get_session_credentials",
          { id: saved.id }
        );
      } catch (err) {
        // Vault probablement verrouillé ou non configuré - ouvrir le formulaire

        openConnectionForm(t('app.enterPasswordConnect'));
        return;
      }

      // Vérifier si on a les credentials nécessaires
      // Pour password auth: on a besoin du password
      // Pour key auth: la passphrase est optionnelle (certaines clés n'en ont pas)
      const needsPassword = saved.auth_type === "password" && !credentials.password;

      // Si password manquant, ouvrir le formulaire pré-rempli
      if (needsPassword) {
        openConnectionForm(t('app.pleaseEnterPassword'));
        return;
      }

      // Helper function to perform the actual connection
      const performSavedSessionConnection = async () => {
        setIsConnecting(true);
        setConnectionError(undefined);

        const ptySessionId = generateSessionId("ssh");
        const keyPath = await expandHomeDir(saved.key_path);

        try {
          await invoke("create_ssh_session", {
            sessionId: ptySessionId,
            host: saved.host,
            port: saved.port,
            username: saved.username,
            password: saved.auth_type === "password" ? credentials.password : null,
            keyPath: saved.auth_type === "key" ? keyPath : null,
            keyPassphrase: saved.auth_type === "key" ? credentials.key_passphrase : null,
          });

          const paneTree = createTerminalNode(ptySessionId);
          const newTab: Tab = {
            id: generateTabId(),
            sessionId: `ssh-${saved.host}`,
            paneTree,
            title: saved.name,
            type: "ssh",
            sshConfig: {
              name: saved.name,
              host: saved.host,
              port: saved.port,
              username: saved.username,
              authType: saved.auth_type,
              keyPath: saved.key_path,
            },
            focusedPaneId: paneTree.id,
          };

          setTabs((prev) => [...prev, newTab]);
          setActiveTabId(newTab.id);
          setIsConnecting(false);

          // Notify plugins of session connect
          pluginManager.notifySessionConnect({
            id: ptySessionId,
            type: 'ssh',
            host: saved.host,
            port: saved.port,
            username: saved.username,
            status: 'connected',
          });

          // Mettre à jour les sessions récentes
          await addToRecentSessions({
            name: saved.name,
            host: saved.host,
            port: saved.port,
            username: saved.username,
            authType: saved.auth_type,
            keyPath: saved.key_path,
          });
        } catch (error) {
          console.error("[SavedSession] SSH connection failed:", error);
          setConnectionError(String(error));
          setIsConnecting(false);
        }
      };

      // Check host key before connecting
      await checkHostKeyBeforeConnect(saved.host, saved.port, performSavedSessionConnection);
    } catch (error) {
      console.error("[SavedSession] SSH connection failed:", error);
      setConnectionError(String(error));
      setIsConnecting(false);
    }
  };

  // Se connecter à une session récente (pré-remplit le formulaire)
  const handleConnectToRecentSession = async (recent: RecentSession) => {
    setInitialConnectionConfig({
      name: recent.name,
      host: recent.host,
      port: recent.port,
      username: recent.username,
      authType: recent.auth_type,
      keyPath: recent.key_path,
    });
    setConnectionError(undefined);
    setIsConnectionModalOpen(true);
    setOpenSidebar("none");
  };

  const handleCloseTab = (tabId: string) => {
    const tabToClose = tabs.find((t) => t.id === tabId);
    if (tabToClose) {
      // Close all PTY sessions in the pane tree
      const ptySessionIds = getAllPtySessionIds(tabToClose.paneTree);
      ptySessionIds.forEach((ptySessionId) => {
        invoke("close_pty_session", { sessionId: ptySessionId }).catch(console.error);
        pluginManager.notifySessionDisconnect(ptySessionId);
      });
    }
    const newTabs = tabs.filter((t) => t.id !== tabId);
    setTabs(newTabs);
    if (activeTabId === tabId) {
      setActiveTabId(newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null);
    }
  };

  // Split pane handlers
  const handleSplitPane = useCallback(
    (direction: "horizontal" | "vertical") => {
      const activeTab = tabs.find((t) => t.id === activeTabId);
      if (!activeTab || !activeTab.focusedPaneId) return;

      // Create a pending pane that will show the picker
      const { tree: newPaneTree, pendingPaneId } = splitPaneWithPending(
        activeTab.paneTree,
        activeTab.focusedPaneId,
        direction
      );

      setTabs(
        tabs.map((t) =>
          t.id === activeTabId
            ? { ...t, paneTree: newPaneTree, focusedPaneId: pendingPaneId }
            : t
        )
      );
    },
    [tabs, activeTabId]
  );

  // Split a specific pane by ID (used by toolbar buttons)
  const handleSplitPaneById = useCallback(
    (paneId: string, direction: "horizontal" | "vertical") => {
      const activeTab = tabs.find((t) => t.id === activeTabId);
      if (!activeTab) return;

      const { tree: newPaneTree, pendingPaneId } = splitPaneWithPending(
        activeTab.paneTree,
        paneId,
        direction
      );

      setTabs(
        tabs.map((t) =>
          t.id === activeTabId
            ? { ...t, paneTree: newPaneTree, focusedPaneId: pendingPaneId }
            : t
        )
      );
    },
    [tabs, activeTabId]
  );

  const handleClosePane = useCallback(
    (paneId: string) => {
      const activeTab = tabs.find((t) => t.id === activeTabId);
      if (!activeTab) return;

      // Count all leaf panes (terminal, sftp, and pending)
      const terminalPaneIds = getAllTerminalPaneIds(activeTab.paneTree);
      const sftpPaneIds = getAllSftpPaneIds(activeTab.paneTree);
      const pendingPaneIds = getAllPendingPaneIds(activeTab.paneTree);
      const totalLeafPanes = terminalPaneIds.length + sftpPaneIds.length + pendingPaneIds.length;

      if (totalLeafPanes <= 1) {
        // Last pane - close the whole tab instead
        handleCloseTab(activeTabId!);
        return;
      }

      const newPaneTree = closePane(activeTab.paneTree, paneId);
      if (!newPaneTree) {
        handleCloseTab(activeTabId!);
        return;
      }

      // Close the PTY session for this pane
      // We need to find which pty was removed
      const oldPtyIds = getAllPtySessionIds(activeTab.paneTree);
      const newPtyIds = getAllPtySessionIds(newPaneTree);
      const removedPtyIds = oldPtyIds.filter((id) => !newPtyIds.includes(id));
      removedPtyIds.forEach((ptyId) => {
        invoke("close_pty_session", { sessionId: ptyId }).catch(console.error);
        pluginManager.notifySessionDisconnect(ptyId);
      });

      // Update focus if needed - prefer terminal panes, then sftp, then pending
      const remainingTerminalIds = getAllTerminalPaneIds(newPaneTree);
      const remainingSftpIds = getAllSftpPaneIds(newPaneTree);
      const remainingPendingIds = getAllPendingPaneIds(newPaneTree);
      const newFocusedPaneId =
        activeTab.focusedPaneId === paneId
          ? (remainingTerminalIds[0] || remainingSftpIds[0] || remainingPendingIds[0])
          : activeTab.focusedPaneId;

      setTabs(
        tabs.map((t) =>
          t.id === activeTabId
            ? { ...t, paneTree: newPaneTree, focusedPaneId: newFocusedPaneId }
            : t
        )
      );
    },
    [tabs, activeTabId, handleCloseTab]
  );

  const handleFocusPane = useCallback(
    (paneId: string) => {
      setTabs(
        tabs.map((t) =>
          t.id === activeTabId ? { ...t, focusedPaneId: paneId } : t
        )
      );
    },
    [tabs, activeTabId]
  );

  const handlePaneTreeChange = useCallback(
    (newTree: PaneNode) => {
      setTabs(
        tabs.map((t) =>
          t.id === activeTabId ? { ...t, paneTree: newTree } : t
        )
      );
    },
    [tabs, activeTabId]
  );

  // Handler to convert a pending pane to a local terminal
  const handlePendingSelectLocal = useCallback(
    (pendingPaneId: string) => {
      const activeTab = tabs.find((t) => t.id === activeTabId);
      if (!activeTab) return;

      const newPtySessionId = generateSessionId("pty");
      const newPaneTree = replacePendingWithTerminal(activeTab.paneTree, pendingPaneId, newPtySessionId);

      setTabs(
        tabs.map((t) =>
          t.id === activeTabId
            ? { ...t, paneTree: newPaneTree }
            : t
        )
      );
    },
    [tabs, activeTabId]
  );

  // Handler to duplicate the current SSH session in a pending pane
  const handlePendingSelectDuplicate = useCallback(
    async (pendingPaneId: string) => {
      const activeTab = tabs.find((t) => t.id === activeTabId);
      if (!activeTab || !activeTab.sshConfig) return;

      const config = activeTab.sshConfig;
      const ptySessionId = generateSessionId("ssh");

      try {
        const keyPath = await expandHomeDir(config.keyPath);

        await invoke("create_ssh_session", {
          sessionId: ptySessionId,
          host: config.host,
          port: config.port,
          username: config.username,
          password: config.password,
          keyPath,
          keyPassphrase: config.keyPassphrase,
        });

        const newPaneTree = replacePendingWithTerminal(activeTab.paneTree, pendingPaneId, ptySessionId);

        setTabs(
          tabs.map((t) =>
            t.id === activeTabId
              ? { ...t, paneTree: newPaneTree }
              : t
          )
        );

        pluginManager.notifySessionConnect({
          id: ptySessionId,
          type: 'ssh',
          host: config.host,
          port: config.port,
          username: config.username,
          status: 'connected',
        });
      } catch (error) {
        console.error("Failed to duplicate SSH session:", error);
        // On error, close the pending pane
        handleClosePane(pendingPaneId);
      }
    },
    [tabs, activeTabId, handleClosePane]
  );

  // Handler for selecting a saved session in a pending pane
  const handlePendingSelectSaved = useCallback(
    async (pendingPaneId: string, saved: SavedSession) => {
      const activeTab = tabs.find((t) => t.id === activeTabId);
      if (!activeTab) return;

      // Helper pour ouvrir le formulaire
      const openFormForCredentials = () => {
        handleClosePane(pendingPaneId);
        setEditingSessionId(saved.id);
        setInitialConnectionConfig({
          name: saved.name,
          host: saved.host,
          port: saved.port,
          username: saved.username,
          authType: saved.auth_type,
          keyPath: saved.key_path,
        });
        setConnectionError(t('app.pleaseEnterPassword'));
        setIsConnectionModalOpen(true);
      };

      try {
        // Essayer de récupérer les credentials
        let credentials: { password: string | null; key_passphrase: string | null };
        try {
          credentials = await invoke<{ password: string | null; key_passphrase: string | null }>(
            "get_session_credentials",
            { id: saved.id }
          );
        } catch (err) {
          // Vault verrouillé - ouvrir le formulaire

          openFormForCredentials();
          return;
        }

        const needsPassword = saved.auth_type === "password" && !credentials.password;
        if (needsPassword) {
          openFormForCredentials();
          return;
        }

        const ptySessionId = generateSessionId("ssh");
        const keyPath = await expandHomeDir(saved.key_path);

        await invoke("create_ssh_session", {
          sessionId: ptySessionId,
          host: saved.host,
          port: saved.port,
          username: saved.username,
          password: saved.auth_type === "password" ? credentials.password : null,
          keyPath: saved.auth_type === "key" ? keyPath : null,
          keyPassphrase: saved.auth_type === "key" ? credentials.key_passphrase : null,
        });

        const newPaneTree = replacePendingWithTerminal(activeTab.paneTree, pendingPaneId, ptySessionId);

        setTabs(
          tabs.map((t) =>
            t.id === activeTabId
              ? { ...t, paneTree: newPaneTree }
              : t
          )
        );

        pluginManager.notifySessionConnect({
          id: ptySessionId,
          type: 'ssh',
          host: saved.host,
          port: saved.port,
          username: saved.username,
          status: 'connected',
        });

        await addToRecentSessions({
          name: saved.name,
          host: saved.host,
          port: saved.port,
          username: saved.username,
          authType: saved.auth_type,
          keyPath: saved.key_path,
        });
      } catch (error) {
        console.error("Failed to connect to saved session:", error);
        handleClosePane(pendingPaneId);
      }
    },
    [tabs, activeTabId, handleClosePane, addToRecentSessions]
  );

  // Handler for selecting a recent session in a pending pane
  const handlePendingSelectRecent = useCallback(
    (pendingPaneId: string, recent: RecentSession) => {
      // Close the pending pane and open the connection modal with pre-filled config
      handleClosePane(pendingPaneId);
      setInitialConnectionConfig({
        name: recent.name,
        host: recent.host,
        port: recent.port,
        username: recent.username,
        authType: recent.auth_type,
        keyPath: recent.key_path,
      });
      setIsConnectionModalOpen(true);
    },
    [handleClosePane]
  );

  // Handler for selecting SFTP for an active SSH connection in a pending pane
  const handlePendingSelectSftp = useCallback(
    async (pendingPaneId: string, _sessionId: string, ptySessionId: string) => {
      const activeTab = tabs.find((t) => t.id === activeTabId);
      if (!activeTab) return;

      // Create a new SFTP session ID
      const sftpSessionId = generateSessionId("sftp-pane");

      // Find the tab that has this ptySessionId to get SSH config
      const sourceTab = tabs.find(t => {
        const ptyIds = getAllPtySessionIds(t.paneTree);
        return ptyIds.includes(ptySessionId);
      });

      if (!sourceTab?.sshConfig) {
        console.error("Could not find SSH config for session");
        return;
      }

      const config = sourceTab.sshConfig;

      try {
        // Get credentials if available
        let password: string | null = null;
        let keyPassphrase: string | null = null;

        // Try to get stored credentials
        try {
          // Find saved session with matching host/username
          const matchingSaved = savedSessions.find(
            s => s.host === config.host && s.username === config.username
          );
          if (matchingSaved) {
            const credentials = await invoke<{ password: string | null; key_passphrase: string | null }>(
              "get_session_credentials",
              { id: matchingSaved.id }
            );
            password = credentials.password;
            keyPassphrase = credentials.key_passphrase;
          }
        } catch (err) {

        }

        // Expand ~ in key path
        const keyPath = await expandHomeDir(config.keyPath);

        // Register SFTP session
        await invoke("register_sftp_session", {
          sessionId: sftpSessionId,
          host: config.host,
          port: config.port,
          username: config.username,
          password: config.authType === "password" ? (password || config.password) : null,
          keyPath: config.authType === "key" ? keyPath : null,
          keyPassphrase: config.authType === "key" ? (keyPassphrase || config.keyPassphrase) : null,
        });

        // Replace pending with SFTP pane
        const newPaneTree = replacePendingWithSftp(activeTab.paneTree, pendingPaneId, sftpSessionId, "/");

        setTabs(
          tabs.map((t) =>
            t.id === activeTabId
              ? { ...t, paneTree: newPaneTree }
              : t
          )
        );
      } catch (error) {
        console.error("Failed to open SFTP pane:", error);
        handleClosePane(pendingPaneId);
      }
    },
    [tabs, activeTabId, savedSessions, handleClosePane]
  );

  // Build active connections list for PanePicker
  const activeConnections: ActiveConnection[] = tabs
    .filter(t => t.type === "ssh")
    .flatMap(t => {
      const ptyIds = getAllPtySessionIds(t.paneTree);
      // Return one connection per SSH tab (use first ptyId)
      if (ptyIds.length > 0) {
        return [{
          tabId: t.id,
          sessionId: t.sessionId,
          ptySessionId: ptyIds[0],
          type: "ssh" as const,
          title: t.title,
          host: t.sshConfig?.host,
          username: t.sshConfig?.username,
        }];
      }
      return [];
    });

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if user is typing in an input/textarea (except terminal)
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA";

      // --- Tab management ---
      // Ctrl+T: New local terminal
      if (e.ctrlKey && !e.shiftKey && e.key === "t") {
        e.preventDefault();
        handleNewLocalTab();
        return;
      }
      // Ctrl+N: New SSH connection
      if (e.ctrlKey && !e.shiftKey && e.key === "n") {
        if (isInput) return;
        e.preventDefault();
        handleOpenConnectionModal();
        return;
      }
      // Ctrl+W: Close active tab
      if (e.ctrlKey && !e.shiftKey && e.key === "w") {
        e.preventDefault();
        if (activeTabId) handleCloseTab(activeTabId);
        return;
      }
      // Ctrl+ArrowLeft: Previous tab
      if (e.ctrlKey && !e.shiftKey && e.key === "ArrowLeft") {
        e.preventDefault();
        if (tabs.length > 1) {
          const currentIndex = tabs.findIndex((t) => t.id === activeTabId);
          const prevIndex = currentIndex <= 0 ? tabs.length - 1 : currentIndex - 1;
          setActiveTabId(tabs[prevIndex].id);
        }
        return;
      }
      // Ctrl+ArrowRight: Next tab
      if (e.ctrlKey && !e.shiftKey && e.key === "ArrowRight") {
        e.preventDefault();
        if (tabs.length > 1) {
          const currentIndex = tabs.findIndex((t) => t.id === activeTabId);
          const nextIndex = (currentIndex + 1) % tabs.length;
          setActiveTabId(tabs[nextIndex].id);
        }
        return;
      }
      // Ctrl+,: Open settings
      if (e.ctrlKey && !e.shiftKey && e.key === ",") {
        e.preventDefault();
        setIsSettingsOpen(true);
        return;
      }

      // --- Pane management (Ctrl+Shift) ---
      // Ctrl+Shift+D: Split vertical
      if (e.ctrlKey && e.shiftKey && e.key === "D") {
        e.preventDefault();
        handleSplitPane("vertical");
        return;
      }
      // Ctrl+Shift+E: Split horizontal
      if (e.ctrlKey && e.shiftKey && e.key === "E") {
        e.preventDefault();
        handleSplitPane("horizontal");
        return;
      }
      // Ctrl+Shift+W: Close current pane
      if (e.ctrlKey && e.shiftKey && e.key === "W") {
        e.preventDefault();
        const tab = tabs.find((t) => t.id === activeTabId);
        if (tab?.focusedPaneId) {
          handleClosePane(tab.focusedPaneId);
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSplitPane, handleClosePane, handleNewLocalTab, handleCloseTab, tabs, activeTabId]);

  const handleOpenConnectionModal = () => {
    setConnectionError(undefined);
    setInitialConnectionConfig(null);
    setEditingSessionId(null);
    setIsConnectionModalOpen(true);
    setOpenSidebar("none");
  };

  const activeTab = tabs.find((t) => t.id === activeTabId);

  // Command Palette handlers and context
  const commandHandlers: CommandHandlers = useMemo(
    () => ({
      newSshConnection: handleOpenConnectionModal,
      closeTab: () => {
        if (activeTabId) handleCloseTab(activeTabId);
      },
      duplicateTab: () => {
        if (activeTab?.sshConfig) {
          // Trigger a new SSH connection with the same config
          setInitialConnectionConfig(activeTab.sshConfig);
          setIsConnectionModalOpen(true);
        }
      },
      renameTab: () => {
        if (activeTabId) {
          const newName = window.prompt("Enter new tab name:", activeTab?.title);
          if (newName && newName.trim()) {
            setTabs(tabs.map((t) =>
              t.id === activeTabId ? { ...t, title: newName.trim() } : t
            ));
          }
        }
      },
      splitPane: () => handleSplitPane("vertical"),
      focusNextPane: () => {
        if (!activeTab) return;
        const paneIds = getAllTerminalPaneIds(activeTab.paneTree);
        if (paneIds.length <= 1) return;
        const currentIndex = paneIds.indexOf(activeTab.focusedPaneId || "");
        const nextIndex = (currentIndex + 1) % paneIds.length;
        handleFocusPane(paneIds[nextIndex]);
      },
      focusPrevPane: () => {
        if (!activeTab) return;
        const paneIds = getAllTerminalPaneIds(activeTab.paneTree);
        if (paneIds.length <= 1) return;
        const currentIndex = paneIds.indexOf(activeTab.focusedPaneId || "");
        const prevIndex = currentIndex <= 0 ? paneIds.length - 1 : currentIndex - 1;
        handleFocusPane(paneIds[prevIndex]);
      },
      nextTab: () => {
        if (tabs.length <= 1) return;
        const currentIndex = tabs.findIndex((t) => t.id === activeTabId);
        const nextIndex = (currentIndex + 1) % tabs.length;
        setActiveTabId(tabs[nextIndex].id);
      },
      prevTab: () => {
        if (tabs.length <= 1) return;
        const currentIndex = tabs.findIndex((t) => t.id === activeTabId);
        const prevIndex = currentIndex <= 0 ? tabs.length - 1 : currentIndex - 1;
        setActiveTabId(tabs[prevIndex].id);
      },
      openSettings: () => setIsSettingsOpen(true),
      openSftp: () => {
        if (activeTab?.type === "ssh" && activeTab.sshConfig) {
          // Find matching saved session to open SFTP
          const matchingSaved = savedSessions.find(
            (s) =>
              s.host === activeTab.sshConfig?.host &&
              s.username === activeTab.sshConfig?.username
          );
          if (matchingSaved) {
            handleOpenSftpTab(matchingSaved);
          }
        }
      },
    }),
    [
      activeTabId,
      activeTab,
      tabs,
      savedSessions,
      handleCloseTab,
      handleSplitPane,
      handleFocusPane,
      handleOpenSftpTab,
    ]
  );

  const commandContext: CommandContext = useMemo(
    () => ({
      hasActiveTab: !!activeTab,
      hasMultipleTabs: tabs.length > 1,
      hasMultiplePanes: activeTab
        ? getAllTerminalPaneIds(activeTab.paneTree).length > 1
        : false,
      isActiveTabSsh: activeTab?.type === "ssh",
    }),
    [activeTab, tabs.length]
  );

  const commandPalette = useCommandPalette({
    handlers: commandHandlers,
    context: commandContext,
  });

  // Global keyboard shortcut for Command Palette (Ctrl+Shift+P)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "P") {
        e.preventDefault();
        commandPalette.toggle();
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [commandPalette.toggle]);

  // Plugin callbacks
  const handleShowNotification = useCallback((message: string, type: NotificationType) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const handleShowModal = useCallback(async (_config: ModalConfig): Promise<unknown> => {
    // TODO: Implement plugin modal support
    // TODO: Implement plugin modal support
    return null;
  }, []);

  const getSessions = useCallback((): SessionInfo[] => {
    return tabs.map(tab => {
      const ptyIds = getAllPtySessionIds(tab.paneTree);
      return {
        id: ptyIds[0] || tab.sessionId,
        type: tab.type === "local" ? "local" : "ssh",
        host: tab.sshConfig?.host,
        port: tab.sshConfig?.port,
        username: tab.sshConfig?.username,
        status: "connected" as const,
      };
    });
  }, [tabs]);

  const getActiveSessionInfo = useCallback((): SessionInfo | null => {
    if (!activeTab) return null;
    const ptyIds = getAllPtySessionIds(activeTab.paneTree);
    return {
      id: ptyIds[0] || activeTab.sessionId,
      type: activeTab.type === "local" ? "local" : "ssh",
      host: activeTab.sshConfig?.host,
      port: activeTab.sshConfig?.port,
      username: activeTab.sshConfig?.username,
      status: "connected" as const,
    };
  }, [activeTab]);

  // Status bar visibility (hidden by default, can be enabled for plugins)
  const statusBarVisible = appSettings.ui?.statusBarVisible ?? false;

  return (
    <div className="relative h-screen bg-terminal overflow-hidden">
      {/* Terminal area - sous la titlebar, au dessus de la status bar */}
      <div className={`absolute inset-x-0 bottom-0 ${statusBarVisible ? "top-[72px]" : "top-10"}`}>
        {tabs.length === 0 ? (
          <EmptyState onNewConnection={handleOpenConnectionModal} />
        ) : (
          /* Render ALL tabs, hide inactive ones to preserve state */
          tabs.map((tab) => (
            <div
              key={tab.id}
              className={`absolute inset-0 ${
                tab.id === activeTabId ? "visible" : "invisible"
              }`}
            >
              {/* SFTP tabs render SftpBrowser directly */}
              {tab.type === "sftp" ? (
                <SftpBrowser sessionId={tab.sessionId} initialPath="/" />
              ) : tab.type === "tunnel" ? (
                /* Tunnel tabs render TunnelManager directly (embedded, not modal) */
                <div className="w-full h-full flex items-center justify-center bg-base p-6">
                  <div className="w-full max-w-2xl h-full">
                    <TunnelManager
                      isOpen={true}
                      onClose={() => {}} // No-op, can't close embedded view
                      sessionId={tab.sessionId}
                      sessionName={tab.title.replace("Tunnels - ", "")}
                      embedded={true}
                    />
                  </div>
                </div>
              ) : (
                <SplitPane
                  node={tab.paneTree}
                  onNodeChange={handlePaneTreeChange}
                  focusedPaneId={tab.focusedPaneId}
                  onFocusPane={handleFocusPane}
                  onClosePane={handleClosePane}
                  onSplitPane={handleSplitPaneById}
                  sessionType={tab.type as "local" | "ssh"}
                  onOpenTunnels={tab.type === "ssh" ? () => setTunnelManagerTabId(tab.id) : undefined}
                  renderTerminal={(_paneId, ptySessionId, isFocused) => (
                    <TerminalPane
                      key={ptySessionId}
                      sessionId={ptySessionId}
                      type={tab.type as "local" | "ssh"}
                      isActive={tab.id === activeTabId && isFocused}
                      appTheme={appSettings.appearance?.theme ?? "dark"}
                      terminalSettings={appSettings.terminal}
                    />
                  )}
                  renderSftp={(_paneId, sessionId, initialPath) => (
                    <SftpBrowser
                      key={sessionId}
                      sessionId={sessionId}
                      initialPath={initialPath}
                    />
                  )}
                  renderPending={(paneId) => (
                    <PanePicker
                      onSelectLocal={() => handlePendingSelectLocal(paneId)}
                      onSelectDuplicate={() => handlePendingSelectDuplicate(paneId)}
                      onSelectSaved={(session) => handlePendingSelectSaved(paneId, session)}
                      onSelectRecent={(session) => handlePendingSelectRecent(paneId, session)}
                      onSelectSftpForConnection={(sessionId, ptySessionId) => handlePendingSelectSftp(paneId, sessionId, ptySessionId)}
                      currentSessionConfig={tab.sshConfig}
                      savedSessions={savedSessions}
                      recentSessions={recentSessions}
                      activeConnections={activeConnections}
                    />
                  )}
                />
              )}
            </div>
          ))
        )}
      </div>

      {/* Floating tabs overlay */}
      <FloatingTabs
        tabs={tabs}
        activeTabId={activeTabId}
        onTabSelect={setActiveTabId}
        onTabClose={handleCloseTab}
        onNewTab={handleOpenConnectionModal}
        onLocalTerminal={handleNewLocalTab}
        onRecentSessionConnect={handleConnectToRecentSession}
        recentSessions={recentSessions}
        onToggleSidebar={() => setOpenSidebar(openSidebar === "menu" ? "none" : "menu")}
        isSidebarOpen={isSidebarOpen}
        onToggleTunnelSidebar={() => setOpenSidebar(openSidebar === "tunnel" ? "none" : "tunnel")}
        isTunnelSidebarOpen={isTunnelSidebarOpen}
        activeTunnelCount={activeTunnelCount}
        vaultConfigured={vault.status?.exists ?? false}
        vaultLocked={!vault.status?.isUnlocked}
        onVaultClick={() => {
          if (vault.status?.isUnlocked) {
            lockVault();
          } else {
            openVaultUnlock();
          }
        }}
      />

      {/* Sidebar drawer */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setOpenSidebar("none")}
        savedSessions={savedSessions}
        folders={folders}
        recentSessions={recentSessions}
        onSavedSessionConnect={handleConnectToSavedSession}
        onSavedSessionEdit={handleEditSavedSession}
        onSavedSessionDelete={handleDeleteSavedSession}
        onSavedSessionSftp={handleOpenSftpTab}
        onSavedSessionTunnel={handleOpenTunnelTab}
        onRecentSessionConnect={handleConnectToRecentSession}
        onRecentSessionDelete={handleDeleteRecentSession}
        onClearRecentSessions={handleClearRecentSessions}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onCreateFolder={createFolder}
        onUpdateFolder={updateFolder}
        onDeleteFolder={deleteFolder}
        onMoveSessionToFolder={moveSessionToFolder}
      />

      {/* Connection Modal */}
      <Modal
        isOpen={isConnectionModalOpen}
        onClose={() => {
          setIsConnectionModalOpen(false);
          setInitialConnectionConfig(null);
          setConnectionError(undefined);
          setEditingSessionId(null);
          setPendingSftpSession(null);
        }}
        title={editingSessionId ? t('app.editConnection') : (pendingSftpSession ? t('app.sftpConnection') : (initialConnectionConfig ? t('app.reconnectSsh') : t('app.newSshConnection')))}
        width="md"
      >
        <ConnectionForm
          onConnect={handleSshConnect}
          onCancel={() => {
            setIsConnectionModalOpen(false);
            setInitialConnectionConfig(null);
            setConnectionError(undefined);
            setEditingSessionId(null);
            setPendingSftpSession(null);
          }}
          isConnecting={isConnecting}
          error={connectionError}
          initialConfig={initialConnectionConfig}
        />
      </Modal>

      {/* Save Session Modal */}
      <Modal
        isOpen={isSaveModalOpen}
        onClose={() => {
          setIsSaveModalOpen(false);
          setPendingSaveConfig(null);
          setEditingSessionId(null);
        }}
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
              onClick={() => {
                setIsSaveModalOpen(false);
                setPendingSaveConfig(null);
                setEditingSessionId(null);
              }}
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
      <HostKeyModal
        isOpen={isHostKeyModalOpen}
        result={hostKeyResult}
        onAccept={handleHostKeyAccept}
        onReject={handleHostKeyReject}
        isLoading={hostKeyLoading}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={appSettings}
        onSettingsChange={handleSettingsChange}
        savedSessionsCount={savedSessions.length}
        onClearAllSessions={() => clearAllSavedSessions(savedSessions)}
      />

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

      {/* Tunnel Manager Modal (for SSH session tunnels) */}
      {tunnelManagerTabId && (() => {
        const tab = tabs.find(t => t.id === tunnelManagerTabId);
        if (!tab || tab.type !== "ssh") return null;
        return (
          <TunnelManager
            isOpen={true}
            onClose={() => setTunnelManagerTabId(null)}
            sessionId={tab.sessionId}
            sessionName={tab.title}
          />
        );
      })()}

      {/* Tunnel Sidebar (standalone tunnels) */}
      <TunnelSidebar
        isOpen={isTunnelSidebarOpen}
        onClose={() => setOpenSidebar("none")}
        savedSessions={savedSessions}
        onTunnelCountChange={setActiveTunnelCount}
      />

      {/* Plugin Host */}
      <PluginHost
        onShowNotification={handleShowNotification}
        onShowModal={handleShowModal}
        getSessions={getSessions}
        getActiveSession={getActiveSessionInfo}
      />

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

      {/* Vault Setup Modal */}
      <VaultSetupModal
        isOpen={showVaultSetup}
        onClose={closeVaultSetup}
        onSetup={handleVaultSetup}
        onSkip={handleVaultSetupSkip}
        canSkip={true}
      />

      {/* Vault Unlock Modal */}
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

      {/* Status Bar (hidden by default, for plugin widgets) */}
      <StatusBar visible={statusBarVisible} />
    </div>
  );
}

function EmptyState({ onNewConnection }: { onNewConnection: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="h-full flex flex-col items-center justify-center">
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-accent/[0.02]" />

      <div className="relative flex flex-col items-center gap-8">
        {/* Logo mark */}
        <div className="relative">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-surface-0/40 to-surface-0/20 flex items-center justify-center border border-surface-0/30">
            <span className="text-4xl text-accent/70">⬡</span>
          </div>
          <div className="absolute -inset-4 bg-accent/5 rounded-full blur-2xl -z-10" />
        </div>

        {/* Text */}
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-text tracking-tight mb-2">
            SimplyTerm
          </h1>
          <p className="text-sm text-text-muted max-w-xs">
            {t('app.tagline')}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={onNewConnection}
            className="px-5 py-2.5 bg-accent text-crust text-sm font-medium rounded-xl hover:bg-accent-hover transition-colors"
          >
            {t('app.newConnection')}
          </button>
        </div>

        {/* Keyboard shortcut hint */}
        <p className="text-xs text-text-muted/60">
          {t('app.shortcutHint')}
        </p>
      </div>
    </div>
  );
}

export default App;
