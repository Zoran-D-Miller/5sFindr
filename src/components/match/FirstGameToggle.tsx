"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setFirstGame } from "@/server/actions/social";

// S6 newcomer tag. Shown to a player on a game before kickoff while they've
// never played a 5sFindr game. The tag shows next to their name on the list.
export function FirstGameToggle({ matchId, on }: { matchId: string; on: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [tagged, setTagged] = useState(on);
  const [error, setError] = useState("");

  function toggle() {
    setError("");
    const next = !tagged;
    start(async () => {
      const res = await setFirstGame(matchId, next);
      if (res.ok) {
        setTagged(next);
        router.refresh();
      } else setError(res.error);
    });
  }

  return (
    <section className="flex items-center gap-3 rounded-2xl border border-ink-700 bg-ink-800/60 p-4">
      <span className="text-2xl" aria-hidden>👋</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{tagged ? "Tagged: first game in Cape Town" : "First game in Cape Town?"}</p>
        <p className="text-xs text-white/50">
          {tagged
            ? "The organiser and the others on the list can see it next to your name."
            : "Tag it so the organiser knows to say hi. It shows next to your name on the list."}
        </p>
        {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      </div>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold transition disabled:opacity-60 ${
          tagged ? "border-ink-600 text-white/60" : "border-pitch bg-pitch/15 text-pitch"
        }`}
      >
        {pending ? "…" : tagged ? "Remove" : "Tag me"}
      </button>
    </section>
  );
}
