"use client";

import { useMemo, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { PlayerChip } from "@/components/profile/PlayerChip";
import { POSITION_BADGE } from "@/lib/positions";
import type { Position } from "@/lib/types";

export interface LeaderRow {
  id: string;
  name: string;
  avatar_url: string | null;
  neighborhood: string | null;
  preferred_positions: Position[] | null;
  motm_count: number;
  reliability_score: number;
  games_played: number;
  founding_number: number | null;
  position: number;
}

const medal = (pos: number) => (pos === 1 ? "🥇" : pos === 2 ? "🥈" : pos === 3 ? "🥉" : `${pos}`);

export function LeaderboardList({
  rows,
  currentUserId,
}: {
  rows: LeaderRow[];
  currentUserId: string;
}) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => {
      const positions = (r.preferred_positions ?? []).map((p) => POSITION_BADGE[p].toLowerCase());
      return (
        r.name.toLowerCase().includes(term) ||
        (r.neighborhood ?? "").toLowerCase().includes(term) ||
        positions.some((p) => p.includes(term))
      );
    });
  }, [q, rows]);

  return (
    <div className="space-y-4">
      {/* Minimalist search */}
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search name, position, or neighborhood…"
        className="w-full rounded-2xl border border-ink-600 bg-ink-800 px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-pitch"
      />

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-700 px-5 py-10 text-center text-sm text-white/40">
          No players match “{q}”.
        </div>
      ) : (
        <ul className="divide-y divide-ink-700 overflow-hidden rounded-2xl border border-ink-700 bg-ink-800/60">
          {filtered.map((r) => (
            <li
              key={r.id}
              className={`flex items-center gap-3 px-4 py-3 ${r.id === currentUserId ? "bg-pitch/5" : ""}`}
            >
              <span className="w-7 shrink-0 text-center text-sm font-black text-white/50">{medal(r.position)}</span>
              <Avatar name={r.name} url={r.avatar_url} size={36} foundingNumber={r.founding_number} />
              <div className="min-w-0 flex-1">
                <PlayerChip userId={r.id} name={r.name} highlight={r.id === currentUserId} />
                <p className="text-xs text-white/40">
                  {r.neighborhood ?? "Cape Town"} · {r.games_played} played
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-bold text-pitch">🏆 {r.motm_count}</p>
                <p className="text-[11px] text-white/40">Rel {Math.round(r.reliability_score)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
