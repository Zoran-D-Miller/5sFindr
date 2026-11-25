"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canPostGames } from "@/lib/entitlements";
import { randomSlug } from "@/lib/slug";
import type { CreateMatchInput, Position, VenueType } from "@/lib/types";
import { cleanLabels, type GameLabels } from "@/lib/labels";

const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, Math.round(Number.isFinite(n) ? n : lo)));

export type CreateMatchResult = { error?: string };

export async function createMatch(input: CreateMatchInput): Promise<CreateMatchResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };
  if (user.is_anonymous) return { error: "Keep your profile (Google or email) to post a game." };

  // Premium gate only while the premium flag is on.
  if (!(await canPostGames(user.id))) return { error: "Go Premium to create matches." };

  // Kickoff must be a real, future time.
  const kickoff = new Date(input.kickoffAtIso);
  if (Number.isNaN(kickoff.getTime())) return { error: "Pick a valid kickoff time." };
  if (kickoff.getTime() < Date.now() + 5 * 60_000)
    return { error: "Kickoff must be at least a few minutes from now." };

  const duration = clamp(input.durationMin, 30, 180);
  const maxPlayers = clamp(input.maxPlayers, 4, 22);
  const price = clamp(input.pricePerPlayerZar || 0, 0, 1000);

  // ── Resolve the venue ────────────────────────────────────────────────
  let locationId: string;
  let venueType: VenueType;

  if (input.venueMode === "custom") {
    const name = input.customVenueName?.trim();
    if (!name) return { error: "Name the field or court." };
    const neighborhood = input.customNeighborhood?.trim() || null;
    // Reuse this organiser's saved field of the same name instead of a duplicate.
    const { data: existing } = await supabase
      .from("locations")
      .select("id, type")
      .eq("created_by_id", user.id)
      .ilike("name", name)
      .limit(1)
      .maybeSingle<{ id: string; type: VenueType }>();
    if (existing) {
      locationId = existing.id;
      venueType = existing.type;
    } else {
      venueType = price > 0 ? "official_court" : "open_area";
      const { data: loc, error: locErr } = await supabase
        .from("locations")
        .insert({
          name,
          type: venueType,
          neighborhood,
          latitude: null,
          longitude: null,
          is_seeded: false,
          created_by_id: user.id,
        })
        .select("id")
        .single();
      if (locErr || !loc) return { error: locErr?.message ?? "Could not save the venue." };
      locationId = loc.id;
    }
  } else {
    if (!input.locationId) return { error: "Choose a venue." };
    const { data: loc } = await supabase
      .from("locations")
      .select("id, type")
      .eq("id", input.locationId)
      .single<{ id: string; type: VenueType }>();
    if (!loc) return { error: "That venue is no longer available." };
    locationId = loc.id;
    venueType = loc.type;
  }

  // ── Build the rows (one, or one per week) ────────────────────────────
  const instant = input.joinMode === "instant";
  const requiredPositions: Position[] | null =
    instant && input.requiredPositions?.length ? input.requiredPositions : null;
  const weeks = clamp(input.repeatWeeks ?? 1, 1, 8);
  const seriesId = weeks > 1 ? crypto.randomUUID() : null;
  const WEEK = 7 * 24 * 3_600_000;

  const base = {
    organizer_id: user.id,
    location_id: locationId,
    title: input.title?.trim() || null,
    venue_type: venueType,
    duration_min: duration,
    max_players: maxPlayers,
    price_per_player_zar: price,
    join_mode: instant ? "instant" : "manual",
    min_skill_level: instant ? clamp(input.minSkillLevel ?? 1, 1, 5) : null,
    required_positions: requiredPositions,
    min_reliability_score: instant ? clamp(input.minReliabilityScore ?? 0, 0, 100) : null,
    status: "open" as const,
    series_id: seriesId,
    ...cleanLabels(input.labels),
  };

  const createdIds: string[] = [];
  for (let w = 0; w < weeks; w++) {
    const start = new Date(kickoff.getTime() + w * WEEK);
    const row = {
      ...base,
      kickoff_at: start.toISOString(),
      ends_at: new Date(start.getTime() + duration * 60_000).toISOString(),
    };
    // Insert with a fresh slug, retrying only on a unique-violation (23505).
    let id: string | null = null;
    for (let attempt = 0; attempt < 4 && !id; attempt++) {
      const { data, error } = await supabase
        .from("matches")
        .insert({ ...row, share_slug: randomSlug() })
        .select("id")
        .single<{ id: string }>();
      if (data) id = data.id;
      else if (error?.code !== "23505") return { error: error?.message ?? "Could not create the game." };
    }
    if (!id) return { error: "Could not create the game — please try again." };
    createdIds.push(id);
  }

  // Paid courts: payment details for each game (only the list can read them).
  const details = input.paymentDetails?.trim().slice(0, 300);
  if (price > 0 && details) {
    const { error } = await supabase
      .from("match_payment_info")
      .insert(createdIds.map((match_id) => ({ match_id, details })));
    if (error) console.error("[createMatch] payment details not saved:", error.message);
  }

  revalidatePath("/feed");
  // Straight to the first game, where the WhatsApp share is. ?posted=1 → Umami.
  redirect(`/matches/${createdIds[0]}?posted=1`);
}

/** Organiser changes a game's labels; `series` = also every later game in the same weekly series. */
export async function setMatchLabels(
  matchId: string,
  labels: Partial<GameLabels>,
  series: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: m } = await supabase
    .from("matches")
    .select("id, organizer_id, series_id, kickoff_at, status")
    .eq("id", matchId)
    .maybeSingle<{ id: string; organizer_id: string; series_id: string | null; kickoff_at: string; status: string }>();
  if (!m || m.organizer_id !== user.id) return { ok: false, error: "Only the organiser can change labels." };
  if (m.status === "completed" || m.status === "cancelled") return { ok: false, error: "This game is closed." };

  const clean = cleanLabels(labels);
  // RLS: "organizer updates match" (only your own games).
  let q = supabase.from("matches").update(clean).eq("organizer_id", user.id);
  q = series && m.series_id
    ? q.eq("series_id", m.series_id).gte("kickoff_at", m.kickoff_at).in("status", ["open", "full", "draft"])
    : q.eq("id", m.id);
  const { error } = await q;
  if (error) return { ok: false, error: "Could not save the labels." };

  revalidatePath(`/matches/${m.id}`);
  revalidatePath("/feed");
  return { ok: true };
}
