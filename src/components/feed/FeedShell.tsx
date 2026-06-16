"use client";

import { useMemo, useState } from "react";
import type { MatchFeedItem, ViewMode } from "@/lib/types";
import { setViewPreference } from "@/server/actions/preferences";
import { ViewSwitcher } from "./ViewSwitcher";
import { PlayerFeed } from "./PlayerFeed";
import { OrganizerDashboard } from "./OrganizerDashboard";

const ALL = "__all__";

export function FeedShell({
  initialView,
  playerMatches,
  organizerMatches,
  isPremium,
}: {
  initialView: ViewMode;
  playerMatches: MatchFeedItem[];
  organizerMatches: MatchFeedItem[];
  isPremium: boolean;
}) {
  const [view, setView] = useState<ViewMode>(initialView);
  const [hood, setHood] = useState<string>(ALL);

  function change(next: ViewMode) {
    setView(next); // instant — data is already client-side
    void setViewPreference(next); // remember for next visit
  }

  // Distinct neighborhoods present in the upcoming player feed (sorted).
  const hoods = useMemo(
    () =>
      [...new Set(playerMatches.map((m) => m.neighborhood?.trim()).filter((n): n is string => !!n))].sort(),
    [playerMatches],
  );

  const filtered = useMemo(
    () => (hood === ALL ? playerMatches : playerMatches.filter((m) => m.neighborhood?.trim() === hood)),
    [playerMatches, hood],
  );

  return (
    <div className="space-y-5">
      <ViewSwitcher value={view} onChange={change} />

      {view === "player" ? (
        <>
          {hoods.length > 0 && (
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
          )}
          <PlayerFeed matches={filtered} />
        </>
      ) : (
        <OrganizerDashboard matches={organizerMatches} isPremium={isPremium} />
      )}
    </div>
  );
}
