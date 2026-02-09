import type { Theme } from "./types";

/**
 * Light theme - Warm Light
 *
 * A warm, comfortable light theme with carefully chosen colors
 * for readability in bright environments.
 */
export const lightTheme: Theme = {
  meta: {
    id: "light",
    name: "Light",
    description: "Clean warm light theme",
    author: "SimplyTerm",
    variant: "light",
    preview: ["#FFFFFF", "#FAF8F5", "#4A7FD4"],
  },

  colors: {
    base: "#FAF8F5",
    mantle: "#FFFFFF",
    crust: "#F0EDE8",
    terminal: "#FFFFFF",

    surface0: "#F5F2ED",
    surface1: "#EBE7E0",
    surface2: "#E0DBD3",

    text: "#2C2A26",
    textSecondary: "#5C5850",
    textMuted: "#8C867A",

    accent: "#4A7FD4",
    accentHover: "#3A6FC4",

    success: "#5A9E4A",
    warning: "#C4A030",
    error: "#D45A5A",

    borderSoft: "rgba(0, 0, 0, 0.06)",
    borderStrong: "rgba(0, 0, 0, 0.12)",

    glass: "rgba(255, 255, 255, 0.85)",
    glassBorder: "rgba(0, 0, 0, 0.08)",
    glassHover: "rgba(255, 255, 255, 0.95)",
    glassSubtle: "rgba(255, 255, 255, 0.6)",

    panel: "#E6E3DD",
    backgroundGradient: "#F5F2ED",
  },

  terminal: {
    background: "#FFFFFF",
    foreground: "#2C2A26",
    cursor: "#4A7FD4",
    cursorAccent: "#FFFFFF",
    selectionBackground: "rgba(74, 127, 212, 0.25)",
    selectionForeground: undefined,

    black: "#2C2A26",
    red: "#C94040",
    green: "#4A8E3A",
    yellow: "#A07D20",
    blue: "#4A7FD4",
    magenta: "#9060A0",
    cyan: "#308080",
    white: "#8C867A",

    brightBlack: "#5C5850",
    brightRed: "#D45A5A",
    brightGreen: "#5A9E4A",
    brightYellow: "#C4A030",
    brightBlue: "#5A8FE4",
    brightMagenta: "#A070B0",
    brightCyan: "#409090",
    brightWhite: "#2C2A26",
  },
};
