"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LabelPicker } from "@/components/match/LabelPicker";
import { setMatchLabels } from "@/server/actions/match";
import { labelList, type GameLabels } from "@/lib/labels";

// Organiser: change a game's labels (and, for a weekly series, the later games too).
export function GameLabelsEditor({
  matchId,
  initial,
  inSeries,
}: {
  matchId: string;
  initial: GameLabels;
  inSeries: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [labels, setLabels] = useState(initial);
  const [series, setSeries] = useState(inSeries);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");

  function save() {
    setMsg("");
    start(async () => {
      const res = await setMatchLabels(matchId, labels, series);
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else setMsg(res.error);
    });
  }

  const current = labelList(initial);
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between rounded-2xl border border-ink-700 bg-ink-800/60 p-3 text-left text-sm text-white/70 hover:border-pitch/40"
      >
        <span>
          <span className="font-semibold text-white">Labels:</span> {current.length ? current.join(" · ") : "none"}
        </span>
        <span className="text-xs font-semibold text-pitch">Edit</span>
      </button>
    );
  }

  return (
    <section className="space-y-4 rounded-2xl border border-ink-700 bg-ink-800/60 p-4">
      <h3 className="text-sm font-bold uppercase tracking-wide text-white/50">Labels</h3>
      <LabelPicker value={labels} onChange={setLabels} />
      {inSeries && (
        <label className="flex items-center gap-2 text-sm text-white/70">
          <input type="checkbox" checked={series} onChange={(e) => setSeries(e.target.checked)} className="accent-pitch" />
          Also the later games in this weekly series
        </label>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={save} disabled={pending} className="btn-primary flex-1 disabled:opacity-60">
          {pending ? "Saving…" : "Save labels"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-2xl border border-ink-600 px-4 text-sm text-white/60">
          Cancel
        </button>
      </div>
      {msg && <p className="text-xs text-red-400">{msg}</p>}
    </section>
  );
}
