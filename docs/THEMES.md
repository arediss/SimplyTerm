# Theme System

SimplyTerm includes a modular theme system that allows customization of the application's appearance. Themes control both the UI colors and the terminal colors.

## Built-in Themes

- **Dark** (`dark`) - Default warm dark theme optimized for extended terminal sessions
- **Light** (`light`) - Clean warm light theme for bright environments

## Theme Structure

Each theme is defined in `src/themes/` and exports a `Theme` object with three parts:

### 1. Metadata (`meta`)

```typescript
interface ThemeMeta {
  id: string;           // Unique identifier (e.g., "dracula")
  name: string;         // Display name
  description?: string; // Optional description
  author?: string;      // Theme author
  variant: "dark" | "light"; // For UI hints
  preview: [string, string, string]; // Colors for theme selector
}
```

### 2. UI Colors (`colors`)

These are applied as CSS custom properties to style the application:

| Property | Description |
|----------|-------------|
| `base` | Main background color |
| `mantle` | Modal/container backgrounds |
| `crust` | Darkest/lightest surfaces |
| `terminal` | Terminal background |
| `surface0/1/2` | Surface layers for depth |
| `text` | Primary text color |
| `textSecondary` | Secondary text |
| `textMuted` | Muted/disabled text |
| `accent` | Primary accent color |
| `accentHover` | Accent hover state |
| `success/warning/error` | Status colors |
| `borderSoft/borderStrong` | Border colors |
| `glass/glassBorder/glassHover` | Glass effect colors |
| `backgroundGradient` | Body background (CSS gradient) |

### 3. Terminal Colors (`terminal`)

These are used by xterm.js for the terminal:

- `background`, `foreground`, `cursor`, `cursorAccent`
- `selectionBackground`, `selectionForeground`
- ANSI colors: `black`, `red`, `green`, `yellow`, `blue`, `magenta`, `cyan`, `white`
- Bright variants: `brightBlack`, `brightRed`, etc.

## Creating a Custom Theme

1. Create a new file in `src/themes/` (e.g., `dracula.ts`):

```typescript
import type { Theme } from "./types";

export const draculaTheme: Theme = {
  meta: {
    id: "dracula",
    name: "Dracula",
    description: "A dark theme with vibrant colors",
    author: "Zeno Rocha",
    variant: "dark",
    preview: ["#282a36", "#44475a", "#bd93f9"],
  },

  colors: {
    base: "#282a36",
    mantle: "#21222c",
    crust: "#191a21",
    terminal: "#282a36",
    // ... other colors
  },

  terminal: {
    background: "#282a36",
    foreground: "#f8f8f2",
    cursor: "#f8f8f2",
    // ... other terminal colors
  },
};
```

2. Register it in `src/themes/index.ts`:

```typescript
import { draculaTheme } from "./dracula";

// In the initialization section:
themes.set(draculaTheme.meta.id, draculaTheme);
```

## Plugin Themes

Plugins can register themes dynamically at runtime:

```typescript
import { registerTheme, unregisterTheme } from "simplyterm/themes";

// Register a theme
registerTheme(myCustomTheme);

// Unregister when plugin unloads
unregisterTheme("my-theme-id");
```

The theme will automatically appear in Settings > Appearance.

## Events

The theme system dispatches events that plugins can listen to:

- `simplyterm:theme-changed` - When the active theme changes
- `simplyterm:theme-registered` - When a new theme is registered
- `simplyterm:theme-unregistered` - When a theme is removed

```typescript
window.addEventListener("simplyterm:theme-changed", (event) => {
  const theme = event.detail;
  console.log("Theme changed to:", theme.meta.id);
});
```

## API Reference

### `getThemes(): Theme[]`
Returns all registered themes.

### `getTheme(id: string): Theme | undefined`
Get a specific theme by ID.

### `registerTheme(theme: Theme): void`
Register a new theme. Overwrites if ID already exists.

### `unregisterTheme(id: string): void`
Remove a theme. Built-in themes cannot be unregistered.

### `applyTheme(themeId: string): void`
Apply a theme to the application.

### `getTerminalTheme(themeId: string): TerminalColors`
Get terminal colors for a specific theme.

### `themeToCssVars(colors: ThemeColors): Record<string, string>`
Convert theme colors to CSS custom properties.
