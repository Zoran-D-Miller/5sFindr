import "server-only";
import { unstable_cache } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { areaFor, LAUNCH_AREAS, UNLOCK, type AreaKey } from "@/lib/areas";

// Unlock progress per launch area: the public board on the landing page, the
// feed and the profile, and the bars on /admin. Counts only; nothing personal
// leaves this file.
//
// Players in an area = waitlist players who ticked it, plus everyone on a game
// there (organisers included) who isn't already one of those waitlist players
// (matched on WhatsApp number). Invites count through this: a mate who joins
// with your link is a player in the areas they tick.
// Weekly games = games in the area with kickoff within 7 days either side,
// where a weekly series counts once.

export type AreaProgress = {
  key: Exclude<AreaKey, "other">;
  label: string;
  players: number;
  weeklyGames: number;
  unlocked: boolean;
};

export type AreaBoard = {
  areas: AreaProgress[];
  /** For /admin's table: every area incl. "other". */
  detail: {
    waitlistPlayers: Record<AreaKey, number>;
    waitlistOrganisers: Record<AreaKey, number>;
    joined: Record<AreaKey, number>;
    weeklyGames: Record<AreaKey, number>;
  };
};

const zero = (): Record<AreaKey, number> => ({ city_bowl: 0, southern: 0, northern: 0, other: 0 });
const sets = (): Record<AreaKey, Set<string>> => ({
  city_bowl: new Set(), southern: new Set(), northern: new Set(), other: new Set(),
});

export async function computeAreaBoard(): Promise<AreaBoard> {
  const db = createServiceClient();
  const now = Date.now();
  const weekAgo = new Date(now - 7 * 864e5).toISOString();
  const weekAhead = new Date(now + 7 * 864e5).toISOString();

  const [wl, games, seats] = await Promise.all([
    db.from("waitlist").select("roles, neighbourhoods, whatsapp")
      .returns<{ roles: string[] | null; neighbourhoods: string[] | null; whatsapp: string }[]>(),
    db.from("matches").select("id, organizer_id, series_id, kickoff_at, location:locations(neighborhood)")
      .neq("status", "cancelled")
      .returns<{ id: string; organizer_id: string; series_id: string | null; kickoff_at: string;
        location: { neighborhood: string | null } | null }[]>(),
    db.from("match_players").select("match_id, user_id").in("status", ["accepted", "attended"])
      .returns<{ match_id: string; user_id: string }[]>(),
  ]);
  for (const r of [wl, games, seats]) if (r.error) throw new Error(r.error.message);

  const waitlistPlayers = zero();
  const waitlistOrganisers = zero();
  const wlPhones = sets(); // waitlist players' numbers per area, for de-duplication
  for (const w of wl.data ?? []) {
    for (const a of new Set((w.neighbourhoods ?? []).map(areaFor))) {
      if (w.roles?.includes("player")) {
        waitlistPlayers[a]++;
        wlPhones[a].add(w.whatsapp);
      }
      if (w.roles?.includes("organizer")) waitlistOrganisers[a]++;
    }
  }

  const gameArea = new Map<string, AreaKey>();
  const organiserOf = new Map<string, string>();
  const weeklySeries = sets();
  for (const g of games.data ?? []) {
    const a = areaFor(g.location?.neighborhood);
    gameArea.set(g.id, a);
    organiserOf.set(g.id, g.organizer_id);
    if (g.kickoff_at >= weekAgo && g.kickoff_at <= weekAhead) weeklySeries[a].add(g.series_id ?? g.id);
  }

  const onGames = sets();
  const joinedSets = sets(); // excludes the organiser's own seat (admin's "joined a game")
  for (const s of seats.data ?? []) {
    const a = gameArea.get(s.match_id);
    if (!a) continue;
    onGames[a].add(s.user_id);
    if (organiserOf.get(s.match_id) !== s.user_id) joinedSets[a].add(s.user_id);
  }

  // Phone numbers of people on games, to skip those already counted from the waitlist.
  const userIds = [...new Set(Object.values(onGames).flatMap((s) => [...s]))];
  const phoneOf = new Map<string, string | null>();
  for (let i = 0; i < userIds.length; i += 200) {
    const { data, error } = await db.from("profiles").select("id, phone_number")
      .in("id", userIds.slice(i, i + 200)).returns<{ id: string; phone_number: string | null }[]>();
    if (error) throw new Error(error.message);
    for (const p of data ?? []) phoneOf.set(p.id, p.phone_number);
  }

  const weeklyGames = zero();
  const joined = zero();
  const players = zero();
  for (const a of Object.keys(players) as AreaKey[]) {
    weeklyGames[a] = weeklySeries[a].size;
    joined[a] = joinedSets[a].size;
    let extra = 0;
    for (const uid of onGames[a]) {
      const phone = phoneOf.get(uid);
      if (!phone || !wlPhones[a].has(phone)) extra++;
    }
    players[a] = waitlistPlayers[a] + extra;
  }

  return {
    areas: LAUNCH_AREAS.map(({ key, label }) => ({
      key,
      label,
      players: players[key],
      weeklyGames: weeklyGames[key],
      unlocked: players[key] >= UNLOCK.players && weeklyGames[key] >= UNLOCK.weeklyGames,
    })),
    detail: { waitlistPlayers, waitlistOrganisers, joined, weeklyGames },
  };
}

export const AREA_PROGRESS_TAG = "area-progress";

const cached = unstable_cache(async () => (await computeAreaBoard()).areas, ["area-progress-v1"], {
  revalidate: 300,
  tags: [AREA_PROGRESS_TAG],
});

/** Public board, cached for 5 minutes. Null when it can't be read (e.g. no service key in a preview). */
export async function getAreaProgress(): Promise<AreaProgress[] | null> {
  try {
    return await cached();
  } catch (e) {
    console.error("[5sFindr] area progress failed:", e instanceof Error ? e.message : e);
    return null;
  }
}
