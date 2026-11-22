import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Lands Google sign-in / identity linking (?code=) and email magic links
// (?code= with PKCE, or ?token_hash=&type= from a custom email template).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const raw = searchParams.get("next") ?? "/feed";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/feed";

  const supabase = createClient();
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  let error: string | null = searchParams.get("error_description");
  if (!error && code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code).then((r) => ({ error: r.error?.message ?? null })));
  } else if (!error && tokenHash && type) {
    ({ error } = await supabase.auth
      .verifyOtp({ token_hash: tokenHash, type })
      .then((r) => ({ error: r.error?.message ?? null })));
  }

  if (error) {
    console.error("[auth/callback]", error);
    const dest = new URL("/login", origin);
    dest.searchParams.set("next", next);
    dest.searchParams.set("error", "That sign-in link didn’t work. Try again.");
    return NextResponse.redirect(dest);
  }
  return NextResponse.redirect(new URL(next, origin));
}
