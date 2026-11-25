import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FEATURES } from "@/lib/flags";
import { PlayerActions } from "@/components/match/PlayerActions";
import { OrganizerControls } from "@/components/match/OrganizerControls";
import { TeamPanel } from "@/components/match/TeamPanel";
import { CheckInPanel } from "@/components/match/CheckInPanel";
import { MatchCodePanel } from "@/components/match/MatchCodePanel";
import { MotMVote } from "@/components/match/MotMVote";
import { MatchRealtime } from "@/components/match/MatchRealtime";
import { settleMatch } from "@/server/actions/attendance";
import { WhatsAppInvite } from "@/components/match/WhatsAppInvite";
import { PingBallers } from "@/components/match/PingBallers";
import { PlayerChip } from "@/components/profile/PlayerChip";
import { AttendancePanel } from "@/components/match/AttendancePanel";
import { KeepProfile } from "@/components/match/KeepProfile";
import { TrackEvent } from "@/components/analytics/TrackEvent";
import { PaymentPanel } from "@/components/match/PaymentPanel";
import { WhoPaidPanel } from "@/components/match/WhoPaidPanel";
import { StillComing } from "@/components/match/StillComing";
import { FirstGameToggle } from "@/components/match/FirstGameToggle";
import { GameLabelsEditor } from "@/components/match/GameLabelsEditor";
import { PlayedWith } from "@/components/social/PlayedWith";
import { RegularAlerts, type RegularAlertRow } from "@/components/social/RegularAlerts";
import { ShareImage } from "@/components/share/ShareImage";
import { cleanLabels, labelList, type GroupTag, type SkillTag } from "@/lib/labels";
import type { MatchStatus, JoinMode, VenueType, RosterEntry } from "@/lib/types";

interface MatchRow {
  id: string;
  organizer_id: string;
  title: string | null;
  venue_type: VenueType;
  kickoff_at: string;
  ends_at: string;
  duration_min: number;
  max_players: number;
  price_per_player_zar: number;
  join_mode: JoinMode;
  status: MatchStatus;
  teams_assigned: boolean;
  motm_awarded: boolean;
  motm_winner_id: string | null;
  share_slug: string;
  series_id: string | null;
  skill_tag: SkillTag | null;
  group_tag: GroupTag | null;
  over_30: boolean;
  location: { name: string; neighborhood: string | null; type: VenueType; latitude: number | null } | null;
}

interface RawRosterRow {
  user_id: string;
  status: RosterEntry["status"];
  team_color: RosterEntry["team_color"];
  position: RosterEntry["position"];
  paid_claimed_at: string | null;
  paid_confirmed_at: string | null;
  confirmed_at: string | null;
  released_at: string | null;
  first_game_ct: boolean;
  profile: { name: string; skill_level: number; reliability_score: number; avatar_url: string | null; games_played: number } | null;
}

// Payment reference the player puts on an EFT, e.g. 5S-THU-ZORAN.
function payReference(kickoffIso: string, name: string) {
  const day = new Date(kickoffIso)
    .toLocaleDateString("en-ZA", { weekday: "short", timeZone: "Africa/Johannesburg" })
    .slice(0, 3)
    .toUpperCase();
  const who = (name.split(" ")[0] || "PLAYER").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) || "PLAYER";
  return `5S-${day}-${who}`;
}

// NOTE: no `organizer:profiles(...)` embed here — matches has TWO FKs to
// profiles (organizer_id + motm_winner_id), which makes that embed ambiguous
// and errors out (→ null → 404). The organizer name is fetched separately.
const MATCH_COLS =
  "id, organizer_id, title, venue_type, kickoff_at, ends_at, duration_min, max_players, price_per_player_zar, join_mode, status, teams_assigned, motm_awarded, motm_winner_id, share_slug, series_id, skill_tag, group_tag, over_30, location:locations(name, neighborhood, type, latitude)";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://5sfindr.com";

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-ZA", {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

