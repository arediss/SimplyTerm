import { ComponentType } from "react";

export interface CommandShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
}

export type CommandCategory = "tabs" | "panes" | "navigation" | "settings";

export interface Command {
  id: string;
  labelKey: string;
  icon?: ComponentType<{ size?: number; className?: string }>;
  shortcut?: CommandShortcut;
  category: CommandCategory;
  action: () => void;
  enabled?: () => boolean;
}

export interface CommandHandlers {
  newSshConnection: () => void;
  closeTab: () => void;
  duplicateTab: () => void;
  renameTab: () => void;
  splitPane: () => void;
  focusNextPane: () => void;
  focusPrevPane: () => void;
  nextTab: () => void;
  prevTab: () => void;
  openSettings: () => void;
  openSftp: () => void;
}

export interface CommandContext {
  hasActiveTab: boolean;
  hasMultipleTabs: boolean;
  hasMultiplePanes: boolean;
  isActiveTabSsh: boolean;
}
