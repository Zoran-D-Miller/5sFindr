import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canPostGames } from "@/lib/entitlements";
import { MatchCreateForm } from "@/components/match/MatchCreateForm";
import type { JoinMode, LastGameDefaults, VenueOption } from "@/lib/types";
import { cleanLabels, type GameLabels } from "@/lib/labels";

export default async function NewMatchPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const uid = user!.id;

  // Premium gate only while the premium flag is on (guests are sent to /login
  // by the middleware).
  if (!(await canPostGames(uid))) redirect("/wallet");

  const [{ data: seeded }, { data: mineVenues }, { data: last }] = await Promise.all([
    supabase.from("locations").select("id, name, type, neighborhood").eq("is_seeded", true)
      .order("name", { ascending: true }).returns<VenueOption[]>(),
    // Saved venues: the fields this organiser has added before.
    supabase.from("locations").select("id, name, type, neighborhood").eq("created_by_id", uid)
      .order("created_at", { ascending: false }).returns<VenueOption[]>(),
    supabase.from("matches")
      .select("id, location_id, kickoff_at, duration_min, max_players, price_per_player_zar, join_mode, title, skill_tag, group_tag, over_30")
      .eq("organizer_id", uid).neq("status", "cancelled")
      .order("created_at", { ascending: false }).limit(1)
      .maybeSingle<{ id: string; location_id: string; kickoff_at: string; duration_min: number; max_players: number;
        price_per_player_zar: number; join_mode: JoinMode; title: string | null } & GameLabels>(),
  ]);

  // One entry per saved field name (older duplicates hidden).
  const seen = new Set<string>();
  const saved = (mineVenues ?? []).filter((v) => {
    const k = v.name.trim().toLowerCase();
    return seen.has(k) ? false : (seen.add(k), true);
  });

  let defaults: LastGameDefaults | null = null;
  if (last) {
    const { data: pay } = await supabase.from("match_payment_info").select("details")
      .eq("match_id", last.id).maybeSingle<{ details: string }>();
    defaults = {
      locationId: last.location_id,
      kickoffAtIso: last.kickoff_at,
      durationMin: last.duration_min,
      maxPlayers: last.max_players,
      pricePerPlayerZar: last.price_per_player_zar,
      joinMode: last.join_mode,
      title: last.title,
      paymentDetails: pay?.details ?? null,
      labels: cleanLabels(last),
    };
  }

  return (
    <>
      <h1 className="mb-6 text-2xl font-black tracking-tight">Post a game</h1>
      <MatchCreateForm venues={seeded ?? []} savedVenues={saved} defaults={defaults} />
    </>
  );
}
