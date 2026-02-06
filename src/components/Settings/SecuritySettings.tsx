import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Shield,
  Lock,
  KeyRound,
  Key,
  Eye,
  EyeOff,
  Check,
  Fingerprint,
  ShieldCheck,
  AlertCircle,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { useVault } from "../../hooks/useVault";
import SshKeyManager from "../SshKeyManager";
import { SettingGroup, Toggle } from "./SettingsUIComponents";

export default function SecuritySettings() {
  const { t } = useTranslation();
  const vault = useVault();
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Password change form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // PIN setup form
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSuccess, setPinSuccess] = useState(false);

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
  const [securityKeySuccess, setSecurityKeySuccess] = useState(false);
  const [securityKeyLoading, setSecurityKeyLoading] = useState(false);

  // Delete confirmation
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const hasPin = vault.status?.unlockMethods.includes('pin') || false;
  const hasSecurityKey = vault.status?.unlockMethods.includes('security_key') || false;

  const autoLockOptions = [
    { value: 0, label: t("settings.security.autoLockNever") },
    { value: 60, label: t("settings.security.autoLock1min") },
    { value: 300, label: t("settings.security.autoLock5min") },
    { value: 600, label: t("settings.security.autoLock10min") },
    { value: 1800, label: t("settings.security.autoLock30min") },
    { value: 3600, label: t("settings.security.autoLock1hour") },
  ];

  const handleAutoLockChange = async (value: number) => {
    await vault.updateSettings(value);
  };

  const handlePasswordChange = async () => {
    setPasswordError(null);
    setPasswordSuccess(false);

    if (newPassword.length < 8) {
      setPasswordError(t("settings.security.passwordTooShort"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t("settings.security.passwordMismatchError"));
      return;
    }

    const result = await vault.changeMasterPassword(currentPassword, newPassword);
    if (result.success) {
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setShowPasswordChange(false);
        setPasswordSuccess(false);
      }, 2000);
    } else {
      setPasswordError(result.error || t("settings.security.passwordChangeError"));
    }
  };

  const handlePinSetup = async () => {
    setPinError(null);
    setPinSuccess(false);

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
      setPinSuccess(true);
      setNewPin('');
      setConfirmPin('');
      setTimeout(() => {
        setShowPinSetup(false);
        setPinSuccess(false);
      }, 2000);
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
    setSecurityKeySuccess(false);
    setSecurityKeyLoading(true);

    const result = await vault.setupSecurityKey();

    setSecurityKeyLoading(false);

    if (result.success) {
      setSecurityKeySuccess(true);
      setTimeout(() => {
        setShowSecurityKeySetup(false);
        setSecurityKeySuccess(false);
      }, 2000);
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

  const handleDeleteVault = async () => {
    setDeleteError(null);
    const result = await vault.deleteVault(deletePassword);
    if (result.success) {
      setShowDeleteConfirm(false);
      setDeletePassword('');
    } else {
      setDeleteError(result.error || t("settings.security.incorrectPassword"));
    }
  };

  const handleLock = async () => {
    await vault.lock();
  };

  // Inline vault setup state
  const [showInlineSetup, setShowInlineSetup] = useState(false);
  const [setupPassword, setSetupPassword] = useState('');
  const [setupConfirmPassword, setSetupConfirmPassword] = useState('');
  const [showSetupPwd, setShowSetupPwd] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupLoading, setSetupLoading] = useState(false);

  const handleInlineSetup = async () => {
    setSetupError(null);
    if (setupPassword.length < 8) {
      setSetupError(t("settings.security.passwordTooShort"));
      return;
    }
    if (setupPassword !== setupConfirmPassword) {
      setSetupError(t("settings.security.passwordMismatchError"));
      return;
    }
    setSetupLoading(true);
    const result = await vault.createVault({
      masterPassword: setupPassword,
      autoLockTimeout: 300,
    });
    setSetupLoading(false);
    if (result.success) {
      setShowInlineSetup(false);
      setSetupPassword('');
      setSetupConfirmPassword('');
    } else {
      setSetupError(result.error || t("settings.security.passwordChangeError"));
    }
  };

  const [securityTab, setSecurityTab] = useState<"vault" | "sshKeys" | "auth">("vault");

  // Skeleton loader while vault status is being fetched
  if (vault.isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        {/* Tab bar skeleton */}
        <div className="flex gap-1 p-1 bg-crust rounded-xl">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex-1 h-9 bg-surface-0/20 rounded-lg" />
          ))}
        </div>
        {/* Content skeleton */}
        <div className="space-y-4">
          <div>
            <div className="h-4 w-32 bg-surface-0/20 rounded" />
            <div className="h-3 w-56 bg-surface-0/10 rounded mt-1.5" />
          </div>
          <div className="h-20 bg-surface-0/15 rounded-lg" />
        </div>
        <div className="space-y-4">
          <div>
            <div className="h-4 w-24 bg-surface-0/20 rounded" />
            <div className="h-3 w-44 bg-surface-0/10 rounded mt-1.5" />
          </div>
          <div className="h-12 bg-surface-0/15 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!vault.status?.exists) {
    return (
      <div className="space-y-6">
        <SettingGroup title={t("settings.security.vaultNotConfigured")} description={t("settings.security.vaultNotConfiguredDesc")}>
          <div className="flex items-center gap-3 p-4 bg-accent/10 rounded-xl mb-4">
            <Shield className="w-5 h-5 text-accent flex-shrink-0" />
            <p className="text-sm text-text-secondary">
              {t("settings.security.noVaultWarning")}
            </p>
          </div>

          {!showInlineSetup ? (
            <button
              onClick={() => setShowInlineSetup(true)}
              className="w-full py-3 bg-accent text-crust font-medium rounded-xl hover:bg-accent-hover transition-colors"
            >
              {t("settings.security.configureVault")}
            </button>
          ) : (
            <div className="p-4 bg-surface-0/20 rounded-lg space-y-4">
              <div className="space-y-3">
                <div className="relative">
                  <input
                    type={showSetupPwd ? 'text' : 'password'}
                    placeholder={t("settings.security.newPasswordPlaceholder")}
                    value={setupPassword}
                    onChange={(e) => setSetupPassword(e.target.value)}
                    className="w-full px-4 py-3 pr-10 bg-surface-0/30 border border-surface-0/50 rounded-xl text-text placeholder-text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSetupPwd(!showSetupPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
                  >
                    {showSetupPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <input
                  type="password"
                  placeholder={t("settings.security.confirmNewPasswordPlaceholder")}
                  value={setupConfirmPassword}
                  onChange={(e) => setSetupConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-surface-0/30 border border-surface-0/50 rounded-xl text-text placeholder-text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
              {setupError && <p className="text-sm text-error">{setupError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowInlineSetup(false); setSetupPassword(''); setSetupConfirmPassword(''); setSetupError(null); }}
                  className="flex-1 py-2 bg-surface-0/50 text-text-muted text-sm rounded-lg hover:bg-surface-0 transition-colors"
                >
                  {t("common.cancel")}
                </button>
                <button
                  onClick={handleInlineSetup}
                  disabled={setupLoading}
                  className="flex-1 py-2 bg-accent text-crust text-sm font-medium rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50"
                >
                  {setupLoading ? t("settings.security.creating") : t("settings.security.createVault")}
                </button>
              </div>
            </div>
          )}
        </SettingGroup>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Security sub-tabs */}
      <div className="flex gap-1 p-1 bg-crust rounded-xl">
        <button
          type="button"
          onClick={() => setSecurityTab("vault")}
          className={`
            flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200
            ${securityTab === "vault"
              ? "bg-surface-0 text-text shadow-sm"
              : "text-text-muted hover:text-text hover:bg-surface-0/50"
            }
          `}
        >
          <Shield size={14} />
          {t("settings.security.tabVault")}
        </button>
        <button
          type="button"
          onClick={() => setSecurityTab("sshKeys")}
          className={`
            flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200
            ${securityTab === "sshKeys"
              ? "bg-surface-0 text-text shadow-sm"
              : "text-text-muted hover:text-text hover:bg-surface-0/50"
            }
          `}
        >
          <Key size={14} />
          {t("settings.security.tabSshKeys")}
        </button>
        <button
          type="button"
          onClick={() => setSecurityTab("auth")}
          className={`
            flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200
            ${securityTab === "auth"
              ? "bg-surface-0 text-text shadow-sm"
              : "text-text-muted hover:text-text hover:bg-surface-0/50"
            }
          `}
        >
          <KeyRound size={14} />
          {t("settings.security.tabAuthentication")}
        </button>
      </div>

      {/* === Vault Tab === */}
      {securityTab === "vault" && <>
      {/* Vault Status */}
      <SettingGroup title={t("settings.security.vaultStatusTitle")} description={t("settings.security.vaultStatusDesc")}>
        <div className="flex items-center justify-between p-4 bg-surface-0/20 rounded-lg">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              vault.status?.isUnlocked ? 'bg-success/20 text-success' : 'bg-error/20 text-error'
            }`}>
              {vault.status?.isUnlocked ? <Lock size={20} /> : <Lock size={20} />}
            </div>
            <div>
              <div className="text-sm font-medium text-text">
                {vault.status?.isUnlocked ? t("settings.security.vaultUnlocked") : t("settings.security.vaultLocked")}
              </div>
              <div className="text-xs text-text-muted">
                {t("settings.security.methods")}: {vault.status?.unlockMethods.map(m =>
                  m === 'master_password' ? t("settings.security.methodPassword") :
                  m === 'pin' ? t("settings.security.methodPin") :
                  m === 'security_key' ? t("settings.security.methodSecurityKey") : m
                ).join(', ')}
              </div>
            </div>
          </div>
          {vault.status?.isUnlocked && (
            <button
              onClick={handleLock}
              className="px-3 py-1.5 bg-surface-0/50 text-text-muted text-xs rounded-lg hover:bg-surface-0 transition-colors"
            >
              {t("settings.security.lock")}
            </button>
          )}
        </div>
      </SettingGroup>

      {/* Auto-lock */}
      <SettingGroup title={t("settings.security.autoLockTitle")} description={t("settings.security.autoLockDesc")}>
        <select
          value={vault.status?.autoLockTimeout ?? 300}
          onChange={(e) => handleAutoLockChange(Number(e.target.value))}
          disabled={!vault.status?.isUnlocked}
          className="w-full px-4 py-3 bg-surface-0/30 border border-surface-0/50 rounded-xl text-text focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent disabled:opacity-50"
        >
          {autoLockOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </SettingGroup>

      {/* Maximum Security Mode */}
      <SettingGroup title={t("settings.security.maxSecurityTitle")} description={t("settings.security.maxSecurityDesc")}>
        <div className="flex items-center justify-between p-4 bg-surface-0/20 rounded-lg">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              vault.status?.requireUnlockOnConnect ? 'bg-warning/20 text-warning' : 'bg-surface-0/50 text-text-muted'
            }`}>
              <ShieldCheck size={20} />
            </div>
            <div>
              <div className="text-sm font-medium text-text">
                {vault.status?.requireUnlockOnConnect ? t("common.enabled") : t("common.disabled")}
              </div>
              <div className="text-xs text-text-muted">
                {vault.status?.requireUnlockOnConnect
                  ? t("settings.security.maxSecurityEnabled")
                  : t("settings.security.maxSecurityDisabled")}
              </div>
            </div>
          </div>
          <Toggle
            checked={vault.status?.requireUnlockOnConnect || false}
            onChange={async (checked) => {
              await vault.setRequireUnlockOnConnect(checked);
            }}
          />
        </div>
        {vault.status?.requireUnlockOnConnect && (
          <p className="text-xs text-warning mt-2 flex items-center gap-2">
            <AlertCircle size={14} />
            {t("settings.security.maxSecurityWarning")}
          </p>
        )}
      </SettingGroup>

      {/* Delete Vault */}
      <SettingGroup title={t("settings.security.deleteVaultTitle")} description={t("settings.security.deleteVaultDesc")}>
        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-4 py-2.5 bg-error/10 text-error text-sm rounded-lg hover:bg-error/20 transition-colors"
          >
            <Trash2 size={16} className="inline mr-2" />
            {t("settings.security.deleteVault")}
          </button>
        ) : (
          <div className="p-4 bg-error/10 rounded-lg border border-error/30 space-y-4">
            <p className="text-sm text-error">
              {t("settings.security.deleteVaultWarning")}
            </p>
            <input
              type="password"
              placeholder={t("settings.security.deleteVaultPasswordPrompt")}
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              className="w-full px-4 py-3 bg-surface-0/30 border border-error/30 rounded-xl text-text placeholder-text-muted/50 focus:outline-none focus:ring-2 focus:ring-error"
            />
            {deleteError && <p className="text-sm text-error">{deleteError}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); setDeleteError(null); }}
                className="flex-1 py-2 bg-surface-0/50 text-text-muted text-sm rounded-lg hover:bg-surface-0 transition-colors"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleDeleteVault}
                disabled={!deletePassword}
                className="flex-1 py-2 bg-error text-white text-sm font-medium rounded-lg hover:bg-error/90 transition-colors disabled:opacity-50"
              >
                {t("settings.security.deletePermanently")}
              </button>
            </div>
          </div>
        )}
      </SettingGroup>
      </>}

      {/* === SSH Keys Tab === */}
      {securityTab === "sshKeys" && <>
      <SshKeyManager isVaultUnlocked={vault.status?.isUnlocked || false} />
      </>}

      {/* === Authentication Tab === */}
      {securityTab === "auth" && <>
      {/* PIN Management */}
      <SettingGroup title={t("settings.security.pinTitle")} description={t("settings.security.pinDesc")}>
        {!showPinSetup ? (
          <div className="flex items-center justify-between p-4 bg-surface-0/20 rounded-lg">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                hasPin ? 'bg-success/20 text-success' : 'bg-surface-0/50 text-text-muted'
              }`}>
                <KeyRound size={20} />
              </div>
              <div>
                <div className="text-sm font-medium text-text">
                  {hasPin ? t("settings.security.pinConfigured") : t("settings.security.pinNotConfigured")}
                </div>
                <div className="text-xs text-text-muted">
                  {hasPin ? t("settings.security.pinQuickUnlock") : t("settings.security.pinSetupPrompt")}
                </div>
              </div>
            </div>
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
          </div>
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
        <div className="flex items-center justify-between p-4 bg-surface-0/20 rounded-lg">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              vault.status?.unlockMethods.includes('biometric')
                ? 'bg-success/20 text-success'
                : 'bg-surface-0/50 text-text-muted'
            }`}>
              <Fingerprint size={20} />
            </div>
            <div>
              <div className="text-sm font-medium text-text">
                {vault.status?.biometricType === 'windows_hello' ? t("settings.security.windowsHello") :
                 vault.status?.biometricType === 'touch_id' ? t("settings.security.touchId") :
                 t("settings.security.biometric")}
              </div>
              <div className="text-xs text-text-muted">
                {vault.status?.unlockMethods.includes('biometric')
                  ? t("common.enabled")
                  : vault.status?.biometricAvailable
                    ? t("common.notConfigured")
                    : t("settings.security.biometricNotAvailable")}
              </div>
            </div>
          </div>
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
        </div>
      </SettingGroup>

      {/* FIDO2 Security Key Authentication */}
      <SettingGroup title={t("settings.security.fido2Title")} description={t("settings.security.fido2Desc")}>
        {!showSecurityKeySetup ? (
          <div className="flex items-center justify-between p-4 bg-surface-0/20 rounded-lg">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                hasSecurityKey ? 'bg-success/20 text-success' : 'bg-surface-0/50 text-text-muted'
              }`}>
                <Key size={20} />
              </div>
              <div>
                <div className="text-sm font-medium text-text">
                  {t("settings.security.fido2Key")}
                </div>
                <div className="text-xs text-text-muted">
                  {hasSecurityKey ? t("settings.security.fido2Configured") : t("settings.security.fido2NotConfigured")}
                </div>
              </div>
            </div>
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
          </div>
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

      {/* Change Password */}
      <SettingGroup title={t("settings.security.masterPasswordTitle")} description={t("settings.security.masterPasswordDesc")}>
        {!showPasswordChange ? (
          <button
            onClick={() => setShowPasswordChange(true)}
            disabled={!vault.status?.isUnlocked}
            className="px-4 py-2.5 bg-surface-0/30 text-text text-sm rounded-lg hover:bg-surface-0/50 transition-colors disabled:opacity-50"
          >
            {t("settings.security.changePassword")}
          </button>
        ) : (
          <div className="p-4 bg-surface-0/20 rounded-lg space-y-4">
            <div className="space-y-3">
              <div className="relative">
                <input
                  type={showCurrentPwd ? 'text' : 'password'}
                  placeholder={t("settings.security.currentPasswordPlaceholder")}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-10 bg-surface-0/30 border border-surface-0/50 rounded-xl text-text placeholder-text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPwd(!showCurrentPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
                >
                  {showCurrentPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <div className="relative">
                <input
                  type={showNewPwd ? 'text' : 'password'}
                  placeholder={t("settings.security.newPasswordPlaceholder")}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-10 bg-surface-0/30 border border-surface-0/50 rounded-xl text-text placeholder-text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPwd(!showNewPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
                >
                  {showNewPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <input
                type="password"
                placeholder={t("settings.security.confirmNewPasswordPlaceholder")}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 bg-surface-0/30 border border-surface-0/50 rounded-xl text-text placeholder-text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            {passwordError && <p className="text-sm text-error">{passwordError}</p>}
            {passwordSuccess && (
              <p className="text-sm text-success flex items-center gap-2">
                <Check size={16} /> {t("settings.security.passwordChangeSuccess")}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowPasswordChange(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                  setPasswordError(null);
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
        )}
      </SettingGroup>
      </>}
    </div>
  );
}
