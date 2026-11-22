"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { joinMatch, cancelParticipation } from "@/server/actions/participation";
import { FEATURES } from "@/lib/flags";
import { track } from "@/lib/analytics";
import { GuestJoin } from "./GuestJoin";
import type { JoinMode, MatchStatus, ParticipantStatus } from "@/lib/types";

const ACTIVE: ParticipantStatus[] = ["requested", "accepted", "attended"];

export function PlayerActions({
  matchId,
  matchStatus,
  joinMode,
  kickoffIso,
  myStatus,
  isAuthed = true,
  availableTokens,
}: {
  matchId: string;
  matchStatus: MatchStatus;
  joinMode: JoinMode;
  kickoffIso: string;
  myStatus: ParticipantStatus | null;
  isAuthed?: boolean;
  availableTokens: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [needDetails, setNeedDetails] = useState(false);

  const tokens = FEATURES.tokens;
  const inMatch = myStatus !== null && ACTIVE.includes(myStatus);
  const hoursToKickoff = (new Date(kickoffIso).getTime() - Date.now()) / 3_600_000;
  const isLate = hoursToKickoff <= 12;

  function doJoin() {
    setError("");
    startTransition(async () => {
      const res = await joinMatch(matchId);
      if (res.ok) {
        track("im_in", { as: "member" });
        router.refresh();
      } else if (res.error.startsWith("Add your name")) {
        setNeedDetails(true);
      } else setError(res.error);
    });
  }

  function doCancel() {
    setError("");
    if (isLate) {
      const ok = window.confirm(
        tokens
          ? "It's less than 12 hours to kickoff. Cancelling now forfeits your R20 token to 5sFindr and lowers your reliability score. Cancel anyway?"
          : "It's less than 12 hours to kickoff. Dropping out now counts as a missed game on your show-up rate. Drop out anyway?",
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
          <p className="mt-0.5 text-lg font-bold text-pitch">
            {myStatus === "requested" ? "Waiting for the organiser" : myStatus === "attended" ? "Played ✓" : "You’re in ✓"}
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
              ? tokens ? "Cancel (forfeits token)" : "Drop out (counts as missed)"
              : tokens ? "Cancel — full refund" : "Can’t make it"}
        </button>
        {!isLate && (
          <p className="text-center text-xs text-white/40">
            Free to drop out until 12 hours before kickoff.
          </p>
        )}
        {error && <p className="text-center text-sm text-red-400">{error}</p>}
      </div>
    );
  }

  if (matchStatus !== "open") {
    return (
      <p className="rounded-2xl border border-ink-700 bg-ink-800/60 p-4 text-center text-sm text-white/50">
        This match is {matchStatus === "full" ? "full" : "closed"}.
      </p>
    );
  }

  // No account → guest join (name + WhatsApp). A guest whose details went
  // missing gets the same form.
  if (!isAuthed || needDetails) return <GuestJoin matchId={matchId} startOpen={needDetails} />;

  if (tokens && availableTokens < 1) {
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
          ? "Adding you…"
          : joinMode === "instant"
            ? tokens ? "I’m in — commit R20 token" : "I’m in"
            : tokens ? "Ask to join — commit R20 token" : "Ask to join"}
      </button>
      <p className="text-center text-xs text-white/40">
        {tokens
          ? "1 token is held now and returned when you show up."
          : joinMode === "instant" ? "Free. You’re on the list straight away." : "Free. The organiser confirms your spot."}
      </p>
      {error && <p className="text-center text-sm text-red-400">{error}</p>}
    </div>
  );
}
