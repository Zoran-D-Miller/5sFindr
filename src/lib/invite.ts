import { createClient as createSupabase } from "@supabase/supabase-js";
import type { JoinMode, MatchStatus, ParticipantStatus, VenueType } from "@/lib/types";
import type { GameLabels } from "@/lib/labels";

// Public data for a /m/<slug> invite: the game, the organiser and the faces
// of who's in. Read with the anon key (live matches + rosters are public,
// 0016), so the page and its link-preview image show the same thing.
export interface InviteData extends GameLabels {
  id: string;
  title: string | null;
  venue_type: VenueType;
  kickoff_at: string;
  max_players: number;
  price_per_player_zar: number;
  join_mode: JoinMode;
  status: MatchStatus;
  organizer_id: string;
  location: { name: string; neighborhood: string | null } | null;
  organizer: { name: string } | null;
  players: { user_id: string; name: string; avatar_url: string | null; status: ParticipantStatus }[];
}

export async function loadInvite(slug: string): Promise<InviteData | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  const db = createSupabase(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: match } = await db
    .from("matches")
    .select(
      "id, title, venue_type, kickoff_at, max_players, price_per_player_zar, join_mode, status, organizer_id, skill_tag, group_tag, over_30, location:locations(name, neighborhood), organizer:profiles!organizer_id(name)",
    )
    .eq("share_slug", slug)
    .maybeSingle<Omit<InviteData, "players">>();
  if (!match) return null;

  const { data: roster } = await db
    .from("match_players")
    .select("user_id, status, requested_at, profile:profiles(name, avatar_url)")
    .eq("match_id", match.id)
    .in("status", ["accepted", "attended"])
    .order("requested_at", { ascending: true })
    .returns<{ user_id: string; status: ParticipantStatus; profile: { name: string; avatar_url: string | null } | null }[]>();

  const players = (roster ?? [])
    .map((r) => ({ user_id: r.user_id, status: r.status, name: r.profile?.name ?? "Player", avatar_url: r.profile?.avatar_url ?? null }))
    // organiser (Captain) first
    .sort((a, b) => Number(b.user_id === match.organizer_id) - Number(a.user_id === match.organizer_id));

  return { ...match, players };
}

/** "3 spots left" / "Full" / "Played" / "Cancelled" for the invite + preview. */
export function spotsLabel(m: Pick<InviteData, "status" | "max_players" | "players">) {
  if (m.status === "completed") return "Played";
  if (m.status === "cancelled") return "Cancelled";
  const left = Math.max(0, m.max_players - m.players.length);
  return left > 0 ? `${left} spot${left === 1 ? "" : "s"} left` : "Full";
}

export function inviteWhen(iso: string) {
  return new Date(iso).toLocaleString("en-ZA", {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false,
    timeZone: "Africa/Johannesburg",
  });
}
