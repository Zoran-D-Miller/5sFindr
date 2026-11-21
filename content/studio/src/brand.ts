// 5sFindr brand tokens for content. "Open door, inner circle" (GROWTH-STRATEGY.md §6a):
// night football, floodlights, film grain, raw condensed type, stencil numbers,
// coordinates as graphics. Mostly monochrome; pitch green is the one signal colour.
// Colours come from the app's tailwind.config.ts so posts match the product.
import { loadFont as loadAnton } from "@remotion/google-fonts/Anton";
import { loadFont as loadStencil } from "@remotion/google-fonts/BigShouldersStencil";
import { loadFont as loadMono } from "@remotion/google-fonts/IBMPlexMono";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

export const C = {
  ink900: "#070A09", // page
  ink800: "#0E1411", // raised surface
  ink700: "#161D19", // border
  ink600: "#222C27",
  pitch: "#0AE98A", // the signal colour: use sparingly
  pitchDark: "#08C476",
  electric: "#1F6FEB", // app secondary, only inside product UI
  white: "#F4F6F5",
  dim: "rgba(244,246,245,0.62)",
  faint: "rgba(244,246,245,0.38)",
  floodlight: "#EAF2FF", // cool white of stadium lights
};

const anton = loadAnton("normal", { weights: ["400"], subsets: ["latin"] });
const stencil = loadStencil("normal", { weights: ["800", "900"], subsets: ["latin"] });
const mono = loadMono("normal", { weights: ["400", "500", "600"], subsets: ["latin"] });
const inter = loadInter("normal", { weights: ["400", "600", "700", "800", "900"], subsets: ["latin"] });

export const F = {
  display: anton.fontFamily, // raw condensed headlines, always uppercase
  stencil: stencil.fontFamily, // kit numbers, big stats, founding numbers
  mono: mono.fontFamily, // coordinates, times, labels
  body: inter.fontFamily, // captions, body copy, product UI
};

// Real public places as graphic elements (venues/fields from supabase/seed.sql).
export const PLACES = {
  greenPoint: { name: "Green Point Urban Park", coord: "33.902° S, 18.409° E" },
  seaPoint: { name: "Sea Point Promenade", coord: "33.914° S, 18.384° E" },
  rondebosch: { name: "Rondebosch Common", coord: "33.959° S, 18.476° E" },
  claremont: { name: "Claremont", coord: "33.983° S, 18.465° E" },
  bellville: { name: "Bellville", coord: "33.882° S, 18.634° E" },
  cityBowl: { name: "City Bowl", coord: "33.925° S, 18.424° E" },
} as const;

export const HANDLES = {
  tiktok: "@5sfindr.com",
  instagram: "@5sfindr.official",
  site: "5sfindr.com",
};

// The two-line rule: every teaser carries a plain line saying what this is.
export const PLAIN_LINE = "Free 5-a-side games in Cape Town · 5sfindr.com";

// TikTok / Reels UI covers the bottom and the right edge. Keep text inside these.
export const SAFE_9x16 = { top: 210, bottom: 430, left: 90, right: 150 };
