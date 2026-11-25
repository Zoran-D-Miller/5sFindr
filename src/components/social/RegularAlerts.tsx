import Link from "next/link";
import { inviteWhen } from "@/lib/invite";

export interface RegularAlertRow {
  match_id: string;
  share_slug: string;
  title: string | null;
  kickoff_at: string;
  venue: string | null;
  neighborhood: string | null;
  spots_left: number;
  regulars: string[];
}

function names(list: string[]) {
  if (list.length <= 1) return list[0] ?? "A regular";
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list[0]}, ${list[1]} +${list.length - 2}`;
}

// "Your regulars are playing": games one of your regulars joined that you're
// not on yet (from my_regular_alerts(), migration 0031).
export function RegularAlerts({ alerts }: { alerts: RegularAlertRow[] }) {
  if (alerts.length === 0) return null;
  return (
    <section className="mb-5 space-y-2">
      <h3 className="px-1 text-sm font-bold uppercase tracking-wide text-white/50">Your regulars are playing</h3>
      {alerts.map((a) => (
        <Link
          key={a.match_id}
          href={`/m/${a.share_slug}`}
          className="flex items-center gap-3 rounded-2xl border border-pitch/40 bg-pitch/10 px-4 py-3 transition hover:bg-pitch/15"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-pitch">
              {names(a.regulars)} {a.regulars.length === 1 ? "is" : "are"} in
            </span>
            <span className="block truncate text-xs text-white/60">
              {inviteWhen(a.kickoff_at)} · {a.title || a.venue || "5-a-side"}
              {a.neighborhood ? ` · ${a.neighborhood}` : ""}
            </span>
          </span>
          <span className="shrink-0 text-right text-xs font-semibold text-pitch/80">
            {a.spots_left} left
            <br />
            Join →
          </span>
        </Link>
      ))}
    </section>
  );
}
