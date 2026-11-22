"use client";

import { useMemo, useState } from "react";
import type { MatchFeedItem, ViewMode } from "@/lib/types";
import Link from "next/link";
import { setViewPreference } from "@/server/actions/preferences";
import { FEATURES } from "@/lib/flags";
import { MatchCard } from "./MatchCard";
import { ViewSwitcher } from "./ViewSwitcher";
import { PlayerFeed } from "./PlayerFeed";
import { OrganizerDashboard } from "./OrganizerDashboard";

const ALL = "__all__";

export function FeedShell({
  initialView,
  playerMatches,
  organizerMatches,
  neighborhoods,
  isPremium,
  canPost = false,
}: {
  initialView: ViewMode;
  playerMatches: MatchFeedItem[];
  organizerMatches: MatchFeedItem[];
  neighborhoods?: string[];
  isPremium: boolean;
  /** Signed-in member (not a guest) who may post a game. */
  canPost?: boolean;
}) {
  const [view, setView] = useState<ViewMode>(initialView);
  const [hood, setHood] = useState<string>(ALL);

  function change(next: ViewMode) {
    setView(next); // instant — data is already client-side
    void setViewPreference(next); // remember for next visit
  }

  // Dropdown options: prefer the server-provided list of all active
  // neighborhoods (incl. custom areas like Malmesbury); else derive from feed.
  const hoods = useMemo(() => {
    if (neighborhoods && neighborhoods.length) return neighborhoods;
    return [...new Set(playerMatches.map((m) => m.neighborhood?.trim()).filter((n): n is string => !!n))].sort();
  }, [neighborhoods, playerMatches]);

  const filtered = useMemo(
    () => (hood === ALL ? playerMatches : playerMatches.filter((m) => m.neighborhood?.trim() === hood)),
    [playerMatches, hood],
  );

  const hoodPicker = hoods.length > 0 && (
    <select
      value={hood}
      onChange={(e) => setHood(e.target.value)}
      className="w-full rounded-2xl border border-ink-600 bg-ink-800 px-4 py-2.5 text-sm font-medium text-white outline-none focus:border-pitch"
    >
      <option value={ALL}>📍 All neighborhoods</option>
      {hoods.map((h) => (
        <option key={h} value={h}>{h}</option>
      ))}
    </select>
  );

  // Switcher hidden: one page. Your own upcoming games first, then the feed.
  if (!FEATURES.roleSwitcher) {
    const mine = organizerMatches.filter(
      (m) => m.status !== "cancelled" && new Date(m.kickoff_at).getTime() >= Date.now() - 24 * 3_600_000,
    );
    return (
      <div className="space-y-5">
        {canPost && (
          <Link
            href="/matches/new"
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-pitch py-3.5 text-base font-bold text-ink-900 shadow-glow transition hover:bg-pitch-dark"
          >
            <span className="text-xl leading-none">+</span> Post a game
          </Link>
        )}
        {mine.length > 0 && (
          <section>
            <h2 className="mb-2 px-1 text-sm font-bold uppercase tracking-wide text-white/50">Your games</h2>
            <div className="space-y-2.5">
              {mine.map((m) => (
                <MatchCard key={m.id} match={m} manage />
              ))}
            </div>
          </section>
        )}
        {hoodPicker}
        <PlayerFeed matches={filtered} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ViewSwitcher value={view} onChange={change} />

      {view === "player" ? (
        <>
          {hoodPicker}
          <PlayerFeed matches={filtered} />
        </>
      ) : (
        <OrganizerDashboard matches={organizerMatches} isPremium={isPremium} />
      )}
    </div>
  );
}
