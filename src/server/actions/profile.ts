"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ProfileDraft } from "@/lib/types";

const POSITIONS = ["GK", "DEF", "MID", "FWD", "ANY"] as const;

export type SaveProfileResult = { ok: true } | { ok: false; error: string };

/**
 * Persist the editable slice of the signed-in user's profile.
 * RLS ("owner updates own profile") is the security boundary; we still
 * sanitize here so bad client input can't reach the row.
 */
export async function updateProfile(draft: ProfileDraft): Promise<SaveProfileResult> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const name = draft.name?.trim();
  if (!name) return { ok: false, error: "Name is required." };
  if (name.length > 50) return { ok: false, error: "Name is too long." };

  const skill = Math.min(5, Math.max(1, Math.round(draft.skill_level)));
  const positions = (draft.preferred_positions ?? []).filter((p) =>
    POSITIONS.includes(p as (typeof POSITIONS)[number]),
  );

  const bio = draft.bio?.trim() || null;
  if (bio && bio.length > 280) return { ok: false, error: "Bio is too long (280 max)." };

  const { error } = await supabase
    .from("profiles")
    .update({
      name,
      bio,
      avatar_url: draft.avatar_url?.trim() || null,
      neighborhood: draft.neighborhood?.trim() || null,
      skill_level: skill,
      preferred_positions: positions.length ? positions : ["ANY"],
      weekly_availability: draft.weekly_availability ?? null,
      instagram_url: draft.instagram_url?.trim() || null,
      tiktok_url: draft.tiktok_url?.trim() || null,
    })
    .eq("id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/profile/edit");
  return { ok: true };
}
