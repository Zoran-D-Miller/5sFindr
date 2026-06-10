import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isPremium } from "@/lib/entitlements";
import { FeedShell } from "@/components/feed/FeedShell";
import type { MatchFeedItem, ViewMode } from "@/lib/types";

export default async function FeedPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const uid = user!.id;

  const now = new Date().toISOString();

  const [{ data: playerMatches }, { data: organizerMatches }, premium] = await Promise.all([
    // Player feed: open/full upcoming games, not your own, soonest first.
    supabase
      .from("match_feed")
      .select("*")
      .in("status", ["open", "full"])
      .gte("kickoff_at", now)
      .neq("organizer_id", uid)
      .order("kickoff_at", { ascending: true })
      .returns<MatchFeedItem[]>(),
    // Organizer dashboard: everything you manage, soonest first.
    supabase
      .from("match_feed")
      .select("*")
      .eq("organizer_id", uid)
      .order("kickoff_at", { ascending: true })
      .returns<MatchFeedItem[]>(),
    isPremium(uid),
  ]);

  const initialView: ViewMode =
    cookies().get("view")?.value === "organizer" ? "organizer" : "player";

  return (
    <>
      <h1 className="mb-5 text-2xl font-black tracking-tight">
        Games in <span className="text-pitch">Cape Town</span>
      </h1>
      <FeedShell
        initialView={initialView}
        playerMatches={playerMatches ?? []}
        organizerMatches={organizerMatches ?? []}
        isPremium={premium}
      />
    </>
  );
}
