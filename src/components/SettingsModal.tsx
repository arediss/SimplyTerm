import { useState } from "react";
import { useTranslation } from "react-i18next";
import i18n from "../i18n";
import {
  X,
  Palette,
  Terminal,
  Link2,
  Info,
  ChevronRight,
  Monitor,
  MousePointer2,
  Trash2,
  ExternalLink,
  Github,
  Puzzle,
  RefreshCw,
  Power,
  PowerOff,
  AlertCircle,
  Shield,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  Check,
  Fingerprint,
  Key,
  ShieldCheck,
} from "lucide-react";
import { usePlugins, type PluginManifest } from "../plugins";
import { useVault } from "../hooks/useVault";
import { getThemes } from "../themes";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
  savedSessionsCount: number;
  onClearAllSessions: () => void;
}

export interface AppSettings {
  terminal: {
    fontSize: number;
    fontFamily: string;
    cursorStyle: "block" | "bar" | "underline";
    cursorBlink: boolean;
    scrollback: number;
  };
  appearance: {
    /** Theme ID (e.g., "dark", "light", or custom theme IDs from plugins) */
    theme: string;
    accentColor: string;
  };
  ui: {
    statusBarVisible: boolean;
  };
  security: {
    vaultSetupSkipped: boolean;
  };
}

export const defaultSettings: AppSettings = {
  terminal: {
    fontSize: 13,
    fontFamily: "JetBrains Mono",
    cursorStyle: "bar",
    cursorBlink: true,
    scrollback: 10000,
  },
  appearance: {
    theme: "dark",
    accentColor: "#7DA6E8",
  },
  ui: {
    statusBarVisible: false,
  },
  security: {
    vaultSetupSkipped: false,
  },
};

type SettingsSection = "appearance" | "terminal" | "connections" | "security" | "plugins" | "about";

