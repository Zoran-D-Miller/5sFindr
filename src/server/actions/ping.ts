"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type PingResult = { ok: true; neighborhood: string | null } | { ok: false; error: string };

// Layer 1 (internal): write a region ping. Players whose profile neighborhood
// matches see it as a live banner at the top of their feed.
export async function pingBallers(matchId: string): Promise<PingResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please log in." };

  const { data: m } = await supabase
    .from("match_feed")
    .select("location_name, neighborhood, max_players, spots_taken, organizer_id, kickoff_at")
    .eq("id", matchId)
    .maybeSingle<{
      location_name: string;
      neighborhood: string | null;
      max_players: number;
      spots_taken: number;
      organizer_id: string;
      kickoff_at: string;
    }>();
  if (!m) return { ok: false, error: "Match not found." };
  if (m.organizer_id !== user.id) return { ok: false, error: "Only the organizer can ping." };

  const spotsLeft = Math.max(0, m.max_players - m.spots_taken);
  const message =
    spotsLeft > 0
      ? `⚽ NEED ${spotsLeft} MORE: ${m.location_name} — kickoff soon!`
      : `⚽ Game on at ${m.location_name}!`;

  const { error } = await supabase
    .from("match_pings")
    .insert({ match_id: matchId, organizer_id: user.id, neighborhood: m.neighborhood, message });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/feed");
  return { ok: true, neighborhood: m.neighborhood };
}
