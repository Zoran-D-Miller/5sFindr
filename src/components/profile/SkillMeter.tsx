"use client";

import { SKILL_LABELS } from "@/lib/positions";

// 1–5 skill selector — five tap targets, pitch-green fill. Mobile-friendly bars.
export function SkillMeter({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-white/70">Skill level</label>
        <span className="text-sm font-semibold text-pitch">{SKILL_LABELS[value]}</span>
      </div>
      <div className="mt-2 flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`Skill ${n}`}
            onClick={() => onChange(n)}
            className={`h-9 flex-1 rounded-lg transition ${
              n <= value ? "bg-pitch" : "bg-ink-700 hover:bg-ink-600"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
