import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/server/actions/auth";

// App shell. Browsing (feed, match details, ranks) is PUBLIC — anonymous
// visitors get a "Log in" CTA instead of being bounced. Private surfaces
// (/wallet, /profile, /matches/new) are still gated by the middleware, and
// mutative actions are guarded in-page + by RLS.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="mx-auto min-h-dvh max-w-md px-5 pb-24 pt-8 sm:max-w-2xl">
      <header className="mb-6 flex items-center justify-between">
        <Link href="/feed" className="text-heading font-extrabold tracking-tight">
          5s<span className="text-pitch">Findr</span>
        </Link>
        {user ? (
          <form action={signOut}>
            <button
              type="submit"
              className="text-body font-medium text-white/40 transition hover:text-white/80"
            >
              Sign out
            </button>
          </form>
        ) : (
          <Link
            href="/signup"
            className="rounded-full bg-pitch px-4 py-1.5 text-body font-bold text-ink-900 shadow-glow transition hover:bg-pitch-dark"
          >
            Join free
          </Link>
        )}
      </header>

      {children}

      {/* Bottom nav — thumb zone */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-ink-700 bg-ink-900/90 backdrop-blur">
        <div className="mx-auto flex max-w-md justify-around py-2 sm:max-w-2xl">
          {[
            ["Feed", "/feed"],
            ["Ranks", "/leaderboard"],
            ["Wallet", "/wallet"],
            ["Profile", "/profile/edit"],
          ].map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className="px-4 py-1.5 text-body font-medium text-white/60 transition hover:text-pitch"
            >
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
