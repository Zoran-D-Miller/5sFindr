"use client";

import { POSITIONS } from "@/lib/positions";
import type { Position } from "@/lib/types";

// Multi-select chips for preferred positions. Selecting "Anywhere" clears the rest.
export function PositionPicker({
  value,
  onChange,
  label = "Preferred positions",
}: {
  value: Position[];
  onChange: (v: Position[]) => void;
  label?: string;
}) {
  function toggle(p: Position) {
    if (p === "ANY") return onChange(["ANY"]);
    const next = value.filter((x) => x !== "ANY");
    onChange(next.includes(p) ? next.filter((x) => x !== p) : [...next, p]);
  }

  return (
    <div>
      <label className="text-sm font-medium text-white/70">{label}</label>
      <div className="mt-2 flex flex-wrap gap-2">
        {POSITIONS.map(({ key, label }) => {
          const active = value.includes(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggle(key)}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                active
                  ? "border-pitch bg-pitch/15 text-pitch"
                  : "border-ink-600 text-white/60 hover:border-white/30"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
