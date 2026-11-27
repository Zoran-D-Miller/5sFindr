"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyRpcError } from "@/lib/rpcErrors";

type Result = { ok: true } | { ok: false; error: string };

export async function followUser(targetId: string): Promise<Result> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please log in." };
  if (user.id === targetId) return { ok: false, error: "You can’t follow yourself." };

  const { error } = await supabase
    .from("follows")
    .insert({ follower_id: user.id, following_id: targetId });
  // ignore duplicate (already following)
  if (error && error.code !== "23505") return { ok: false, error: error.message };

  revalidatePath("/leaderboard");
  revalidatePath("/profile/edit");
  return { ok: true };
}

export async function unfollowUser(targetId: string): Promise<Result> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please log in." };

  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", user.id)
    .eq("following_id", targetId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/leaderboard");
  revalidatePath("/profile/edit");
  return { ok: true };
}

// ── S6: regulars, "first game in Cape Town", alert emails ───────────────

/** Add / remove a regular. The DB only allows people you've played a game with. */
export async function setRegular(targetId: string, on: boolean): Promise<Result> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please log in." };

  const { error } = await supabase.rpc("set_regular", { p_user_id: targetId, p_on: on });
  if (error) return { ok: false, error: friendlyRpcError(error.message) };
  revalidatePath("/profile/edit");
  return { ok: true };
}

/** Tick / untick "first game in Cape Town" on your seat for a game. */
export async function setFirstGame(matchId: string, on: boolean): Promise<Result> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please log in." };

  const { error } = await supabase.rpc("set_first_game_ct", { p_match_id: matchId, p_on: on });
  if (error) return { ok: false, error: friendlyRpcError(error.message) };
  revalidatePath(`/matches/${matchId}`);
  return { ok: true };
}

/** "Email me when my regulars join a game" on / off. */
export async function setRegularsEmail(on: boolean): Promise<Result> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please log in." };

  const { error } = await supabase
    .from("user_settings")
    .upsert({ user_id: user.id, regulars_email: on, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) return { ok: false, error: "Could not save that." };
  revalidatePath("/profile/edit");
  return { ok: true };
}
