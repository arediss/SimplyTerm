import { useState, useCallback, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Command, CommandHandlers, CommandContext } from "./types";
import { createCommands } from "./commands";

interface UseCommandPaletteOptions {
  handlers: CommandHandlers;
  context: CommandContext;
}

export function useCommandPalette({ handlers, context }: UseCommandPaletteOptions) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Create commands with current handlers and context
  const commands = useMemo(
    () => createCommands(handlers, context),
    [handlers, context]
  );

  // Filter commands based on query and enabled state
  const filteredCommands = useMemo(() => {
    // Filter out disabled commands
    const enabledCommands = commands.filter(
      (cmd) => !cmd.enabled || cmd.enabled()
    );

    if (!query.trim()) {
      return enabledCommands;
    }

    const searchTerms = query.toLowerCase().split(/\s+/);

    return enabledCommands.filter((cmd) => {
      const label = t(cmd.labelKey).toLowerCase();
      // Fuzzy match: all search terms must be found somewhere in the label
      return searchTerms.every((term) => label.includes(term));
    });
  }, [commands, query, t]);

  // Reset selection when filtered commands change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredCommands.length]);

  const open = useCallback(() => {
    setIsOpen(true);
    setQuery("");
    setSelectedIndex(0);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery("");
    setSelectedIndex(0);
  }, []);

  const toggle = useCallback(() => {
    if (isOpen) {
      close();
    } else {
      open();
    }
  }, [isOpen, open, close]);

  const executeCommand = useCallback(
    (command: Command) => {
      command.action();
      close();
    },
    [close]
  );

  const executeSelected = useCallback(() => {
    if (filteredCommands[selectedIndex]) {
      executeCommand(filteredCommands[selectedIndex]);
    }
  }, [filteredCommands, selectedIndex, executeCommand]);

  const selectNext = useCallback(() => {
    setSelectedIndex((prev) =>
      prev < filteredCommands.length - 1 ? prev + 1 : 0
    );
  }, [filteredCommands.length]);

  const selectPrev = useCallback(() => {
    setSelectedIndex((prev) =>
      prev > 0 ? prev - 1 : filteredCommands.length - 1
    );
  }, [filteredCommands.length]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          selectNext();
          break;
        case "ArrowUp":
          e.preventDefault();
          selectPrev();
          break;
        case "Enter":
          e.preventDefault();
          executeSelected();
          break;
        case "Escape":
          e.preventDefault();
          close();
          break;
      }
    },
    [selectNext, selectPrev, executeSelected, close]
  );

  return {
    isOpen,
    query,
    setQuery,
    selectedIndex,
    setSelectedIndex,
    filteredCommands,
    open,
    close,
    toggle,
    executeCommand,
    executeSelected,
    selectNext,
    selectPrev,
    handleKeyDown,
  };
}