function SettingsModal({
  isOpen,
  onClose,
  settings,
  onSettingsChange,
  savedSessionsCount,
  onClearAllSessions,
}: SettingsModalProps) {
  const { t } = useTranslation();
  const [activeSection, setActiveSection] = useState<SettingsSection>("appearance");

  if (!isOpen) return null;

  const updateTerminalSetting = <K extends keyof AppSettings["terminal"]>(
    key: K,
    value: AppSettings["terminal"][K]
  ) => {
    onSettingsChange({
      ...settings,
      terminal: { ...settings.terminal, [key]: value },
    });
  };

  const updateAppearanceSetting = <K extends keyof AppSettings["appearance"]>(
    key: K,
    value: AppSettings["appearance"][K]
  ) => {
    onSettingsChange({
      ...settings,
      appearance: { ...settings.appearance, [key]: value },
    });
  };

  const sections: { id: SettingsSection; label: string; icon: React.ReactNode }[] = [
    { id: "appearance", label: t("settings.sections.appearance"), icon: <Palette size={18} /> },
    { id: "terminal", label: t("settings.sections.terminal"), icon: <Terminal size={18} /> },
    { id: "connections", label: t("settings.sections.connections"), icon: <Link2 size={18} /> },
    { id: "security", label: t("settings.sections.security"), icon: <Shield size={18} /> },
    { id: "plugins", label: t("settings.sections.plugins"), icon: <Puzzle size={18} /> },
    { id: "about", label: t("settings.sections.about"), icon: <Info size={18} /> },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-8 pointer-events-none">
        <div
          className="bg-mantle rounded-2xl shadow-2xl overflow-hidden pointer-events-auto animate-scale-in flex"
          style={{ width: "800px", height: "560px", maxWidth: "90vw", maxHeight: "80vh" }}
        >
          {/* Sidebar */}
          <div className="w-56 bg-crust flex flex-col border-r border-surface-0/30">
            {/* Header */}
            <div className="p-4">
              <h2 className="text-sm font-semibold text-text">{t("settings.title")}</h2>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-2 space-y-1">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors
                    ${activeSection === section.id
                      ? "bg-surface-0/50 text-text"
                      : "text-text-muted hover:text-text hover:bg-white/5"
                    }
                  `}
                >
                  {section.icon}
                  {section.label}
                </button>
              ))}
            </nav>

          </div>

          {/* Content */}
          <div className="flex-1 flex flex-col">
            {/* Header with close button */}
            <div className="h-14 px-6 flex items-center justify-between">
              <h3 className="text-base font-medium text-text">
                {sections.find((s) => s.id === activeSection)?.label}
              </h3>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text hover:bg-white/5 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content area */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeSection === "appearance" && (
                <AppearanceSettings
                  settings={settings}
                  onChange={updateAppearanceSetting}
                />
              )}
              {activeSection === "terminal" && (
                <TerminalSettings
                  settings={settings.terminal}
                  onChange={updateTerminalSetting}
                />
              )}
              {activeSection === "connections" && (
                <ConnectionsSettings
                  savedSessionsCount={savedSessionsCount}
                  onClearAllSessions={onClearAllSessions}
                />
              )}
              {activeSection === "security" && <SecuritySettings />}
              {activeSection === "plugins" && <PluginsSettings />}
              {activeSection === "about" && <AboutSettings />}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ============================================================================
// Settings Sections
// ============================================================================

function AppearanceSettings({
  settings,
  onChange,
}: {
  settings: AppSettings;
  onChange: <K extends keyof AppSettings["appearance"]>(
    key: K,
    value: AppSettings["appearance"][K]
  ) => void;
}) {
  const { t } = useTranslation();
  const themes = getThemes();

  const languages = [
    { code: 'en', label: 'English', flag: '🇬🇧' },
    { code: 'fr', label: 'Français', flag: '🇫🇷' },
  ];

  return (
    <div className="space-y-6">
      <SettingGroup title={t("settings.appearance.themeTitle")} description={t("settings.appearance.themeDesc")}>
        <div className="flex flex-wrap gap-3">
          {themes.map((theme) => (
            <ThemeCard
              key={theme.meta.id}
              name={theme.meta.name}
              active={settings.appearance.theme === theme.meta.id}
              colors={theme.meta.preview}
              onClick={() => onChange("theme", theme.meta.id)}
            />
          ))}
        </div>
      </SettingGroup>

      <SettingGroup title={t("settings.appearance.accentTitle")} description={t("settings.appearance.accentDesc")}>
        <div className="flex gap-2">
          {["#7DA6E8", "#9CD68D", "#E8C878", "#D4A5D9", "#E88B8B"].map((color) => (
            <button
              key={color}
              onClick={() => onChange("accentColor", color)}
              className={`
                w-8 h-8 rounded-full transition-transform hover:scale-110
                ${settings.appearance.accentColor === color ? "ring-2 ring-white ring-offset-2 ring-offset-mantle" : ""}
              `}
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
        </div>
      </SettingGroup>

      <SettingGroup title={t("settings.appearance.languageTitle")} description={t("settings.appearance.languageDesc")}>
        <div className="flex gap-3">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => i18n.changeLanguage(lang.code)}
              className={`
                px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2
                ${i18n.language === lang.code
                  ? "bg-accent/20 text-accent border border-accent/30"
                  : "bg-surface-0/30 text-text-muted hover:text-text border border-transparent"
                }
              `}
            >
              <span>{lang.flag}</span>
              {lang.label}
            </button>
          ))}
        </div>
      </SettingGroup>
    </div>
  );
}

function TerminalSettings({
  settings,
  onChange,
}: {
  settings: AppSettings["terminal"];
  onChange: <K extends keyof AppSettings["terminal"]>(
    key: K,
    value: AppSettings["terminal"][K]
  ) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <SettingGroup title={t("settings.terminal.fontTitle")} description={t("settings.terminal.fontDesc")}>
        <div className="flex gap-3">
          {["JetBrains Mono", "Fira Code", "SF Mono", "Consolas"].map((font) => (
            <button
              key={font}
              onClick={() => onChange("fontFamily", font)}
              className={`
                px-4 py-2 rounded-lg text-sm font-mono transition-colors
                ${settings.fontFamily === font
                  ? "bg-accent/20 text-accent border border-accent/30"
                  : "bg-surface-0/30 text-text-muted hover:text-text border border-transparent"
                }
              `}
              style={{ fontFamily: font }}
            >
              {font.split(" ")[0]}
            </button>
          ))}
        </div>
      </SettingGroup>

      <SettingGroup title={t("settings.terminal.fontSizeTitle")} description={t("settings.terminal.fontSizeDesc")}>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={10}
            max={20}
            value={settings.fontSize}
            onChange={(e) => onChange("fontSize", parseInt(e.target.value))}
            className="flex-1 accent-accent"
          />
          <span className="w-12 text-center text-sm text-text font-mono">
            {settings.fontSize}px
          </span>
        </div>
      </SettingGroup>

      <SettingGroup title={t("settings.terminal.cursorTitle")} description={t("settings.terminal.cursorDesc")}>
        <div className="flex gap-3">
          {[
            { value: "bar", label: t("settings.terminal.cursorBar"), icon: <div className="w-0.5 h-4 bg-current" /> },
            { value: "block", label: t("settings.terminal.cursorBlock"), icon: <div className="w-3 h-4 bg-current" /> },
            { value: "underline", label: t("settings.terminal.cursorUnderline"), icon: <div className="w-3 h-0.5 bg-current mt-3" /> },
          ].map((cursor) => (
            <button
              key={cursor.value}
              onClick={() => onChange("cursorStyle", cursor.value as "bar" | "block" | "underline")}
              className={`
                flex flex-col items-center gap-2 px-4 py-3 rounded-lg transition-colors
                ${settings.cursorStyle === cursor.value
                  ? "bg-accent/20 text-accent border border-accent/30"
                  : "bg-surface-0/30 text-text-muted hover:text-text border border-transparent"
                }
              `}
            >
              <div className="h-5 flex items-center">{cursor.icon}</div>
              <span className="text-xs">{cursor.label}</span>
            </button>
          ))}
        </div>
      </SettingGroup>

      <SettingRow
        icon={<MousePointer2 size={18} />}
        title={t("settings.terminal.cursorBlinkTitle")}
        description={t("settings.terminal.cursorBlinkDesc")}
      >
        <Toggle
          checked={settings.cursorBlink}
          onChange={(checked) => onChange("cursorBlink", checked)}
        />
      </SettingRow>

      <SettingGroup title={t("settings.terminal.scrollbackTitle")} description={t("settings.terminal.scrollbackDesc")}>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={1000}
            max={50000}
            step={1000}
            value={settings.scrollback}
            onChange={(e) => onChange("scrollback", parseInt(e.target.value))}
            className="flex-1 accent-accent"
          />
          <span className="w-20 text-center text-sm text-text font-mono">
            {settings.scrollback.toLocaleString()}
          </span>
        </div>
      </SettingGroup>
    </div>
  );
}

function ConnectionsSettings({
  savedSessionsCount,
  onClearAllSessions,
}: {
  savedSessionsCount: number;
  onClearAllSessions: () => void;
}) {
  const { t } = useTranslation();
  const [confirmClear, setConfirmClear] = useState(false);

  const handleClearAll = () => {
    if (confirmClear) {
      onClearAllSessions();
      setConfirmClear(false);
    } else {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3000);
    }
  };

  return (
    <div className="space-y-6">
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

function SecuritySettings() {
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

    // Check if FIDO2 security keys are available
    const available = await vault.isSecurityKeyAvailable();
    setSecurityKeyAvailable(available);

    if (available) {
      // Detect security keys
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

    // User will need to touch their key twice during setup
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
      // The app will show the setup modal automatically
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
    </div>
  );
}

function PluginsSettings() {
  const { t } = useTranslation();
  const { plugins, loading, refresh, enablePlugin, disablePlugin } = usePlugins();
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleTogglePlugin = async (plugin: PluginManifest) => {
    setActionLoading(plugin.id);
    try {
      if (plugin.status === "enabled") {
        await disablePlugin(plugin.id);
      } else {
        await enablePlugin(plugin.id);
      }
    } catch (error) {
      console.error("Failed to toggle plugin:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRefresh = async () => {
    setActionLoading("refresh");
    try {
      await refresh();
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <SettingGroup
        title={t("settings.plugins.installedTitle")}
        description={t("settings.plugins.installedDesc")}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-text-muted">
            {t("settings.plugins.pluginCount", { count: plugins.length })}
          </span>
          <button
            onClick={handleRefresh}
            disabled={loading || actionLoading === "refresh"}
            className="flex items-center gap-1.5 px-2 py-1 text-xs text-text-muted hover:text-text transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={actionLoading === "refresh" ? "animate-spin" : ""} />
            {t("common.refresh")}
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw size={20} className="animate-spin text-text-muted" />
          </div>
        ) : plugins.length === 0 ? (
          <div className="text-center py-8 text-text-muted">
            <Puzzle size={32} className="mx-auto mb-3 opacity-50" />
            <p className="text-sm">{t("settings.plugins.noPlugins")}</p>
            <p className="text-xs mt-1">
              {t("settings.plugins.pluginDirHint")}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {plugins.map((plugin) => (
              <div
                key={plugin.id}
                className="flex items-center gap-3 p-3 bg-surface-0/20 rounded-lg"
              >
                <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center text-accent">
                  <Puzzle size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text truncate">
                      {plugin.name}
                    </span>
                    <span className="text-[10px] text-text-muted bg-surface-0/50 px-1.5 py-0.5 rounded">
                      v{plugin.version}
                    </span>
                    {plugin.status === "error" && (
                      <AlertCircle size={14} className="text-error" />
                    )}
                  </div>
                  {plugin.description && (
                    <p className="text-xs text-text-muted truncate">
                      {plugin.description}
                    </p>
                  )}
                  {plugin.author && (
                    <p className="text-[10px] text-text-muted/70">
                      {t("settings.plugins.byAuthor", { author: plugin.author })}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleTogglePlugin(plugin)}
                  disabled={actionLoading === plugin.id}
                  className={`
                    flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                    ${plugin.status === "enabled"
                      ? "bg-success/20 text-success hover:bg-success/30"
                      : "bg-surface-0/50 text-text-muted hover:bg-surface-0"
                    }
                    disabled:opacity-50
                  `}
                >
                  {actionLoading === plugin.id ? (
                    <RefreshCw size={12} className="animate-spin" />
                  ) : plugin.status === "enabled" ? (
                    <>
                      <Power size={12} />
                      {t("common.active")}
                    </>
                  ) : (
                    <>
                      <PowerOff size={12} />
                      {t("common.inactive")}
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </SettingGroup>

      <SettingGroup
        title={t("settings.plugins.installationTitle")}
        description={t("settings.plugins.installationDesc")}
      >
        <div className="p-3 bg-surface-0/20 rounded-lg text-xs text-text-muted space-y-2">
          <p>
            <strong className="text-text">1.</strong> {t("settings.plugins.installStep1")}{" "}
            <code className="px-1 py-0.5 bg-surface-0/50 rounded">~/.simplyterm/plugins/</code>
          </p>
          <p>
            <strong className="text-text">2.</strong> {t("settings.plugins.installStep2")}
          </p>
          <ul className="ml-4 space-y-1">
            <li>• <code className="px-1 py-0.5 bg-surface-0/50 rounded">manifest.json</code> - {t("settings.plugins.manifestFile")}</li>
            <li>• <code className="px-1 py-0.5 bg-surface-0/50 rounded">index.js</code> - {t("settings.plugins.indexFile")}</li>
          </ul>
          <p>
            <strong className="text-text">3.</strong> {t("settings.plugins.installStep3")}
          </p>
        </div>
      </SettingGroup>
    </div>
  );
}

function AboutSettings() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      {/* App info */}
      <div className="flex items-center gap-4 p-4 bg-surface-0/20 rounded-xl">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent/30 to-accent/10 flex items-center justify-center">
          <span className="text-3xl">⬡</span>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-text">SimplyTerm</h3>
          <p className="text-sm text-text-muted">{t("settings.about.version", { version: "0.1.0" })}</p>
          <p className="text-xs text-text-muted mt-1">
            {t("settings.about.tagline")}
          </p>
        </div>
      </div>

      <SettingGroup title={t("settings.about.techTitle")} description={t("settings.about.techDesc")}>
        <div className="flex flex-wrap gap-2">
          {["Tauri", "React", "TypeScript", "Rust", "xterm.js"].map((tech) => (
            <span
              key={tech}
              className="px-3 py-1.5 bg-surface-0/30 rounded-full text-xs text-text-muted"
            >
              {tech}
            </span>
          ))}
        </div>
      </SettingGroup>

      <SettingGroup title={t("settings.about.linksTitle")} description={t("settings.about.linksDesc")}>
        <div className="space-y-2">
          <LinkButton
            icon={<Github size={18} />}
            title={t("settings.about.sourceCode")}
            description={t("settings.about.viewOnGithub")}
            href="https://github.com"
          />
          <LinkButton
            icon={<ExternalLink size={18} />}
            title={t("settings.about.documentation")}
            description={t("settings.about.userGuide")}
            href="#"
          />
        </div>
      </SettingGroup>

      <div className="pt-4 border-t border-surface-0/30">
        <p className="text-xs text-text-muted text-center">
          {t("settings.about.footer")}
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// UI Components
// ============================================================================

function SettingGroup({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-sm font-medium text-text">{title}</h4>
        <p className="text-xs text-text-muted">{description}</p>
      </div>
      {children}
    </div>
  );
}

function SettingRow({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between p-4 bg-surface-0/20 rounded-lg">
      <div className="flex items-center gap-3">
        <div className="text-text-muted">{icon}</div>
        <div>
          <div className="text-sm font-medium text-text">{title}</div>
          <div className="text-xs text-text-muted">{description}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`
        w-11 h-6 rounded-full transition-colors relative
        ${checked ? "bg-accent" : "bg-surface-0"}
      `}
    >
      <div
        className={`
          absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform
          ${checked ? "translate-x-6" : "translate-x-1"}
        `}
      />
    </button>
  );
}

function ThemeCard({
  name,
  active,
  colors,
  onClick,
}: {
  name: string;
  active: boolean;
  colors: string[];
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        relative flex flex-col items-center gap-2 p-3 rounded-xl transition-all
        ${active
          ? "ring-2 ring-accent bg-accent/10"
          : "hover:bg-white/5"
        }
      `}
    >
      <div className="flex gap-1">
        {colors.map((color, i) => (
          <div
            key={i}
            className="w-8 h-12 rounded-md first:rounded-l-lg last:rounded-r-lg"
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
      <span className="text-xs text-text-muted">{name}</span>
    </button>
  );
}

function LinkButton({
  icon,
  title,
  description,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 p-3 rounded-lg bg-surface-0/20 hover:bg-surface-0/30 transition-colors group"
    >
      <div className="text-text-muted group-hover:text-accent transition-colors">
        {icon}
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium text-text">{title}</div>
        <div className="text-xs text-text-muted">{description}</div>
      </div>
      <ChevronRight size={16} className="text-text-muted group-hover:text-text transition-colors" />
    </a>
  );
}

export default SettingsModal;
