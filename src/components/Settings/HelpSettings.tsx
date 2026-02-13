import { useTranslation } from "react-i18next";
import { Keyboard } from "lucide-react";
import { modifierKey } from "../../utils";
import { SettingGroup } from "./SettingsUIComponents";

interface Shortcut {
  labelKey: string;
  keys: string;
}

interface ShortcutGroup {
  titleKey: string;
  shortcuts: Shortcut[];
}

const mod = modifierKey;

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    titleKey: "settings.help.groupGeneral",
    shortcuts: [
      { labelKey: "settings.help.commandPalette", keys: `${mod}+Shift+P` },
      { labelKey: "settings.help.openSettings", keys: `${mod}+,` },
    ],
  },
  {
    titleKey: "settings.help.groupTabs",
    shortcuts: [
      { labelKey: "settings.help.newSshConnection", keys: `${mod}+N` },
      { labelKey: "settings.help.newLocalTerminal", keys: `${mod}+T` },
      { labelKey: "settings.help.closeTab", keys: `${mod}+W` },
      { labelKey: "settings.help.nextTab", keys: `${mod}+Tab` },
      { labelKey: "settings.help.prevTab", keys: `${mod}+Shift+Tab` },
    ],
  },
  {
    titleKey: "settings.help.groupPanes",
    shortcuts: [
      { labelKey: "settings.help.splitVertical", keys: `${mod}+Shift+D` },
      { labelKey: "settings.help.splitHorizontal", keys: `${mod}+Shift+E` },
      { labelKey: "settings.help.focusNextPane", keys: "Ctrl+Alt+Tab" },
      { labelKey: "settings.help.focusPrevPane", keys: "Ctrl+Alt+Shift+Tab" },
    ],
  },
  {
    titleKey: "settings.help.groupTerminal",
    shortcuts: [
      { labelKey: "settings.help.searchInTerminal", keys: "Ctrl+F" },
    ],
  },
];

function ShortcutKey({ keys }: Readonly<{ keys: string }>) {
  const parts = keys.split("+");
  return (
    <span className="flex items-center gap-0.5">
      {parts.map((part, i) => (
        <span key={i}>
          {i > 0 && <span className="text-text-muted/30 mx-0.5">+</span>}
          <kbd className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 text-[10px] font-medium text-text-muted bg-crust/80 border border-surface-0/30 rounded-md shadow-sm">
            {part}
          </kbd>
        </span>
      ))}
    </span>
  );
}

function ShortcutRow({ labelKey, keys }: Readonly<Shortcut>) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between py-2 px-3">
      <span className="text-xs text-text">{t(labelKey)}</span>
      <ShortcutKey keys={keys} />
    </div>
  );
}

function ShortcutSection({ group }: Readonly<{ group: ShortcutGroup }>) {
  const { t } = useTranslation();
  return (
    <div>
      <div className="text-[11px] font-medium text-text-muted/60 uppercase tracking-wider px-3 py-1.5">
        {t(group.titleKey)}
      </div>
      <div className="divide-y divide-surface-0/15">
        {group.shortcuts.map((s) => (
          <ShortcutRow key={s.labelKey} {...s} />
        ))}
      </div>
    </div>
  );
}

export default function HelpSettings() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <SettingGroup
        title={t("settings.help.shortcutsTitle")}
        description={t("settings.help.shortcutsDesc")}
      >
        <div className="rounded-xl bg-surface-0/15 border border-surface-0/20 overflow-hidden divide-y divide-surface-0/20">
          {SHORTCUT_GROUPS.map((group) => (
            <ShortcutSection key={group.titleKey} group={group} />
          ))}
        </div>
      </SettingGroup>

      {/* Tip */}
      <div className="flex items-start gap-3 p-3 bg-accent/5 border border-accent/10 rounded-xl">
        <Keyboard size={16} className="text-accent mt-0.5 shrink-0" />
        <p className="text-[11px] text-text-muted leading-relaxed">
          {t("settings.help.tip")}
        </p>
      </div>
    </div>
  );
}
