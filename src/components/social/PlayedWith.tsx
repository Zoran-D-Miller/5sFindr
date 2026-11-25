import { Avatar } from "@/components/ui/Avatar";
import { PlayerChip } from "@/components/profile/PlayerChip";
import { RegularButton } from "@/components/social/RegularButton";

export interface PlayedWithPerson {
  user_id: string;
  name: string;
  avatar_url: string | null;
  is_regular: boolean;
  /** e.g. "3 games together" (profile list) */
  note?: string;
}

// "Played with": people you were on a game with, each with "+ Regular".
// Your regulars stay private to you; when one joins a game you're not on,
// you see it in the app (and by email if you kept your profile with one).
export function PlayedWith({
  title,
  people,
  intro,
}: {
  title: string;
  people: PlayedWithPerson[];
  intro?: string;
}) {
  if (people.length === 0) return null;
  return (
    <section>
      <h3 className="mb-1 px-1 text-sm font-bold uppercase tracking-wide text-white/50">{title}</h3>
      {intro && <p className="mb-2 px-1 text-xs text-white/45">{intro}</p>}
      <ul className="space-y-2">
        {people.map((p) => (
          <li key={p.user_id} className="flex items-center gap-3 rounded-2xl border border-ink-700 bg-ink-800/60 p-3 text-sm">
            <Avatar name={p.name} url={p.avatar_url} size={32} />
            <span className="min-w-0 flex-1">
              <PlayerChip userId={p.user_id} name={p.name} />
              {p.note && <span className="block text-[11px] text-white/40">{p.note}</span>}
            </span>
            <RegularButton userId={p.user_id} isRegular={p.is_regular} />
          </li>
        ))}
      </ul>
    </section>
  );
}
