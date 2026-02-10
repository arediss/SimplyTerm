import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  KeyRound,
  Key,
  Check,
  Fingerprint,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { useAutoHideSuccess } from "../../hooks/useAutoHideSuccess";
import { SettingGroup, SettingRow } from "./SettingsUIComponents";
import type { useVault } from "../../hooks";

interface AuthenticationSectionProps {
  vault: ReturnType<typeof useVault>;
}

export default function AuthenticationSection({ vault }: AuthenticationSectionProps) {
  const { t } = useTranslation();

  const [pinSuccess, triggerPinSuccess] = useAutoHideSuccess();
  const [securityKeySuccess, triggerSecurityKeySuccess] = useAutoHideSuccess();

  const hasPin = vault.status?.unlockMethods.includes('pin') || false;
  const hasSecurityKey = vault.status?.unlockMethods.includes('security_key') || false;

  // PIN setup form
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  // FIDO2 Security Key setup
  const [showSecurityKeySetup, setShowSecurityKeySetup] = useState(false);
  const [securityKeyAvailable, setSecurityKeyAvailable] = useState<boolean | null>(null);
  const [detectedSecurityKeys, setDetectedSecurityKeys] = useState<Array<{
    productName: string;
    manufacturer: string;
    devicePath: string;
    hasPin: boolean;
  }>>([]);
  const [securityKeyError, setSecurityKeyError] = useState<string | null>(null);
  const [securityKeyLoading, setSecurityKeyLoading] = useState(false);

  // PIN handlers
  const handlePinSetup = async () => {
    setPinError(null);

    if (newPin.length < 4 || newPin.length > 6 || !/^\d+$/.test(newPin)) {
      setPinError(t("settings.security.pinValidationError"));
      return;
    }
    if (newPin !== confirmPin) {
      setPinError(t("settings.security.pinMismatchError"));
      return;
    }

    const result = await vault.setupPin(newPin);
    if (result.success) {
      setNewPin('');
      setConfirmPin('');
      triggerPinSuccess(() => setShowPinSetup(false));
    } else {
      setPinError(result.error || t("settings.security.pinSetupError"));
    }
  };

  const handleRemovePin = async () => {
    const result = await vault.removePin();
    if (!result.success) {
      setPinError(result.error || t("settings.security.pinRemoveError"));
    }
  };

  // Security Key handlers
  const handleOpenSecurityKeySetup = async () => {
    setShowSecurityKeySetup(true);
    setSecurityKeyError(null);
    setSecurityKeyLoading(true);

    const available = await vault.isSecurityKeyAvailable();
    setSecurityKeyAvailable(available);

    if (available) {
      const { keys, error } = await vault.detectSecurityKeys();
      setDetectedSecurityKeys(keys);
      if (error) {
        setSecurityKeyError(error);
      }
    }

    setSecurityKeyLoading(false);
  };

  const handleRefreshSecurityKeys = async () => {
    setSecurityKeyLoading(true);
    setSecurityKeyError(null);
    const { keys, error } = await vault.detectSecurityKeys();
    setDetectedSecurityKeys(keys);
    if (error) {
      setSecurityKeyError(error);
    }
    setSecurityKeyLoading(false);
  };

  const handleSetupSecurityKey = async () => {
    setSecurityKeyError(null);
    setSecurityKeyLoading(true);

    const result = await vault.setupSecurityKey();

    setSecurityKeyLoading(false);

    if (result.success) {
      triggerSecurityKeySuccess(() => setShowSecurityKeySetup(false));
    } else {
      setSecurityKeyError(result.error || t("settings.security.keySetupError"));
    }
  };

  const handleRemoveSecurityKey = async () => {
    const result = await vault.removeSecurityKey();
    if (!result.success) {
      setSecurityKeyError(result.error || t("settings.security.keyRemoveError"));
    }
  };

  return (
    <>
      {/* PIN Management */}
      <SettingGroup title={t("settings.security.pinTitle")} description={t("settings.security.pinDesc")}>
        {!showPinSetup ? (
          <SettingRow
            icon={<KeyRound size={20} />}
            iconClassName={`w-10 h-10 rounded-lg flex items-center justify-center ${
              hasPin ? 'bg-success/20 text-success' : 'bg-surface-0/50 text-text-muted'
            }`}
            title={hasPin ? t("settings.security.pinConfigured") : t("settings.security.pinNotConfigured")}
            description={hasPin ? t("settings.security.pinQuickUnlock") : t("settings.security.pinSetupPrompt")}
          >
            <div className="flex gap-2">
              {hasPin && (
                <button
                  onClick={handleRemovePin}
                  disabled={!vault.status?.isUnlocked}
                  className="px-3 py-1.5 bg-error/10 text-error text-xs rounded-lg hover:bg-error/20 transition-colors disabled:opacity-50"
                >
                  {t("common.remove")}
                </button>
              )}
              <button
                onClick={() => setShowPinSetup(true)}
                disabled={!vault.status?.isUnlocked}
                className="px-3 py-1.5 bg-accent/20 text-accent text-xs rounded-lg hover:bg-accent/30 transition-colors disabled:opacity-50"
              >
                {hasPin ? t("common.modify") : t("common.configure")}
              </button>
            </div>
          </SettingRow>
        ) : (
          <div className="p-4 bg-surface-0/20 rounded-lg space-y-4">
            <div className="space-y-3">
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                placeholder={t("settings.security.newPinPlaceholder")}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                className="w-full px-4 py-3 bg-surface-0/30 border border-surface-0/50 rounded-xl text-text placeholder-text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                placeholder={t("settings.security.confirmPinPlaceholder")}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                className="w-full px-4 py-3 bg-surface-0/30 border border-surface-0/50 rounded-xl text-text placeholder-text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            {pinError && <p className="text-sm text-error">{pinError}</p>}
            {pinSuccess && (
              <p className="text-sm text-success flex items-center gap-2">
                <Check size={16} /> {t("settings.security.pinSetupSuccess")}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => { setShowPinSetup(false); setNewPin(''); setConfirmPin(''); setPinError(null); }}
                className="flex-1 py-2 bg-surface-0/50 text-text-muted text-sm rounded-lg hover:bg-surface-0 transition-colors"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handlePinSetup}
                className="flex-1 py-2 bg-accent text-crust text-sm font-medium rounded-lg hover:bg-accent-hover transition-colors"
              >
                {t("common.save")}
              </button>
            </div>
          </div>
        )}
      </SettingGroup>

      {/* Biometric Authentication */}
      <SettingGroup title={t("settings.security.biometricTitle")} description={t("settings.security.biometricDesc")}>
        <SettingRow
          icon={<Fingerprint size={20} />}
          iconClassName={`w-10 h-10 rounded-lg flex items-center justify-center ${
            vault.status?.unlockMethods.includes('biometric')
              ? 'bg-success/20 text-success'
              : 'bg-surface-0/50 text-text-muted'
          }`}
          title={vault.status?.biometricType === 'windows_hello' ? t("settings.security.windowsHello") :
                 vault.status?.biometricType === 'touch_id' ? t("settings.security.touchId") :
                 t("settings.security.biometric")}
          description={vault.status?.unlockMethods.includes('biometric')
            ? t("common.enabled")
            : vault.status?.biometricAvailable
              ? t("common.notConfigured")
              : t("settings.security.biometricNotAvailable")}
        >
          <div className="flex items-center gap-2">
            {!vault.status?.biometricAvailable ? (
              <span className="px-2 py-1 bg-surface-0/50 text-text-muted text-[10px] rounded-full">
                {t("common.notSupported")}
              </span>
            ) : (
              <span className="px-2 py-1 bg-accent/20 text-accent text-[10px] rounded-full">
                {t("common.comingSoon")}
              </span>
            )}
          </div>
        </SettingRow>
      </SettingGroup>

      {/* FIDO2 Security Key Authentication */}
      <SettingGroup title={t("settings.security.fido2Title")} description={t("settings.security.fido2Desc")}>
        {!showSecurityKeySetup ? (
          <SettingRow
            icon={<Key size={20} />}
            iconClassName={`w-10 h-10 rounded-lg flex items-center justify-center ${
              hasSecurityKey ? 'bg-success/20 text-success' : 'bg-surface-0/50 text-text-muted'
            }`}
            title={t("settings.security.fido2Key")}
            description={hasSecurityKey ? t("settings.security.fido2Configured") : t("settings.security.fido2NotConfigured")}
          >
            <div className="flex gap-2">
              {hasSecurityKey && (
                <button
                  onClick={handleRemoveSecurityKey}
                  disabled={!vault.status?.isUnlocked}
                  className="px-3 py-1.5 bg-error/10 text-error text-xs rounded-lg hover:bg-error/20 transition-colors disabled:opacity-50"
                >
                  {t("common.remove")}
                </button>
              )}
              <button
                onClick={handleOpenSecurityKeySetup}
                disabled={!vault.status?.isUnlocked}
                className="px-3 py-1.5 bg-accent/20 text-accent text-xs rounded-lg hover:bg-accent/30 transition-colors disabled:opacity-50"
              >
                {hasSecurityKey ? t("common.modify") : t("common.configure")}
              </button>
            </div>
          </SettingRow>
        ) : (
          <div className="p-4 bg-surface-0/20 rounded-lg space-y-4">
            {securityKeyLoading ? (
              <div className="flex flex-col items-center justify-center py-6 gap-3">
                <div className="w-16 h-16 rounded-2xl bg-accent/20 flex items-center justify-center">
                  <Key size={32} className="text-accent animate-pulse" />
                </div>
                <p className="text-sm text-text-muted">{t("settings.security.touchKey")}</p>
              </div>
            ) : securityKeyAvailable === false ? (
              <div className="p-4 bg-warning/10 rounded-lg">
                <p className="text-sm text-warning flex items-center gap-2">
                  <AlertCircle size={16} />
                  {t("settings.security.noKeyDetected")}
                </p>
                <p className="text-xs text-text-muted mt-2">
                  {t("settings.security.insertKeyPrompt")}
                </p>
              </div>
            ) : detectedSecurityKeys.length === 0 ? (
              <div className="p-4 bg-surface-0/30 rounded-lg">
                {navigator.platform.includes('Win') ? (
                  <>
                    <p className="text-sm text-text text-center">
                      {t("settings.security.windowsWebAuthnReady")}
                    </p>
                    <p className="text-xs text-text-muted/70 text-center mt-1">
                      {t("settings.security.windowsWebAuthnHint")}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-text-muted text-center">
                      {t("settings.security.noKeyDetected")}
                    </p>
                    <p className="text-xs text-text-muted/70 text-center mt-1">
                      {t("settings.security.insertKeyPrompt")}
                    </p>
                    <button
                      onClick={handleRefreshSecurityKeys}
                      className="mt-3 w-full py-2 bg-surface-0/50 text-text-muted text-xs rounded-lg hover:bg-surface-0 transition-colors flex items-center justify-center gap-2"
                    >
                      <RefreshCw size={14} />
                      {t("common.refresh")}
                    </button>
                  </>
                )}
              </div>
            ) : (
              <>
                {/* Detected keys info */}
                <div className="p-3 bg-success/10 rounded-lg">
                  <p className="text-sm text-success flex items-center gap-2">
                    <Check size={16} />
                    {t("settings.security.keyDetected", { count: detectedSecurityKeys.length })}
                  </p>
                  <p className="text-xs text-text-muted mt-1">
                    {detectedSecurityKeys.map(k => k.productName).join(', ')}
                  </p>
                </div>

                <div className="p-3 bg-surface-0/30 rounded-lg">
                  <p className="text-sm text-text">{t("settings.security.setupSteps")}</p>
                  <ol className="text-xs text-text-muted mt-2 space-y-1 list-decimal list-inside">
                    <li>{t("settings.security.setupStep1")}</li>
                    <li>{t("settings.security.setupStep2")}</li>
                  </ol>
                </div>

                <button
                  onClick={handleRefreshSecurityKeys}
                  className="text-xs text-text-muted hover:text-text flex items-center gap-1"
                >
                  <RefreshCw size={12} />
                  {t("settings.security.refreshKeyList")}
                </button>
              </>
            )}

            {securityKeyError && <p className="text-sm text-error">{securityKeyError}</p>}
            {securityKeySuccess && (
              <p className="text-sm text-success flex items-center gap-2">
                <Check size={16} /> {t("settings.security.keySetupSuccess")}
              </p>
            )}

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  setShowSecurityKeySetup(false);
                  setSecurityKeyError(null);
                }}
                className="flex-1 py-2 bg-surface-0/50 text-text-muted text-sm rounded-lg hover:bg-surface-0 transition-colors"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleSetupSecurityKey}
                disabled={securityKeyLoading || (detectedSecurityKeys.length === 0 && !navigator.platform.includes('Win'))}
                className="flex-1 py-2 bg-accent text-crust text-sm font-medium rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50"
              >
                {securityKeyLoading ? t("settings.security.touchKey") : t("common.configure")}
              </button>
            </div>
          </div>
        )}
      </SettingGroup>
    </>
  );
}
