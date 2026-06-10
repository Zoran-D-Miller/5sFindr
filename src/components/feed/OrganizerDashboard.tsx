import Link from "next/link";
import type { MatchFeedItem } from "@/lib/types";
import { MatchCard } from "./MatchCard";

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-2xl border border-ink-700 bg-ink-800/60 p-4 text-center">
      <p className={`text-2xl font-black ${tone}`}>{value}</p>
      <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-white/40">
        {label}
      </p>
    </div>
  );
}

export function OrganizerDashboard({
  matches,
  isPremium,
}: {
  matches: MatchFeedItem[];
  isPremium: boolean;
}) {
  const now = Date.now();
  const upcoming = matches.filter(
    (m) => new Date(m.kickoff_at).getTime() >= now && m.status !== "cancelled",
  );
  const playersComing = upcoming.reduce((sum, m) => sum + m.spots_taken, 0);

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-2.5">
        <Stat label="Upcoming" value={upcoming.length} tone="text-pitch" />
        <Stat label="Players in" value={playersComing} tone="text-electric" />
        <Stat label="Total hosted" value={matches.length} tone="text-white" />
      </div>

      {/* Create CTA — prominent */}
      {isPremium ? (
        <Link
          href="/matches/new"
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-pitch py-4 text-base font-bold text-ink-900 shadow-glow transition hover:bg-pitch-dark"
        >
          <span className="text-xl leading-none">+</span> Create a match
        </Link>
      ) : (
        <Link
          href="/wallet"
          className="block w-full rounded-2xl border border-electric/40 bg-electric/10 py-4 text-center font-bold text-electric transition hover:bg-electric/20"
        >
          Go Premium to create matches →
        </Link>
      )}

      {/* Managed games */}
      <section>
        <h2 className="mb-2 px-1 text-sm font-bold uppercase tracking-wide text-white/50">
          Your matches
        </h2>
        {matches.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink-700 px-5 py-10 text-center">
            <p className="font-semibold text-white/70">You haven’t hosted a game yet</p>
            <p className="mt-1 text-sm text-white/40">
              Create one above and share it to your WhatsApp group.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {matches.map((m) => (
              <MatchCard key={m.id} match={m} manage />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
