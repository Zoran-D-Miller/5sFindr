import type { RosterEntry } from "@/lib/types";

function TeamCard({
  title,
  tone,
  players,
  meId,
}: {
  title: string;
  tone: "light" | "dark";
  players: RosterEntry[];
  meId: string;
}) {
  const isLight = tone === "light";
  return (
    <div
      className={`flex-1 rounded-2xl border p-4 ${
        isLight ? "border-white/40 bg-white/10" : "border-ink-600 bg-ink-900"
      }`}
    >
      <div className="mb-3 flex items-center gap-2">
        <span
          className={`h-3 w-3 rounded-full ${isLight ? "bg-white" : "border border-white/40 bg-ink-700"}`}
        />
        <h4 className="text-sm font-bold uppercase tracking-wide">{title}</h4>
      </div>
      <ul className="space-y-1.5">
        {players.length === 0 && <li className="text-xs text-white/40">—</li>}
        {players.map((p) => (
          <li
            key={p.user_id}
            className={`flex items-center justify-between text-sm ${
              p.user_id === meId ? "font-bold text-pitch" : "text-white/80"
            }`}
          >
            <span className="truncate">
              {p.name}
              {p.user_id === meId ? " (you)" : ""}
            </span>
            <span className="text-xs text-white/40">S{p.skill_level}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// The auto-assigned Team Light vs Team Dark layout shown on filled/locked matches.
export function TeamPanel({ roster, meId }: { roster: RosterEntry[]; meId: string }) {
  const light = roster.filter((r) => r.team_color === "light");
  const dark = roster.filter((r) => r.team_color === "dark");
  return (
    <div className="flex gap-3">
      <TeamCard title="Team Light" tone="light" players={light} meId={meId} />
      <TeamCard title="Team Dark" tone="dark" players={dark} meId={meId} />
    </div>
  );
}
