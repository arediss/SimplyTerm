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
    sidebarPinned: boolean;
  };
  security: {
    vaultSetupSkipped: boolean;
  };
  developer?: {
    enabled: boolean;
    devPluginsPath?: string;
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
    sidebarPinned: false,
  },
  security: {
    vaultSetupSkipped: false,
  },
  developer: {
    enabled: false,
    devPluginsPath: undefined,
  },
};
