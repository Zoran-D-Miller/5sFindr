import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { PRELAUNCH } from "@/lib/flags";

type CookieToSet = { name: string; value: string; options: CookieOptions };

// Routes that require a session — only private/mutative surfaces. Browsing
// (/feed, /matches/[id], /leaderboard, /m/* invites) is public; the auth wall
// triggers on Wallet, Profile, and Post-a-Match. Join-a-match is guarded
// in-page (login CTA) and by RLS.
const PROTECTED = ["/wallet", "/profile", "/matches/new"];
const AUTH_PAGES = ["/login", "/signup"];

// Pre-launch, signed-out visitors only reach these (plus / and files such as
// robots.txt and the service worker's scripts); the rest goes to the waitlist.
// /login stays open so existing accounts can still sign in and use the app.
const PRELAUNCH_OPEN = ["/privacy", "/login", "/offline", "/api/"];
const FILE_PATH = /\.[a-z0-9]+$/i;

// Refreshes the Supabase session cookie on every request AND enforces
// route protection in one pass.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Before Supabase env is configured, don't crash the whole site — let the
  // public pages (landing, login, signup) render. Protected pages still gate
  // themselves server-side once env is present.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return response;

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // IMPORTANT: getUser() refreshes the token; do not run logic between this
  // call and returning `response`, or the refreshed cookie can be lost.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  if (
    PRELAUNCH &&
    !user &&
    path !== "/" &&
    !FILE_PATH.test(path) &&
    !PRELAUNCH_OPEN.some((p) => path.startsWith(p))
  ) {
    const dest = request.nextUrl.clone();
    dest.pathname = "/";
    return NextResponse.redirect(dest);
  }

  if (!user && PROTECTED.some((p) => path.startsWith(p))) {
    const dest = request.nextUrl.clone();
    dest.pathname = "/login";
    dest.searchParams.set("next", path);
    return NextResponse.redirect(dest);
  }

  if (user && AUTH_PAGES.some((p) => path.startsWith(p))) {
    const dest = request.nextUrl.clone();
    dest.pathname = "/profile/edit";
    return NextResponse.redirect(dest);
  }

  return response;
}
