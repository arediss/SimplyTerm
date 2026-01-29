import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import Sidebar from "./components/Sidebar";
import FloatingTabs from "./components/FloatingTabs";
import TerminalPane from "./components/TerminalPane";
import Modal from "./components/Modal";
import ConnectionForm, { SshConnectionConfig } from "./components/ConnectionForm";
import SettingsModal, { AppSettings, defaultSettings } from "./components/SettingsModal";
import DebugStats from "./components/DebugStats";
import { PluginHost, pluginManager, type SessionInfo, type ModalConfig, type NotificationType } from "./plugins";

export interface Session {
  id: string;
  name: string;
  type: "ssh" | "local" | "sftp";
  host?: string;
  user?: string;
  status: "connected" | "disconnected" | "connecting";
}

export interface SavedSession {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  auth_type: "password" | "key";
  key_path?: string;
}

export interface RecentSession {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  auth_type: "password" | "key";
  key_path?: string;
  last_used: number;
}

export interface Tab {
  id: string;
  sessionId: string;
  ptySessionId: string;
  title: string;
  type: "local" | "ssh";
  sshConfig?: SshConnectionConfig;
}

function App() {
  const [sessions] = useState<Session[]>([]);
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>([]);
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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

  // Settings state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings>(defaultSettings);

  // Notification state (for plugins)
  const [notification, setNotification] = useState<{ message: string; type: NotificationType } | null>(null);

  // Charger les sessions sauvegardées au démarrage
  const loadSavedSessions = useCallback(async () => {
    try {
      const sessions = await invoke<SavedSession[]>("load_saved_sessions");
      setSavedSessions(sessions);
    } catch (error) {
      console.error("Failed to load saved sessions:", error);
    }
  }, []);

  // Charger les sessions récentes au démarrage
  const loadRecentSessions = useCallback(async () => {
    try {
      const sessions = await invoke<RecentSession[]>("get_recent_sessions");
      setRecentSessions(sessions);
    } catch (error) {
      console.error("Failed to load recent sessions:", error);
    }
  }, []);

  // Load app settings on startup
  const loadAppSettings = useCallback(async () => {
    try {
      const settings = await invoke<AppSettings>("load_settings");
      setAppSettings(settings);
    } catch (error) {
      console.error("Failed to load settings:", error);
    }
  }, []);

  // Save settings when changed
  const handleSettingsChange = useCallback(async (newSettings: AppSettings) => {
    setAppSettings(newSettings);
    try {
      await invoke("save_settings", { settings: newSettings });
    } catch (error) {
      console.error("Failed to save settings:", error);
    }
  }, []);

  useEffect(() => {
    loadSavedSessions();
    loadRecentSessions();
    loadAppSettings();
  }, [loadSavedSessions, loadRecentSessions, loadAppSettings]);

  const handleNewLocalTab = () => {
    const ptySessionId = `pty-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newTab: Tab = {
      id: `tab-${Date.now()}`,
      sessionId: "local",
      ptySessionId,
      title: "Terminal",
      type: "local",
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(newTab.id);
    setIsSidebarOpen(false);
  };

  const handleSshConnect = async (config: SshConnectionConfig) => {
    setIsConnecting(true);
    setConnectionError(undefined);

    const ptySessionId = `ssh-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      let keyPath = config.keyPath;
      if (keyPath?.startsWith("~")) {
        const home = await invoke<string>("get_home_dir").catch(() => "");
        if (home) {
          keyPath = keyPath.replace("~", home);
        }
      }

      await invoke("create_ssh_session", {
        sessionId: ptySessionId,
        host: config.host,
        port: config.port,
        username: config.username,
        password: config.password,
        keyPath,
        keyPassphrase: config.keyPassphrase,
      });

      const newTab: Tab = {
        id: `tab-${Date.now()}`,
        sessionId: `ssh-${config.host}`,
        ptySessionId,
        title: config.name,
        type: "ssh",
        sshConfig: config,
      };

      setTabs([...tabs, newTab]);
      setActiveTabId(newTab.id);
      setIsConnectionModalOpen(false);
      setIsSidebarOpen(false);
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
      await invoke("add_to_recent", {
        name: config.name,
        host: config.host,
        port: config.port,
        username: config.username,
        authType: config.authType,
        keyPath: config.keyPath,
      });
      await loadRecentSessions();

      // Si on était en mode édition, proposer de mettre à jour
      if (editingSessionId) {
        setPendingSaveConfig(config);
        setIsSaveModalOpen(true);
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

  // Sauvegarder une session
  const handleSaveSession = async () => {
    if (!pendingSaveConfig) return;

    const config = pendingSaveConfig;
    // Utiliser l'ID existant si on édite, sinon en générer un nouveau
    const sessionId = editingSessionId || `saved-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

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

  // Supprimer une session sauvegardée
  const handleDeleteSavedSession = async (sessionId: string) => {
    try {
      await invoke("delete_saved_session", { id: sessionId });
      await loadSavedSessions();
    } catch (error) {
      console.error("Failed to delete session:", error);
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
    setIsSidebarOpen(false);
  };

  // Se connecter à une session sauvegardée
  const handleConnectToSavedSession = async (saved: SavedSession) => {
    setIsSidebarOpen(false);

    try {
      // Récupérer les credentials
      const credentials = await invoke<{ password: string | null; key_passphrase: string | null }>(
        "get_session_credentials",
        { id: saved.id }
      );

      // Vérifier si on a les credentials nécessaires
      // Pour password auth: on a besoin du password
      // Pour key auth: la passphrase est optionnelle (certaines clés n'en ont pas)
      const needsPassword = saved.auth_type === "password" && !credentials.password;

      // Si password manquant, ouvrir le formulaire pré-rempli
      if (needsPassword) {
        console.log("[SavedSession] Credentials missing, opening form");
        setInitialConnectionConfig({
          name: saved.name,
          host: saved.host,
          port: saved.port,
          username: saved.username,
          authType: saved.auth_type,
          keyPath: saved.key_path,
        });
        setConnectionError("Veuillez entrer votre mot de passe");
        setIsConnectionModalOpen(true);
        return;
      }

      // Credentials trouvés, on se connecte directement
      setIsConnecting(true);
      setConnectionError(undefined);

      const ptySessionId = `ssh-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      let keyPath = saved.key_path;
      if (keyPath?.startsWith("~")) {
        const home = await invoke<string>("get_home_dir").catch(() => "");
        if (home) {
          keyPath = keyPath.replace("~", home);
        }
      }

      await invoke("create_ssh_session", {
        sessionId: ptySessionId,
        host: saved.host,
        port: saved.port,
        username: saved.username,
        password: saved.auth_type === "password" ? credentials.password : null,
        keyPath: saved.auth_type === "key" ? keyPath : null,
        keyPassphrase: saved.auth_type === "key" ? credentials.key_passphrase : null,
      });

      const newTab: Tab = {
        id: `tab-${Date.now()}`,
        sessionId: `ssh-${saved.host}`,
        ptySessionId,
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
      };

      setTabs(prevTabs => [...prevTabs, newTab]);
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
      await invoke("add_to_recent", {
        name: saved.name,
        host: saved.host,
        port: saved.port,
        username: saved.username,
        authType: saved.auth_type,
        keyPath: saved.key_path,
      });
      await loadRecentSessions();
    } catch (error) {
      console.error("[SavedSession] SSH connection failed:", error);
      setConnectionError(String(error));
      setIsConnecting(false);
    }
  };

  // Se connecter à une session récente (demande les credentials)
  const handleConnectToRecentSession = async (_recent: RecentSession) => {
    // TODO: Pré-remplir le formulaire avec les infos de la session récente
    setIsConnectionModalOpen(true);
    setIsSidebarOpen(false);
  };

  // Supprimer une session récente
  const handleDeleteRecentSession = async (sessionId: string) => {
    try {
      await invoke("remove_from_recent", { id: sessionId });
      await loadRecentSessions();
    } catch (error) {
      console.error("Failed to delete recent session:", error);
    }
  };

  // Vider l'historique des sessions récentes
  const handleClearRecentSessions = async () => {
    try {
      await invoke("clear_recent");
      await loadRecentSessions();
    } catch (error) {
      console.error("Failed to clear recent sessions:", error);
    }
  };

  // Supprimer toutes les sessions sauvegardées
  const handleClearAllSavedSessions = async () => {
    try {
      // Supprimer chaque session une par une
      for (const session of savedSessions) {
        await invoke("delete_saved_session", { id: session.id });
      }
      await loadSavedSessions();
      // Vider aussi les récentes
      await invoke("clear_recent");
      await loadRecentSessions();
    } catch (error) {
      console.error("Failed to clear all sessions:", error);
    }
  };

  const handleCloseTab = (tabId: string) => {
    const tabToClose = tabs.find((t) => t.id === tabId);
    if (tabToClose) {
      invoke("close_pty_session", { sessionId: tabToClose.ptySessionId }).catch(
        console.error
      );
      // Notify plugins of session disconnect (use ptySessionId to match connect)
      pluginManager.notifySessionDisconnect(tabToClose.ptySessionId);
    }
    const newTabs = tabs.filter((t) => t.id !== tabId);
    setTabs(newTabs);
    if (activeTabId === tabId) {
      setActiveTabId(newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null);
    }
  };

  const handleOpenConnectionModal = () => {
    setConnectionError(undefined);
    setInitialConnectionConfig(null);
    setEditingSessionId(null);
    setIsConnectionModalOpen(true);
    setIsSidebarOpen(false);
  };

  const activeTab = tabs.find((t) => t.id === activeTabId);

  // Plugin callbacks
  const handleShowNotification = useCallback((message: string, type: NotificationType) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const handleShowModal = useCallback(async (_config: ModalConfig): Promise<unknown> => {
    // TODO: Implement plugin modal support
    console.log("Plugin modal requested:", _config);
    return null;
  }, []);

  const getSessions = useCallback((): SessionInfo[] => {
    return tabs.map(tab => ({
      id: tab.ptySessionId,
      type: tab.type === "local" ? "local" : "ssh",
      host: tab.sshConfig?.host,
      port: tab.sshConfig?.port,
      username: tab.sshConfig?.username,
      status: "connected" as const,
    }));
  }, [tabs]);

  const getActiveSessionInfo = useCallback((): SessionInfo | null => {
    if (!activeTab) return null;
    return {
      id: activeTab.ptySessionId,
      type: activeTab.type === "local" ? "local" : "ssh",
      host: activeTab.sshConfig?.host,
      port: activeTab.sshConfig?.port,
      username: activeTab.sshConfig?.username,
      status: "connected" as const,
    };
  }, [activeTab]);

  return (
    <div className="relative h-screen bg-terminal overflow-hidden">
      {/* Terminal area - sous la titlebar */}
      <div className="absolute inset-0 top-10">
        {tabs.length === 0 ? (
          <EmptyState onNewConnection={handleOpenConnectionModal} />
        ) : (
          /* Render ALL terminals, hide inactive ones to preserve state */
          tabs.map((tab) => (
            <div
              key={tab.ptySessionId}
              className={`absolute inset-0 ${
                tab.id === activeTabId ? "visible" : "invisible"
              }`}
            >
              <TerminalPane
                sessionId={tab.ptySessionId}
                type={tab.type}
                isActive={tab.id === activeTabId}
              />
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
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        isSidebarOpen={isSidebarOpen}
      />

      {/* Sidebar drawer */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        sessions={sessions}
        savedSessions={savedSessions}
        recentSessions={recentSessions}
        onLocalTerminal={handleNewLocalTab}
        onSessionSelect={() => {}}
        onSavedSessionConnect={handleConnectToSavedSession}
        onSavedSessionEdit={handleEditSavedSession}
        onSavedSessionDelete={handleDeleteSavedSession}
        onRecentSessionConnect={handleConnectToRecentSession}
        onRecentSessionDelete={handleDeleteRecentSession}
        onClearRecentSessions={handleClearRecentSessions}
        onNewConnection={handleOpenConnectionModal}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Connection Modal */}
      <Modal
        isOpen={isConnectionModalOpen}
        onClose={() => {
          setIsConnectionModalOpen(false);
          setInitialConnectionConfig(null);
          setConnectionError(undefined);
          setEditingSessionId(null);
        }}
        title={editingSessionId ? "Modifier la connexion" : (initialConnectionConfig ? "Reconnexion SSH" : "Nouvelle connexion SSH")}
        width="md"
      >
        <ConnectionForm
          onConnect={handleSshConnect}
          onCancel={() => {
            setIsConnectionModalOpen(false);
            setInitialConnectionConfig(null);
            setConnectionError(undefined);
            setEditingSessionId(null);
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
        title={editingSessionId ? "Mettre à jour la connexion ?" : "Sauvegarder la connexion ?"}
        width="sm"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-muted">
            {editingSessionId
              ? "Voulez-vous mettre à jour cette connexion avec les nouvelles informations ?"
              : "Voulez-vous sauvegarder cette connexion pour y accéder rapidement ?"
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
              Non merci
            </button>
            <button
              onClick={handleSaveSession}
              className="flex-1 py-2.5 bg-accent text-base font-medium text-sm rounded-lg hover:bg-accent/90 transition-colors"
            >
              {editingSessionId ? "Mettre à jour" : "Sauvegarder"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={appSettings}
        onSettingsChange={handleSettingsChange}
        savedSessionsCount={savedSessions.length}
        onClearAllSessions={handleClearAllSavedSessions}
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

      {/* Debug Stats - only in dev */}
      {import.meta.env.DEV && <DebugStats />}
    </div>
  );
}

function EmptyState({ onNewConnection }: { onNewConnection: () => void }) {
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
            Terminal SSH moderne, rapide et élégant
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={onNewConnection}
            className="px-5 py-2.5 bg-accent text-crust text-sm font-medium rounded-xl hover:bg-accent-hover transition-colors"
          >
            Nouvelle connexion
          </button>
        </div>

        {/* Keyboard shortcut hint */}
        <p className="text-xs text-text-muted/60">
          Appuyez sur{" "}
          <kbd className="px-1.5 py-0.5 bg-surface-0/30 rounded text-text-muted">
            ⌘
          </kbd>{" "}
          +{" "}
          <kbd className="px-1.5 py-0.5 bg-surface-0/30 rounded text-text-muted">
            N
          </kbd>{" "}
          pour créer une connexion
        </p>
      </div>
    </div>
  );
}

export default App;
