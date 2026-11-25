import { notFound } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { areaLabel, LAUNCH_AREAS, UNLOCK, type AreaKey } from "@/lib/areas";
import { computeAreaBoard } from "@/server/areaProgress";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · 5sFindr", robots: { index: false } };

// Admin view: signups by area and role, app usage, and each launch area's
// unlock progress (UNLOCK.players + UNLOCK.weeklyGames). Only for the emails
// in ADMIN_EMAILS (comma-separated, set in Vercel). Counts only, no personal data.
const ADMINS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const KEYS: AreaKey[] = [...LAUNCH_AREAS.map((a) => a.key), "other"];

function Bar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-ink-700">
      <div className="h-full rounded-full bg-pitch" style={{ width: `${pct}%` }} />
    </div>
  );
}

export default async function AdminPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email || !ADMINS.includes(user.email.toLowerCase())) notFound();

  const db = createServiceClient();
  const now = Date.now();
  const weekAgo = new Date(now - 7 * 864e5).toISOString();

  // Unlock progress: same numbers as the public board (src/server/areaProgress.ts).
  const [board, { data: waitlist }, { data: profiles }, { data: games }] = await Promise.all([
    computeAreaBoard(),
    db.from("waitlist").select("created_at").returns<{ created_at: string }[]>(),
    db.from("profiles").select("id, founding_number").returns<{ id: string; founding_number: number | null }[]>(),
    db.from("matches").select("organizer_id, kickoff_at").neq("status", "cancelled")
      .returns<{ organizer_id: string; kickoff_at: string }[]>(),
  ]);
  const { waitlistPlayers: wlPlayers, waitlistOrganisers: wlOrganisers, joined, weeklyGames: weekly } = board.detail;
  const wlWeek = (waitlist ?? []).filter((w) => w.created_at >= weekAgo).length;
  const organisers = new Set((games ?? []).map((g) => g.organizer_id));

  const kept = (profiles ?? []).filter((p) => p.founding_number !== null).length;
  const guests = (profiles ?? []).length - kept;
  const upcoming = (games ?? []).filter((g) => g.kickoff_at >= new Date(now).toISOString()).length;

  return (
    <main className="mx-auto max-w-2xl space-y-8 px-5 py-8">
      <h1 className="text-2xl font-black tracking-tight">Admin</h1>

      <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {[
          ["Waitlist", (waitlist ?? []).length, `+${wlWeek} this week`],
          ["Kept profiles", kept, "Google / email / password"],
          ["Guests", guests, "joined without an account"],
          ["Organisers", organisers.size, `${upcoming} upcoming games`],
        ].map(([label, value, sub]) => (
          <div key={String(label)} className="rounded-2xl border border-ink-700 bg-ink-800/60 p-4">
            <p className="text-2xl font-black text-pitch">{value}</p>
            <p className="text-xs font-bold uppercase tracking-wide text-white/50">{label}</p>
            <p className="mt-0.5 text-[11px] text-white/30">{sub}</p>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-white/50">
          Unlock progress ({UNLOCK.players} players + {UNLOCK.weeklyGames} weekly games)
        </h2>
        {board.areas.map(({ key, players, weeklyGames, unlocked: ready }) => {
          return (
            <div key={key} className="space-y-2 rounded-2xl border border-ink-700 bg-ink-800/60 p-4">
              <div className="flex items-baseline justify-between">
                <p className="font-bold">{areaLabel(key)}</p>
                <p className={`text-xs font-bold ${ready ? "text-pitch" : "text-white/40"}`}>{ready ? "Ready to unlock" : "Locked"}</p>
              </div>
              <div className="grid grid-cols-[7rem_1fr_4rem] items-center gap-2 text-xs text-white/60">
                <span>Players</span><Bar value={players} max={UNLOCK.players} /><span className="text-right">{players}/{UNLOCK.players}</span>
                <span>Weekly games</span><Bar value={weeklyGames} max={UNLOCK.weeklyGames} /><span className="text-right">{weeklyGames}/{UNLOCK.weeklyGames}</span>
              </div>
            </div>
          );
        })}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-white/50">By area and role</h2>
        <div className="overflow-x-auto rounded-2xl border border-ink-700">
          <table className="w-full text-left text-sm">
            <thead className="bg-ink-800 text-xs uppercase text-white/40">
              <tr>
                <th className="p-3">Area</th>
                <th className="p-3 text-right">Waitlist players</th>
                <th className="p-3 text-right">Waitlist organisers</th>
                <th className="p-3 text-right">Joined a game</th>
                <th className="p-3 text-right">Weekly games</th>
              </tr>
            </thead>
            <tbody>
              {KEYS.map((k) => (
                <tr key={k} className="border-t border-ink-700">
                  <td className="p-3">{areaLabel(k)}</td>
                  <td className="p-3 text-right">{wlPlayers[k]}</td>
                  <td className="p-3 text-right">{wlOrganisers[k]}</td>
                  <td className="p-3 text-right">{joined[k]}</td>
                  <td className="p-3 text-right">{weekly[k]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-white/30">
          Waitlist people count in every area they ticked, and roles overlap. Includes test signups. Players for the
          unlock = waitlist players in the area + people on a game there who aren’t one of them (matched on WhatsApp
          number). Weekly games = games ±7 days, a weekly series counted once.
        </p>
      </section>
    </main>
  );
}
