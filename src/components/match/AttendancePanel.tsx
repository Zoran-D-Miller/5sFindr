"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setAttendance } from "@/server/actions/attendance";
import type { RosterEntry } from "@/lib/types";

// Organiser ticks who showed up (replaces GPS / code check-in while hidden).
export function AttendancePanel({ matchId, players }: { matchId: string; players: RosterEntry[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");

  function toggle(p: RosterEntry) {
    setError("");
    start(async () => {
      const res = await setAttendance(matchId, p.user_id, p.status !== "attended");
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  const here = players.filter((p) => p.status === "attended").length;

  return (
    <section className="rounded-2xl border border-ink-700 bg-ink-800/60 p-4">
      <h3 className="text-sm font-bold uppercase tracking-wide text-white/50">
        Who showed up? ({here}/{players.length})
      </h3>
      <p className="mt-1 text-xs text-white/40">Tick everyone who played. Anyone left unticked counts as a no-show.</p>
      <ul className="mt-3 space-y-1.5">
        {players.map((p) => {
          const on = p.status === "attended";
          return (
            <li key={p.user_id}>
              <button
                type="button"
                disabled={pending}
                onClick={() => toggle(p)}
                aria-pressed={on}
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition disabled:opacity-60 ${
                  on ? "border-pitch/50 bg-pitch/10 text-white" : "border-ink-600 text-white/70"
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-xs font-black ${
                    on ? "border-pitch bg-pitch text-ink-900" : "border-ink-500"
                  }`}
                >
                  {on ? "✓" : ""}
                </span>
                <span className="flex-1 truncate font-medium">{p.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {error && <p className="mt-2 text-center text-sm text-red-400">{error}</p>}
    </section>
  );
}
