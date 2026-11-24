"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmSpot } from "@/server/actions/participation";

// S4 "Still coming?" card: accepted players, in the 24h before kickoff, until
// they confirm. Guests without an email only get this (no email reminder).
export function StillComing({
  matchId,
  kickoffIso,
  confirmed,
}: {
  matchId: string;
  kickoffIso: string;
  confirmed: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [done, setDone] = useState(confirmed);

  const time = new Date(kickoffIso).toLocaleString("en-ZA", {
    weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Johannesburg",
  });
  const lastCall = new Date(kickoffIso).getTime() - Date.now() <= 3 * 3_600_000;

  if (done) {
    return (
      <p className="rounded-2xl border border-pitch/40 bg-pitch/10 p-3 text-center text-sm font-bold text-pitch">
        ✓ You’re confirmed for {time}. See you there.
      </p>
    );
  }

  function yes() {
    setError("");
    start(async () => {
      const res = await confirmSpot(matchId);
      if (res.ok) {
        setDone(true);
        router.refresh();
      } else setError(res.error);
    });
  }

  return (
    <section className="space-y-3 rounded-2xl border border-yellow-400/40 bg-yellow-400/10 p-4">
      <div>
        <h3 className="text-base font-black">Still coming? {time}</h3>
        <p className="mt-1 text-xs text-white/60">
          {lastCall
            ? "Last call. Spots nobody confirms are freed 90 minutes before kickoff so others can play."
            : "One tap lets the organiser know you’re coming."}
        </p>
      </div>
      <button type="button" onClick={yes} disabled={pending} className="btn-primary w-full disabled:opacity-60">
        {pending ? "Confirming…" : "Yes, I’m coming"}
      </button>
      <p className="text-center text-xs text-white/40">Can’t make it? Drop out below so someone else gets your spot.</p>
      {error && <p className="text-center text-xs text-red-400">{error}</p>}
    </section>
  );
}
