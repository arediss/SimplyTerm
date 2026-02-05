import { useState, useEffect, useRef } from "react";
import type { PromptConfig } from "../plugins/types";

interface PromptModalProps {
  isOpen: boolean;
  config: PromptConfig;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

function PromptModal({ isOpen, config, onConfirm, onCancel }: PromptModalProps) {
  const [value, setValue] = useState(config.defaultValue || "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(config.defaultValue || "");
      // Focus input after a short delay to allow animation
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, config.defaultValue]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onConfirm(value.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onCancel();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-mantle border border-surface-0/50 rounded-2xl shadow-2xl w-full max-w-md pointer-events-auto animate-scale-in"
          onKeyDown={handleKeyDown}
        >
          <form onSubmit={handleSubmit}>
            {/* Header */}
            <div className="px-6 pt-5 pb-4">
              <h2 className="text-lg font-semibold text-text">{config.title}</h2>
              {config.message && (
                <p className="mt-1 text-sm text-text-muted">{config.message}</p>
              )}
            </div>

            {/* Input */}
            <div className="px-6 pb-4">
              <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={config.placeholder}
                className="w-full px-4 py-2.5 bg-crust border border-surface-0/50 rounded-lg text-text placeholder:text-text-muted/50 focus:outline-none focus:border-accent/50 transition-colors"
              />
            </div>

            {/* Actions */}
            <div className="px-6 pb-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-sm font-medium text-text-muted hover:text-text hover:bg-surface-0/50 rounded-lg transition-colors"
              >
                {config.cancelLabel || "Cancel"}
              </button>
              <button
                type="submit"
                disabled={!value.trim()}
                className="px-4 py-2 text-sm font-medium text-crust bg-accent hover:bg-accent/90 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {config.confirmLabel || "Confirm"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

export default PromptModal;
