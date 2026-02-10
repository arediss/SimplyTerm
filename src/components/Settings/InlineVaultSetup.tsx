import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Shield } from "lucide-react";
import { PasswordInput } from "../UI/PasswordInput";
import { validatePassword } from "../../utils/validatePassword";
import { SettingGroup } from "./SettingsUIComponents";
import type { useVault } from "../../hooks";

interface InlineVaultSetupProps {
  vault: ReturnType<typeof useVault>;
}

export default function InlineVaultSetup({ vault }: Readonly<InlineVaultSetupProps>) {
  const { t } = useTranslation();

  const [showForm, setShowForm] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSetup = async () => {
    setError(null);
    const pwdError = validatePassword(password, confirmPassword, {
      tooShort: t("settings.security.passwordTooShort"),
      mismatch: t("settings.security.passwordMismatchError"),
    });
    if (pwdError) {
      setError(pwdError);
      return;
    }
    setLoading(true);
    const result = await vault.createVault({
      masterPassword: password,
      autoLockTimeout: 300,
    });
    setLoading(false);
    if (result.success) {
      setShowForm(false);
      setPassword('');
      setConfirmPassword('');
    } else {
      setError(result.error || t("settings.security.passwordChangeError"));
    }
  };

  return (
    <div className="space-y-6">
      <SettingGroup title={t("settings.security.vaultNotConfigured")} description={t("settings.security.vaultNotConfiguredDesc")}>
        <div className="flex items-center gap-3 p-4 bg-accent/10 rounded-xl mb-4">
          <Shield className="w-5 h-5 text-accent flex-shrink-0" />
          <p className="text-sm text-text-secondary">
            {t("settings.security.noVaultWarning")}
          </p>
        </div>

        {showForm ? (
          <div className="p-4 bg-surface-0/20 rounded-lg space-y-4">
            <div className="space-y-3">
              <PasswordInput
                placeholder={t("settings.security.newPasswordPlaceholder")}
                value={password}
                onChange={setPassword}
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
            <div className="flex gap-2">
              <button
                onClick={() => { setShowForm(false); setPassword(''); setConfirmPassword(''); setError(null); }}
                className="flex-1 py-2 bg-surface-0/50 text-text-muted text-sm rounded-lg hover:bg-surface-0 transition-colors"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleSetup}
                disabled={loading}
                className="flex-1 py-2 bg-accent text-crust text-sm font-medium rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50"
              >
                {loading ? t("settings.security.creating") : t("settings.security.createVault")}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowForm(true)}
            className="w-full py-3 bg-accent text-crust font-medium rounded-xl hover:bg-accent-hover transition-colors"
          >
            {t("settings.security.configureVault")}
          </button>
        )}
      </SettingGroup>
    </div>
  );
}
