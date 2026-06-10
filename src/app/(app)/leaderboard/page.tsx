import { createClient } from "@/lib/supabase/server";

interface LeaderRow {
  id: string;
  name: string;
  neighborhood: string | null;
  skill_level: number;
  motm_count: number;
  reliability_score: number;
  games_played: number;
  position: number;
}

export default async function LeaderboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: rows } = await supabase
    .from("leaderboard")
    .select("id, name, neighborhood, skill_level, motm_count, reliability_score, games_played, position")
    .order("position", { ascending: true })
    .limit(100)
    .returns<LeaderRow[]>();

  const medal = (pos: number) => (pos === 1 ? "🥇" : pos === 2 ? "🥈" : pos === 3 ? "🥉" : `${pos}`);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-black tracking-tight">
        Cape Town <span className="text-pitch">leaderboard</span>
      </h1>

      {(!rows || rows.length === 0) ? (
        <div className="rounded-2xl border border-dashed border-ink-700 px-5 py-12 text-center">
          <p className="font-semibold text-white/70">No ranked players yet</p>
          <p className="mt-1 text-sm text-white/40">Play matches and earn MotM trophies to climb.</p>
        </div>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-800/60 divide-y divide-ink-700">
          {rows.map((r) => (
            <li
              key={r.id}
              className={`flex items-center gap-3 px-4 py-3 ${r.id === user!.id ? "bg-pitch/5" : ""}`}
            >
              <span className="w-7 shrink-0 text-center text-sm font-black text-white/50">
                {medal(r.position)}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm font-bold ${r.id === user!.id ? "text-pitch" : ""}`}>
                  {r.name}{r.id === user!.id ? " (you)" : ""}
                </p>
                <p className="text-xs text-white/40">
                  {r.neighborhood ?? "Cape Town"} · {r.games_played} played
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-bold text-pitch">🏆 {r.motm_count}</p>
                <p className="text-[11px] text-white/40">Rel {Math.round(r.reliability_score)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
