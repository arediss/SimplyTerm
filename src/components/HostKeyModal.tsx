import { useEffect, useRef } from "react";
import { X, ShieldAlert, ShieldQuestion, AlertTriangle } from "lucide-react";

export interface HostKeyCheckResult {
  status: "trusted" | "unknown" | "mismatch" | "error";
  host: string;
  port: number;
  key_type: string | null;
  fingerprint: string | null;
  expected_fingerprint: string | null;
  message: string | null;
}

interface HostKeyModalProps {
  isOpen: boolean;
  result: HostKeyCheckResult | null;
  onAccept: () => void;
  onReject: () => void;
  isLoading?: boolean;
}

function HostKeyModal({
  isOpen,
  result,
  onAccept,
  onReject,
  isLoading = false,
}: HostKeyModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isLoading) onReject();
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, onReject, isLoading]);

  useEffect(() => {
    if (isOpen && modalRef.current) {
      modalRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen || !result) return null;

  const isUnknown = result.status === "unknown";
  const isMismatch = result.status === "mismatch";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => !isLoading && onReject()}
      />

      {/* Modal */}
      <div
        ref={modalRef}
        tabIndex={-1}
        className="relative w-full max-w-lg mx-4 bg-mantle border border-surface-0/60 rounded-2xl shadow-2xl shadow-black/50 animate-scale-in"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-surface-0/40">
          <div className="flex items-center gap-3">
            {isMismatch ? (
              <ShieldAlert className="text-red" size={22} />
            ) : (
              <ShieldQuestion className="text-yellow" size={22} />
            )}
            <h2 className="text-base font-semibold text-text">
              {isMismatch ? "Host Key Changed" : "Unknown Host"}
            </h2>
          </div>
          <button
            onClick={onReject}
            disabled={isLoading}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {isMismatch && (
            <div className="flex items-start gap-3 p-4 bg-red/10 border border-red/30 rounded-xl">
              <AlertTriangle className="text-red shrink-0 mt-0.5" size={20} />
              <div className="text-sm text-red">
                <p className="font-semibold mb-1">Warning: Potential Security Risk</p>
                <p className="text-red/80">
                  The host key for this server has changed. This could indicate a
                  man-in-the-middle attack, or the server may have been reconfigured.
                </p>
              </div>
            </div>
          )}

          {isUnknown && (
            <p className="text-sm text-text-muted">
              The authenticity of host <span className="text-text font-medium">{result.host}</span> cannot be established.
              This is the first time you're connecting to this server.
            </p>
          )}

          <div className="space-y-3 p-4 bg-surface-0/30 rounded-xl">
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Host</span>
              <span className="text-text font-mono">
                {result.host}:{result.port}
              </span>
            </div>

            {result.key_type && (
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">Key Type</span>
                <span className="text-text font-mono">{result.key_type}</span>
              </div>
            )}

            {result.fingerprint && (
              <div className="text-sm">
                <span className="text-text-muted block mb-1">
                  {isMismatch ? "New Fingerprint" : "Fingerprint"}
                </span>
                <span className="text-text font-mono text-xs break-all bg-crust px-2 py-1.5 rounded-lg block">
                  {result.fingerprint}
                </span>
              </div>
            )}

            {isMismatch && result.expected_fingerprint && (
              <div className="text-sm">
                <span className="text-text-muted block mb-1">Expected Fingerprint</span>
                <span className="text-red/80 font-mono text-xs break-all bg-crust px-2 py-1.5 rounded-lg block">
                  {result.expected_fingerprint}
                </span>
              </div>
            )}
          </div>

          {isUnknown && (
            <p className="text-sm text-text-muted">
              Do you want to trust this host and add it to your known hosts?
            </p>
          )}

          {isMismatch && (
            <p className="text-sm text-text-muted">
              Only proceed if you are certain the server key has legitimately changed.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-surface-0/40">
          <button
            onClick={onReject}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-text-muted hover:text-text bg-surface-0/50 hover:bg-surface-0 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onAccept}
            disabled={isLoading}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
              isMismatch
                ? "bg-accent/20 text-accent hover:bg-accent/30"
                : "text-green bg-green/20 hover:bg-green/30"
            }`}
          >
            {isLoading
              ? "Processing..."
              : isMismatch
              ? "Update & Connect"
              : "Trust & Connect"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default HostKeyModal;
