"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
