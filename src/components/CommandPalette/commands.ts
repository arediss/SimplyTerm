import {
  Plus,
  X,
  Copy,
  Edit3,
  SplitSquareVertical,
  ArrowRight,
  ArrowLeft,
  Settings,
  FolderOpen,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { Command, CommandHandlers, CommandContext } from "./types";

export function createCommands(
  handlers: CommandHandlers,
  context: CommandContext
): Command[] {
  return [
    // === TABS ===
    {
      id: "newSshConnection",
      labelKey: "commandPalette.commands.newSshConnection",
      icon: Plus,
      shortcut: { key: "N", ctrl: true },
      category: "tabs",
      action: handlers.newSshConnection,
    },
    {
      id: "closeTab",
      labelKey: "commandPalette.commands.closeTab",
      icon: X,
      shortcut: { key: "W", ctrl: true },
      category: "tabs",
      action: handlers.closeTab,
      enabled: () => context.hasActiveTab,
    },
    {
      id: "duplicateTab",
      labelKey: "commandPalette.commands.duplicateTab",
      icon: Copy,
      category: "tabs",
      action: handlers.duplicateTab,
      enabled: () => context.isActiveTabSsh,
    },
    {
      id: "renameTab",
      labelKey: "commandPalette.commands.renameTab",
      icon: Edit3,
      category: "tabs",
      action: handlers.renameTab,
      enabled: () => context.hasActiveTab,
    },

    // === PANES ===
    {
      id: "splitPane",
      labelKey: "commandPalette.commands.splitPane",
      icon: SplitSquareVertical,
      shortcut: { key: "D", ctrl: true, shift: true },
      category: "panes",
      action: handlers.splitPane,
      enabled: () => context.hasActiveTab,
    },
    {
      id: "focusNextPane",
      labelKey: "commandPalette.commands.focusNextPane",
      icon: ArrowRight,
      shortcut: { key: "Tab", ctrl: true },
      category: "panes",
      action: handlers.focusNextPane,
      enabled: () => context.hasMultiplePanes,
    },
    {
      id: "focusPrevPane",
      labelKey: "commandPalette.commands.focusPrevPane",
      icon: ArrowLeft,
      shortcut: { key: "Tab", ctrl: true, shift: true },
      category: "panes",
      action: handlers.focusPrevPane,
      enabled: () => context.hasMultiplePanes,
    },

    // === NAVIGATION ===
    {
      id: "nextTab",
      labelKey: "commandPalette.commands.nextTab",
      icon: ChevronRight,
      shortcut: { key: "Tab", ctrl: true, alt: true },
      category: "navigation",
      action: handlers.nextTab,
      enabled: () => context.hasMultipleTabs,
    },
    {
      id: "prevTab",
      labelKey: "commandPalette.commands.prevTab",
      icon: ChevronLeft,
      shortcut: { key: "Tab", ctrl: true, alt: true, shift: true },
      category: "navigation",
      action: handlers.prevTab,
      enabled: () => context.hasMultipleTabs,
    },
    {
      id: "openSftp",
      labelKey: "commandPalette.commands.openSftp",
      icon: FolderOpen,
      category: "navigation",
      action: handlers.openSftp,
      enabled: () => context.isActiveTabSsh,
    },

    // === SETTINGS ===
    {
      id: "openSettings",
      labelKey: "commandPalette.commands.openSettings",
      icon: Settings,
      shortcut: { key: ",", ctrl: true },
      category: "settings",
      action: handlers.openSettings,
    },
  ];
}

export function formatShortcut(shortcut: Command["shortcut"]): string {
  if (!shortcut) return "";

  const parts: string[] = [];
  if (shortcut.ctrl) parts.push("Ctrl");
  if (shortcut.shift) parts.push("Shift");
  if (shortcut.alt) parts.push("Alt");
  parts.push(shortcut.key);

  return parts.join("+");
}
