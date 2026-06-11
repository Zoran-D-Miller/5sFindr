import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

type CookieToSet = { name: string; value: string; options: CookieOptions };

// Read a required env var, failing loudly (with a clear server log) instead of
// passing `undefined` to the client — which surfaces later as a cryptic
// "fetch failed". A common cause is forgetting to REDEPLOY after setting envs.
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[5sFindr] Missing env var ${name}. Set it in Vercel (Production) and REDEPLOY.`,
    );
  }
  return value;
}

// Server Supabase client bound to the user's session cookies. Subject to RLS.
export function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // called from a Server Component — safe to ignore, middleware refreshes the session
          }
        },
      },
    },
  );
}

// Trusted, service-role client for economy mutations (token commit/return/forfeit,
// attendance settlement, Paystack webhooks). BYPASSES RLS — server-only, never ship to client.
export function createServiceClient() {
  return createServerClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { cookies: { getAll: () => [], setAll: () => {} } },
  );
}
