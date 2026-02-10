import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
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

function getHostKeyButtonLabel(
  isLoading: boolean,
  isMismatch: boolean,
  t: (key: string) => string,
): string {
  if (isLoading) return t('hostKey.processing');
  if (isMismatch) return t('hostKey.updateConnect');
  return t('hostKey.trustConnect');
}

function HostKeyModal({
  isOpen,
  result,
  onAccept,
  onReject,
  isLoading = false,
}: Readonly<HostKeyModalProps>) {
  const { t } = useTranslation();
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
        role="presentation"
        onClick={() => !isLoading && onReject()}
        onKeyDown={(e) => { if (e.key === 'Escape' && !isLoading) onReject(); }}
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
              {isMismatch ? t('hostKey.keyChanged') : t('hostKey.unknownHost')}
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
                <p className="font-semibold mb-1">{t('hostKey.warningTitle')}</p>
                <p className="text-red/80">
                  {t('hostKey.warningDesc')}
                </p>
              </div>
            </div>
          )}

          {isUnknown && (
            <p className="text-sm text-text-muted">
              {t('hostKey.unknownHostDesc', { host: result.host })}
            </p>
          )}

          <div className="space-y-3 p-4 bg-surface-0/30 rounded-xl">
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">{t('hostKey.host')}</span>
              <span className="text-text font-mono">
                {result.host}:{result.port}
              </span>
            </div>

            {result.key_type && (
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">{t('hostKey.keyType')}</span>
                <span className="text-text font-mono">{result.key_type}</span>
              </div>
            )}

            {result.fingerprint && (
              <div className="text-sm">
                <span className="text-text-muted block mb-1">
                  {isMismatch ? t('hostKey.newFingerprint') : t('hostKey.fingerprint')}
                </span>
                <span className="text-text font-mono text-xs break-all bg-crust px-2 py-1.5 rounded-lg block">
                  {result.fingerprint}
                </span>
              </div>
            )}

            {isMismatch && result.expected_fingerprint && (
              <div className="text-sm">
                <span className="text-text-muted block mb-1">{t('hostKey.expectedFingerprint')}</span>
                <span className="text-red/80 font-mono text-xs break-all bg-crust px-2 py-1.5 rounded-lg block">
                  {result.expected_fingerprint}
                </span>
              </div>
            )}
          </div>

          {isUnknown && (
            <p className="text-sm text-text-muted">
              {t('hostKey.trustPrompt')}
            </p>
          )}

          {isMismatch && (
            <p className="text-sm text-text-muted">
              {t('hostKey.mismatchWarning')}
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
            {t('common.cancel')}
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
            {getHostKeyButtonLabel(isLoading, isMismatch, t)}
          </button>
        </div>
      </div>
    </div>
  );
}

export default HostKeyModal;
