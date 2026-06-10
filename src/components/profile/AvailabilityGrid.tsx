"use client";

import { DAYS, DAYPARTS } from "@/lib/positions";
import type { WeeklyAvailability, DayKey, Daypart } from "@/lib/types";

// Compact 7-day × 3-daypart toggle grid. Stored as jsonb on the profile.
export function AvailabilityGrid({
  value,
  onChange,
}: {
  value: WeeklyAvailability;
  onChange: (v: WeeklyAvailability) => void;
}) {
  function toggle(day: DayKey, part: Daypart) {
    const current = value[day] ?? [];
    const next = current.includes(part)
      ? current.filter((p) => p !== part)
      : [...current, part];
    const updated = { ...value };
    if (next.length) updated[day] = next;
    else delete updated[day];
    onChange(updated);
  }

  return (
    <div>
      <label className="text-sm font-medium text-white/70">Weekly availability</label>
      <div className="mt-2 grid grid-cols-[2.4rem_repeat(3,1fr)] gap-1.5">
        <div />
        {DAYPARTS.map((dp) => (
          <span key={dp.key} className="text-center text-[11px] font-medium text-white/40">
            {dp.label}
          </span>
        ))}
        {DAYS.map((d) => (
          <div key={d.key} className="contents">
            <span className="flex items-center text-xs font-medium text-white/50">{d.label}</span>
            {DAYPARTS.map((dp) => {
              const on = (value[d.key] ?? []).includes(dp.key);
              return (
                <button
                  key={dp.key}
                  type="button"
                  aria-label={`${d.label} ${dp.label}`}
                  onClick={() => toggle(d.key, dp.key)}
                  className={`h-8 rounded-md transition ${
                    on ? "bg-electric" : "bg-ink-700 hover:bg-ink-600"
                  }`}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
