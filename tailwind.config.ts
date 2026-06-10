import type { Config } from "tailwindcss";

// 5sFindr brand: sporty, high-contrast, dark-mode-first.
// Pitch-green primary, electric-blue secondary accent.
const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        pitch: {
          DEFAULT: "#0AE98A", // pitch-green accent
          dark: "#08C476",
          glow: "#0AE98A33",
        },
        electric: {
          DEFAULT: "#1F6FEB", // electric-blue accent
          dark: "#1659C4",
        },
        ink: {
          900: "#070A09", // near-black base
          800: "#0E1411",
          700: "#161D19",
          600: "#222C27",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 24px -4px #0AE98A66",
      },
    },
  },
  plugins: [],
};

export default config;
