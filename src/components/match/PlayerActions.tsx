"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { joinMatch, cancelParticipation } from "@/server/actions/participation";
import type { JoinMode, MatchStatus, ParticipantStatus } from "@/lib/types";

const ACTIVE: ParticipantStatus[] = ["requested", "accepted", "attended"];

export function PlayerActions({
  matchId,
  matchStatus,
  joinMode,
  kickoffIso,
  myStatus,
  isPremium,
  availableTokens,
}: {
  matchId: string;
  matchStatus: MatchStatus;
  joinMode: JoinMode;
  kickoffIso: string;
  myStatus: ParticipantStatus | null;
  isPremium: boolean;
  availableTokens: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const inMatch = myStatus !== null && ACTIVE.includes(myStatus);
  const hoursToKickoff = (new Date(kickoffIso).getTime() - Date.now()) / 3_600_000;
  const isLate = hoursToKickoff <= 12;

  function doJoin() {
    setError("");
    startTransition(async () => {
      const res = await joinMatch(matchId);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  function doCancel() {
    setError("");
    if (isLate) {
      const ok = window.confirm(
        "It's less than 12 hours to kickoff. Cancelling now forfeits your R20 token to 5sFindr and lowers your reliability score. Cancel anyway?",
      );
      if (!ok) return;
    }
    startTransition(async () => {
      const res = await cancelParticipation(matchId);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  // Already in the match → show status + cancel.
  if (inMatch) {
    return (
      <div className="space-y-2">
        <div className="rounded-2xl border border-ink-700 bg-ink-800/60 p-4 text-center">
          <p className="text-sm text-white/50">Your status</p>
          <p className="mt-0.5 text-lg font-bold capitalize text-pitch">
            {myStatus === "requested" ? "Pending approval" : myStatus}
          </p>
        </div>
        <button
          type="button"
          onClick={doCancel}
          disabled={pending}
          className={`w-full rounded-2xl py-3.5 font-bold transition disabled:opacity-60 ${
            isLate
              ? "border border-red-500/50 text-red-400 hover:bg-red-500/10"
              : "border border-ink-600 text-white/80 hover:border-white/40"
          }`}
        >
          {pending
            ? "Cancelling…"
            : isLate
              ? "Cancel (forfeits token)"
              : "Cancel — full refund"}
        </button>
        {!isLate && (
          <p className="text-center text-xs text-white/40">
            Free cancellation until 12 hours before kickoff.
          </p>
        )}
        {error && <p className="text-center text-sm text-red-400">{error}</p>}
      </div>
    );
  }

  // Not in the match — gate on open status, Premium, and token balance.
  if (matchStatus !== "open") {
    return (
      <p className="rounded-2xl border border-ink-700 bg-ink-800/60 p-4 text-center text-sm text-white/50">
        This match is {matchStatus === "full" ? "full" : "closed"}.
      </p>
    );
  }

  if (!isPremium) {
    return (
      <Link
        href="/wallet"
        className="block w-full rounded-2xl border border-electric/40 bg-electric/10 py-3.5 text-center font-bold text-electric"
      >
        Go Premium to join →
      </Link>
    );
  }

  if (availableTokens < 1) {
    return (
      <Link
        href="/wallet"
        className="block w-full rounded-2xl border border-pitch/40 py-3.5 text-center font-bold text-pitch"
      >
        Top up a token to join →
      </Link>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={doJoin}
        disabled={pending}
        className="w-full rounded-2xl bg-pitch py-3.5 font-bold text-ink-900 shadow-glow transition hover:bg-pitch-dark disabled:opacity-60"
      >
        {pending
          ? "Committing token…"
          : joinMode === "instant"
            ? "Instant book — commit R20 token"
            : "Request to join — commit R20 token"}
      </button>
      <p className="text-center text-xs text-white/40">
        1 token is held now and returned when you check in.
      </p>
      {error && <p className="text-center text-sm text-red-400">{error}</p>}
    </div>
  );
}
