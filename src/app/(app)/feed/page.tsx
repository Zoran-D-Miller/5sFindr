import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { canPostGames } from "@/lib/entitlements";
import { TrackEvent } from "@/components/analytics/TrackEvent";
import { PRELAUNCH } from "@/lib/flags";
import { UNLOCK } from "@/lib/areas";
import { FeedShell } from "@/components/feed/FeedShell";
import type { MatchFeedItem, ViewMode } from "@/lib/types";

interface PingRow {
  match_id: string;
  message: string;
  created_at: string;
  match: { status: string; kickoff_at: string } | null;
}

export default async function FeedPage({ searchParams }: { searchParams: { posted?: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Public browsing: uid is null for anonymous visitors — they see the full
  // open feed; per-user extras (own-match exclusion, organizer view, pings)
  // simply don't apply.
  const uid = user?.id ?? null;
  const member = !!user && !user.is_anonymous;

  const now = new Date().toISOString();

  const playerQuery = supabase
    .from("match_feed")
    .select("*")
    .in("status", ["open", "full"])
    .gte("kickoff_at", now)
    .order("kickoff_at", { ascending: true });

  const [playerRes, organizerRes, premium] = await Promise.all([
    // Player feed: open/full upcoming games (excluding your own when logged in).
    (uid ? playerQuery.neq("organizer_id", uid) : playerQuery).returns<MatchFeedItem[]>(),
    // Organizer dashboard: everything you manage, soonest first.
    uid
      ? supabase
          .from("match_feed")
          .select("*")
          .eq("organizer_id", uid)
          .order("kickoff_at", { ascending: true })
          .returns<MatchFeedItem[]>()
      : Promise.resolve({ data: [] as MatchFeedItem[], error: null }),
    member && uid ? canPostGames(uid) : Promise.resolve(false),
  ]);

  // Surface (don't swallow) read errors — an empty feed from a permission/RLS
  // error must be visible in logs, not silently rendered as a ghost town.
  if (playerRes.error) console.error("[feed] player query error:", playerRes.error.message);
  if (organizerRes.error) console.error("[feed] organizer query error:", organizerRes.error.message);
  let playerMatches = playerRes.data;

  // Soft launch: the area feeds stay closed until an area unlocks. Games are
  // shared by link (/m/<slug>), so here you only see the ones you're on.
  if (PRELAUNCH) {
    const { data: mine } = uid
      ? await supabase.from("match_players").select("match_id").eq("user_id", uid)
          .in("status", ["requested", "accepted", "attended"]).returns<{ match_id: string }[]>()
      : { data: [] as { match_id: string }[] };
    const ids = new Set((mine ?? []).map((r) => r.match_id));
    playerMatches = (playerMatches ?? []).filter((m) => ids.has(m.id));
  }
  const organizerMatches = organizerRes.data;

  const initialView: ViewMode =
    cookies().get("view")?.value === "organizer" ? "organizer" : "player";

  // Dropdown options: every neighborhood with an upcoming open/full match
  // (across ALL organizers, so your own custom areas like Malmesbury appear too).
  const { data: hoodRows } = await supabase
    .from("match_feed")
    .select("neighborhood")
    .in("status", ["open", "full"])
    .gte("kickoff_at", now)
    .returns<{ neighborhood: string | null }[]>();
  const neighborhoods = PRELAUNCH
    ? []
    : [...new Set((hoodRows ?? []).map((r) => r.neighborhood?.trim()).filter((n): n is string => !!n))].sort();

  // Region pings (Layer 1): active alerts for upcoming open matches in my hood.
  // Anonymous visitors have no neighborhood, so no pings.
  const { data: me } = uid
    ? await supabase.from("profiles").select("neighborhood").eq("id", uid).maybeSingle()
    : { data: null };
  let pings: PingRow[] = [];
  if (me?.neighborhood) {
    const since = new Date(Date.now() - 6 * 3_600_000).toISOString();
    const { data } = await supabase
      .from("match_pings")
      .select("match_id, message, created_at, match:matches(status, kickoff_at)")
      .eq("neighborhood", me.neighborhood)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(10)
      .returns<PingRow[]>();
    const seen = new Set<string>();
    pings = (data ?? [])
      .filter((p) => p.match?.status === "open" && new Date(p.match.kickoff_at).getTime() > Date.now())
      .filter((p) => (seen.has(p.match_id) ? false : (seen.add(p.match_id), true)))
      .slice(0, 2);
  }

  return (
    <>
      <TrackEvent name="browse" data={{ who: member ? "member" : user ? "guest" : "visitor" }} />
      {searchParams.posted === "1" && <TrackEvent name="post_game" />}
      <h1 className="mb-5 text-2xl font-black tracking-tight">
        Games in <span className="text-pitch">Cape Town</span>
      </h1>

      {pings.length > 0 && (
        <div className="mb-5 space-y-2">
          {pings.map((p) => (
            <Link
              key={p.match_id}
              href={`/matches/${p.match_id}`}
              className="flex items-center gap-3 rounded-2xl border border-pitch/40 bg-pitch/10 px-4 py-3 shadow-glow transition hover:bg-pitch/15"
            >
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pitch opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-pitch" />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-bold text-pitch">{p.message}</span>
              <span className="shrink-0 text-xs font-semibold text-pitch/70">Join →</span>
            </Link>
          ))}
        </div>
      )}

      {PRELAUNCH && (
        <p className="mb-5 rounded-2xl border border-ink-700 bg-ink-800/60 p-4 text-sm text-white/60">
          Soft launch: games are shared by link for now. Each area’s feed opens once it has {UNLOCK.players} players
          and {UNLOCK.weeklyGames} weekly games. Here you’ll see the games you run or are on.
        </p>
      )}

      <FeedShell
        initialView={initialView}
        playerMatches={playerMatches ?? []}
        organizerMatches={organizerMatches ?? []}
        neighborhoods={neighborhoods}
        isPremium={premium}
        canPost={premium}
      />
    </>
  );
}
