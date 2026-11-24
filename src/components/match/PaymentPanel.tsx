"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { claimPaid } from "@/server/actions/payment";

// Player view on a paid game: what to pay, how, the reference, "I've paid".
export function PaymentPanel({
  matchId,
  price,
  organizerName,
  details,
  reference,
  claimed,
  confirmed,
}: {
  matchId: string;
  price: number;
  organizerName: string;
  details: string | null;
  reference: string;
  claimed: boolean;
  confirmed: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  function toggle() {
    setError("");
    start(async () => {
      const res = await claimPaid(matchId, !claimed);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  async function copyRef() {
    await navigator.clipboard.writeText(reference);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <section className="space-y-3 rounded-2xl border border-ink-700 bg-ink-800/60 p-4">
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wide text-white/50">R{price} each</h3>
        <p className="mt-1 text-xs text-white/50">
          Court booked by {organizerName}. Pay them directly (cash, SnapScan or EFT).
        </p>
      </div>
      {details && (
        <p className="whitespace-pre-wrap break-words rounded-xl bg-ink-900/60 p-3 text-sm text-white/80">{details}</p>
      )}
      <div className="flex items-center justify-between gap-2 rounded-xl border border-ink-600 px-3 py-2 text-sm">
        <span className="text-white/50">Reference</span>
        <button type="button" onClick={copyRef} className="font-mono font-bold text-pitch">
          {copied ? "Copied ✓" : reference}
        </button>
      </div>
      {confirmed ? (
        <p className="text-center text-sm font-bold text-pitch">✓ {organizerName} has your payment</p>
      ) : (
        <button type="button" onClick={toggle} disabled={pending} className={claimed ? "btn-outline w-full" : "btn-primary w-full"}>
          {pending ? "…" : claimed ? "Marked as paid ✓ (undo)" : "I’ve paid"}
        </button>
      )}
      {error && <p className="text-center text-sm text-red-400">{error}</p>}
    </section>
  );
}
