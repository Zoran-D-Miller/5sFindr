import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadInvite, inviteWhen, spotsLabel } from "@/lib/invite";
import { Avatar } from "@/components/ui/Avatar";
import { PlayerActions } from "@/components/match/PlayerActions";
import { KeepProfile } from "@/components/match/KeepProfile";
import { StillComing } from "@/components/match/StillComing";
import { ConfirmFromEmail } from "@/components/match/ConfirmFromEmail";
import { FirstGameToggle } from "@/components/match/FirstGameToggle";
import { labelList } from "@/lib/labels";
import type { ParticipantStatus } from "@/lib/types";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const m = await loadInvite(params.slug);
  if (!m) return { title: "5sFindr" };
  const title = `${m.organizer?.name ?? "A game"} needs players · ${inviteWhen(m.kickoff_at)}`;
  const description = [
    m.location?.name,
    ...labelList(m),
    m.price_per_player_zar > 0 ? `R${m.price_per_player_zar} each` : "Free",
    spotsLabel(m),
    "Tap “I’m in”, no app needed.",
  ].filter(Boolean).join(" · ");
  // The image comes from ./opengraph-image.tsx (faces + spots left).
  return { title, description, openGraph: { title, description }, twitter: { card: "summary_large_image", title, description } };
}

// Public invite: anyone with the link sees the game and taps "I'm in"
// (guest join: first name + WhatsApp). Open under the pre-launch gate.
export default async function MatchInvitePage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { c?: string };
}) {
  const match = await loadInvite(params.slug);
  if (!match) notFound();

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const uid = user?.id ?? null;

  let myStatus: ParticipantStatus | null = null;
  let myConfirmed = false;
  let myReleased = false;
  let myFirstGame = false;
  let myGamesPlayed = 1;
  if (uid) {
    const [{ data }, { data: me }] = await Promise.all([
      supabase
        .from("match_players")
        .select("status, confirmed_at, released_at, first_game_ct")
        .eq("match_id", match.id)
        .eq("user_id", uid)
        .maybeSingle<{ status: ParticipantStatus; confirmed_at: string | null; released_at: string | null; first_game_ct: boolean }>(),
      supabase.from("profiles").select("games_played").eq("id", uid).maybeSingle<{ games_played: number }>(),
    ]);
    myStatus = data?.status ?? null;
    myConfirmed = !!data?.confirmed_at;
    myReleased = data?.status === "cancelled_early" && !!data?.released_at;
    myFirstGame = !!data?.first_game_ct;
    myGamesPlayed = me?.games_played ?? 1;
  }

  const isOrganizer = uid === match.organizer_id;
  // S4: "Still coming?" in the 24h before kickoff.
  const msToKickoff = new Date(match.kickoff_at).getTime() - Date.now();
  const askNow = !isOrganizer && myStatus === "accepted" && !myConfirmed &&
    msToKickoff > 0 && msToKickoff <= 24 * 3_600_000 && (match.status === "open" || match.status === "full");
  const inGame = myStatus === "requested" || myStatus === "accepted" || myStatus === "attended";
  const taken = match.players.length;
  const left = Math.max(0, match.max_players - taken);
  const faces = match.players.slice(0, 8);
  const labels = labelList(match);
  // S6: "First game in Cape Town?" for players who've never played a 5sFindr game.
  const canTagFirstGame = !isOrganizer && (myStatus === "requested" || myStatus === "accepted") &&
    msToKickoff > 0 && (match.status === "open" || match.status === "full") && myGamesPlayed === 0;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 py-10">
      <header className="text-center">
        <Link href="/" className="text-lg font-extrabold tracking-tight">
          5s<span className="text-pitch">Findr</span>
        </Link>
      </header>

      <div className="mt-8 rounded-3xl border border-pitch/30 bg-gradient-to-b from-pitch/10 to-transparent p-6">
        <span className="inline-flex items-center gap-2 rounded-full border border-pitch/30 bg-pitch/10 px-3 py-1 text-xs font-semibold text-pitch">
          ⚽ 5-a-side
        </span>
        <h1 className="mt-4 text-2xl font-black leading-tight">
          {match.organizer?.name ?? "An organiser"} needs players
        </h1>
        <p className="mt-1 text-white/60">
          {match.title ? `${match.title} · ` : ""}
          <span className="font-semibold text-white">{match.location?.name}</span>
          {match.location?.neighborhood ? ` · ${match.location.neighborhood}` : ""}
        </p>
        {labels.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {labels.map((l) => (
              <span key={l} className="rounded-full border border-pitch/40 px-2.5 py-0.5 text-xs font-semibold text-pitch">{l}</span>
            ))}
          </div>
        )}

        <dl className="mt-5 space-y-2 text-sm">
          <div className="flex justify-between border-t border-ink-700 pt-2">
            <dt className="text-white/40">Kickoff</dt>
            <dd className="font-semibold">{inviteWhen(match.kickoff_at)}</dd>
          </div>
          <div className="flex justify-between border-t border-ink-700 pt-2">
            <dt className="text-white/40">Cost</dt>
            <dd className="font-semibold">
              {match.price_per_player_zar > 0 ? `R${match.price_per_player_zar} each, pay the organiser` : "Free"}
            </dd>
          </div>
          <div className="flex justify-between border-t border-ink-700 pt-2">
            <dt className="text-white/40">Spots</dt>
            <dd className="font-semibold text-pitch">
              {match.status === "open" || match.status === "full"
                ? left > 0 ? `${left} left of ${match.max_players}` : "Full"
                : spotsLabel(match)}
            </dd>
          </div>
        </dl>

        {faces.length > 0 && (
          <div className="mt-5 flex items-center">
            <div className="flex -space-x-2">
              {faces.map((p) => (
                <span key={p.user_id} className="rounded-full ring-2 ring-ink-900">
                  <Avatar name={p.name} url={p.avatar_url} size={34} />
                </span>
              ))}
            </div>
            <p className="ml-3 text-xs text-white/50">
              {faces.map((p) => p.name.split(" ")[0]).slice(0, 3).join(", ")}
              {taken > 3 ? ` +${taken - 3}` : ""} {taken === 1 ? "is" : "are"} in
            </p>
          </div>
        )}
      </div>

      <div className="mt-6 space-y-4">
        {searchParams.c && <ConfirmFromEmail token={searchParams.c} />}
        {!searchParams.c && askNow && (
          <StillComing matchId={match.id} kickoffIso={match.kickoff_at} confirmed={false} />
        )}
        {!searchParams.c && myReleased && (
          <p className="rounded-2xl border border-yellow-400/40 bg-yellow-400/10 p-3 text-center text-sm text-white/80">
            Your spot was freed because it wasn’t confirmed in time. Tap “I’m in” if there’s still room.
          </p>
        )}
        {isOrganizer ? (
          <Link href={`/matches/${match.id}`} className="btn-primary block w-full text-center">
            Manage your game
          </Link>
        ) : (
          <PlayerActions
            matchId={match.id}
            matchStatus={match.status}
            joinMode={match.join_mode}
            kickoffIso={match.kickoff_at}
            myStatus={myStatus}
            isAuthed={!!uid}
            availableTokens={0}
          />
        )}

        {canTagFirstGame && <FirstGameToggle matchId={match.id} on={myFirstGame} />}
        {inGame && (
          <Link href={`/matches/${match.id}`} className="block text-center text-sm font-semibold text-pitch">
            Game details{match.price_per_player_zar > 0 ? " and how to pay" : ""} →
          </Link>
        )}
        {inGame && user?.is_anonymous && <KeepProfile />}
      </div>

      <p className="mt-auto pt-10 text-center text-xs text-white/40">
        Run your own game?{" "}
        <Link href="/organise" className="font-semibold text-white/70 underline">
          Post it on 5sFindr, free
        </Link>
      </p>
    </main>
  );
}
