"use client";

import { useState, useTransition } from "react";
import { ensureMatchCode } from "@/server/actions/attendance";

// Organizer-only. Reveals the 4-digit code to read out at the pitch. The code
// is stored in a table only the organizer can read; players never receive it
// over the wire — they type what they hear.
export function MatchCodePanel({ matchId }: { matchId: string }) {
  const [pending, start] = useTransition();
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState("");

  function reveal() {
    setError("");
    start(async () => {
      const r = await ensureMatchCode(matchId);
      if (r.ok) setCode(r.code);
      else setError(r.error);
    });
  }

  return (
    <section className="rounded-2xl border border-electric/30 bg-electric/5 p-4">
      <h3 className="text-sm font-bold uppercase tracking-wide text-white/50">Attendance code</h3>
      {code ? (
        <>
          <p className="mt-2 text-center text-4xl font-black tracking-[0.4em] text-electric">{code}</p>
          <p className="mt-2 text-center text-xs text-white/40">
            Read this out at the pitch. Valid until 60 min after full time.
          </p>
        </>
      ) : (
        <button
          type="button"
          onClick={reveal}
          disabled={pending}
          className="mt-2 w-full rounded-2xl bg-electric py-3 font-bold text-white transition hover:bg-electric-dark disabled:opacity-60"
        >
          {pending ? "Generating…" : "Reveal match code"}
        </button>
      )}
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </section>
  );
}
