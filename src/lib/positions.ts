import type { Position, DayKey, Daypart, FoundingTier } from "./types";

// Elite short labels for the position badge (FWD shown as "STR" / striker).
export const POSITION_BADGE: Record<Position, string> = {
  GK: "GK",
  DEF: "DEF",
  MID: "MID",
  FWD: "STR",
  ANY: "ANY",
};

// Founding tier from signup ordinal: Gold ≤100, Silver ≤1000, else none.
export function foundingTier(n: number | null | undefined): FoundingTier {
  if (n == null) return null;
  if (n <= 100) return "baller";
  if (n <= 1000) return "member";
  return null;
}

export const FOUNDING_LABEL: Record<"baller" | "member", string> = {
  baller: "Founding Baller",
  member: "Founding Member",
};

// Tailwind ring classes for the gold / silver avatar accent.
export const FOUNDING_RING: Record<"baller" | "member", string> = {
  baller: "ring-2 ring-yellow-400 ring-offset-2 ring-offset-ink-900",
  member: "ring-2 ring-zinc-300 ring-offset-2 ring-offset-ink-900",
};

export const POSITIONS: { key: Position; label: string }[] = [
  { key: "GK", label: "Keeper" },
  { key: "DEF", label: "Defence" },
  { key: "MID", label: "Midfield" },
  { key: "FWD", label: "Forward" },
  { key: "ANY", label: "Anywhere" },
];

export const SKILL_LABELS: Record<number, string> = {
  1: "Casual",
  2: "Improver",
  3: "Solid",
  4: "Strong",
  5: "Elite",
};

export const DAYS: { key: DayKey; label: string }[] = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

export const DAYPARTS: { key: Daypart; label: string }[] = [
  { key: "morning", label: "AM" },
  { key: "afternoon", label: "Noon" },
  { key: "evening", label: "PM" },
];
