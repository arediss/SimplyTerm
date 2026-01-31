import type { Theme } from "./types";

/**
 * Monokai theme
 *
 * Classic theme inspired by Sublime Text's iconic Monokai color scheme.
 * Vibrant colors on a dark background.
 */
export const monokaiTheme: Theme = {
  meta: {
    id: "monokai",
    name: "Monokai",
    description: "Classic vibrant dark theme",
    author: "SimplyTerm",
    variant: "dark",
    preview: ["#272822", "#3E3D32", "#F92672"],
  },

  colors: {
    base: "#272822",
    mantle: "#1E1F1C",
    crust: "#171814",
    terminal: "#272822",

    surface0: "#3E3D32",
    surface1: "#49483E",
    surface2: "#5B5A4F",

    text: "#F8F8F2",
    textSecondary: "#CFCFC2",
    textMuted: "#75715E",

    accent: "#66D9EF",
    accentHover: "#78E1F4",

    success: "#A6E22E",
    warning: "#E6DB74",
    error: "#F92672",

    borderSoft: "rgba(248, 248, 242, 0.06)",
    borderStrong: "rgba(248, 248, 242, 0.12)",

    glass: "rgba(39, 40, 34, 0.9)",
    glassBorder: "rgba(62, 61, 50, 0.6)",
    glassHover: "rgba(46, 47, 41, 0.95)",
    glassSubtle: "rgba(39, 40, 34, 0.6)",

    backgroundGradient: "radial-gradient(1200px circle at 50% 30%, #272822 0%, #1E1F1C 60%)",
  },

  terminal: {
    background: "#272822",
    foreground: "#F8F8F2",
    cursor: "#F8F8F2",
    cursorAccent: "#272822",
    selectionBackground: "rgba(73, 72, 62, 0.5)",
    selectionForeground: undefined,

    black: "#272822",
    red: "#F92672",
    green: "#A6E22E",
    yellow: "#F4BF75",
    blue: "#66D9EF",
    magenta: "#AE81FF",
    cyan: "#A1EFE4",
    white: "#F8F8F2",

    brightBlack: "#75715E",
    brightRed: "#F92672",
    brightGreen: "#A6E22E",
    brightYellow: "#F4BF75",
    brightBlue: "#66D9EF",
    brightMagenta: "#AE81FF",
    brightCyan: "#A1EFE4",
    brightWhite: "#F9F8F5",
  },
};
