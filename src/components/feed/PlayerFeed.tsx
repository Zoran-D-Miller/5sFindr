import type { MatchFeedItem } from "@/lib/types";
import { MatchCard } from "./MatchCard";

// Groups upcoming matches by neighborhood, preserving kickoff order within
// each group (the query already sorts by kickoff_at ascending).
function groupByNeighborhood(matches: MatchFeedItem[]): [string, MatchFeedItem[]][] {
  const map = new Map<string, MatchFeedItem[]>();
  for (const m of matches) {
    const key = m.neighborhood?.trim() || "Other areas";
    (map.get(key) ?? map.set(key, []).get(key)!).push(m);
  }
  return [...map.entries()];
}

export function PlayerFeed({ matches }: { matches: MatchFeedItem[] }) {
  if (matches.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ink-700 px-5 py-12 text-center">
        <p className="font-semibold text-white/70">No games near you yet</p>
        <p className="mt-1 text-sm text-white/40">
          Switch to Organizer and be the first to put one on.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groupByNeighborhood(matches).map(([neighborhood, group]) => (
        <section key={neighborhood}>
          <div className="mb-2 flex items-center gap-2 px-1">
            <h2 className="text-sm font-bold uppercase tracking-wide text-white/50">
              {neighborhood}
            </h2>
            <span className="text-xs text-white/30">
              {group.length} game{group.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="space-y-2.5">
            {group.map((m) => (
              <MatchCard key={m.id} match={m} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
