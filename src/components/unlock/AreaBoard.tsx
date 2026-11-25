import { UNLOCK } from "@/lib/areas";
import type { AreaProgress } from "@/server/areaProgress";

// Area progress board ("City Bowl 38/50"). Server-rendered, counts only.
// `highlight` marks the viewer's own area. Every teaser has a plain line
// under it (GROWTH-STRATEGY.md §6a, two-line rule).

function Bar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-ink-700"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(value, max)}
    >
      <div className="h-full rounded-full bg-pitch" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function AreaBoard({ areas, highlight }: { areas: AreaProgress[]; highlight?: string | null }) {
  return (
    <ul className="space-y-2.5">
      {areas.map((a) => {
        const playersLeft = Math.max(0, UNLOCK.players - a.players);
        const gamesLeft = Math.max(0, UNLOCK.weeklyGames - a.weeklyGames);
        const mine = a.key === highlight;
        return (
          <li
            key={a.key}
            className={`rounded-card border p-4 ${mine ? "border-pitch/50 bg-pitch/[0.06]" : "border-ink-700 bg-ink-800/60"}`}
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-display text-heading font-extrabold uppercase tracking-wide">
                {a.label}
                {mine && <span className="ml-2 align-middle font-sans text-micro font-bold normal-case text-pitch">your area</span>}
              </p>
              <p className="shrink-0 font-display text-title font-extrabold tabular-nums">
                <span className={a.unlocked ? "text-pitch" : ""}>{a.players}</span>
                <span className="text-white/30">/{UNLOCK.players}</span>
              </p>
            </div>
            <div className="mt-2">
              <Bar value={a.players} max={UNLOCK.players} />
            </div>
            <p className="mt-2 text-meta text-white/50">
              {a.unlocked ? (
                <span className="font-semibold text-pitch">Target reached. The area feed opens next.</span>
              ) : (
                <>
                  {playersLeft > 0 ? `${playersLeft} more ${playersLeft === 1 ? "player" : "players"}` : "Players ✓"}
                  {" · "}
                  {a.weeklyGames}/{UNLOCK.weeklyGames} weekly games
                  {gamesLeft === 0 && " ✓"}
                </>
              )}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
