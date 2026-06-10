"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyRpcError as friendly } from "@/lib/rpcErrors";

function refresh(matchId: string) {
  revalidatePath(`/matches/${matchId}`);
  revalidatePath("/feed");
  revalidatePath("/wallet");
  revalidatePath("/leaderboard");
}

// Organizer reveals (and lazily generates) the 4-digit code to share verbally.
export async function ensureMatchCode(
  matchId: string,
): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("ensure_match_code", { p_match_id: matchId });
  if (error) return { ok: false, error: friendly(error.message) };
  return { ok: true, code: data as string };
}

export type CheckInResult =
  | { ok: true; status: "verified" | "already" }
  | { ok: false; error: string };

// Primary layer — GPS. Server re-validates the 200m distance; the client only
// supplies the coordinates from navigator.geolocation.
export async function checkInGps(
  matchId: string,
  lat: number,
  lng: number,
): Promise<CheckInResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("check_in", {
    p_match_id: matchId,
    p_method: "gps",
    p_lat: lat,
    p_lng: lng,
    p_code: null,
  });
  if (error) return { ok: false, error: friendly(error.message) };
  refresh(matchId);
  return { ok: true, status: data as "verified" | "already" };
}

// Secondary layer — the 4-digit code, entered retroactively on Wi-Fi.
export async function checkInCode(matchId: string, code: string): Promise<CheckInResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("check_in", {
    p_match_id: matchId,
    p_method: "match_code",
    p_lat: null,
    p_lng: null,
    p_code: code.trim(),
  });
  if (error) return { ok: false, error: friendly(error.message) };
  refresh(matchId);
  return { ok: true, status: data as "verified" | "already" };
}

// Organizer ends the match now → triggers settlement (returns/forfeits tokens).
export async function settleMatch(
  matchId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient();
  const { error } = await supabase.rpc("settle_match", { p_match_id: matchId });
  if (error) return { ok: false, error: friendly(error.message) };
  refresh(matchId);
  return { ok: true };
}

// Post-match MotM vote.
export async function voteMotm(
  matchId: string,
  voteeId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient();
  const { error } = await supabase.rpc("vote_motm", {
    p_match_id: matchId,
    p_votee_id: voteeId,
  });
  if (error) return { ok: false, error: friendly(error.message) };
  refresh(matchId);
  return { ok: true };
}
