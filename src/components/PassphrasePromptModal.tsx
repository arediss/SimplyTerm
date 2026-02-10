import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import Modal from "./Modal";
import { Key } from "lucide-react";

interface PassphrasePromptModalProps {
  isOpen: boolean;
  keyName: string;
  onConfirm: (passphrase: string) => void;
  onCancel: () => void;
}

export default function PassphrasePromptModal({
  isOpen,
  keyName,
  onConfirm,
  onCancel,
}: Readonly<PassphrasePromptModalProps>) {
  const { t } = useTranslation();
  const [passphrase, setPassphrase] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const focusTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    if (isOpen) {
      setPassphrase("");
      if (focusTimeoutRef.current) clearTimeout(focusTimeoutRef.current);
      focusTimeoutRef.current = setTimeout(() => inputRef.current?.focus(), 100);
    }
    return () => {
      if (focusTimeoutRef.current) clearTimeout(focusTimeoutRef.current);
    };
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(passphrase);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={t("settings.security.sshKeysPassphraseRequired")}
      width="sm"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex items-center gap-3 p-3 bg-surface-0/20 rounded-lg">
          <div className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0">
            <Key size={16} />
          </div>
          <div className="text-sm text-text">
            {t("settings.security.sshKeysEnterPassphraseFor")} <span className="font-medium">{keyName}</span>
          </div>
        </div>

        <input
          ref={inputRef}
          type="password"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          placeholder={t("settings.security.sshKeysPassphrase")}
          className="input-field"
          autoFocus
        />

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 bg-surface-0/50 text-text-secondary text-sm rounded-lg hover:bg-surface-0 transition-colors"
          >
            {t("common.cancel") || "Cancel"}
          </button>
          <button
            type="submit"
            className="flex-1 py-2.5 bg-accent text-base font-medium text-sm rounded-lg hover:bg-accent/90 transition-colors"
          >
            {t("common.confirm") || "Confirm"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
