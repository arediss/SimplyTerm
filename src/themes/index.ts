/**
 * Theme system for SimplyTerm
 *
 * Provides a registry for managing themes and utilities for applying them.
 * Plugins can register custom themes using the registry.
 */

import type { Theme, ThemeColors, TerminalColors } from "./types";
import { darkTheme } from "./dark";
import { lightTheme } from "./light";
import { monokaiTheme } from "./monokai";
import { creamTheme } from "./cream";

// Re-export types
export type { Theme, ThemeMeta, ThemeColors, TerminalColors, ThemeRegistry } from "./types";

// Theme registry (singleton)
const themes: Map<string, Theme> = new Map();

// Register built-in themes
themes.set(darkTheme.meta.id, darkTheme);
themes.set(lightTheme.meta.id, lightTheme);
themes.set(monokaiTheme.meta.id, monokaiTheme);
themes.set(creamTheme.meta.id, creamTheme);

/**
 * Get all registered themes
 */
export function getThemes(): Theme[] {
  return Array.from(themes.values());
}

/**
 * Get a theme by ID
 */
export function getTheme(id: string): Theme | undefined {
  return themes.get(id);
}

/**
 * Register a new theme (for plugins)
 */
export function registerTheme(theme: Theme): void {
  if (themes.has(theme.meta.id)) {
    console.warn(`Theme "${theme.meta.id}" already exists and will be overwritten`);
  }
  themes.set(theme.meta.id, theme);

  // Dispatch event for reactive updates
  window.dispatchEvent(new CustomEvent("simplyterm:theme-registered", { detail: theme }));
}

/**
 * Unregister a theme
 */
export function unregisterTheme(id: string): void {
  if (id === "dark" || id === "light") {
    console.warn("Cannot unregister built-in themes");
    return;
  }
  themes.delete(id);

  // Dispatch event for reactive updates
  window.dispatchEvent(new CustomEvent("simplyterm:theme-unregistered", { detail: { id } }));
}

/**
 * Convert ThemeColors to CSS custom properties
 */
export function themeToCssVars(colors: ThemeColors): Record<string, string> {
  return {
    "--color-base": colors.base,
    "--color-mantle": colors.mantle,
    "--color-crust": colors.crust,
    "--color-terminal": colors.terminal,
    "--color-surface-0": colors.surface0,
    "--color-surface-1": colors.surface1,
    "--color-surface-2": colors.surface2,
    "--color-text": colors.text,
    "--color-text-secondary": colors.textSecondary,
    "--color-text-muted": colors.textMuted,
    "--color-accent": colors.accent,
    "--color-accent-hover": colors.accentHover,
    "--color-success": colors.success,
    "--color-warning": colors.warning,
    "--color-error": colors.error,
    "--color-border-soft": colors.borderSoft,
    "--color-border-strong": colors.borderStrong,
    "--color-glass": colors.glass,
    "--color-glass-border": colors.glassBorder,
    "--color-glass-hover": colors.glassHover,
    "--color-glass-subtle": colors.glassSubtle,
  };
}

/**
 * Apply a theme to the document
 */
export function applyTheme(themeId: string): void {
  const theme = getTheme(themeId);
  if (!theme) {
    console.error(`Theme "${themeId}" not found`);
    return;
  }

  const root = document.documentElement;
  const cssVars = themeToCssVars(theme.colors);

  // Apply CSS variables
  for (const [property, value] of Object.entries(cssVars)) {
    root.style.setProperty(property, value);
  }

  // Apply background gradient to body (only if blur is not enabled)
  // When blur is enabled, CSS handles transparency
  if (root.dataset.blur !== "true") {
    document.body.style.background = theme.colors.backgroundGradient;
  } else {
    document.body.style.background = "transparent";
  }

  // Set data attribute for CSS selectors
  root.dataset.theme = themeId;
  root.dataset.themeVariant = theme.meta.variant;

  // Dispatch event for components that need to react
  window.dispatchEvent(new CustomEvent("simplyterm:theme-changed", { detail: theme }));
}

/**
 * Get terminal colors for xterm from current theme
 */
export function getTerminalTheme(themeId: string): TerminalColors {
  const theme = getTheme(themeId);
  return theme?.terminal ?? darkTheme.terminal;
}

// Default exports
export { darkTheme } from "./dark";
export { lightTheme } from "./light";
export { monokaiTheme } from "./monokai";
export { creamTheme } from "./cream";
