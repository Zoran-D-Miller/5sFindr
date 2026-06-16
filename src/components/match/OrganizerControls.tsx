"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { respondToRequest, lockMatch, cancelMatch } from "@/server/actions/participation";
import type { MatchStatus, RosterEntry } from "@/lib/types";

export function OrganizerControls({
  matchId,
  matchStatus,
  kickoffIso,
  requests,
}: {
  matchId: string;
  matchStatus: MatchStatus;
  kickoffIso: string;
  requests: RosterEntry[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  // Fair-play: deletion only allowed >24h before kickoff.
  const hoursToKickoff = (new Date(kickoffIso).getTime() - Date.now()) / 3_600_000;
  const canDelete = hoursToKickoff > 24 && matchStatus !== "completed" && matchStatus !== "cancelled";

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError("");
    startTransition(async () => {
      const res = await fn();
      if (res.ok) router.refresh();
      else setError(res.error ?? "Something went wrong.");
    });
  }

  function onDelete() {
    if (!window.confirm("Delete this match? All players will get their tokens back. This can't be undone."))
      return;
    run(() => cancelMatch(matchId));
  }

  return (
    <div className="space-y-4">
      {requests.length > 0 && (
        <section>
          <h3 className="mb-2 px-1 text-sm font-bold uppercase tracking-wide text-white/50">
            Pending requests ({requests.length})
          </h3>
          <ul className="space-y-2">
            {requests.map((r) => (
              <li
                key={r.user_id}
                className="flex items-center gap-3 rounded-2xl border border-ink-700 bg-ink-800/60 p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{r.name}</p>
                  <p className="text-xs text-white/40">
                    Skill {r.skill_level} · Reliability {Math.round(r.reliability_score)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => respondToRequest(matchId, r.user_id, true))}
                  className="rounded-xl bg-pitch px-3 py-1.5 text-sm font-bold text-ink-900 disabled:opacity-60"
                >
                  Accept
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => respondToRequest(matchId, r.user_id, false))}
                  className="rounded-xl border border-ink-600 px-3 py-1.5 text-sm font-medium text-white/70 disabled:opacity-60"
                >
                  Decline
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {matchStatus === "open" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => lockMatch(matchId))}
          className="w-full rounded-2xl border border-electric/40 bg-electric/10 py-3 font-bold text-electric transition hover:bg-electric/20 disabled:opacity-60"
        >
          Lock match & assign teams
        </button>
      )}

      {/* Fair-play deletion: only >24h before kickoff */}
      {matchStatus !== "completed" && matchStatus !== "cancelled" && (
        canDelete ? (
          <button
            type="button"
            disabled={pending}
            onClick={onDelete}
            className="w-full rounded-2xl border border-red-500/40 py-3 font-semibold text-red-400 transition hover:bg-red-500/10 disabled:opacity-60"
          >
            Delete match (refunds all tokens)
          </button>
        ) : (
          <p className="rounded-2xl border border-ink-700 bg-ink-800/60 p-3 text-center text-xs text-white/50">
            Under 24h to kickoff — deletion is locked. Message your squad via the WhatsApp group above instead.
          </p>
        )
      )}

      {error && <p className="text-center text-sm text-red-400">{error}</p>}
    </div>
  );
}
