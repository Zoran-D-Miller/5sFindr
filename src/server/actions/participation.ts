"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyRpcError as friendly } from "@/lib/rpcErrors";

function refresh(matchId: string) {
  revalidatePath(`/matches/${matchId}`);
  revalidatePath("/feed");
  revalidatePath("/wallet");
}

export type JoinResult =
  | { ok: true; status: "accepted" | "requested" }
  | { ok: false; error: string };

export async function joinMatch(matchId: string): Promise<JoinResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("join_match", { p_match_id: matchId });
  if (error) return { ok: false, error: friendly(error.message) };
  refresh(matchId);
  return { ok: true, status: data as "accepted" | "requested" };
}

export type CancelResult =
  | { ok: true; outcome: "refunded" | "forfeited" }
  | { ok: false; error: string };

export async function cancelParticipation(matchId: string): Promise<CancelResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("cancel_participation", { p_match_id: matchId });
  if (error) return { ok: false, error: friendly(error.message) };
  refresh(matchId);
  return { ok: true, outcome: data as "refunded" | "forfeited" };
}

export async function respondToRequest(
  matchId: string,
  userId: string,
  accept: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient();
  const { error } = await supabase.rpc("manager_respond", {
    p_match_id: matchId,
    p_user_id: userId,
    p_accept: accept,
  });
  if (error) return { ok: false, error: friendly(error.message) };
  refresh(matchId);
  return { ok: true };
}

export async function lockMatch(
  matchId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient();
  const { error } = await supabase.rpc("lock_match", { p_match_id: matchId });
  if (error) return { ok: false, error: friendly(error.message) };
  refresh(matchId);
  return { ok: true };
}

// Organizer cancels the match (>24h to kickoff) — refunds all RSVP'd tokens.
export async function cancelMatch(
  matchId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient();
  const { error } = await supabase.rpc("cancel_match", { p_match_id: matchId });
  if (error) return { ok: false, error: friendly(error.message) };
  refresh(matchId);
  return { ok: true };
}

// S4 "Still coming?": the player confirms their spot from the game page.
export async function confirmSpot(
  matchId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient();
  const { error } = await supabase.rpc("confirm_spot", { p_match_id: matchId });
  if (error) return { ok: false, error: friendly(error.message) };
  refresh(matchId);
  return { ok: true };
}

export type TokenConfirm = "confirmed" | "released" | "gone";

// From the email button (/m/<slug>?c=<token>). Works signed out: the token
// is the secret. Runs from the page's client component, so link scanners
// that only fetch the URL don't confirm anyone.
export async function confirmSpotByToken(token: string): Promise<TokenConfirm> {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return "gone";
  const supabase = createClient();
  const { data, error } = await supabase.rpc("confirm_spot_by_token", { p_token: token });
  if (error || !data) return "gone";
  return ((data as { result?: TokenConfirm }).result ?? "gone") as TokenConfirm;
}
