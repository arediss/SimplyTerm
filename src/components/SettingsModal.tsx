import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  X,
  Palette,
  Terminal,
  Link2,
  Info,
  Shield,
  Puzzle,
} from "lucide-react";
import { pluginManager } from "../plugins";
import { PluginSettingsPanel } from "../plugins/PluginSettingsPanel";
import type { SettingsPanelRegistration } from "../plugins/types";
import {
  AppearanceSettings,
  TerminalSettings,
  ConnectionsSettings,
  SecuritySettings,
  PluginsSettings,
  AboutSettings,
} from "./Settings";

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
    /** Window blur effect: "none" | "acrylic" | "mica" */
    windowEffect?: string;
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

type SettingsSection = "appearance" | "terminal" | "connections" | "security" | "plugins" | "about" | `plugin:${string}`;

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
  const [pluginPanels, setPluginPanels] = useState<Map<string, { pluginId: string; panel: SettingsPanelRegistration }>>(
    new Map(pluginManager.registeredSettingsPanels)
  );

  // Subscribe to plugin settings panel changes
  useEffect(() => {
    const unsubscribe = pluginManager.subscribe((event) => {
      if (event.type === 'settings:register' || event.type === 'settings:unregister') {
        setPluginPanels(new Map(pluginManager.registeredSettingsPanels));
      }
      if (event.type === 'settings:unregister') {
        setActiveSection((prev) => {
          if (prev === `plugin:${event.panelId}`) return 'appearance';
          return prev;
        });
      }
    });

    setPluginPanels(new Map(pluginManager.registeredSettingsPanels));

    return unsubscribe;
  }, []);

  const activePluginPanel = useMemo(() => {
    if (activeSection.startsWith('plugin:')) {
      const panelId = activeSection.replace('plugin:', '');
      return pluginPanels.get(panelId);
    }
    return null;
  }, [activeSection, pluginPanels]);

  const pluginSections = useMemo(() => {
    return Array.from(pluginPanels.entries())
      .sort(([, a], [, b]) => (a.panel.config.order ?? 100) - (b.panel.config.order ?? 100))
      .map(([panelId, { panel }]) => ({
        id: `plugin:${panelId}` as SettingsSection,
        label: panel.config.title,
        icon: <Puzzle size={18} />,
      }));
  }, [pluginPanels]);

  // Early return AFTER all hooks
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

  const coreSections: { id: SettingsSection; label: string; icon: React.ReactNode }[] = [
    { id: "appearance", label: t("settings.sections.appearance"), icon: <Palette size={18} /> },
    { id: "terminal", label: t("settings.sections.terminal"), icon: <Terminal size={18} /> },
    { id: "connections", label: t("settings.sections.connections"), icon: <Link2 size={18} /> },
    { id: "security", label: t("settings.sections.security"), icon: <Shield size={18} /> },
    { id: "plugins", label: t("settings.sections.plugins"), icon: <Puzzle size={18} /> },
    { id: "about", label: t("settings.sections.about"), icon: <Info size={18} /> },
  ];

  const sections = [...coreSections, ...pluginSections];

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
          style={{ width: "900px", height: "640px", maxWidth: "90vw", maxHeight: "85vh" }}
        >
          {/* Sidebar */}
          <div className="w-56 bg-crust flex flex-col border-r border-surface-0/30">
            <div className="p-4">
              <h2 className="text-sm font-semibold text-text">{t("settings.title")}</h2>
            </div>

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
              {activePluginPanel && (
                <PluginSettingsPanel
                  key={activePluginPanel.panel.config.id}
                  pluginId={activePluginPanel.pluginId}
                  panel={activePluginPanel.panel}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default SettingsModal;
