import { useState } from "react";
import {
  X,
  Palette,
  Terminal,
  Link2,
  Info,
  ChevronRight,
  Monitor,
  MousePointer2,
  RotateCcw,
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
    theme: "dark" | "light";
    accentColor: string;
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

  const resetSettings = () => {
    onSettingsChange(defaultSettings);
  };

  const sections: { id: SettingsSection; label: string; icon: React.ReactNode }[] = [
    { id: "appearance", label: "Apparence", icon: <Palette size={18} /> },
    { id: "terminal", label: "Terminal", icon: <Terminal size={18} /> },
    { id: "connections", label: "Connexions", icon: <Link2 size={18} /> },
    { id: "security", label: "Sécurité", icon: <Shield size={18} /> },
    { id: "plugins", label: "Plugins", icon: <Puzzle size={18} /> },
    { id: "about", label: "À propos", icon: <Info size={18} /> },
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
            <div className="p-4 border-b border-surface-0/30">
              <h2 className="text-sm font-semibold text-text">Paramètres</h2>
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

            {/* Reset button */}
            <div className="p-3 border-t border-surface-0/30">
              <button
                onClick={resetSettings}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs text-text-muted hover:text-warning hover:bg-warning/10 transition-colors"
              >
                <RotateCcw size={14} />
                Réinitialiser
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 flex flex-col">
            {/* Header with close button */}
            <div className="h-14 px-6 flex items-center justify-between border-b border-surface-0/30">
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
                <AppearanceSettings settings={settings} />
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

function AppearanceSettings({ settings }: { settings: AppSettings }) {
  return (
    <div className="space-y-6">
      <SettingGroup title="Thème" description="Personnalisez l'apparence de l'application">
        <div className="flex gap-3">
          <ThemeCard
            name="Sombre"
            active={settings.appearance.theme === "dark"}
            colors={["#181715", "#1F1E1B", "#262421"]}
          />
          <ThemeCard
            name="Clair"
            active={settings.appearance.theme === "light"}
            colors={["#F5F5F5", "#FFFFFF", "#E8E8E8"]}
            disabled
            badge="Bientôt"
          />
        </div>
      </SettingGroup>

      <SettingGroup title="Couleur d'accent" description="Couleur utilisée pour les éléments interactifs">
        <div className="flex gap-2">
          {["#7DA6E8", "#9CD68D", "#E8C878", "#D4A5D9", "#E88B8B"].map((color) => (
            <button
              key={color}
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
  return (
    <div className="space-y-6">
      <SettingGroup title="Police" description="Police utilisée dans le terminal">
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

      <SettingGroup title="Taille de police" description="Taille du texte dans le terminal">
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

      <SettingGroup title="Style du curseur" description="Apparence du curseur dans le terminal">
        <div className="flex gap-3">
          {[
            { value: "bar", label: "Barre", icon: <div className="w-0.5 h-4 bg-current" /> },
            { value: "block", label: "Bloc", icon: <div className="w-3 h-4 bg-current" /> },
            { value: "underline", label: "Souligné", icon: <div className="w-3 h-0.5 bg-current mt-3" /> },
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
        title="Clignotement du curseur"
        description="Faire clignoter le curseur"
      >
        <Toggle
          checked={settings.cursorBlink}
          onChange={(checked) => onChange("cursorBlink", checked)}
        />
      </SettingRow>

      <SettingGroup title="Historique (scrollback)" description="Nombre de lignes conservées">
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
        title="Sessions sauvegardées"
        description="Gérez vos connexions enregistrées"
      >
        <div className="flex items-center justify-between p-4 bg-surface-0/20 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center text-accent">
              <Monitor size={20} />
            </div>
            <div>
              <div className="text-sm font-medium text-text">
                {savedSessionsCount} session{savedSessionsCount !== 1 ? "s" : ""} sauvegardée{savedSessionsCount !== 1 ? "s" : ""}
              </div>
              <div className="text-xs text-text-muted">
                Stockées localement avec credentials sécurisés
              </div>
            </div>
          </div>
        </div>
      </SettingGroup>

      <SettingGroup
        title="Supprimer les données"
        description="Effacer toutes les sessions sauvegardées et leurs credentials"
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
          {confirmClear ? "Confirmer la suppression" : "Tout supprimer"}
        </button>
        {confirmClear && (
          <p className="text-xs text-error mt-2">
            Cliquez à nouveau pour confirmer. Cette action est irréversible.
          </p>
        )}
      </SettingGroup>
    </div>
  );
}

function SecuritySettings() {
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
    { value: 0, label: 'Jamais' },
    { value: 60, label: '1 minute' },
    { value: 300, label: '5 minutes' },
    { value: 600, label: '10 minutes' },
    { value: 1800, label: '30 minutes' },
    { value: 3600, label: '1 heure' },
  ];

  const handleAutoLockChange = async (value: number) => {
    await vault.updateSettings(value);
  };

  const handlePasswordChange = async () => {
    setPasswordError(null);
    setPasswordSuccess(false);

    if (newPassword.length < 8) {
      setPasswordError('Le nouveau mot de passe doit contenir au moins 8 caractères');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Les mots de passe ne correspondent pas');
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
      setPasswordError(result.error || 'Erreur lors du changement de mot de passe');
    }
  };

  const handlePinSetup = async () => {
    setPinError(null);
    setPinSuccess(false);

    if (newPin.length < 4 || newPin.length > 6 || !/^\d+$/.test(newPin)) {
      setPinError('Le PIN doit contenir 4 à 6 chiffres');
      return;
    }
    if (newPin !== confirmPin) {
      setPinError('Les PINs ne correspondent pas');
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
      setPinError(result.error || 'Erreur lors de la configuration du PIN');
    }
  };

  const handleRemovePin = async () => {
    const result = await vault.removePin();
    if (!result.success) {
      setPinError(result.error || 'Erreur lors de la suppression du PIN');
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
      const keys = await vault.detectSecurityKeys();
      setDetectedSecurityKeys(keys);
    }

    setSecurityKeyLoading(false);
  };

  const handleRefreshSecurityKeys = async () => {
    setSecurityKeyLoading(true);
    const keys = await vault.detectSecurityKeys();
    setDetectedSecurityKeys(keys);
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
      setSecurityKeyError(result.error || 'Erreur lors de la configuration de la clé de sécurité');
    }
  };

  const handleRemoveSecurityKey = async () => {
    const result = await vault.removeSecurityKey();
    if (!result.success) {
      setSecurityKeyError(result.error || 'Erreur lors de la suppression de la clé de sécurité');
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
      setDeleteError(result.error || 'Mot de passe incorrect');
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
      setSetupError('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }
    if (setupPassword !== setupConfirmPassword) {
      setSetupError('Les mots de passe ne correspondent pas');
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
      setSetupError(result.error || 'Erreur lors de la création');
    }
  };

  if (!vault.status?.exists) {
    return (
      <div className="space-y-6">
        <SettingGroup title="Vault non configuré" description="Protégez vos mots de passe avec un vault chiffré">
          <div className="flex items-center gap-3 p-4 bg-accent/10 rounded-xl mb-4">
            <Shield className="w-5 h-5 text-accent flex-shrink-0" />
            <p className="text-sm text-text-secondary">
              Sans vault, les mots de passe de vos connexions ne seront pas sauvegardés.
              Vous devrez les saisir à chaque connexion.
            </p>
          </div>

          {!showInlineSetup ? (
            <button
              onClick={() => setShowInlineSetup(true)}
              className="w-full py-3 bg-accent text-crust font-medium rounded-xl hover:bg-accent-hover transition-colors"
            >
              Configurer le vault
            </button>
          ) : (
            <div className="p-4 bg-surface-0/20 rounded-lg space-y-4">
              <div className="space-y-3">
                <div className="relative">
                  <input
                    type={showSetupPwd ? 'text' : 'password'}
                    placeholder="Mot de passe principal (min. 8 car.)"
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
                  placeholder="Confirmer le mot de passe"
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
                  Annuler
                </button>
                <button
                  onClick={handleInlineSetup}
                  disabled={setupLoading}
                  className="flex-1 py-2 bg-accent text-crust text-sm font-medium rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50"
                >
                  {setupLoading ? 'Création...' : 'Créer le vault'}
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
      <SettingGroup title="État du vault" description="Stockage chiffré de vos credentials">
        <div className="flex items-center justify-between p-4 bg-surface-0/20 rounded-lg">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              vault.status?.isUnlocked ? 'bg-success/20 text-success' : 'bg-error/20 text-error'
            }`}>
              {vault.status?.isUnlocked ? <Lock size={20} /> : <Lock size={20} />}
            </div>
            <div>
              <div className="text-sm font-medium text-text">
                {vault.status?.isUnlocked ? 'Vault déverrouillé' : 'Vault verrouillé'}
              </div>
              <div className="text-xs text-text-muted">
                Méthodes: {vault.status?.unlockMethods.map(m =>
                  m === 'master_password' ? 'Mot de passe' :
                  m === 'pin' ? 'PIN' : m
                ).join(', ')}
              </div>
            </div>
          </div>
          {vault.status?.isUnlocked && (
            <button
              onClick={handleLock}
              className="px-3 py-1.5 bg-surface-0/50 text-text-muted text-xs rounded-lg hover:bg-surface-0 transition-colors"
            >
              Verrouiller
            </button>
          )}
        </div>
      </SettingGroup>

      {/* Auto-lock */}
      <SettingGroup title="Verrouillage automatique" description="Délai avant le verrouillage automatique">
        <select
          value={vault.status?.autoLockTimeout || 300}
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
      <SettingGroup title="Mode sécurité maximale" description="Exige le déverrouillage du vault à chaque connexion SSH">
        <div className="flex items-center justify-between p-4 bg-surface-0/20 rounded-lg">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              vault.status?.requireUnlockOnConnect ? 'bg-warning/20 text-warning' : 'bg-surface-0/50 text-text-muted'
            }`}>
              <ShieldCheck size={20} />
            </div>
            <div>
              <div className="text-sm font-medium text-text">
                {vault.status?.requireUnlockOnConnect ? 'Activé' : 'Désactivé'}
              </div>
              <div className="text-xs text-text-muted">
                {vault.status?.requireUnlockOnConnect
                  ? 'Le vault sera verrouillé après chaque connexion'
                  : 'Les credentials restent accessibles selon le timeout'}
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
            Vous devrez saisir votre PIN/mot de passe à chaque connexion SSH
          </p>
        )}
      </SettingGroup>

      {/* PIN Management */}
      <SettingGroup title="Code PIN" description="Déverrouillage rapide avec un code PIN">
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
                  {hasPin ? 'PIN configuré' : 'PIN non configuré'}
                </div>
                <div className="text-xs text-text-muted">
                  {hasPin ? 'Déverrouillage rapide activé' : 'Ajoutez un PIN pour un accès rapide'}
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
                  Supprimer
                </button>
              )}
              <button
                onClick={() => setShowPinSetup(true)}
                disabled={!vault.status?.isUnlocked}
                className="px-3 py-1.5 bg-accent/20 text-accent text-xs rounded-lg hover:bg-accent/30 transition-colors disabled:opacity-50"
              >
                {hasPin ? 'Modifier' : 'Configurer'}
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
                placeholder="Nouveau PIN (4-6 chiffres)"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                className="w-full px-4 py-3 bg-surface-0/30 border border-surface-0/50 rounded-xl text-text placeholder-text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                placeholder="Confirmer le PIN"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                className="w-full px-4 py-3 bg-surface-0/30 border border-surface-0/50 rounded-xl text-text placeholder-text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            {pinError && <p className="text-sm text-error">{pinError}</p>}
            {pinSuccess && (
              <p className="text-sm text-success flex items-center gap-2">
                <Check size={16} /> PIN configuré avec succès
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => { setShowPinSetup(false); setNewPin(''); setConfirmPin(''); setPinError(null); }}
                className="flex-1 py-2 bg-surface-0/50 text-text-muted text-sm rounded-lg hover:bg-surface-0 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handlePinSetup}
                className="flex-1 py-2 bg-accent text-crust text-sm font-medium rounded-lg hover:bg-accent-hover transition-colors"
              >
                Enregistrer
              </button>
            </div>
          </div>
        )}
      </SettingGroup>

      {/* Biometric Authentication */}
      <SettingGroup title="Authentification biométrique" description="Déverrouillez avec Windows Hello ou Touch ID">
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
                {vault.status?.biometricType === 'windows_hello' ? 'Windows Hello' :
                 vault.status?.biometricType === 'touch_id' ? 'Touch ID' :
                 'Biométrie'}
              </div>
              <div className="text-xs text-text-muted">
                {vault.status?.unlockMethods.includes('biometric')
                  ? 'Activé'
                  : vault.status?.biometricAvailable
                    ? 'Non configuré'
                    : 'Non disponible sur ce système'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!vault.status?.biometricAvailable ? (
              <span className="px-2 py-1 bg-surface-0/50 text-text-muted text-[10px] rounded-full">
                Non supporté
              </span>
            ) : (
              <span className="px-2 py-1 bg-accent/20 text-accent text-[10px] rounded-full">
                Bientôt
              </span>
            )}
          </div>
        </div>
      </SettingGroup>

      {/* FIDO2 Security Key Authentication */}
      <SettingGroup title="Clé de sécurité FIDO2" description="Déverrouillez en touchant votre clé (YubiKey, SoloKey, etc.)">
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
                  Clé FIDO2
                </div>
                <div className="text-xs text-text-muted">
                  {hasSecurityKey ? 'Configurée - Touch to unlock' : 'Clé de sécurité matérielle'}
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
                  Supprimer
                </button>
              )}
              <button
                onClick={handleOpenSecurityKeySetup}
                disabled={!vault.status?.isUnlocked}
                className="px-3 py-1.5 bg-accent/20 text-accent text-xs rounded-lg hover:bg-accent/30 transition-colors disabled:opacity-50"
              >
                {hasSecurityKey ? 'Modifier' : 'Configurer'}
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
                <p className="text-sm text-text-muted">Touchez votre clé de sécurité...</p>
              </div>
            ) : securityKeyAvailable === false ? (
              <div className="p-4 bg-warning/10 rounded-lg">
                <p className="text-sm text-warning flex items-center gap-2">
                  <AlertCircle size={16} />
                  Aucune clé de sécurité détectée
                </p>
                <p className="text-xs text-text-muted mt-2">
                  Insérez une clé FIDO2 (YubiKey, SoloKey, Google Titan, etc.)
                </p>
              </div>
            ) : detectedSecurityKeys.length === 0 ? (
              <div className="p-4 bg-surface-0/30 rounded-lg">
                <p className="text-sm text-text-muted text-center">
                  Aucune clé détectée
                </p>
                <p className="text-xs text-text-muted/70 text-center mt-1">
                  Insérez une clé de sécurité FIDO2
                </p>
                <button
                  onClick={handleRefreshSecurityKeys}
                  className="mt-3 w-full py-2 bg-surface-0/50 text-text-muted text-xs rounded-lg hover:bg-surface-0 transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw size={14} />
                  Actualiser
                </button>
              </div>
            ) : (
              <>
                {/* Detected keys info */}
                <div className="p-3 bg-success/10 rounded-lg">
                  <p className="text-sm text-success flex items-center gap-2">
                    <Check size={16} />
                    {detectedSecurityKeys.length} clé{detectedSecurityKeys.length > 1 ? 's' : ''} détectée{detectedSecurityKeys.length > 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-text-muted mt-1">
                    {detectedSecurityKeys.map(k => k.productName).join(', ')}
                  </p>
                </div>

                <div className="p-3 bg-surface-0/30 rounded-lg">
                  <p className="text-sm text-text">Configuration en 2 étapes :</p>
                  <ol className="text-xs text-text-muted mt-2 space-y-1 list-decimal list-inside">
                    <li>Touchez votre clé pour l'enregistrer</li>
                    <li>Touchez-la à nouveau pour confirmer</li>
                  </ol>
                </div>

                <button
                  onClick={handleRefreshSecurityKeys}
                  className="text-xs text-text-muted hover:text-text flex items-center gap-1"
                >
                  <RefreshCw size={12} />
                  Actualiser la liste
                </button>
              </>
            )}

            {securityKeyError && <p className="text-sm text-error">{securityKeyError}</p>}
            {securityKeySuccess && (
              <p className="text-sm text-success flex items-center gap-2">
                <Check size={16} /> Clé de sécurité configurée avec succès
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
                Annuler
              </button>
              <button
                onClick={handleSetupSecurityKey}
                disabled={securityKeyLoading || detectedSecurityKeys.length === 0}
                className="flex-1 py-2 bg-accent text-crust text-sm font-medium rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50"
              >
                {securityKeyLoading ? 'Touchez votre clé...' : 'Configurer'}
              </button>
            </div>
          </div>
        )}
      </SettingGroup>

      {/* Change Password */}
      <SettingGroup title="Mot de passe principal" description="Modifiez votre mot de passe principal">
        {!showPasswordChange ? (
          <button
            onClick={() => setShowPasswordChange(true)}
            disabled={!vault.status?.isUnlocked}
            className="px-4 py-2.5 bg-surface-0/30 text-text text-sm rounded-lg hover:bg-surface-0/50 transition-colors disabled:opacity-50"
          >
            Changer le mot de passe
          </button>
        ) : (
          <div className="p-4 bg-surface-0/20 rounded-lg space-y-4">
            <div className="space-y-3">
              <div className="relative">
                <input
                  type={showCurrentPwd ? 'text' : 'password'}
                  placeholder="Mot de passe actuel"
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
                  placeholder="Nouveau mot de passe (min. 8 car.)"
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
                placeholder="Confirmer le nouveau mot de passe"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 bg-surface-0/30 border border-surface-0/50 rounded-xl text-text placeholder-text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            {passwordError && <p className="text-sm text-error">{passwordError}</p>}
            {passwordSuccess && (
              <p className="text-sm text-success flex items-center gap-2">
                <Check size={16} /> Mot de passe modifié avec succès
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
                Annuler
              </button>
              <button
                onClick={handlePasswordChange}
                className="flex-1 py-2 bg-accent text-crust text-sm font-medium rounded-lg hover:bg-accent-hover transition-colors"
              >
                Modifier
              </button>
            </div>
          </div>
        )}
      </SettingGroup>

      {/* Delete Vault */}
      <SettingGroup title="Supprimer le vault" description="Supprime toutes vos données chiffrées de manière irréversible">
        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-4 py-2.5 bg-error/10 text-error text-sm rounded-lg hover:bg-error/20 transition-colors"
          >
            <Trash2 size={16} className="inline mr-2" />
            Supprimer le vault
          </button>
        ) : (
          <div className="p-4 bg-error/10 rounded-lg border border-error/30 space-y-4">
            <p className="text-sm text-error">
              Cette action est irréversible. Toutes vos credentials seront perdues.
            </p>
            <input
              type="password"
              placeholder="Entrez votre mot de passe principal pour confirmer"
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
                Annuler
              </button>
              <button
                onClick={handleDeleteVault}
                disabled={!deletePassword}
                className="flex-1 py-2 bg-error text-white text-sm font-medium rounded-lg hover:bg-error/90 transition-colors disabled:opacity-50"
              >
                Supprimer définitivement
              </button>
            </div>
          </div>
        )}
      </SettingGroup>
    </div>
  );
}

function PluginsSettings() {
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
        title="Plugins installés"
        description="Extensions ajoutant des fonctionnalités à SimplyTerm"
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-text-muted">
            {plugins.length} plugin{plugins.length !== 1 ? "s" : ""} trouvé{plugins.length !== 1 ? "s" : ""}
          </span>
          <button
            onClick={handleRefresh}
            disabled={loading || actionLoading === "refresh"}
            className="flex items-center gap-1.5 px-2 py-1 text-xs text-text-muted hover:text-text transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={actionLoading === "refresh" ? "animate-spin" : ""} />
            Actualiser
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw size={20} className="animate-spin text-text-muted" />
          </div>
        ) : plugins.length === 0 ? (
          <div className="text-center py-8 text-text-muted">
            <Puzzle size={32} className="mx-auto mb-3 opacity-50" />
            <p className="text-sm">Aucun plugin installé</p>
            <p className="text-xs mt-1">
              Placez vos plugins dans ~/.simplyterm/plugins/
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
                      par {plugin.author}
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
                      Actif
                    </>
                  ) : (
                    <>
                      <PowerOff size={12} />
                      Inactif
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </SettingGroup>

      <SettingGroup
        title="Installation"
        description="Comment ajouter de nouveaux plugins"
      >
        <div className="p-3 bg-surface-0/20 rounded-lg text-xs text-text-muted space-y-2">
          <p>
            <strong className="text-text">1.</strong> Créez le dossier{" "}
            <code className="px-1 py-0.5 bg-surface-0/50 rounded">~/.simplyterm/plugins/</code>
          </p>
          <p>
            <strong className="text-text">2.</strong> Ajoutez un dossier pour chaque plugin avec :
          </p>
          <ul className="ml-4 space-y-1">
            <li>• <code className="px-1 py-0.5 bg-surface-0/50 rounded">manifest.json</code> - Métadonnées</li>
            <li>• <code className="px-1 py-0.5 bg-surface-0/50 rounded">index.js</code> - Code du plugin</li>
          </ul>
          <p>
            <strong className="text-text">3.</strong> Actualisez la liste et activez le plugin
          </p>
        </div>
      </SettingGroup>
    </div>
  );
}

