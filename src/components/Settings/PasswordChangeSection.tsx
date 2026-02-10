import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { PasswordInput } from "../UI/PasswordInput";
import { useAutoHideSuccess } from "../../hooks/useAutoHideSuccess";
import { validatePassword } from "../../utils/validatePassword";
import { SettingGroup } from "./SettingsUIComponents";
import type { useVault } from "../../hooks";

interface PasswordChangeSectionProps {
  vault: ReturnType<typeof useVault>;
}

export default function PasswordChangeSection({ vault }: Readonly<PasswordChangeSectionProps>) {
  const { t } = useTranslation();

  const [passwordSuccess, triggerPasswordSuccess] = useAutoHideSuccess();

  const [showForm, setShowForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handlePasswordChange = async () => {
    setError(null);

    const pwdError = validatePassword(newPassword, confirmPassword, {
      tooShort: t("settings.security.passwordTooShort"),
      mismatch: t("settings.security.passwordMismatchError"),
    });
    if (pwdError) {
      setError(pwdError);
      return;
    }

    const result = await vault.changeMasterPassword(currentPassword, newPassword);
    if (result.success) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      triggerPasswordSuccess(() => setShowForm(false));
    } else {
      setError(result.error || t("settings.security.passwordChangeError"));
    }
  };

  return (
    <SettingGroup title={t("settings.security.masterPasswordTitle")} description={t("settings.security.masterPasswordDesc")}>
      {showForm ? (
        <div className="p-4 bg-surface-0/20 rounded-lg space-y-4">
          <div className="space-y-3">
            <PasswordInput
              placeholder={t("settings.security.currentPasswordPlaceholder")}
              value={currentPassword}
              onChange={setCurrentPassword}
            />
            <PasswordInput
              placeholder={t("settings.security.newPasswordPlaceholder")}
              value={newPassword}
              onChange={setNewPassword}
            />
            <input
              type="password"
              placeholder={t("settings.security.confirmNewPasswordPlaceholder")}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 bg-surface-0/30 border border-surface-0/50 rounded-xl text-text placeholder-text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          {error && <p className="text-sm text-error">{error}</p>}
          {passwordSuccess && (
            <p className="text-sm text-success flex items-center gap-2">
              <Check size={16} /> {t("settings.security.passwordChangeSuccess")}
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowForm(false);
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
                setError(null);
              }}
              className="flex-1 py-2 bg-surface-0/50 text-text-muted text-sm rounded-lg hover:bg-surface-0 transition-colors"
            >
              {t("common.cancel")}
            </button>
            <button
              onClick={handlePasswordChange}
              className="flex-1 py-2 bg-accent text-crust text-sm font-medium rounded-lg hover:bg-accent-hover transition-colors"
            >
              {t("common.modify")}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          disabled={!vault.status?.isUnlocked}
          className="px-4 py-2.5 bg-surface-0/30 text-text text-sm rounded-lg hover:bg-surface-0/50 transition-colors disabled:opacity-50"
        >
          {t("settings.security.changePassword")}
        </button>
      )}
    </SettingGroup>
  );
}
