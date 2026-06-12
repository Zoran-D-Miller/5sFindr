import { createClient } from "@/lib/supabase/server";
import { LeaderboardList, type LeaderRow } from "@/components/leaderboard/LeaderboardList";

export default async function LeaderboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: rows } = await supabase
    .from("leaderboard")
    .select(
      "id, name, avatar_url, neighborhood, preferred_positions, motm_count, reliability_score, games_played, founding_number, position",
    )
    .order("position", { ascending: true })
    .limit(100)
    .returns<LeaderRow[]>();

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-black tracking-tight">
        Cape Town <span className="text-pitch">leaderboard</span>
      </h1>

      {!rows || rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-700 px-5 py-12 text-center">
          <p className="font-semibold text-white/70">No ranked players yet</p>
          <p className="mt-1 text-sm text-white/40">Play matches and earn MotM trophies to climb.</p>
        </div>
      ) : (
        <LeaderboardList rows={rows} currentUserId={user!.id} />
      )}
    </div>
  );
}
