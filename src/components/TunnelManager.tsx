import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  X,
  ArrowLeftRight,
  ArrowRight,
  ArrowLeft,
  Globe,
  Plus,
  StopCircle,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Loader2,
} from "lucide-react";

interface Tunnel {
  id: string;
  session_id: string;
  tunnel_type: "local" | "remote" | "dynamic";
  local_port: number;
  remote_host: string | null;
  remote_port: number | null;
  status: { state: "Starting" } | { state: "Active" } | { state: "Error"; message: string } | { state: "Stopped" };
  bytes_sent: number;
  bytes_received: number;
}

interface TunnelManagerProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  sessionName: string;
  embedded?: boolean; // If true, renders without modal overlay
}

type TunnelType = "local" | "remote" | "dynamic";

function TunnelManager({ isOpen, onClose, sessionId, sessionName, embedded = false }: TunnelManagerProps) {
  const [tunnels, setTunnels] = useState<Tunnel[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [tunnelType, setTunnelType] = useState<TunnelType>("local");
  const [localPort, setLocalPort] = useState("");
  const [remoteHost, setRemoteHost] = useState("");
  const [remotePort, setRemotePort] = useState("");
  const [creating, setCreating] = useState(false);

  // Load tunnels on mount and periodically
  useEffect(() => {
    if (isOpen) {
      loadTunnels();
      const interval = setInterval(loadTunnels, 2000);
      return () => clearInterval(interval);
    }
  }, [isOpen, sessionId]);

  const loadTunnels = async () => {
    try {
      const result = await invoke<Tunnel[]>("tunnel_list", { sessionId });
      setTunnels(result);
    } catch (err) {
      console.error("Failed to load tunnels:", err);
    }
  };

  const createTunnel = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);

    try {
      await invoke("tunnel_create", {
        sessionId,
        tunnelType,
        localPort: parseInt(localPort),
        remoteHost: tunnelType === "dynamic" ? null : remoteHost || null,
        remotePort: tunnelType === "dynamic" ? null : parseInt(remotePort) || null,
      });
      
      // Reset form
      setLocalPort("");
      setRemoteHost("");
      setRemotePort("");
      
      // Reload tunnels
      await loadTunnels();
    } catch (err) {
      setError(String(err));
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

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const getTunnelIcon = (type: TunnelType) => {
    switch (type) {
      case "local":
        return <ArrowRight size={14} className="text-blue" />;
      case "remote":
        return <ArrowLeft size={14} className="text-green" />;
      case "dynamic":
        return <Globe size={14} className="text-mauve" />;
    }
  };

  const getStatusIcon = (status: Tunnel["status"]) => {
    switch (status.state) {
      case "Starting":
        return <Loader2 size={14} className="text-yellow animate-spin" />;
      case "Active":
        return <CheckCircle size={14} className="text-green" />;
      case "Error":
        return <AlertCircle size={14} className="text-red" />;
      case "Stopped":
        return <Square size={14} className="text-text-muted" />;
    }
  };

  const getTunnelDescription = (tunnel: Tunnel): string => {
    switch (tunnel.tunnel_type) {
      case "local":
        return `localhost:${tunnel.local_port} → ${tunnel.remote_host}:${tunnel.remote_port}`;
      case "remote":
        return `remote:${tunnel.remote_port} → localhost:${tunnel.local_port}`;
      case "dynamic":
        return `SOCKS5 proxy on :${tunnel.local_port}`;
    }
  };

  if (!isOpen) return null;

  // Content that's shared between modal and embedded modes
  const content = (
    <div className="space-y-6">
          {/* New Tunnel Form */}
          <form onSubmit={createTunnel} className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-text">
              <Plus size={16} />
              New Tunnel
            </div>

            {/* Tunnel Type Selector */}
            <div className="flex p-1 bg-crust rounded-lg">
              {(["local", "remote", "dynamic"] as TunnelType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setTunnelType(type)}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-all ${
                    tunnelType === type
                      ? "bg-surface-0 text-text shadow-sm"
                      : "text-text-muted hover:text-text"
                  }`}
                >
                  {getTunnelIcon(type)}
                  {type === "local" ? "Local (-L)" : type === "remote" ? "Remote (-R)" : "Dynamic (-D)"}
                </button>
              ))}
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-text-muted mb-1.5">
                  {tunnelType === "remote" ? "Local Port (destination)" : "Local Port"}
                </label>
                <input
                  type="number"
                  value={localPort}
                  onChange={(e) => setLocalPort(e.target.value)}
                  placeholder={tunnelType === "dynamic" ? "1080" : "8080"}
                  required
                  min={1}
                  max={65535}
                  className="input-field"
                />
              </div>

              {tunnelType !== "dynamic" && (
                <>
                  <div>
                    <label className="block text-xs text-text-muted mb-1.5">
                      {tunnelType === "local" ? "Remote Host" : "Local Host"}
                    </label>
                    <input
                      type="text"
                      value={remoteHost}
                      onChange={(e) => setRemoteHost(e.target.value)}
                      placeholder={tunnelType === "local" ? "mysql.internal" : "127.0.0.1"}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-text-muted mb-1.5">
                      {tunnelType === "local" ? "Remote Port" : "Remote Port (listen)"}
                    </label>
                    <input
                      type="number"
                      value={remotePort}
                      onChange={(e) => setRemotePort(e.target.value)}
                      placeholder={tunnelType === "local" ? "3306" : "8080"}
                      required
                      min={1}
                      max={65535}
                      className="input-field"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Help Text */}
            <p className="text-xs text-text-muted">
              {tunnelType === "local" && "Forward a local port to a remote destination through SSH."}
              {tunnelType === "remote" && "Expose a local service on a port on the remote server."}
              {tunnelType === "dynamic" && "Create a SOCKS5 proxy to route traffic through SSH."}
            </p>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red/10 border border-red/20 rounded-lg text-xs text-red">
                <AlertCircle size={14} />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={creating}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-accent hover:bg-accent-hover text-crust rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {creating ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus size={16} />
                  Create Tunnel
                </>
              )}
            </button>
          </form>

          {/* Active Tunnels */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-text">Active Tunnels</span>
              <button
                onClick={loadTunnels}
                className="p-1.5 text-text-muted hover:text-text hover:bg-white/5 rounded-md transition-colors"
              >
                <RefreshCw size={14} />
              </button>
            </div>

            {tunnels.length === 0 ? (
              <div className="text-center py-8 text-text-muted text-sm">
                No active tunnels
              </div>
            ) : (
              <div className="space-y-2">
                {tunnels.map((tunnel) => (
                  <div
                    key={tunnel.id}
                    className="flex items-center justify-between p-3 bg-crust rounded-lg border border-surface-0/40"
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(tunnel.status)}
                      <div>
                        <div className="flex items-center gap-2 text-sm text-text">
                          {getTunnelIcon(tunnel.tunnel_type)}
                          <span className="font-mono">{getTunnelDescription(tunnel)}</span>
                        </div>
                        <div className="text-xs text-text-muted mt-0.5">
                          {tunnel.status.state === "Error" ? (
                            <span className="text-red">{tunnel.status.message}</span>
                          ) : (
                            <>
                              {formatBytes(tunnel.bytes_sent)} sent, {formatBytes(tunnel.bytes_received)} received
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {(tunnel.status.state === "Active" || tunnel.status.state === "Starting") ? (
                      <button
                        onClick={() => stopTunnel(tunnel.id)}
                        className="p-2 text-text-muted hover:text-red hover:bg-red/10 rounded-lg transition-colors"
                        title="Stop tunnel"
                      >
                        <StopCircle size={14} />
                      </button>
                    ) : (
                      <button
                        onClick={() => removeTunnel(tunnel.id)}
                        className="p-2 text-text-muted hover:text-red hover:bg-red/10 rounded-lg transition-colors"
                        title="Remove tunnel"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
  );

  // Embedded mode - render content directly
  if (embedded) {
    return (
      <div className="w-full h-full bg-mantle rounded-2xl border border-surface-0/60 overflow-auto">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-surface-0/40 sticky top-0 bg-mantle z-10">
          <ArrowLeftRight size={20} className="text-blue" />
          <div>
            <h2 className="text-base font-semibold text-text">Port Forwarding</h2>
            <p className="text-xs text-text-muted">{sessionName}</p>
          </div>
        </div>
        {/* Content */}
        <div className="p-6">
          {content}
        </div>
      </div>
    );
  }

  // Modal mode
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-mantle border border-surface-0/60 rounded-2xl shadow-2xl shadow-black/50 animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-surface-0/40">
          <div className="flex items-center gap-3">
            <ArrowLeftRight size={20} className="text-blue" />
            <div>
              <h2 className="text-base font-semibold text-text">Port Forwarding</h2>
              <p className="text-xs text-text-muted">{sessionName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text hover:bg-white/5 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {content}
        </div>
      </div>
    </div>
  );
}

export default TunnelManager;
