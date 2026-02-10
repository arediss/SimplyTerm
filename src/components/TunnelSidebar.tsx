import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { getErrorMessage } from "../utils";
import { invoke } from "@tauri-apps/api/core";
import {
  X,
  ArrowLeftRight,
  ArrowRight,
  ArrowLeft,
  Globe,
  Plus,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { SavedSession } from "../types";

interface Tunnel {
  id: string;
  session_id: string;
  tunnel_type: "local" | "remote" | "dynamic";
  local_port: number;
  remote_host: string;
  remote_port: number;
  status: {
    state: "Starting" | "Active" | "Stopped" | "Error";
    error?: string;
  };
  bytes_transferred: number;
}

interface TunnelSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  savedSessions: SavedSession[];
  onTunnelCountChange?: (count: number) => void;
}

export default function TunnelSidebar({
  isOpen,
  onClose,
  savedSessions,
  onTunnelCountChange
}: Readonly<TunnelSidebarProps>) {
  const { t } = useTranslation();
  const [isAnimating, setIsAnimating] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [tunnels, setTunnels] = useState<Tunnel[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);

  // Form state
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [tunnelType, setTunnelType] = useState<"local" | "remote" | "dynamic">("local");
  const [localPort, setLocalPort] = useState("");
  const [remoteHost, setRemoteHost] = useState("127.0.0.1");
  const [remotePort, setRemotePort] = useState("");

  // Animation handling - fermeture immédiate (pas d'animation de sortie pour éviter conflit avec menu sidebar)
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      // Petit délai pour permettre au DOM de se mettre à jour avant l'animation
      requestAnimationFrame(() => setIsAnimating(true));
    } else {
      setIsAnimating(false);
      setShouldRender(false); // Fermeture immédiate
    }
  }, [isOpen]);

  // Reset form when closing
  useEffect(() => {
    if (!isOpen) {
      setShowNewForm(false);
      setError(null);
    }
  }, [isOpen]);

  const isMountedRef = useRef(true);
  useEffect(() => { isMountedRef.current = true; return () => { isMountedRef.current = false; }; }, []);

  const onTunnelCountChangeRef = useRef(onTunnelCountChange);
  onTunnelCountChangeRef.current = onTunnelCountChange;

  const loadTunnels = useCallback(async () => {
    setLoading(true);
    try {
      const list = await invoke<Tunnel[]>("tunnel_list", {});
      if (!isMountedRef.current) return;
      setTunnels(list);
      const activeCount = list.filter(t => t.status.state === "Active" || t.status.state === "Starting").length;
      onTunnelCountChangeRef.current?.(activeCount);
    } catch (err) {
      console.error("Failed to load tunnels:", err);
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    loadTunnels();
    const interval = setInterval(loadTunnels, 5000);
    return () => clearInterval(interval);
  }, [isOpen, loadTunnels]);

  const createTunnel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSessionId) {
      setError(t('tunnelSidebar.selectConnection'));
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const session = savedSessions.find(s => s.id === selectedSessionId);
      if (!session) {
        setError("Session not found");
        setCreating(false);
        return;
      }

      // Get credentials from vault
      let credentials: { password: string | null; key_passphrase: string | null };
      try {
        credentials = await invoke<{ password: string | null; key_passphrase: string | null }>(
          "get_session_credentials",
          { id: session.id }
        );
      } catch (err) {
        setError(t('tunnelSidebar.vaultLocked'));
        setCreating(false);
        return;
      }

      // Check if we have the required credentials
      if (session.auth_type === "password" && !credentials.password) {
        setError(t('tunnelSidebar.passwordNotFound'));
        setCreating(false);
        return;
      }

      // Generate unique session ID
      const sshSessionId = `tunnel-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

      // Expand ~ in key path
      let keyPath = session.key_path;
      if (keyPath?.startsWith("~")) {
        const home = await invoke<string>("get_home_dir").catch(() => "");
        if (home) {
          keyPath = keyPath.replace("~", home);
        }
      }

      // Register SSH session for tunnel
      await invoke("register_sftp_session", {
        sessionId: sshSessionId,
        host: session.host,
        port: session.port,
        username: session.username,
        password: session.auth_type === "password" ? credentials.password : null,
        keyPath: session.auth_type === "key" ? keyPath : null,
        keyPassphrase: session.auth_type === "key" ? credentials.key_passphrase : null,
      });

      // Create tunnel
      await invoke("tunnel_create", {
        sessionId: sshSessionId,
        tunnelType,
        localPort: Number.parseInt(localPort),
        remoteHost: tunnelType === "dynamic" ? undefined : remoteHost,
        remotePort: tunnelType === "dynamic" ? undefined : Number.parseInt(remotePort),
      });

      // Reset form
      setLocalPort("");
      setRemoteHost("127.0.0.1");
      setRemotePort("");
      setShowNewForm(false);
      await loadTunnels();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const stopTunnel = async (tunnelId: string) => {
    try {
      await invoke("tunnel_stop", { tunnelId });
      await loadTunnels();
    } catch (err) {
      console.error("Failed to stop tunnel:", err);
    }
  };

  const removeTunnel = async (tunnelId: string) => {
    try {
      await invoke("tunnel_remove", { tunnelId });
      await loadTunnels();
    } catch (err) {
      console.error("Failed to remove tunnel:", err);
    }
  };

  const getTunnelIcon = (type: string) => {
    switch (type) {
      case "local": return <ArrowRight size={12} className="text-blue" />;
      case "remote": return <ArrowLeft size={12} className="text-green" />;
      case "dynamic": return <Globe size={12} className="text-mauve" />;
      default: return <ArrowLeftRight size={12} />;
    }
  };

  const getStatusColor = (status: Tunnel["status"]) => {
    switch (status.state) {
      case "Active": return "text-green";
      case "Starting": return "text-yellow";
      case "Error": return "text-red";
      default: return "text-text-muted";
    }
  };

  const activeTunnels = tunnels.filter(t => t.status.state === "Active" || t.status.state === "Starting");
  const inactiveTunnels = tunnels.filter(t => t.status.state !== "Active" && t.status.state !== "Starting");

  if (!shouldRender) return null;

  return (
    <>
      {/* Backdrop - sous la titlebar */}
      <div
        className={`fixed inset-0 top-10 z-30 bg-black/40 transition-opacity duration-200 ${
          isAnimating ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Sidebar panel - flottant à gauche */}
      <div
        className={`
          fixed top-14 left-3 bottom-3 z-40 w-80
          bg-mantle/98 backdrop-blur-sm border border-surface-0/50 rounded-2xl
          flex flex-col shadow-2xl overflow-hidden
          ${isAnimating ? "animate-slide-in" : "animate-slide-out"}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-0/30">
          <div className="flex items-center gap-2">
            <ArrowLeftRight size={16} className="text-accent" />
            <span className="text-sm font-medium text-text">{t('tunnelSidebar.title')}</span>
            {activeTunnels.length > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-accent/20 text-accent rounded-full">
                {activeTunnels.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={loadTunnels}
              disabled={loading}
              className="p-1.5 text-text-muted hover:text-text hover:bg-surface-0/50 rounded-lg transition-colors"
              title={t('common.refresh')}
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-text-muted hover:text-text hover:bg-surface-0/50 rounded-lg transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* New Tunnel Button/Form */}
          <div className="p-3 border-b border-surface-0/30">
            {showNewForm ? (
              <form onSubmit={createTunnel} className="space-y-3">
                {/* Session selector */}
                <div>
                  <label className="block text-xs text-text-muted mb-1">{t('tunnelSidebar.sshConnection')}</label>
                  <select
                    value={selectedSessionId}
                    onChange={(e) => setSelectedSessionId(e.target.value)}
                    className="w-full px-2.5 py-2 bg-surface-0/50 border border-surface-0 rounded-xl text-sm text-text focus:outline-none focus:border-accent/50"
                  >
                    <option value="">{t('tunnelSidebar.selectPlaceholder')}</option>
                    {savedSessions.map(session => (
                      <option key={session.id} value={session.id}>
                        {session.name} ({session.username}@{session.host})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tunnel type */}
                <div>
                  <label className="block text-xs text-text-muted mb-1">{t('tunnelSidebar.type')}</label>
                  <div className="flex gap-1">
                    {(["local", "remote", "dynamic"] as const).map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setTunnelType(type)}
                        className={`flex-1 px-2 py-2 text-xs rounded-xl border transition-colors ${
                          tunnelType === type
                            ? "bg-accent/20 border-accent/50 text-accent"
                            : "border-surface-0 text-text-muted hover:text-text hover:border-surface-0/80"
                        }`}
                      >
                        {getTunnelTypeLabel(type)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Port config */}
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-xs text-text-muted mb-1">{t('tunnelSidebar.localPort')}</label>
                    <input
                      type="number"
                      value={localPort}
                      onChange={(e) => setLocalPort(e.target.value)}
                      className="w-full px-2.5 py-2 bg-surface-0/50 border border-surface-0 rounded-xl text-sm text-text focus:outline-none focus:border-accent/50"
                      placeholder="8080"
                    />
                  </div>
                  {tunnelType !== "dynamic" && (
                    <div className="flex-1">
                      <label className="block text-xs text-text-muted mb-1">{t('tunnelSidebar.remotePort')}</label>
                      <input
                        type="number"
                        value={remotePort}
                        onChange={(e) => setRemotePort(e.target.value)}
                        className="w-full px-2.5 py-2 bg-surface-0/50 border border-surface-0 rounded-xl text-sm text-text focus:outline-none focus:border-accent/50"
                        placeholder="3306"
                      />
                    </div>
                  )}
                </div>

                {/* Remote host */}
                {tunnelType !== "dynamic" && (
                  <div>
                    <label className="block text-xs text-text-muted mb-1">{t('tunnelSidebar.remoteHost')}</label>
                    <input
                      type="text"
                      value={remoteHost}
                      onChange={(e) => setRemoteHost(e.target.value)}
                      className="w-full px-2.5 py-2 bg-surface-0/50 border border-surface-0 rounded-xl text-sm text-text focus:outline-none focus:border-accent/50"
                      placeholder="127.0.0.1"
                    />
                  </div>
                )}

                {error && (
                  <div className="flex items-center gap-2 p-2.5 bg-red/10 border border-red/20 rounded-xl text-xs text-red">
                    <AlertCircle size={12} />
                    <span className="truncate">{error}</span>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewForm(false);
                      setError(null);
                    }}
                    className="flex-1 px-3 py-2 text-sm text-text-muted hover:text-text border border-surface-0 hover:border-surface-0/80 rounded-xl transition-colors"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={creating || !selectedSessionId || !localPort}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-accent hover:bg-accent-hover text-crust text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
                  >
                    {creating ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Plus size={14} />
                    )}
                    {t('common.create')}
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setShowNewForm(true)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-accent hover:bg-accent-hover text-crust rounded-xl text-sm font-medium transition-colors"
              >
                <Plus size={14} />
                {t('tunnelSidebar.newTunnel')}
              </button>
            )}
          </div>

          {/* Active Tunnels */}
          {activeTunnels.length > 0 && (
            <div className="p-3">
              <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                {t('tunnelSidebar.active')}
              </span>
              <div className="mt-2 space-y-2">
                {activeTunnels.map(tunnel => (
                  <TunnelItem
                    key={tunnel.id}
                    tunnel={tunnel}
                    onStop={() => stopTunnel(tunnel.id)}
                    onRemove={() => removeTunnel(tunnel.id)}
                    getTunnelIcon={getTunnelIcon}
                    getStatusColor={getStatusColor}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Inactive Tunnels */}
          {inactiveTunnels.length > 0 && (
            <div className="p-3 border-t border-surface-0/30">
              <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                {t('tunnelSidebar.history')}
              </span>
              <div className="mt-2 space-y-2">
                {inactiveTunnels.map(tunnel => (
                  <TunnelItem
                    key={tunnel.id}
                    tunnel={tunnel}
                    onStop={() => stopTunnel(tunnel.id)}
                    onRemove={() => removeTunnel(tunnel.id)}
                    getTunnelIcon={getTunnelIcon}
                    getStatusColor={getStatusColor}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {tunnels.length === 0 && !loading && (
            <div className="p-8 text-center">
              <ArrowLeftRight size={32} className="mx-auto text-text-muted/30 mb-3" />
              <p className="text-sm text-text-muted">{t('tunnelSidebar.noActiveTunnels')}</p>
              <p className="text-xs text-text-muted/70 mt-1">
                {t('tunnelSidebar.createTunnelHint')}
              </p>
            </div>
          )}
        </div>
      </div>

    </>
  );
}

function getTunnelTypeLabel(type: string): string {
  if (type === "local") return "Local";
  if (type === "remote") return "Remote";
  return "SOCKS5";
}

function TunnelStatusIcon({
  isActive,
  tunnel,
  getStatusColor,
}: Readonly<{
  isActive: boolean;
  tunnel: Tunnel;
  getStatusColor: (status: Tunnel["status"]) => string;
}>) {
  if (isActive) {
    return <CheckCircle size={10} className={getStatusColor(tunnel.status)} />;
  }
  if (tunnel.status.state === "Error") {
    return <AlertCircle size={10} className={getStatusColor(tunnel.status)} />;
  }
  return null;
}

interface TunnelItemProps {
  tunnel: Tunnel;
  onStop: () => void;
  onRemove: () => void;
  getTunnelIcon: (type: string) => React.ReactNode;
  getStatusColor: (status: Tunnel["status"]) => string;
}

function TunnelItem({ tunnel, onStop, onRemove, getTunnelIcon, getStatusColor }: TunnelItemProps) {
  const { t } = useTranslation();
  const isActive = tunnel.status.state === "Active" || tunnel.status.state === "Starting";

  return (
    <div className={`p-2.5 rounded-xl transition-colors ${
      isActive
        ? "bg-surface-0/30 hover:bg-surface-0/40"
        : "bg-surface-0/10 hover:bg-surface-0/20 opacity-60"
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {getTunnelIcon(tunnel.tunnel_type)}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-text">:{tunnel.local_port}</span>
              {tunnel.tunnel_type !== "dynamic" && (
                <>
                  <span className="text-text-muted text-[10px]">→</span>
                  <span className="text-xs text-text-muted truncate">
                    {tunnel.remote_host}:{tunnel.remote_port}
                  </span>
                </>
              )}
              {tunnel.tunnel_type === "dynamic" && (
                <span className="text-[9px] px-1.5 py-0.5 bg-mauve/20 text-mauve rounded-full">SOCKS5</span>
              )}
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <TunnelStatusIcon isActive={isActive} tunnel={tunnel} getStatusColor={getStatusColor} />
              <span className={`text-[10px] ${getStatusColor(tunnel.status)}`}>
                {tunnel.status.state === "Error" ? tunnel.status.error : tunnel.status.state}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={isActive ? onStop : onRemove}
          className="p-1.5 text-text-muted hover:text-red hover:bg-red/10 rounded-lg transition-colors"
          title={isActive ? t('tunnelSidebar.stop') : t('common.delete')}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
