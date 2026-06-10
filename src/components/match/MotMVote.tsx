"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { voteMotm } from "@/server/actions/attendance";
import type { RosterEntry } from "@/lib/types";

// Post-match dopamine loop: pick the Man of the Match from the players who
// actually showed up. One vote per attendee.
export function MotMVote({
  matchId,
  candidates,
  alreadyVoted,
}: {
  matchId: string;
  candidates: RosterEntry[];
  alreadyVoted: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [voted, setVoted] = useState(alreadyVoted);
  const [sel, setSel] = useState<string>("");
  const [error, setError] = useState("");

  if (voted) {
    return (
      <div className="rounded-2xl border border-pitch/30 bg-pitch/5 p-4 text-center text-sm font-semibold text-pitch">
        🏆 Thanks for voting — trophy goes to the top pick once voting closes.
      </div>
    );
  }

  function submit() {
    setError("");
    if (!sel) return setError("Pick a player.");
    start(async () => {
      const r = await voteMotm(matchId, sel);
      if (r.ok) {
        setVoted(true);
        router.refresh();
      } else setError(r.error);
    });
  }

  return (
    <section className="rounded-2xl border border-pitch/20 bg-pitch/5 p-4">
      <h3 className="text-sm font-bold uppercase tracking-wide text-white/60">
        🏆 Vote: Man of the Match
      </h3>
      <ul className="mt-3 space-y-2">
        {candidates.map((c) => (
          <li key={c.user_id}>
            <button
              type="button"
              onClick={() => setSel(c.user_id)}
              className={`flex w-full items-center justify-between rounded-xl border px-4 py-2.5 text-sm font-medium transition ${
                sel === c.user_id
                  ? "border-pitch bg-pitch/15 text-pitch"
                  : "border-ink-600 text-white/70 hover:border-white/30"
              }`}
            >
              <span>{c.name}</span>
              <span className="text-xs text-white/40">Skill {c.skill_level}</span>
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="mt-3 w-full rounded-2xl bg-pitch py-3 font-bold text-ink-900 transition hover:bg-pitch-dark disabled:opacity-60"
      >
        {pending ? "Casting…" : "Cast my vote"}
      </button>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </section>
  );
}
