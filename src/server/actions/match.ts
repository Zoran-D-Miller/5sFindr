"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isPremium } from "@/lib/entitlements";
import { randomSlug } from "@/lib/slug";
import type { CreateMatchInput, Position, VenueType } from "@/lib/types";

const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, Math.round(Number.isFinite(n) ? n : lo)));

export type CreateMatchResult = { error?: string };

export async function createMatch(input: CreateMatchInput): Promise<CreateMatchResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // Premium gate (RLS also enforces this; we fail fast with a clear message).
  if (!(await isPremium(user.id))) return { error: "Go Premium to create matches." };

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
    if (!name) return { error: "Name your community field." };
    // No coordinates (no map SDK) — attendance falls back to the 4-digit code.
    const { data: loc, error: locErr } = await supabase
      .from("locations")
      .insert({
        name,
        type: "open_area",
        neighborhood: input.customNeighborhood?.trim() || null,
        latitude: null,
        longitude: null,
        is_seeded: false,
        created_by_id: user.id,
      })
      .select("id")
      .single();
    if (locErr || !loc) return { error: locErr?.message ?? "Could not save the venue." };
    locationId = loc.id;
    venueType = "open_area";
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

  // ── Build the row ────────────────────────────────────────────────────
  const instant = input.joinMode === "instant";
  const requiredPositions: Position[] | null =
    instant && input.requiredPositions?.length ? input.requiredPositions : null;

  const row = {
    organizer_id: user.id,
    location_id: locationId,
    title: input.title?.trim() || null,
    venue_type: venueType,
    kickoff_at: kickoff.toISOString(),
    duration_min: duration,
    ends_at: new Date(kickoff.getTime() + duration * 60_000).toISOString(),
    max_players: maxPlayers,
    price_per_player_zar: price,
    join_mode: instant ? "instant" : "manual",
    min_skill_level: instant ? clamp(input.minSkillLevel ?? 1, 1, 5) : null,
    required_positions: requiredPositions,
    min_reliability_score: instant ? clamp(input.minReliabilityScore ?? 0, 0, 100) : null,
    status: "open" as const,
  };

  // Insert with a fresh slug, retrying only on a unique-violation (23505).
  let created = false;
  for (let attempt = 0; attempt < 4; attempt++) {
    const { error } = await supabase
      .from("matches")
      .insert({ ...row, share_slug: randomSlug() });
    if (!error) {
      created = true;
      break;
    }
    if (error.code !== "23505") return { error: error.message };
  }
  if (!created) return { error: "Could not create the match — please try again." };

  // Land them on their Organizer dashboard with the new match showing.
  cookies().set("view", "organizer", { path: "/", maxAge: 31_536_000, sameSite: "lax" });
  revalidatePath("/feed");
  redirect("/feed");
}
