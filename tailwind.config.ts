import type { Config } from "tailwindcss";

// ─────────────────────────────────────────────────────────────────────────
//  5sFindr design system — single source of visual truth.
//  Brand: sporty, high-contrast, dark-mode-first. Pitch-green primary,
//  electric-blue secondary. Component classes live in globals.css @layer
//  components (.card, .btn, .chip, .drawer-sheet, .input-field).
//
//  RULES (keep the app from drifting back into vibe-coding):
//  • Type scale: display > title > heading > body > meta > micro. No ad-hoc
//    text sizes — pick from the scale.
//  • Surfaces: page = ink-900, raised card = surface (ink-800/60 + ink-700
//    border), nested tile = sunken (ink-900 + ink-700 border).
//  • Rounding: cards/buttons/inputs = rounded-card (16px); sheets/hero
//    panels = rounded-sheet (24px); chips/avatars = rounded-full.
//  • Rhythm: page sections stack with space-y-6; inside a card use gap-3/4;
//    card padding is p-4 (row), p-5 (block), p-6 (hero).
// ─────────────────────────────────────────────────────────────────────────
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
          900: "#070A09", // near-black base (page)
          800: "#0E1411", // raised surface
          700: "#161D19", // border / divider
          600: "#222C27", // strong border / control edge
        },
      },
      // Strict type scale — size + line-height pairs. Weight by role:
      // display/title = font-black, heading = font-bold, meta = font-medium.
      fontSize: {
        display: ["2.25rem", { lineHeight: "1.05", letterSpacing: "-0.02em" }], // hero
        title: ["1.5rem", { lineHeight: "1.15", letterSpacing: "-0.02em" }],    // page h1
        heading: ["1.125rem", { lineHeight: "1.3" }],                            // card/section titles
        body: ["0.875rem", { lineHeight: "1.5" }],                               // default copy
        meta: ["0.75rem", { lineHeight: "1.4" }],                                // secondary info
        micro: ["0.6875rem", { lineHeight: "1.3" }],                             // badges/chips
      },
      borderRadius: {
        card: "1rem",    // cards, buttons, inputs (== rounded-2xl)
        sheet: "1.5rem", // drawers, hero panels (== rounded-3xl)
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
