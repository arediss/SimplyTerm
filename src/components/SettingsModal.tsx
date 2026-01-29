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
} from "lucide-react";
import { usePlugins, type PluginManifest } from "../plugins";

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

type SettingsSection = "appearance" | "terminal" | "connections" | "plugins" | "about";

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
