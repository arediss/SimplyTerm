import { useRef, useEffect, useCallback, memo } from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { Command } from "./types";
import { CommandItem } from "./CommandItem";

interface CommandPaletteProps {
  isOpen: boolean;
  query: string;
  onQueryChange: (query: string) => void;
  selectedIndex: number;
  onSelectedIndexChange: (index: number) => void;
  filteredCommands: Command[];
  onClose: () => void;
  onExecuteCommand: (command: Command) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

export function CommandPalette({
  isOpen,
  query,
  onQueryChange,
  selectedIndex,
  onSelectedIndexChange,
  filteredCommands,
  onClose,
  onExecuteCommand,
  onKeyDown,
}: CommandPaletteProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && filteredCommands.length > 0) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex, filteredCommands.length]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] animate-fade-in">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        role="presentation"
        onClick={onClose}
      />

      {/* Palette */}
      <div
        className="
          relative w-full max-w-lg mx-4
          bg-mantle border border-surface-0/60 rounded-xl
          shadow-2xl shadow-black/50
          animate-scale-in
          overflow-hidden
        "
        role="dialog"
        onKeyDown={onKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-0/40">
          <Search size={18} className="text-text-muted shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={t("commandPalette.searchPlaceholder")}
            className="
              flex-1 bg-transparent text-text text-sm
              placeholder:text-text-muted/60
              outline-none
            "
          />
        </div>

        {/* Commands list */}
        <div
          ref={listRef}
          className="max-h-[50vh] overflow-y-auto p-2"
        >
          {filteredCommands.length === 0 ? (
            <div className="py-8 text-center text-sm text-text-muted">
              {t("commandPalette.noResults")}
            </div>
          ) : (
            filteredCommands.map((command, index) => (
              <CommandItemWrapper
                key={command.id}
                command={command}
                index={index}
                isSelected={index === selectedIndex}
                onSelectedIndexChange={onSelectedIndexChange}
                onExecuteCommand={onExecuteCommand}
              />
            ))
          )}
        </div>

        {/* Footer with hints */}
        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-surface-0/40 text-xs text-text-muted">
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded bg-surface-0/50">
              <span className="font-mono">↑↓</span>
            </kbd>
            {t("commandPalette.navigate")}
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded bg-surface-0/50">
              <span className="font-mono">↵</span>
            </kbd>
            {t("commandPalette.execute")}
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded bg-surface-0/50">
              <span className="font-mono">Esc</span>
            </kbd>
            {t("commandPalette.close")}
          </span>
        </div>
      </div>
    </div>
  );
}

// Wrapper to avoid inline closures per command in .map()
const CommandItemWrapper = memo(function CommandItemWrapper({
  command,
  index,
  isSelected,
  onSelectedIndexChange,
  onExecuteCommand,
}: {
  command: Command;
  index: number;
  isSelected: boolean;
  onSelectedIndexChange: (index: number) => void;
  onExecuteCommand: (command: Command) => void;
}) {
  const handleSelect = useCallback(() => onSelectedIndexChange(index), [index, onSelectedIndexChange]);
  const handleExecute = useCallback(() => onExecuteCommand(command), [command, onExecuteCommand]);
  return (
    <CommandItem
      command={command}
      isSelected={isSelected}
      onSelect={handleSelect}
      onExecute={handleExecute}
    />
  );
});
