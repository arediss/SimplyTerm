import { useTranslation } from "react-i18next";
import { MousePointer2 } from "lucide-react";
import { SettingGroup, SettingRow, Toggle } from "./SettingsUIComponents";
import type { AppSettings } from "../../types";

interface TerminalSettingsProps {
  settings: AppSettings["terminal"];
  onChange: <K extends keyof AppSettings["terminal"]>(
    key: K,
    value: AppSettings["terminal"][K]
  ) => void;
}

export default function TerminalSettings({ settings, onChange }: TerminalSettingsProps) {
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
