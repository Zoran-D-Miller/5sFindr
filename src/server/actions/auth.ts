"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function safeNext(next: FormDataEntryValue | null): string {
  const n = typeof next === "string" ? next : "";
  // only allow same-site relative paths
  return n.startsWith("/") && !n.startsWith("//") ? n : "/profile/edit";
}

export async function signIn(
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Email and password are required." };

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  redirect(safeNext(formData.get("next")));
}

export async function signUp(
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const ref = String(formData.get("ref") ?? "").trim();

  if (!name) return { error: "What should we call you?" };
  if (!email || !password) return { error: "Email and password are required." };
  if (password.length < 6) return { error: "Password must be at least 6 characters." };

  const supabase = createClient();

  // name + referral_code go into raw_user_meta_data — the handle_new_user()
  // trigger reads these the instant the auth.users row is inserted, then
  // creates the profile, grants 1 free token, starts the 30-day trial, and
  // (if ref is valid) awards the referrer +7 days. All in one transaction.
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name, referral_code: ref || null },
    },
  });
  if (error) return { error: error.message };

  // Confirmations are disabled, so the session is already set — drop the
  // brand-new baller straight onto their profile.
  redirect("/profile/edit");
}

export async function signOut(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/");
}
