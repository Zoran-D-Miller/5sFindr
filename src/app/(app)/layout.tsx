import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/server/actions/auth";

// Authed shell for the in-app routes. The full Player ⇄ Organizer view
// switcher lands in Phase 3; for now this guards auth and gives bottom nav.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto min-h-dvh max-w-md px-5 pb-24 pt-8 sm:max-w-2xl">
      <header className="mb-6 flex items-center justify-between">
        <Link href="/feed" className="text-lg font-extrabold tracking-tight">
          5s<span className="text-pitch">Findr</span>
        </Link>
        <form action={signOut}>
          <button
            type="submit"
            className="text-sm font-medium text-white/40 transition hover:text-white/80"
          >
            Sign out
          </button>
        </form>
      </header>

      {children}

      {/* Bottom nav — thumb zone */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-ink-700 bg-ink-900/90 backdrop-blur">
        <div className="mx-auto flex max-w-md justify-around py-2 sm:max-w-2xl">
          {[
            ["Feed", "/feed"],
            ["Wallet", "/wallet"],
            ["Profile", "/profile/edit"],
          ].map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className="px-4 py-1.5 text-sm font-medium text-white/60 transition hover:text-pitch"
            >
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