function AboutSettings() {
  return (
    <div className="space-y-6">
      {/* App info */}
      <div className="flex items-center gap-4 p-4 bg-surface-0/20 rounded-xl">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent/30 to-accent/10 flex items-center justify-center">
          <span className="text-3xl">⬡</span>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-text">SimplyTerm</h3>
          <p className="text-sm text-text-muted">Version 0.1.0</p>
          <p className="text-xs text-text-muted mt-1">
            Terminal SSH moderne, rapide et élégant
          </p>
        </div>
      </div>

      <SettingGroup title="Technologies" description="Construit avec">
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

      <SettingGroup title="Liens" description="Ressources et communauté">
        <div className="space-y-2">
          <LinkButton
            icon={<Github size={18} />}
            title="Code source"
            description="Voir sur GitHub"
            href="https://github.com"
          />
          <LinkButton
            icon={<ExternalLink size={18} />}
            title="Documentation"
            description="Guide d'utilisation"
            href="#"
          />
        </div>
      </SettingGroup>

      <div className="pt-4 border-t border-surface-0/30">
        <p className="text-xs text-text-muted text-center">
          Fait avec passion. Open source sous licence MIT.
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
  disabled,
  badge,
}: {
  name: string;
  active: boolean;
  colors: string[];
  disabled?: boolean;
  badge?: string;
}) {
  return (
    <button
      disabled={disabled}
      className={`
        relative flex flex-col items-center gap-2 p-3 rounded-xl transition-all
        ${active
          ? "ring-2 ring-accent bg-accent/10"
          : disabled
            ? "opacity-50 cursor-not-allowed"
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
      {badge && (
        <span className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-accent/20 text-accent text-[10px] rounded-full">
          {badge}
        </span>
      )}
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
