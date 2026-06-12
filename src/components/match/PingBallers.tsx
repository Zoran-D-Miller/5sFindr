"use client";

import { useState, useTransition } from "react";
import { pingBallers } from "@/server/actions/ping";
import { buildPingBlast } from "@/lib/whatsapp";

// Organizer tool. Layer 1: in-app region ping (feed banner for nearby players).
// Layer 2: copy a high-conversion blast for external WhatsApp groups.
export function PingBallers({
  matchId,
  venue,
  kickoffIso,
  spotsLeft,
  shareSlug,
  siteUrl,
}: {
  matchId: string;
  venue: string;
  kickoffIso: string;
  spotsLeft: number;
  shareSlug: string;
  siteUrl: string;
}) {
  const [pending, start] = useTransition();
  const [pinged, setPinged] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  function ping() {
    setError("");
    start(async () => {
      const r = await pingBallers(matchId);
      if (r.ok) setPinged(r.neighborhood ? `Alerted ballers in ${r.neighborhood}` : "Ballers alerted");
      else setError(r.error);
    });
  }

  async function copyBlast() {
    await navigator.clipboard.writeText(
      buildPingBlast({ venue, kickoffIso, spotsLeft, shareSlug, siteUrl }),
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <section className="rounded-2xl border border-pitch/20 bg-gradient-to-b from-pitch/10 to-transparent p-4">
      <h3 className="text-sm font-bold uppercase tracking-wide text-white/60">Ping nearby ballers</h3>
      <p className="mt-1 text-xs text-white/40">
        {spotsLeft > 0 ? `${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left.` : "Squad full."} Rally
        the neighborhood.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={ping}
          disabled={pending}
          className="flex-1 rounded-2xl bg-pitch py-3 font-bold text-ink-900 shadow-glow transition hover:bg-pitch-dark disabled:opacity-60"
        >
          {pending ? "Pinging…" : "🔔 Ping the area"}
        </button>
        <button
          type="button"
          onClick={copyBlast}
          className="flex-1 rounded-2xl border border-ink-600 py-3 font-semibold text-white/80 transition hover:border-pitch hover:text-white"
        >
          {copied ? "Copied ✓" : "📋 WhatsApp blast"}
        </button>
      </div>
      {pinged && <p className="mt-2 text-sm font-medium text-pitch">{pinged}</p>}
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </section>
  );
}
