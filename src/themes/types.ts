/**
 * Theme system types for SimplyTerm
 *
 * Themes can be built-in or provided by plugins.
 * Each theme defines UI colors (CSS variables) and terminal colors (xterm).
 */

/** Window effect types for native transparency */
export type WindowEffect =
  | "none"           // Solid background, no transparency
  | "acrylic"        // Windows 10+ acrylic blur
  | "mica"           // Windows 11 mica effect
  | "vibrancy";      // macOS vibrancy

/** Theme metadata */
export interface ThemeMeta {
  /** Unique theme identifier (e.g., "dark", "light", "dracula") */
  id: string;
  /** Display name */
  name: string;
  /** Theme description */
  description?: string;
  /** Theme author */
  author?: string;
  /** Theme variant for UI hints */
  variant: "dark" | "light";
  /** Preview colors for theme selector [background, surface, accent] */
  preview: [string, string, string];
  /** Native window effect (transparency/blur) */
  windowEffect?: WindowEffect;
}

/** UI color variables (applied as CSS custom properties) */
export interface ThemeColors {
  /** Main background */
  base: string;
  /** Modal/container backgrounds */
  mantle: string;
  /** Darkest/lightest surfaces */
  crust: string;
  /** Terminal background */
  terminal: string;

  /** Surface levels for layering */
  surface0: string;
  surface1: string;
  surface2: string;

  /** Text colors */
  text: string;
  textSecondary: string;
  textMuted: string;

  /** Accent colors */
  accent: string;
  accentHover: string;

  /** Status colors */
  success: string;
  warning: string;
  error: string;

  /** Border colors */
  borderSoft: string;
  borderStrong: string;

  /** Glass effect colors */
  glass: string;
  glassBorder: string;
  glassHover: string;
  glassSubtle: string;

  /** Panel background (pane groups, pinned sidebar) */
  panel: string;

  /** Background gradient (CSS gradient string) */
  backgroundGradient: string;
}

/** Terminal colors for xterm */
export interface TerminalColors {
  background: string;
  foreground: string;
  cursor: string;
  cursorAccent: string;
  selectionBackground: string;
  selectionForeground?: string;

  // ANSI colors
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;

  // Bright ANSI colors
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}

/** Complete theme definition */
export interface Theme {
  meta: ThemeMeta;
  colors: ThemeColors;
  terminal: TerminalColors;
}

/** Theme registry for managing available themes */
export interface ThemeRegistry {
  /** Get all registered themes */
  getThemes(): Theme[];
  /** Get a theme by ID */
  getTheme(id: string): Theme | undefined;
  /** Register a new theme (for plugins) */
  registerTheme(theme: Theme): void;
  /** Unregister a theme */
  unregisterTheme(id: string): void;
}
