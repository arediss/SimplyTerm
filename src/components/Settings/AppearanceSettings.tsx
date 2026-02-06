import { useTranslation } from "react-i18next";
import i18n from "../../i18n";
import { getThemes } from "../../themes";
import { SettingGroup, ThemeCard } from "./SettingsUIComponents";
import type { AppSettings } from "../SettingsModal";

interface AppearanceSettingsProps {
  settings: AppSettings;
  onChange: <K extends keyof AppSettings["appearance"]>(
    key: K,
    value: AppSettings["appearance"][K]
  ) => void;
}

export default function AppearanceSettings({ settings, onChange }: AppearanceSettingsProps) {
  const { t } = useTranslation();
  const themes = getThemes();

  const languages = [
    { code: 'en', label: 'English', flag: '\u{1F1EC}\u{1F1E7}' },
    { code: 'fr', label: 'Fran\u00E7ais', flag: '\u{1F1EB}\u{1F1F7}' },
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

      <SettingGroup title={t("settings.appearance.windowEffectTitle")} description={t("settings.appearance.windowEffectDesc")}>
        <div className="flex gap-3">
          {[
            { value: "none", label: t("settings.appearance.effectNone") },
            { value: "acrylic", label: t("settings.appearance.effectAcrylic") },
            { value: "mica", label: t("settings.appearance.effectMica") },
          ].map((effect) => (
            <button
              key={effect.value}
              onClick={() => onChange("windowEffect", effect.value)}
              className={`
                px-4 py-2 rounded-lg text-sm transition-colors
                ${(settings.appearance.windowEffect ?? "none") === effect.value
                  ? "bg-accent/20 text-accent border border-accent/30"
                  : "bg-surface-0/30 text-text-muted hover:text-text border border-transparent"
                }
              `}
            >
              {effect.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-text-muted/70 mt-2">
          {t("settings.appearance.windowEffectNote")}
        </p>
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
