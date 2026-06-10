"use client";

import type { ViewMode } from "@/lib/types";

// Segmented Player ⇄ Organizer control. A single sliding pill animates between
// the two halves for a smooth, app-like switch.
export function ViewSwitcher({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  return (
    <div className="relative grid grid-cols-2 rounded-2xl border border-ink-700 bg-ink-800 p-1">
      <span
        aria-hidden
        className="absolute inset-y-1 w-[calc(50%-0.25rem)] rounded-xl bg-pitch shadow-glow transition-transform duration-300 ease-out"
        style={{ transform: value === "organizer" ? "translateX(100%)" : "translateX(0)" }}
      />
      {(["player", "organizer"] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          className={`relative z-10 rounded-xl py-2.5 text-sm font-bold capitalize transition-colors ${
            value === mode ? "text-ink-900" : "text-white/60"
          }`}
        >
          {mode === "player" ? "Player" : "Organizer"}
        </button>
      ))}
    </div>
  );
}
