import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isPremium } from "@/lib/entitlements";
import { FeedShell } from "@/components/feed/FeedShell";
import type { MatchFeedItem, ViewMode } from "@/lib/types";

interface PingRow {
  match_id: string;
  message: string;
  created_at: string;
  match: { status: string; kickoff_at: string } | null;
}

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

  // Region pings (Layer 1): active alerts for upcoming open matches in my hood.
  const { data: me } = await supabase.from("profiles").select("neighborhood").eq("id", uid).maybeSingle();
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

      <FeedShell
        initialView={initialView}
        playerMatches={playerMatches ?? []}
        organizerMatches={organizerMatches ?? []}
        isPremium={premium}
      />
    </>
  );
}
