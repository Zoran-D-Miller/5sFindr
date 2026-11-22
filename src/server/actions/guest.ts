"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabase } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { friendlyRpcError as friendly } from "@/lib/rpcErrors";
import { toE164 } from "@/lib/phone";
import type { JoinResult } from "./participation";

// Bump when the consent wording in GuestJoin.tsx or /privacy changes.
const CONSENT_VERSION = "guest-join-2026-11";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://5sfindr.com";

/**
 * "I'm in" without an account: Supabase anonymous sign-in (session cookie stays
 * on the phone) → name + WhatsApp + POPIA consent → join_match.
 * captchaToken is the Cloudflare Turnstile token; Supabase verifies it when
 * Auth → Bot protection is on (the secret lives in Supabase, not here).
 */
export async function guestJoin(
  matchId: string,
  input: { name: string; phone: string; consent: boolean; captchaToken?: string },
): Promise<JoinResult> {
  const name = input.name.trim().replace(/\s+/g, " ");
  if (!name || name.length > 40) return { ok: false, error: "Add your first name." };
  const phone = toE164(input.phone);
  if (!phone) return { ok: false, error: "That WhatsApp number doesn’t look right." };
  if (!input.consent) return { ok: false, error: "Tick the box so the organiser can add you." };

  const supabase = createClient();
  let { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    const { data, error } = await supabase.auth.signInAnonymously({
      options: { captchaToken: input.captchaToken || undefined },
    });
    if (error || !data.session) {
      console.error("[guestJoin] anonymous sign-in failed:", error?.message);
      return { ok: false, error: "Couldn’t add you just now. Refresh the page and try again." };
    }
    session = data.session;
  }

  // Use the fresh access token explicitly (cookie writes from this request
  // aren't visible to reads in the same request).
  const db = createSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Members already have their details on file; only guests save them here.
  if (session.user.is_anonymous) {
    const saved = await db.rpc("save_guest_details", {
      p_name: name,
      p_phone: phone,
      p_consent_version: CONSENT_VERSION,
    });
    if (saved.error) return { ok: false, error: friendly(saved.error.message) };
  }

  const { data, error } = await db.rpc("join_match", { p_match_id: matchId });
  if (error) return { ok: false, error: friendly(error.message) };

  revalidatePath(`/matches/${matchId}`);
  return { ok: true, status: data as "accepted" | "requested" };
}

/**
 * Keep the profile with an email instead of Google: Supabase emails a link;
 * once it's clicked the guest account is permanent (same id, same games).
 */
export async function keepWithEmail(email: string, next: string): Promise<{ ok: boolean; error?: string }> {
  const clean = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return { ok: false, error: "Enter a valid email." };
  const path = next.startsWith("/") && !next.startsWith("//") ? next : "/feed";

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.is_anonymous) return { ok: false, error: "You already have a profile." };

  const { error } = await supabase.auth.updateUser(
    { email: clean },
    { emailRedirectTo: `${SITE_URL}/auth/callback?next=${encodeURIComponent(path)}` },
  );
  if (error) {
    console.error("[keepWithEmail]", error.message);
    return { ok: false, error: error.message.includes("already") ? "That email already has a profile. Log in with it instead." : "Couldn’t send the link. Try again shortly." };
  }
  return { ok: true };
}
