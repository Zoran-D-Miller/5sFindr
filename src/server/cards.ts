import { createClient as createSupabase } from "@supabase/supabase-js";
import type { GameLabels } from "@/lib/labels";
import type { Position } from "@/lib/types";

// Data for the S6 shareable cards (next/og images under /api/card/*). Read
// with the anon key through game_recap() / player_card() (migration 0031),
// which only return public data: completed game rosters and public profile
// columns, plus counts.

export interface RecapData extends GameLabels {
  title: string | null;
  kickoff_at: string;
  venue: string | null;
  neighborhood: string | null;
  organizer_name: string | null;
  organizer_id: string;
  players: number;
  new_faces: number;
  first_game_ct: number;
  faces: { name: string; avatar_url: string | null }[];
}

export interface PlayerCardData {
  name: string;
  avatar_url: string | null;
  neighborhood: string | null;
  preferred_positions: Position[] | null;
  founding_number: number | null;
  games_played: number;
  games_missed: number;
  reliability_score: number;
  created_at: string;
  played_with: number;
}

function anonDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  return createSupabase(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Recap of a completed game, or null (not found / not completed yet). */
export async function loadRecap(matchId: string): Promise<RecapData | null> {
  if (!UUID_RE.test(matchId)) return null;
  const db = anonDb();
  if (!db) return null;
  const { data, error } = await db.rpc("game_recap", { p_match_id: matchId });
  if (error) console.error("[cards] game_recap:", error.message);
  return (data as RecapData | null) ?? null;
}

export async function loadPlayerCard(slug: string): Promise<PlayerCardData | null> {
  if (!/^[a-z0-9-]{1,80}$/i.test(slug)) return null;
  const db = anonDb();
  if (!db) return null;
  const { data, error } = await db.rpc("player_card", { p_slug: slug });
  if (error) console.error("[cards] player_card:", error.message);
  return (data as PlayerCardData | null) ?? null;
}

export function cardWhen(iso: string) {
  return new Date(iso)
    .toLocaleString("en-ZA", {
      weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false,
      timeZone: "Africa/Johannesburg",
    })
    .toUpperCase();
}
