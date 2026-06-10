import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { JoinMode, MatchStatus, VenueType } from "@/lib/types";

interface InviteMatch {
  id: string;
  title: string | null;
  venue_type: VenueType;
  kickoff_at: string;
  max_players: number;
  join_mode: JoinMode;
  status: MatchStatus;
  location: { name: string; neighborhood: string | null } | null;
  organizer: { name: string; referral_code: string } | null;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-ZA", {
    weekday: "long", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

// Public viral landing — anyone with the link can see the match and claim a
// spot. RLS exposes only live matches to anon, which is exactly what we want.
export default async function MatchInvitePage({ params }: { params: { slug: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: match } = await supabase
    .from("matches")
    .select(
      "id, title, venue_type, kickoff_at, max_players, join_mode, status, location:locations(name, neighborhood), organizer:profiles!organizer_id(name, referral_code)",
    )
    .eq("share_slug", params.slug)
    .maybeSingle<InviteMatch>();

  if (!match) notFound();

  const open = match.status === "open";
  const ref = match.organizer?.referral_code ?? "";
  // Logged-in users go straight to the lobby; newcomers sign up (carrying the
  // organizer's referral code so the organizer earns a free week) and are
  // routed back to the match to claim their spot.
  const claimHref = user
    ? `/matches/${match.id}`
    : `/signup?ref=${encodeURIComponent(ref)}&next=${encodeURIComponent(`/matches/${match.id}`)}`;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 py-10">
      <header className="text-center">
        <Link href="/" className="text-lg font-extrabold tracking-tight">
          5s<span className="text-pitch">Findr</span>
        </Link>
      </header>

      <div className="mt-10 rounded-3xl border border-pitch/30 bg-gradient-to-b from-pitch/10 to-transparent p-6">
        <span className="inline-flex items-center gap-2 rounded-full border border-pitch/30 bg-pitch/10 px-3 py-1 text-xs font-semibold text-pitch">
          ⚽ 5-a-side invite
        </span>
        <h1 className="mt-4 text-2xl font-black leading-tight">
          {match.organizer?.name ?? "An organizer"} needs players
        </h1>
        <p className="mt-1 text-white/60">
          {match.title || `${match.max_players}-a-side`} at{" "}
          <span className="font-semibold text-white">{match.location?.name}</span>
          {match.location?.neighborhood ? ` · ${match.location.neighborhood}` : ""}
        </p>

        <dl className="mt-5 space-y-2 text-sm">
          <div className="flex justify-between border-t border-ink-700 pt-2">
            <dt className="text-white/40">Kickoff</dt>
            <dd className="font-semibold">{fmt(match.kickoff_at)}</dd>
          </div>
          <div className="flex justify-between border-t border-ink-700 pt-2">
            <dt className="text-white/40">Venue</dt>
            <dd className="font-semibold">
              {match.venue_type === "official_court" ? "Official court" : "Open field"}
            </dd>
          </div>
          <div className="flex justify-between border-t border-ink-700 pt-2">
            <dt className="text-white/40">Joining</dt>
            <dd className="font-semibold capitalize">
              {match.join_mode === "instant" ? "Instant booking" : "Request to join"}
            </dd>
          </div>
        </dl>
      </div>

      {open ? (
        <Link
          href={claimHref}
          className="mt-6 rounded-2xl bg-pitch py-4 text-center text-base font-bold text-ink-900 shadow-glow transition hover:bg-pitch-dark"
        >
          {user ? "Claim your spot" : "Claim your spot — first month free"}
        </Link>
      ) : (
        <p className="mt-6 rounded-2xl border border-ink-700 bg-ink-800/60 py-4 text-center text-sm text-white/50">
          This match is {match.status === "full" ? "full" : "closed"} — but there are more games waiting.
        </p>
      )}

      {!user && (
        <p className="mt-4 text-center text-xs text-white/40">
          New to 5sFindr? You’ll get a 30-day Premium trial and a free token to join your first game.
        </p>
      )}

      <Link
        href={user ? "/feed" : "/login"}
        className="mt-6 text-center text-sm font-medium text-white/50 transition hover:text-white"
      >
        {user ? "Browse all games" : "Already have an account? Log in"}
      </Link>
    </main>
  );
}
