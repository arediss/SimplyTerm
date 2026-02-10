import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Command } from "./types";
import { formatShortcut } from "./commands";

interface CommandItemProps {
  command: Command;
  isSelected: boolean;
  onSelect: () => void;
  onExecute: () => void;
}

export const CommandItem = memo(function CommandItem({
  command,
  isSelected,
  onSelect,
  onExecute,
}: CommandItemProps) {
  const { t } = useTranslation();
  const Icon = command.icon;
  const shortcut = formatShortcut(command.shortcut);

  return (
    <button
      className={`
        w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
        transition-colors text-left
        ${isSelected
          ? "bg-accent/20 text-text"
          : "text-text-secondary hover:bg-surface-0/50 hover:text-text"
        }
      `}
      onMouseEnter={onSelect}
      onClick={onExecute}
    >
      {Icon && (
        <Icon
          size={16}
          className={isSelected ? "text-accent" : "text-text-muted"}
        />
      )}
      <span className="flex-1 text-sm">{t(command.labelKey)}</span>
      {shortcut && (
        <kbd
          className={`
            text-xs px-1.5 py-0.5 rounded
            ${isSelected
              ? "bg-accent/30 text-accent"
              : "bg-surface-0/50 text-text-muted"
            }
          `}
        >
          {shortcut}
        </kbd>
      )}
    </button>
  );
});
