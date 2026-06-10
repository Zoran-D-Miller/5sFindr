import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isPremium } from "@/lib/entitlements";
import { PlayerActions } from "@/components/match/PlayerActions";
import { OrganizerControls } from "@/components/match/OrganizerControls";
import { TeamPanel } from "@/components/match/TeamPanel";
import type { MatchStatus, JoinMode, VenueType, RosterEntry } from "@/lib/types";

interface MatchRow {
  id: string;
  organizer_id: string;
  title: string | null;
  venue_type: VenueType;
  kickoff_at: string;
  duration_min: number;
  max_players: number;
  price_per_player_zar: number;
  join_mode: JoinMode;
  status: MatchStatus;
  teams_assigned: boolean;
  location: { name: string; neighborhood: string | null; type: VenueType } | null;
}

// Supabase returns embedded profile as an object; normalize the roster shape.
interface RawRosterRow {
  user_id: string;
  status: RosterEntry["status"];
  team_color: RosterEntry["team_color"];
  position: RosterEntry["position"];
  profile: { name: string; skill_level: number; reliability_score: number } | null;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default async function MatchLobbyPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const uid = user!.id;

  const { data: match } = await supabase
    .from("matches")
    .select(
      "id, organizer_id, title, venue_type, kickoff_at, duration_min, max_players, price_per_player_zar, join_mode, status, teams_assigned, location:locations(name, neighborhood, type)",
    )
    .eq("id", params.id)
    .maybeSingle<MatchRow>();

  if (!match) notFound();

  const [{ data: rawRoster }, { count: availableTokens }, premium] = await Promise.all([
    supabase
      .from("match_players")
      .select(
        "user_id, status, team_color, position, profile:profiles(name, skill_level, reliability_score)",
      )
      .eq("match_id", params.id)
      .returns<RawRosterRow[]>(),
    supabase
      .from("tokens")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", uid)
      .eq("status", "available"),
    isPremium(uid),
  ]);

  const roster: RosterEntry[] = (rawRoster ?? []).map((r) => ({
    user_id: r.user_id,
    status: r.status,
    team_color: r.team_color,
    position: r.position,
    name: r.profile?.name ?? "Player",
    skill_level: r.profile?.skill_level ?? 3,
    reliability_score: r.profile?.reliability_score ?? 100,
  }));

  const isOrganizer = match.organizer_id === uid;
  const confirmed = roster.filter((r) => r.status === "accepted" || r.status === "attended");
  const requests = roster.filter((r) => r.status === "requested");
  const mine = roster.find((r) => r.user_id === uid) ?? null;

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black tracking-tight">
          {match.title || match.location?.name || "5-a-side match"}
        </h1>
        <p className="mt-1 text-sm text-white/60">
          {fmt(match.kickoff_at)} · {match.duration_min} min
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="rounded-full bg-ink-700 px-2 py-0.5 font-medium text-white/60">
            {match.location?.name}
            {match.location?.neighborhood ? ` · ${match.location.neighborhood}` : ""}
          </span>
          <span className="rounded-full bg-ink-700 px-2 py-0.5 font-medium text-white/60">
            {match.venue_type === "official_court" ? "Court" : "Open field"}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 font-medium ${
              match.join_mode === "instant" ? "bg-pitch/15 text-pitch" : "bg-electric/15 text-electric"
            }`}
          >
            {match.join_mode === "instant" ? "Instant" : "Request"}
          </span>
          <span className="rounded-full bg-ink-700 px-2 py-0.5 font-medium capitalize text-white/60">
            {match.status} · {confirmed.length}/{match.max_players}
          </span>
        </div>
      </div>

      {/* Teams (filled/locked) or confirmed roster */}
      {match.teams_assigned ? (
        <section>
          <h3 className="mb-2 px-1 text-sm font-bold uppercase tracking-wide text-white/50">
            Match tickets
          </h3>
          <TeamPanel roster={confirmed} meId={uid} />
        </section>
      ) : (
        confirmed.length > 0 && (
          <section>
            <h3 className="mb-2 px-1 text-sm font-bold uppercase tracking-wide text-white/50">
              Squad ({confirmed.length}/{match.max_players})
            </h3>
            <ul className="space-y-2">
              {confirmed.map((p) => (
                <li
                  key={p.user_id}
                  className="flex items-center justify-between rounded-2xl border border-ink-700 bg-ink-800/60 p-3 text-sm"
                >
                  <span className={p.user_id === uid ? "font-bold text-pitch" : ""}>
                    {p.name}
                    {p.user_id === uid ? " (you)" : ""}
                  </span>
                  <span className="text-xs text-white/40">Skill {p.skill_level}</span>
                </li>
              ))}
            </ul>
          </section>
        )
      )}

      {/* Actions */}
      {isOrganizer ? (
        <OrganizerControls matchId={match.id} matchStatus={match.status} requests={requests} />
      ) : (
        <PlayerActions
          matchId={match.id}
          matchStatus={match.status}
          joinMode={match.join_mode}
          kickoffIso={match.kickoff_at}
          myStatus={mine?.status ?? null}
          isPremium={premium}
          availableTokens={availableTokens ?? 0}
        />
      )}
    </div>
  );
}
