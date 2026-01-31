import type { Theme } from "./types";

/**
 * Default dark theme - Warm Dark
 *
 * A warm, comfortable dark theme with carefully chosen colors
 * for reduced eye strain during extended terminal sessions.
 */
export const darkTheme: Theme = {
  meta: {
    id: "dark",
    name: "Dark",
    description: "Default warm dark theme",
    author: "SimplyTerm",
    variant: "dark",
    preview: ["#181715", "#1F1E1B", "#7DA6E8"],
  },

  colors: {
    base: "#1F1E1B",
    mantle: "#1A1917",
    crust: "#141311",
    terminal: "#181715",

    surface0: "#262421",
    surface1: "#2E2C28",
    surface2: "#38352F",

    text: "#E6E2DC",
    textSecondary: "#B6B0A7",
    textMuted: "#8E887F",

    accent: "#7DA6E8",
    accentHover: "#8FB2EC",

    success: "#9CD68D",
    warning: "#E8C878",
    error: "#E88B8B",

    borderSoft: "rgba(255, 245, 235, 0.06)",
    borderStrong: "rgba(255, 245, 235, 0.12)",

    glass: "rgba(26, 25, 23, 0.85)",
    glassBorder: "rgba(38, 36, 33, 0.6)",
    glassHover: "rgba(31, 30, 27, 0.9)",
    glassSubtle: "rgba(26, 25, 23, 0.6)",

    backgroundGradient: "radial-gradient(1200px circle at 50% 30%, #1F1E1B 0%, #161513 60%)",
  },

  terminal: {
    background: "#181715",
    foreground: "#E6E2DC",
    cursor: "#7DA6E8",
    cursorAccent: "#181715",
    selectionBackground: "rgba(125, 166, 232, 0.3)",
    selectionForeground: undefined,

    black: "#38352F",
    red: "#E88B8B",
    green: "#9CD68D",
    yellow: "#E8C878",
    blue: "#7DA6E8",
    magenta: "#D4A5D9",
    cyan: "#7FCFCF",
    white: "#B6B0A7",

    brightBlack: "#5A564E",
    brightRed: "#F0A0A0",
    brightGreen: "#B0E0A0",
    brightYellow: "#F0D090",
    brightBlue: "#8FB2EC",
    brightMagenta: "#E0B0E5",
    brightCyan: "#90E0E0",
    brightWhite: "#E6E2DC",
  },
};
