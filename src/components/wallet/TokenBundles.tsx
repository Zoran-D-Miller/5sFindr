"use client";

import { useState, useTransition } from "react";
import { purchaseTokens } from "@/server/actions/subscription";

const BUNDLES: { qty: 1 | 5 | 10; price: string; sub: string; save?: string }[] = [
  { qty: 1, price: "R20", sub: "Single token" },
  { qty: 5, price: "R90", sub: "5-pack", save: "Save R10" },
  { qty: 10, price: "R170", sub: "10-pack", save: "Save R30" },
];

export function TokenBundles() {
  const [pending, start] = useTransition();
  const [busyQty, setBusyQty] = useState<number | null>(null);
  const [error, setError] = useState("");

  function buy(qty: 1 | 5 | 10) {
    setError("");
    setBusyQty(qty);
    start(async () => {
      try {
        const res = await purchaseTokens(qty);
        if (res.ok) {
          window.location.href = res.url;
          return;
        }
        setError(res.error);
      } catch {
        setError("Couldn’t start checkout — please try again.");
      }
      setBusyQty(null);
    });
  }

  return (
    <section className="rounded-3xl border border-ink-700 bg-ink-800/60 p-5">
      <h3 className="text-sm font-bold uppercase tracking-wide text-white/60">Top up tokens</h3>
      <p className="mt-1 text-xs text-white/40">A token is a R20 deposit — play the game, get it back.</p>
      <div className="mt-4 grid grid-cols-3 gap-2.5">
        {BUNDLES.map((b) => (
          <button
            key={b.qty}
            type="button"
            onClick={() => buy(b.qty)}
            disabled={pending}
            className="relative flex flex-col items-center rounded-2xl border border-ink-600 bg-ink-900 p-3 transition hover:border-pitch disabled:opacity-60"
          >
            {b.save && (
              <span className="absolute -top-2 rounded-full bg-pitch px-2 py-0.5 text-[10px] font-bold text-ink-900">
                {b.save}
              </span>
            )}
            <span className="mt-1 text-2xl font-black text-pitch">{b.qty}</span>
            <span className="text-[11px] text-white/50">{b.sub}</span>
            <span className="mt-1 text-sm font-bold">{busyQty === b.qty ? "…" : b.price}</span>
          </button>
        ))}
      </div>
      {error && (
        <p
          role="alert"
          className="mt-3 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-300"
        >
          {error}
        </p>
      )}
    </section>
  );
}
