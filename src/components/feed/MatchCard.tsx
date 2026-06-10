import type { MatchFeedItem } from "@/lib/types";

function kickoffLabel(iso: string): { day: string; time: string } {
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" });
  const time = d.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", hour12: false });
  return { day, time };
}

// A single match in the feed. Compact, high-contrast, thumb-scannable.
// `manage` flips the right-side context for the Organizer view.
export function MatchCard({ match, manage = false }: { match: MatchFeedItem; manage?: boolean }) {
  const { day, time } = kickoffLabel(match.kickoff_at);
  const full = match.spots_taken >= match.max_players;
  const spotsLeft = Math.max(0, match.max_players - match.spots_taken);

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-ink-700 bg-ink-800/60 p-4">
      {/* Time block */}
      <div className="w-14 shrink-0 text-center">
        <p className="text-[11px] font-medium uppercase text-white/40">{day}</p>
        <p className="text-lg font-black leading-tight text-pitch">{time}</p>
      </div>

      <div className="h-10 w-px bg-ink-700" />

      {/* Body */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">
          {match.title || match.location_name}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="rounded-full bg-ink-700 px-2 py-0.5 font-medium text-white/60">
            {match.location_type === "official_court" ? "Court" : "Open field"}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 font-medium ${
              match.join_mode === "instant"
                ? "bg-pitch/15 text-pitch"
                : "bg-electric/15 text-electric"
            }`}
          >
            {match.join_mode === "instant" ? "Instant" : "Request"}
          </span>
          {match.price_per_player_zar > 0 && (
            <span className="rounded-full bg-ink-700 px-2 py-0.5 font-medium text-white/60">
              R{match.price_per_player_zar}pp
            </span>
          )}
        </div>
      </div>

      {/* Spots */}
      <div className="shrink-0 text-right">
        <p className={`text-sm font-bold ${full ? "text-red-400" : "text-white"}`}>
          {match.spots_taken}/{match.max_players}
        </p>
        <p className="text-[11px] text-white/40">
          {manage ? "joined" : full ? "full" : `${spotsLeft} left`}
        </p>
      </div>
    </div>
  );
}
