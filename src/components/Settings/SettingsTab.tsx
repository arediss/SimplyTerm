import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Palette, Terminal, Link2, Info, Shield, Puzzle } from "lucide-react";
import { pluginManager } from "../../plugins";
import { PluginSettingsPanel } from "../../plugins/PluginSettingsPanel";
import type { SettingsPanelRegistration } from "../../plugins/types";
import type { AppSettings } from "../../types/settings";
import {
  AppearanceSettings,
  TerminalSettings,
  ConnectionsSettings,
  SecuritySettings,
  PluginsSettings,
  AboutSettings,
} from "./index";

interface SettingsTabProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
  savedSessionsCount: number;
  onClearAllSessions: () => void;
}

type SettingsSection = "appearance" | "terminal" | "connections" | "security" | "plugins" | "about" | `plugin:${string}`;

export default function SettingsTab({
  settings,
  onSettingsChange,
  savedSessionsCount,
  onClearAllSessions,
}: SettingsTabProps) {
  const { t } = useTranslation();
  const [activeSection, setActiveSection] = useState<SettingsSection>("appearance");
  const [pluginPanels, setPluginPanels] = useState<Map<string, { pluginId: string; panel: SettingsPanelRegistration }>>(
    new Map(pluginManager.registeredSettingsPanels)
  );

  useEffect(() => {
    const unsubscribe = pluginManager.subscribe((event) => {
      if (event.type === "settings:register" || event.type === "settings:unregister") {
        setPluginPanels(new Map(pluginManager.registeredSettingsPanels));
      }
      if (event.type === "settings:unregister") {
        setActiveSection((prev) => (prev === `plugin:${event.panelId}` ? "appearance" : prev));
      }
    });
    setPluginPanels(new Map(pluginManager.registeredSettingsPanels));
    return unsubscribe;
  }, []);

  const activePluginPanel = useMemo(() => {
    if (activeSection.startsWith("plugin:")) {
      const panelId = activeSection.replace("plugin:", "");
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
    <div className="flex h-full">
      {/* Nav sidebar */}
      <div className="w-52 flex flex-col border-r border-surface-0/30">
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
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

      {/* Content area */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <h3 className="text-sm font-medium text-text mb-4">
            {sections.find((s) => s.id === activeSection)?.label}
          </h3>
          {activeSection === "appearance" && (
            <AppearanceSettings settings={settings} onChange={updateAppearanceSetting} />
          )}
          {activeSection === "terminal" && (
            <TerminalSettings settings={settings.terminal} onChange={updateTerminalSetting} />
          )}
          {activeSection === "connections" && (
            <ConnectionsSettings savedSessionsCount={savedSessionsCount} onClearAllSessions={onClearAllSessions} />
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
  );
}