export default async function MatchLobbyPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { posted?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // Public browsing: match details are viewable anonymously. uid === null →
  // spectator mode (no wallet/vote/check-in reads, join CTA routes to signup).
  const uid = user?.id ?? null;
  const isGuest = !!user?.is_anonymous;

  // Resolve by UUID id OR share_slug — bulletproof regardless of which the URL
  // carries (a slug is not a valid uuid, so `.eq("id", slug)` would error → 404).
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const byId = UUID_RE.test(params.id);
  const loadMatch = () => {
    const base = supabase.from("matches").select(MATCH_COLS);
    return (byId ? base.eq("id", params.id) : base.eq("share_slug", params.id)).maybeSingle<MatchRow>();
  };

  let { data: match } = await loadMatch();
  if (!match) notFound();
  const matchId = match.id; // resolved UUID — use for all downstream queries

  const now = Date.now();
  const ended = now >= new Date(match.ends_at).getTime();

  // Lazy automated closure: once a match has ended, settle it (returns tokens
  // to attendees, forfeits no-shows). With tokens off the DB waits 24h after
  // full time for anyone but the organiser, so they can tick attendance. Call the RPC directly — NOT settleMatch()
  // — because that action calls revalidatePath(), illegal during render. We
  // re-fetch below, so revalidation isn't needed here. Skipped for anonymous
  // visitors (RPC execute is granted to authenticated only); the pg_cron sweep
  // and any logged-in viewer still settle it.
  if (uid && ended && match.status !== "completed" && match.status !== "cancelled") {
    await supabase.rpc("settle_match", { p_match_id: matchId });
    ({ data: match } = await loadMatch());
  }
  // Lazy MotM finalization once voting has closed (24h after full time).
  if (uid && match && match.status === "completed" && !match.motm_awarded &&
      now >= new Date(match.ends_at).getTime() + 24 * 3_600_000) {
    await supabase.rpc("finalize_motm", { p_match_id: matchId });
    ({ data: match } = await loadMatch());
  }
  if (!match) notFound();

  const paid = match.price_per_player_zar > 0;
  const [{ data: rawRoster }, { count: availableTokens }, { data: myVote }, { data: organizerRow }, { data: payInfo }] =
    await Promise.all([
      supabase
        .from("match_players")
        .select("user_id, status, team_color, position, paid_claimed_at, paid_confirmed_at, confirmed_at, released_at, first_game_ct, profile:profiles(name, skill_level, reliability_score, avatar_url, games_played)")
        .eq("match_id", matchId)
        .returns<RawRosterRow[]>(),
      uid && FEATURES.tokens
        ? supabase.from("tokens").select("id", { count: "exact", head: true })
            .eq("owner_id", uid).eq("status", "available")
        : Promise.resolve({ count: 0 }),
      uid && FEATURES.motm
        ? supabase.from("match_votes").select("id").eq("match_id", matchId).eq("voter_id", uid).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("profiles").select("name").eq("id", match.organizer_id).maybeSingle<{ name: string }>(),
      // RLS: only the organiser and people on the list can read this.
      uid && paid
        ? supabase.from("match_payment_info").select("details").eq("match_id", matchId).maybeSingle<{ details: string }>()
        : Promise.resolve({ data: null }),
    ]);

  const organizerName = organizerRow?.name ?? "Your organizer";

  const roster: RosterEntry[] = (rawRoster ?? []).map((r) => ({
    user_id: r.user_id, status: r.status, team_color: r.team_color, position: r.position,
    name: r.profile?.name ?? "Player",
    skill_level: r.profile?.skill_level ?? 3,
    reliability_score: r.profile?.reliability_score ?? 100,
  }));

  const isOrganizer = match.organizer_id === uid;
  const captainId = match.organizer_id; // organizer holds Slot 1 as Captain
  // Captain sorts to Slot 1, then by skill.
  const slotOrder = (a: RosterEntry, b: RosterEntry) =>
    a.user_id === captainId ? -1 : b.user_id === captainId ? 1 : b.skill_level - a.skill_level;
  const attended = roster.filter((r) => r.status === "attended").sort(slotOrder);
  const confirmed = roster.filter((r) => r.status === "accepted" || r.status === "attended").sort(slotOrder);
  const requests = roster.filter((r) => r.status === "requested");
  const mine = roster.find((r) => r.user_id === uid) ?? null;
  const myRaw = (rawRoster ?? []).find((r) => r.user_id === uid) ?? null;
  const ACTIVE_STATUSES = ["requested", "accepted", "attended"];
  const payRows = (rawRoster ?? [])
    .filter((r) => r.user_id !== match!.organizer_id && ACTIVE_STATUSES.includes(r.status))
    .map((r) => ({
      user_id: r.user_id,
      name: r.profile?.name ?? "Player",
      claimed: !!r.paid_claimed_at,
      confirmed: !!r.paid_confirmed_at,
    }));
  // S4 "Still coming?": the 24h before kickoff, accepted players confirm;
  // unconfirmed spots are freed 90 min before kickoff (migration 0029).
  const msToKickoff = new Date(match.kickoff_at).getTime() - now;
  const checkinOpen = msToKickoff > 0 && msToKickoff <= 24 * 3_600_000 &&
    (match.status === "open" || match.status === "full");
  const confirmedIds = new Set((rawRoster ?? []).filter((r) => r.confirmed_at).map((r) => r.user_id));
  const released = (rawRoster ?? []).filter((r) => r.status === "cancelled_early" && r.released_at);
  const iWasReleased = !!myRaw && myRaw.status === "cancelled_early" && !!myRaw.released_at;
  const completed = match.status === "completed";
  const kickedOff = now >= new Date(match.kickoff_at).getTime();
  const inCheckInWindow = kickedOff && !ended && !completed;
  const live = match.status !== "cancelled" && !completed;
  const showTeams = FEATURES.shirts && match.teams_assigned;
  const winner = match.motm_winner_id ? roster.find((r) => r.user_id === match!.motm_winner_id) : null;

  // ── S6 ──
  const labels = cleanLabels(match);
  const labelChips = labelList(labels);
  const newcomers = new Set((rawRoster ?? []).filter((r) => r.first_game_ct).map((r) => r.user_id));
  const newcomerNames = confirmed.filter((p) => newcomers.has(p.user_id) && p.user_id !== uid).map((p) => p.name.split(" ")[0]);
  // "First game in Cape Town?" while they've never played a 5sFindr game.
  const canTagFirstGame = !isOrganizer && !!myRaw && (myRaw.status === "requested" || myRaw.status === "accepted") &&
    msToKickoff > 0 && (match.status === "open" || match.status === "full") && (myRaw.profile?.games_played ?? 1) === 0;
  // "Played with": after the game, everyone ticked as playing (you included).
  const iPlayed = !!myRaw && myRaw.status === "attended" && ended;
  const teammates = iPlayed
    ? (rawRoster ?? []).filter((r) => r.status === "attended" && r.user_id !== uid)
    : [];
  const [{ data: myRegulars }, { data: alertRows }] = await Promise.all([
    teammates.length > 0
      ? supabase.from("regulars").select("regular_id").eq("user_id", uid!).returns<{ regular_id: string }[]>()
      : Promise.resolve({ data: [] as { regular_id: string }[] }),
    // Guests can't open the feed, so their "your regulars are playing" card lives here.
    isGuest ? supabase.rpc("my_regular_alerts") : Promise.resolve({ data: [] }),
  ]);
  const regularIds = new Set((myRegulars ?? []).map((r) => r.regular_id));

  return (
    <div className="space-y-6 pb-10">
      <MatchRealtime matchId={match.id} />
      {searchParams.posted === "1" && isOrganizer && (
        <>
          <TrackEvent name="post_game" />
          <p className="rounded-2xl border border-pitch/40 bg-pitch/10 p-3 text-center text-sm font-bold text-pitch">
            Posted ✓ Now share it to your group.
          </p>
        </>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-black tracking-tight">
          {match.title || match.location?.name || "5-a-side match"}
        </h1>
        <p className="mt-1 text-sm text-white/60">{fmt(match.kickoff_at)} · {match.duration_min} min</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="rounded-full bg-ink-700 px-2 py-0.5 font-medium text-white/60">
            {match.location?.name}{match.location?.neighborhood ? ` · ${match.location.neighborhood}` : ""}
          </span>
          <span className="rounded-full bg-ink-700 px-2 py-0.5 font-medium text-white/60">
            {match.venue_type === "official_court" ? "Court" : "Open field"}
          </span>
          <span className="rounded-full bg-ink-700 px-2 py-0.5 font-medium capitalize text-white/60">
            {match.status} · {confirmed.length}/{match.max_players}
          </span>
          {labelChips.map((l) => (
            <span key={l} className="rounded-full border border-pitch/40 px-2 py-0.5 font-semibold text-pitch">{l}</span>
          ))}
        </div>
      </div>

      {/* MotM winner banner */}
      {FEATURES.motm && completed && winner && (
        <div className="rounded-2xl border border-pitch/30 bg-pitch/10 p-4 text-center">
          <p className="text-xs uppercase tracking-wide text-white/50">Man of the Match</p>
          <p className="mt-0.5 text-lg font-black text-pitch">🏆 {winner.name}</p>
        </div>
      )}

      {/* Teams / squad */}
      {showTeams ? (
        <section>
          <h3 className="mb-2 px-1 text-sm font-bold uppercase tracking-wide text-white/50">Match tickets</h3>
          <TeamPanel roster={completed ? attended : confirmed} meId={uid ?? ""} captainId={captainId} />
        </section>
      ) : (
        confirmed.length > 0 && (
          <section>
            <h3 className="mb-2 px-1 text-sm font-bold uppercase tracking-wide text-white/50">
              Squad ({confirmed.length}/{match.max_players})
            </h3>
            <ul className="space-y-2">
              {confirmed.map((p, i) => (
                <li key={p.user_id} className="flex items-center gap-3 rounded-2xl border border-ink-700 bg-ink-800/60 p-3 text-sm">
                  <span className="w-5 shrink-0 text-center text-xs font-bold text-white/30">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <PlayerChip userId={p.user_id} name={p.name} highlight={p.user_id === uid} />
                    {p.user_id === captainId && (
                      <span className="ml-2 rounded-full bg-pitch/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-pitch">
                        ⓒ Captain
                      </span>
                    )}
                    {newcomers.has(p.user_id) && (
                      <span className="ml-2 rounded-full bg-electric/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-electric">
                        👋 First game in Cape Town
                      </span>
                    )}
                  </span>
                  {isOrganizer && checkinOpen && p.user_id !== captainId ? (
                    confirmedIds.has(p.user_id) ? (
                      <span className="shrink-0 text-xs font-bold text-pitch">Coming ✓</span>
                    ) : (
                      <span className="shrink-0 text-xs font-semibold text-yellow-400">Not confirmed</span>
                    )
                  ) : (
                    <span className="shrink-0 text-xs text-white/40">Skill {p.skill_level}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )
      )}

      {/* S6: say hi to newcomers */}
      {isOrganizer && live && newcomerNames.length > 0 && (
        <p className="rounded-2xl border border-electric/40 bg-electric/10 p-3 text-sm text-white/80">
          👋 First game in Cape Town: {newcomerNames.join(", ")}. Say hi when they arrive.
        </p>
      )}
      {canTagFirstGame && <FirstGameToggle matchId={match.id} on={!!myRaw?.first_game_ct} />}

      {/* S6: played with → regulars */}
      {teammates.length > 0 && (
        <PlayedWith
          title="You played with"
          intro="Add your regulars. When one of them joins a game you’re not on, you’ll see it in the app."
          people={teammates.map((t) => ({
            user_id: t.user_id,
            name: t.profile?.name ?? "Player",
            avatar_url: t.profile?.avatar_url ?? null,
            is_regular: regularIds.has(t.user_id),
          }))}
        />
      )}
      {isGuest && <RegularAlerts alerts={(alertRows ?? []) as RegularAlertRow[]} />}

      {/* Organiser: spots freed because nobody confirmed (refill them) */}
      {isOrganizer && live && released.length > 0 && (
        <p className="rounded-2xl border border-yellow-400/40 bg-yellow-400/10 p-3 text-sm text-white/80">
          Freed (didn’t confirm): {released.map((r) => r.profile?.name?.split(" ")[0] ?? "Player").join(", ")}.
          {" "}Share the game again to fill {released.length === 1 ? "the spot" : "the spots"}.
        </p>
      )}
      {isOrganizer && checkinOpen && confirmed.length > 1 && (
        <p className="px-1 text-xs text-white/40">
          Players get “Still coming?” 24h and 3h before kickoff. Spots nobody confirms are freed 90 min before kickoff.
        </p>
      )}

      {/* Player: "Still coming?" */}
      {!isOrganizer && mine?.status === "accepted" && checkinOpen && !confirmedIds.has(mine.user_id) && (
        <StillComing matchId={match.id} kickoffIso={match.kickoff_at} confirmed={false} />
      )}
      {!isOrganizer && iWasReleased && live && (
        <p className="rounded-2xl border border-yellow-400/40 bg-yellow-400/10 p-3 text-center text-sm text-white/80">
          Your spot was freed because it wasn’t confirmed in time. Tap “I’m in” if there’s still room.
        </p>
      )}

      {/* Post-match MotM vote (attendees only) */}
      {FEATURES.motm && completed && mine?.status === "attended" && (
        <MotMVote
          matchId={match.id}
          candidates={attended.filter((a) => a.user_id !== uid)}
          alreadyVoted={!!myVote}
        />
      )}

      {/* Check-in (any accepted player incl. the Captain, during the window) */}
      {FEATURES.gpsCheckIn && inCheckInWindow && mine?.status === "accepted" && (
        <CheckInPanel matchId={match.id} hasGeo={match.location?.latitude != null} />
      )}
      {FEATURES.gpsCheckIn && mine?.status === "attended" && !completed && (
        <div className="rounded-2xl border border-pitch/40 bg-pitch/10 p-4 text-center font-bold text-pitch">
          ✓ Checked in{isOrganizer ? " (Captain)" : ""} — token returns when the match settles.
        </div>
      )}

      {/* Organiser ticks attendance from kickoff until the game is closed */}
      {!FEATURES.gpsCheckIn && isOrganizer && kickedOff && live && confirmed.length > 0 && (
        <AttendancePanel matchId={match.id} players={confirmed} />
      )}

      {/* Guests: keep the profile (Google / email link) once they're on a list */}
      {isGuest && mine && <KeepProfile />}

      {/* Actions */}
      {isOrganizer ? (
        <div className="space-y-4">
          {completed && (
            <section className="space-y-2 rounded-2xl border border-pitch/30 bg-pitch/5 p-4">
              <h3 className="text-sm font-bold uppercase tracking-wide text-white/50">Game recap</h3>
              <p className="text-xs text-white/50">
                An image of who played, new faces and where. Post it to your group or your story.
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/card/game/${match.id}`}
                alt="Game recap card"
                className="mx-auto w-48 rounded-xl border border-ink-700"
              />
              <ShareImage
                src={`/api/card/game/${match.id}`}
                filename="5sfindr-recap.png"
                label="Share the recap"
                via="recap_card"
              />
            </section>
          )}
          {live && (
            <GameLabelsEditor matchId={match.id} initial={labels} inSeries={!!match.series_id} />
          )}
          {!completed && match.status !== "cancelled" && (
            <>
              <WhatsAppInvite
                title={match.title}
                venue={match.location?.name ?? "the pitch"}
                kickoffIso={match.kickoff_at}
                pricePerPlayer={match.price_per_player_zar}
                names={confirmed.map((p) => p.name)}
                maxPlayers={match.max_players}
                shareSlug={match.share_slug}
                siteUrl={SITE_URL}
                labels={labelChips}
              />
              <PingBallers
                matchId={match.id}
                venue={match.location?.name ?? "the pitch"}
                kickoffIso={match.kickoff_at}
                spotsLeft={Math.max(0, match.max_players - confirmed.length)}
                shareSlug={match.share_slug}
                siteUrl={SITE_URL}
              />
            </>
          )}
          {paid && match.status !== "cancelled" && (
            <WhoPaidPanel matchId={match.id} price={match.price_per_player_zar} details={payInfo?.details ?? null} rows={payRows} />
          )}
          {FEATURES.gpsCheckIn && !completed && <MatchCodePanel matchId={match.id} />}
          <OrganizerControls
            matchId={match.id}
            matchStatus={match.status}
            kickoffIso={match.kickoff_at}
            requests={requests}
          />
          {!completed && ended && (
            <form action={async () => { "use server"; await settleMatch(match!.id); }}>
              <button className="w-full rounded-2xl border border-ink-600 py-3 font-semibold text-white/80 hover:border-pitch">
                {FEATURES.tokens ? "End match & settle tokens" : "Done ticking? Close the game"}
              </button>
            </form>
          )}
        </div>
      ) : (
        !completed && (
          <PlayerActions
            matchId={match.id}
            matchStatus={match.status}
            joinMode={match.join_mode}
            kickoffIso={match.kickoff_at}
            myStatus={mine?.status ?? null}
            isAuthed={!!uid}
            availableTokens={availableTokens ?? 0}
          />
        )
      )}

      {/* Paid court: how to pay the organiser + "I've paid" */}
      {!isOrganizer && paid && myRaw && ACTIVE_STATUSES.includes(myRaw.status) && match.status !== "cancelled" && (
        <PaymentPanel
          matchId={match.id}
          price={match.price_per_player_zar}
          organizerName={organizerName}
          details={payInfo?.details ?? null}
          reference={payReference(match.kickoff_at, myRaw.profile?.name ?? "Player")}
          claimed={!!myRaw.paid_claimed_at}
          confirmed={!!myRaw.paid_confirmed_at}
        />
      )}
    </div>
  );
}
