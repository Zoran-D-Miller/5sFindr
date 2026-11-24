"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmPaid, savePaymentInfo } from "@/server/actions/payment";

export interface PayRow {
  user_id: string;
  name: string;
  claimed: boolean;
  confirmed: boolean;
}

// Organiser view on a paid game: payment details + "who's paid" checklist.
// Players who tapped "I've paid" (not yet ticked) are listed first.
export function WhoPaidPanel({
  matchId,
  price,
  details,
  rows,
}: {
  matchId: string;
  price: number;
  details: string | null;
  rows: PayRow[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(!details);
  const [draft, setDraft] = useState(details ?? "");

  const rank = (r: PayRow) => (r.claimed && !r.confirmed ? 0 : r.confirmed ? 2 : 1);
  const sorted = [...rows].sort((a, b) => rank(a) - rank(b));
  const paid = rows.filter((r) => r.confirmed).length;

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) {
    setError("");
    start(async () => {
      const res = await fn();
      if (res.ok) {
        after?.();
        router.refresh();
      } else setError(res.error ?? "Something went wrong.");
    });
  }

  return (
    <section className="space-y-3 rounded-2xl border border-ink-700 bg-ink-800/60 p-4">
      <h3 className="text-sm font-bold uppercase tracking-wide text-white/50">
        Who’s paid · R{price} each ({paid}/{rows.length})
      </h3>

      {editing ? (
        <div className="space-y-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={300}
            rows={3}
            placeholder="How to pay you: a SnapScan link, or bank + account number + branch code. Only people on the list see this."
            className="input-field w-full text-sm"
          />
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => savePaymentInfo(matchId, draft), () => setEditing(false))}
            className="btn-outline w-full"
          >
            Save payment details
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setEditing(true)} className="w-full text-left">
          <p className="whitespace-pre-wrap break-words rounded-xl bg-ink-900/60 p-3 text-xs text-white/60">{details}</p>
          <span className="mt-1 block text-right text-[11px] text-white/40 underline">Edit</span>
        </button>
      )}

      {rows.length === 0 ? (
        <p className="text-center text-xs text-white/40">Nobody to collect from yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {sorted.map((r) => (
            <li key={r.user_id}>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => confirmPaid(matchId, r.user_id, !r.confirmed))}
                aria-pressed={r.confirmed}
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition disabled:opacity-60 ${
                  r.confirmed ? "border-pitch/50 bg-pitch/10" : "border-ink-600"
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-xs font-black ${
                    r.confirmed ? "border-pitch bg-pitch text-ink-900" : "border-ink-500"
                  }`}
                >
                  {r.confirmed ? "✓" : ""}
                </span>
                <span className="flex-1 truncate font-medium">{r.name}</span>
                {r.claimed && !r.confirmed && (
                  <span className="shrink-0 rounded-full bg-electric/15 px-2 py-0.5 text-[10px] font-bold uppercase text-electric">
                    says paid
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-center text-sm text-red-400">{error}</p>}
    </section>
  );
}
