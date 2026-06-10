"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Postgres raises exceptions like `NO_TOKEN`; map the code to a player-facing message.
const MESSAGES: Record<string, string> = {
  NOT_AUTHED: "Please log in again.",
  NOT_PREMIUM: "Go Premium to join matches.",
  NO_MATCH: "This match no longer exists.",
  OWN_MATCH: "You can’t join your own match.",
  NOT_OPEN: "This match isn’t open for joining.",
  STARTED: "This match has already kicked off.",
  ALREADY_IN: "You’re already in this match.",
  NO_TOKEN: "You need an available token. Top up in your wallet.",
  NOT_IN: "You’re not in this match.",
  NOT_ORGANIZER: "Only the organizer can do that.",
  NO_REQUEST: "That request is no longer pending.",
  MATCH_FULL: "The squad is already full.",
};

function friendly(message: string | undefined): string {
  const code = message?.match(/[A-Z_]{4,}/)?.[0];
  return (code && MESSAGES[code]) || "Something went wrong — please try again.";
}

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
