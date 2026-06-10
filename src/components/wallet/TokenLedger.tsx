import type { TokenTransaction, TokenTxnType } from "@/lib/types";

// Human-readable labels + sign for each ledger event type.
const LEDGER: Record<TokenTxnType, { label: string; tone: string; sign: string }> = {
  signup_grant: { label: "Welcome token", tone: "text-pitch", sign: "+" },
  purchase: { label: "Token top-up", tone: "text-pitch", sign: "+" },
  return: { label: "Returned — match played", tone: "text-pitch", sign: "+" },
  refund: { label: "Refunded — early cancel", tone: "text-pitch", sign: "+" },
  commit: { label: "Committed to match", tone: "text-electric", sign: "−" },
  forfeit: { label: "Forfeited — late bail", tone: "text-red-400", sign: "−" },
};

function when(iso: string) {
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
  });
}

export function TokenLedger({ transactions }: { transactions: TokenTransaction[] }) {
  return (
    <section>
      <h3 className="px-1 text-sm font-semibold text-white/70">Token history</h3>
      <ul className="mt-3 divide-y divide-ink-700 overflow-hidden rounded-2xl border border-ink-700 bg-ink-800/60">
        {transactions.length === 0 && (
          <li className="px-4 py-4 text-sm text-white/40">No activity yet.</li>
        )}
        {transactions.map((tx) => {
          const meta = LEDGER[tx.type];
          return (
            <li key={tx.id} className="flex items-center justify-between px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{meta.label}</p>
                <p className="text-xs text-white/40">{when(tx.created_at)}</p>
              </div>
              <span className={`text-sm font-bold ${meta.tone}`}>
                {meta.sign}R{tx.amount_zar}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
