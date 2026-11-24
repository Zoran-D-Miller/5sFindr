import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PasswordlessOptions } from "@/components/auth/PasswordlessOptions";

export const metadata = {
  title: "Run a 5-a-side? Post it free · 5sFindr",
  description: "Your group, your slot, free. Post your game, share one link to WhatsApp, never cancel for being 2 short.",
};

// "I run a game" path: open under the pre-launch gate so organisers can make
// an account (Google or email link) and post a game straight away.
export default async function OrganisePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user && !user.is_anonymous) redirect("/matches/new");

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <Link href="/" className="mb-8 text-center text-xl font-extrabold tracking-tight">
        5s<span className="text-pitch">Findr</span>
      </Link>

      <h1 className="text-2xl font-black tracking-tight">Run a game? Post it here, free.</h1>
      <ul className="mt-3 space-y-1.5 text-sm text-white/60">
        <li>· Keep your booking and your group. Post the game here too.</li>
        <li>· One link for WhatsApp: players tap “I’m in”, no app needed.</li>
        <li>· The list fills itself. Tick who’s paid and who showed up.</li>
      </ul>

      <PasswordlessOptions next="/matches/new" allowGoogle intent="organise" passwordHint={false} />

      <p className="mt-6 text-center text-sm text-white/50">
        Already have an account?{" "}
        <Link href="/login?next=/matches/new" className="font-semibold text-pitch">
          Log in
        </Link>
      </p>
    </main>
  );
}
