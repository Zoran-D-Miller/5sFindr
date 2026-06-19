import type { Token } from "@/lib/types";
import { TokenChip } from "./TokenChip";

// Balance hero: big available count + a row of coin visuals, with committed/total context.
export function TokenWallet({ tokens }: { tokens: Token[] }) {
  const available = tokens.filter((t) => t.status === "available");
  const committed = tokens.filter((t) => t.status === "committed");

  return (
    <section className="rounded-3xl border border-ink-700 bg-ink-800/60 p-6 backdrop-blur">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm font-medium text-white/50">Available tokens</p>
          <p className="mt-1 text-5xl font-black text-pitch">{available.length}</p>
          <p className="mt-1 text-xs text-white/40">
            {committed.length} committed · {tokens.length} total · R20 each
          </p>
        </div>
        <TokenChip status="available" />
      </div>

      {/* Coin row — visual stock at a glance */}
      <div className="mt-5 flex flex-wrap gap-2">
        {tokens.length === 0 ? (
          <p className="text-sm text-white/40">No tokens yet.</p>
        ) : (
          tokens
            .slice(0, 12)
            .map((t) => <TokenChip key={t.id} status={t.status} size="sm" />)
        )}
      </div>

    </section>
  );
}
