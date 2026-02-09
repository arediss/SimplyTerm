import type { Theme } from "./types";

/**
 * Default dark theme — Fleet-inspired
 *
 * Cool-toned dark theme inspired by JetBrains Fleet.
 * Deep blue-grays with crisp accent colors.
 */
export const darkTheme: Theme = {
  meta: {
    id: "dark",
    name: "Dark",
    description: "Fleet-inspired dark theme",
    author: "SimplyTerm",
    variant: "dark",
    preview: ["#1E1F22", "#2B2D30", "#3574F0"],
  },

  colors: {
    base: "#1E1F22",
    mantle: "#1E1F22",
    crust: "#16171A",
    terminal: "#1E1F22",

    surface0: "#2B2D30",
    surface1: "#393B40",
    surface2: "#4E5157",

    text: "#DFE1E5",
    textSecondary: "#BCBEC4",
    textMuted: "#6F737A",

    accent: "#3574F0",
    accentHover: "#467FF5",

    success: "#5FB865",
    warning: "#E9AA42",
    error: "#F75464",

    borderSoft: "rgba(255, 255, 255, 0.06)",
    borderStrong: "rgba(255, 255, 255, 0.12)",

    glass: "rgba(30, 31, 34, 0.85)",
    glassBorder: "rgba(43, 45, 48, 0.6)",
    glassHover: "rgba(43, 45, 48, 0.9)",
    glassSubtle: "rgba(30, 31, 34, 0.6)",

    panel: "#18191B",
    backgroundGradient: "#16171A",
  },

  terminal: {
    background: "#1E1F22",
    foreground: "#DFE1E5",
    cursor: "#3574F0",
    cursorAccent: "#1E1F22",
    selectionBackground: "rgba(53, 116, 240, 0.3)",
    selectionForeground: undefined,

    black: "#393B40",
    red: "#F75464",
    green: "#5FB865",
    yellow: "#E9AA42",
    blue: "#3574F0",
    magenta: "#C77DBB",
    cyan: "#2AACB8",
    white: "#BCBEC4",

    brightBlack: "#6F737A",
    brightRed: "#FF6B7A",
    brightGreen: "#72C978",
    brightYellow: "#F0BC5E",
    brightBlue: "#467FF5",
    brightMagenta: "#D68FCC",
    brightCyan: "#3DC0CC",
    brightWhite: "#DFE1E5",
  },
};
