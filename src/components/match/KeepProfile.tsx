"use client";

import { useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { keepWithEmail } from "@/server/actions/guest";

// Shown to guests (anonymous sign-in): keep the profile and your regulars.
// Google links to the SAME account (Supabase linkIdentity), so games stay.
export function KeepProfile() {
  const path = usePathname() || "/feed";
  const [pending, start] = useTransition();
  const [showEmail, setShowEmail] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  async function google() {
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.linkIdentity({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(path)}` },
    });
    if (error) setError("Google sign-in isn’t available right now. Use your email instead.");
  }

  function email(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = String(new FormData(e.currentTarget).get("email") ?? "");
    setError("");
    start(async () => {
      const res = await keepWithEmail(value, path);
      if (res.ok) setMsg("Check your inbox and tap the link to keep your profile.");
      else setError(res.error ?? "Something went wrong.");
    });
  }

  return (
    <section className="space-y-3 rounded-2xl border border-ink-700 bg-ink-800/60 p-4">
      <div>
        <p className="font-bold">Keep your profile and your regulars?</p>
        <p className="mt-0.5 text-xs text-white/50">
          One tap. Your games come with you to any phone, and you get your Founding Member number.
        </p>
      </div>
      <button type="button" onClick={google} className="btn-primary w-full">
        Continue with Google
      </button>
      {msg ? (
        <p className="text-center text-sm text-pitch">{msg}</p>
      ) : showEmail ? (
        <form onSubmit={email} className="flex gap-2">
          <input name="email" type="email" required placeholder="Email" autoComplete="email" className="input-field flex-1" />
          <button type="submit" disabled={pending} className="btn-outline shrink-0 px-4">
            {pending ? "…" : "Send"}
          </button>
        </form>
      ) : (
        <button type="button" onClick={() => setShowEmail(true)} className="w-full text-center text-sm text-white/50 underline">
          Email me a link instead
        </button>
      )}
      {error && <p className="text-center text-sm text-red-400">{error}</p>}
    </section>
  );
}
