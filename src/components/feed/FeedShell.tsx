"use client";

import { useState } from "react";
import type { MatchFeedItem, ViewMode } from "@/lib/types";
import { setViewPreference } from "@/server/actions/preferences";
import { ViewSwitcher } from "./ViewSwitcher";
import { PlayerFeed } from "./PlayerFeed";
import { OrganizerDashboard } from "./OrganizerDashboard";

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

  function change(next: ViewMode) {
    setView(next); // instant — data is already client-side
    void setViewPreference(next); // remember for next visit
  }

  return (
    <div className="space-y-5">
      <ViewSwitcher value={view} onChange={change} />
      {view === "player" ? (
        <PlayerFeed matches={playerMatches} />
      ) : (
        <OrganizerDashboard matches={organizerMatches} isPremium={isPremium} />
      )}
    </div>
  );
}
