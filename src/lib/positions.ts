import type { Position, DayKey, Daypart } from "./types";

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
