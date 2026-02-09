import type { Theme } from "./types";

/**
 * Cream theme
 *
 * A warm, paper-like theme easy on the eyes.
 * Inspired by sepia/e-ink displays for comfortable reading.
 */
export const creamTheme: Theme = {
  meta: {
    id: "cream",
    name: "Cream",
    description: "Warm paper-like theme",
    author: "SimplyTerm",
    variant: "light",
    preview: ["#F5F0E6", "#EDE6D6", "#8B7355"],
  },

  colors: {
    base: "#F5F0E6",
    mantle: "#FAF6EE",
    crust: "#EDE6D6",
    terminal: "#FAF6EE",

    surface0: "#EBE4D4",
    surface1: "#E0D7C4",
    surface2: "#D4C9B4",

    text: "#433422",
    textSecondary: "#6B5D4D",
    textMuted: "#9C8B78",

    accent: "#8B7355",
    accentHover: "#7A6348",

    success: "#6B8E4E",
    warning: "#B8943D",
    error: "#B85450",

    borderSoft: "rgba(67, 52, 34, 0.08)",
    borderStrong: "rgba(67, 52, 34, 0.15)",

    glass: "rgba(250, 246, 238, 0.9)",
    glassBorder: "rgba(212, 201, 180, 0.5)",
    glassHover: "rgba(250, 246, 238, 0.95)",
    glassSubtle: "rgba(250, 246, 238, 0.7)",

    panel: "#E5DECE",
    backgroundGradient: "#F0E9DA",
  },

  terminal: {
    background: "#FAF6EE",
    foreground: "#433422",
    cursor: "#8B7355",
    cursorAccent: "#FAF6EE",
    selectionBackground: "rgba(139, 115, 85, 0.2)",
    selectionForeground: undefined,

    black: "#433422",
    red: "#B85450",
    green: "#6B8E4E",
    yellow: "#B8943D",
    blue: "#5C7A99",
    magenta: "#8B6B8E",
    cyan: "#5E8E8B",
    white: "#9C8B78",

    brightBlack: "#6B5D4D",
    brightRed: "#C86460",
    brightGreen: "#7BA05E",
    brightYellow: "#C8A44D",
    brightBlue: "#6C8AA9",
    brightMagenta: "#9B7B9E",
    brightCyan: "#6E9E9B",
    brightWhite: "#433422",
  },
};
