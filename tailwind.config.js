/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Warm Dark Theme
        base: '#1F1E1B',
        mantle: '#1A1917',
        crust: '#141311',
        terminal: '#181715',

        surface: {
          0: '#262421',
          1: '#2E2C28',
          2: '#38352F',
        },

        text: {
          DEFAULT: '#E6E2DC',
          secondary: '#B6B0A7',
          muted: '#8E887F',
        },

        accent: {
          DEFAULT: '#7DA6E8',
          hover: '#8FB2EC',
        },

        success: '#9CD68D',
        warning: '#E8C878',
        error: '#E88B8B',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'SF Mono', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
