"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PRELAUNCH } from "@/lib/flags";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://5sfindr.com";

function safeNext(next: FormDataEntryValue | null): string {
  const n = typeof next === "string" ? next : "";
  // only allow same-site relative paths
  return n.startsWith("/") && !n.startsWith("//") ? n : "/profile/edit";
}

// supabase-js returns "fetch failed" when it can't reach the Supabase URL, and
// a missing env throws our requireEnv message. Both are config issues, not user
// errors — translate them into something actionable and log the real cause.
function authErrorMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  console.error("[5sFindr] auth action failed:", raw);
  if (raw.includes("fetch failed") || raw.toLowerCase().includes("network")) {
    return "Couldn’t reach the server. The site may be misconfigured — try again shortly.";
  }
  if (raw.includes("Missing env var")) {
    return "Server isn’t configured yet. Please try again later.";
  }
  return raw;
}

export async function signIn(
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Email and password are required." };

  try {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
  } catch (e) {
    return { error: authErrorMessage(e) };
  }

  redirect(safeNext(formData.get("next"))); // outside try: redirect() throws by design
}

export async function signUp(
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const ref = String(formData.get("ref") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const next = formData.get("next");

  if (!name) return { error: "What should we call you?" };
  if (!email || !password) return { error: "Email and password are required." };
  if (password.length < 6) return { error: "Password must be at least 6 characters." };
  // Mandatory mobile number (no OTP — just captured). SA numbers are ~10 digits.
  if (!phone) return { error: "Mobile number is required." };
  if (phone.replace(/\D/g, "").length < 9) return { error: "Enter a valid mobile number." };

  // name + referral_code go into raw_user_meta_data — the handle_new_user()
  // trigger reads these the instant the auth.users row is inserted, then
  // creates the profile, grants 1 free token, starts the 30-day trial, and
  // (if ref is valid) awards the referrer +7 days. All in one transaction.
  try {
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, phone_number: phone, referral_code: ref || null },
      },
    });
    if (error) return { error: error.message };
  } catch (e) {
    return { error: authErrorMessage(e) };
  }

  // Confirmations are disabled, so the session is already set. If they came
  // from a match invite (?next=/matches/…) send them there to claim the spot;
  // otherwise drop the brand-new baller onto their profile.
  redirect(safeNext(next));
}

// Email magic link (passwordless). While PRELAUNCH is on it only signs in
// existing accounts, so the waitlist gate holds.
export async function sendMagicLink(
  _prev: { error?: string; sent?: boolean },
  formData: FormData,
): Promise<{ error?: string; sent?: boolean }> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email." };
  const next = safeNext(formData.get("next"));
  try {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: !PRELAUNCH,
        emailRedirectTo: `${SITE_URL}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      console.error("[5sFindr] magic link failed:", error.message);
      // Don't reveal whether an account exists.
      if (!error.message.toLowerCase().includes("signups not allowed")) {
        return { error: "Couldn’t send the link. Try again shortly." };
      }
    }
  } catch (e) {
    return { error: authErrorMessage(e) };
  }
  return { sent: true };
}

export async function signOut(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/");
}
