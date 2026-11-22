"use client";

import { useFormState, useFormStatus } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { sendMagicLink } from "@/server/actions/auth";

function Send() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-outline shrink-0 px-4">
      {pending ? "…" : "Send"}
    </button>
  );
}

// Continue with Google + email magic link. Google is only offered when new
// accounts are allowed (OAuth can't be limited to existing users).
export function PasswordlessOptions({ next, allowGoogle }: { next?: string; allowGoogle: boolean }) {
  const [state, action] = useFormState(sendMagicLink, {});
  const dest = next && next.startsWith("/") && !next.startsWith("//") ? next : "/feed";

  async function google() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(dest)}` },
    });
  }

  return (
    <div className="mt-7 space-y-3">
      {allowGoogle && (
        <button type="button" onClick={google} className="btn-primary w-full">
          Continue with Google
        </button>
      )}
      {state.sent ? (
        <p className="rounded-2xl border border-pitch/30 bg-pitch/10 p-3 text-center text-sm text-pitch">
          If that email has a profile, a sign-in link is on its way. Check your inbox.
        </p>
      ) : (
        <form action={action} className="flex gap-2">
          <input type="hidden" name="next" value={dest} />
          <input
            name="email"
            type="email"
            required
            placeholder="Email me a sign-in link"
            autoComplete="email"
            inputMode="email"
            className="input-field flex-1"
          />
          <Send />
        </form>
      )}
      {state.error && <p className="text-sm text-red-400">{state.error}</p>}
      <p className="pt-2 text-center text-xs uppercase tracking-wide text-white/30">or with your password</p>
    </div>
  );
}
