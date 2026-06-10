"use client";

import { useState } from "react";

// Reliability score pill with a tap/hover micro-dashboard:
// [Games Played] vs [Games Missed/Bailed/Ghosted].
export function ReliabilityBadge({
  score,
  gamesPlayed,
  gamesMissed,
}: {
  score: number;
  gamesPlayed: number;
  gamesMissed: number;
}) {
  const [open, setOpen] = useState(false);
  const tone =
    score >= 85 ? "text-pitch" : score >= 60 ? "text-yellow-400" : "text-red-400";

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="inline-flex items-center gap-1.5 rounded-full border border-ink-600 bg-ink-800 px-3 py-1 text-sm font-semibold"
      >
        <span className="text-white/50">Reliability</span>
        <span className={tone}>{Math.round(score)}</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-10 mt-2 w-52 rounded-xl border border-ink-600 bg-ink-800 p-3 shadow-glow">
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/60">Played</span>
            <span className="font-bold text-pitch">{gamesPlayed}</span>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-sm">
            <span className="text-white/60">Missed / ghosted</span>
            <span className="font-bold text-red-400">{gamesMissed}</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-600">
            <div
              className="h-full bg-pitch"
              style={{
                width: `${
                  gamesPlayed + gamesMissed === 0
                    ? 100
                    : (gamesPlayed / (gamesPlayed + gamesMissed)) * 100
                }%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
