// The three launch areas (PRODUCT-BRIEF.md). Same mapping as the waitlist
// digest: waitlist neighbourhood labels → area. Venue neighbourhoods are free
// text, so they're matched on keywords.
export const LAUNCH_AREAS = [
  { key: "city_bowl", label: "City Bowl + Atlantic Seaboard" },
  { key: "southern", label: "Southern Suburbs" },
  { key: "northern", label: "Northern Suburbs" },
] as const;
export type AreaKey = (typeof LAUNCH_AREAS)[number]["key"] | "other";

// Unlock threshold per area (adjustable).
export const UNLOCK = { players: 50, weeklyGames: 3 } as const;

const KEYWORDS: Record<Exclude<AreaKey, "other">, string[]> = {
  city_bowl: ["city bowl", "green point", "sea point", "woodstock", "observatory", "gardens", "tamboerskloof",
    "vredehoek", "camps bay", "clifton", "bantry bay", "fresnaye", "mouille point", "de waterkant", "cbd", "foreshore"],
  southern: ["rondebosch", "newlands", "claremont", "kenilworth", "wynberg", "southern suburbs", "rosebank",
    "mowbray", "plumstead", "constantia", "bergvliet", "tokai", "harfield"],
  northern: ["century city", "milnerton", "bellville", "northern suburbs", "montague", "durbanville",
    "table view", "parow", "goodwood", "edgemead", "bothasig", "brackenfell", "kraaifontein"],
};

export function areaFor(neighbourhood: string | null | undefined): AreaKey {
  const n = (neighbourhood ?? "").toLowerCase();
  if (!n) return "other";
  for (const [key, words] of Object.entries(KEYWORDS) as [Exclude<AreaKey, "other">, string[]][]) {
    if (words.some((w) => n.includes(w))) return key;
  }
  return "other";
}

export function areaLabel(key: AreaKey): string {
  return LAUNCH_AREAS.find((a) => a.key === key)?.label ?? "Outside the 3 launch areas";
}
