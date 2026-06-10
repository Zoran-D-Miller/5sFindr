"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { checkInGps, checkInCode } from "@/server/actions/attendance";

// Dual-layer check-in. Primary = native GPS (no map SDK). Secondary = the
// organizer's 4-digit code, entered retroactively on Wi-Fi. Either verifies.
export function CheckInPanel({ matchId, hasGeo }: { matchId: string; hasGeo: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [locating, setLocating] = useState(false);
  const [code, setCode] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  function ok() {
    setDone(true);
    router.refresh();
  }

  function gps() {
    setError("");
    if (!("geolocation" in navigator)) {
      setError("Your browser can’t do GPS — use the code below.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        start(async () => {
          const r = await checkInGps(matchId, pos.coords.latitude, pos.coords.longitude);
          if (r.ok) ok();
          else setError(r.error);
        });
      },
      (e) => {
        setLocating(false);
        setError(
          e.code === e.PERMISSION_DENIED
            ? "Location permission denied — use the code below."
            : "Couldn’t get your location — use the code below.",
        );
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  function submitCode() {
    setError("");
    if (!/^\d{4}$/.test(code)) {
      setError("Enter the 4-digit code.");
      return;
    }
    start(async () => {
      const r = await checkInCode(matchId, code);
      if (r.ok) ok();
      else setError(r.error);
    });
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-pitch/40 bg-pitch/10 p-4 text-center font-bold text-pitch">
        ✓ You’re checked in — your token comes back when the match settles.
      </div>
    );
  }

  return (
    <section className="space-y-3 rounded-2xl border border-ink-700 bg-ink-800/60 p-4">
      <h3 className="text-sm font-bold uppercase tracking-wide text-white/50">Check in</h3>

      {hasGeo && (
        <>
          <button
            type="button"
            onClick={gps}
            disabled={pending || locating}
            className="w-full rounded-2xl bg-pitch py-3.5 font-bold text-ink-900 shadow-glow transition hover:bg-pitch-dark disabled:opacity-60"
          >
            {locating ? "Finding you…" : pending ? "Verifying…" : "📍 Check in with GPS"}
          </button>
          <div className="flex items-center gap-3 text-xs text-white/30">
            <span className="h-px flex-1 bg-ink-700" /> or no signal? <span className="h-px flex-1 bg-ink-700" />
          </div>
        </>
      )}

      <div className="flex gap-2">
        <input
          inputMode="numeric"
          maxLength={4}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="4-digit code"
          className="min-w-0 flex-1 rounded-xl border border-ink-600 bg-ink-800 px-3.5 py-3 text-center text-lg font-bold tracking-[0.3em] outline-none focus:border-pitch"
        />
        <button
          type="button"
          onClick={submitCode}
          disabled={pending}
          className="shrink-0 rounded-xl border border-pitch/40 px-5 font-bold text-pitch disabled:opacity-60"
        >
          Verify
        </button>
      </div>
      <p className="text-xs text-white/40">
        Ask the organizer for the code at the pitch — works later on Wi-Fi too.
      </p>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </section>
  );
}
