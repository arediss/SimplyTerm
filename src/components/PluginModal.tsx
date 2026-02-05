import { useEffect, useRef, useCallback } from "react";
import type { ModalConfig } from "../plugins/types";

interface PluginModalProps {
  isOpen: boolean;
  config: ModalConfig;
  onButtonClick: (index: number) => void;
  onClose: () => void;
}

const BUTTON_STYLES = {
  primary: "bg-accent text-crust hover:bg-accent-hover",
  secondary: "bg-surface-0/50 text-text-secondary hover:bg-surface-0",
  danger: "bg-error/20 text-error hover:bg-error/30",
} as const;

function PluginModal({ isOpen, config, onButtonClick, onClose }: PluginModalProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && contentRef.current && config.content instanceof HTMLElement) {
      contentRef.current.innerHTML = "";
      contentRef.current.appendChild(config.content);
    }
  }, [isOpen, config.content]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  if (!isOpen) return null;

  const buttons = config.buttons && config.buttons.length > 0
    ? config.buttons
    : [{ label: "Close", variant: "secondary" as const }];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-mantle border border-surface-0/50 rounded-2xl shadow-2xl w-full max-w-md pointer-events-auto animate-scale-in"
          onKeyDown={handleKeyDown}
          tabIndex={-1}
        >
          {/* Header */}
          <div className="px-6 pt-5 pb-4">
            <h2 className="text-lg font-semibold text-text">{config.title}</h2>
          </div>

          {/* Content */}
          <div className="px-6 pb-4">
            {typeof config.content === "string" ? (
              <p className="text-sm text-text-muted">{config.content}</p>
            ) : (
              <div ref={contentRef} />
            )}
          </div>

          {/* Buttons */}
          <div className="px-6 pb-5 flex justify-end gap-2">
            {buttons.map((button, index) => (
              <button
                key={index}
                type="button"
                onClick={() => onButtonClick(index)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  BUTTON_STYLES[button.variant || "secondary"]
                }`}
              >
                {button.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export default PluginModal;
