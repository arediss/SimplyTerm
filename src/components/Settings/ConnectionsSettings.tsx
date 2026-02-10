import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Monitor, Trash2 } from "lucide-react";
import { SettingGroup } from "./SettingsUIComponents";

interface ConnectionsSettingsProps {
  savedSessionsCount: number;
  onClearAllSessions: () => void;
}

export default function ConnectionsSettings({ savedSessionsCount, onClearAllSessions }: ConnectionsSettingsProps) {
  const { t } = useTranslation();
  const [confirmClear, setConfirmClear] = useState(false);
  const clearTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Cleanup confirm-clear timeout on unmount
  useEffect(() => {
    return () => {
      if (clearTimeoutRef.current) clearTimeout(clearTimeoutRef.current);
    };
  }, []);

  const handleClearAll = () => {
    if (confirmClear) {
      onClearAllSessions();
      setConfirmClear(false);
    } else {
      setConfirmClear(true);
      if (clearTimeoutRef.current) clearTimeout(clearTimeoutRef.current);
      clearTimeoutRef.current = setTimeout(() => setConfirmClear(false), 3000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Jump Hosts section moved to plugin: com.simplyterm.bastions */}

      <SettingGroup
        title={t("settings.connections.savedTitle")}
        description={t("settings.connections.savedDesc")}
      >
        <div className="flex items-center justify-between p-4 bg-surface-0/20 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center text-accent">
              <Monitor size={20} />
            </div>
            <div>
              <div className="text-sm font-medium text-text">
                {t("settings.connections.savedCount", { count: savedSessionsCount })}
              </div>
              <div className="text-xs text-text-muted">
                {t("settings.connections.storedSecurely")}
              </div>
            </div>
          </div>
        </div>
      </SettingGroup>

      <SettingGroup
        title={t("settings.connections.deleteTitle")}
        description={t("settings.connections.deleteDesc")}
      >
        <button
          onClick={handleClearAll}
          disabled={savedSessionsCount === 0}
          className={`
            flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm transition-colors
            ${confirmClear
              ? "bg-error text-white"
              : "bg-error/10 text-error hover:bg-error/20"
            }
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        >
          <Trash2 size={16} />
          {confirmClear ? t("settings.connections.confirmDelete") : t("settings.connections.deleteAll")}
        </button>
        {confirmClear && (
          <p className="text-xs text-error mt-2">
            {t("settings.connections.deleteWarning")}
          </p>
        )}
      </SettingGroup>
    </div>
  );
}
