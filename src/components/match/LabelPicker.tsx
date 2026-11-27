"use client";

import { GROUP_TAGS, SKILL_TAGS, type GameLabels, type GroupTag, type SkillTag } from "@/lib/labels";

function Chip({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
        on ? "border-pitch bg-pitch/15 text-pitch" : "border-ink-600 text-white/60 hover:border-white/30"
      }`}
    >
      {label}
    </button>
  );
}

// S6 game labels: skill, women's / mixed, 30+. Tap a chip again to clear it.
export function LabelPicker({ value, onChange }: { value: GameLabels; onChange: (v: GameLabels) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs text-white/40">Level</p>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {SKILL_TAGS.map((s) => (
            <Chip
              key={s.key}
              label={s.label}
              on={value.skill_tag === s.key}
              onClick={() => onChange({ ...value, skill_tag: value.skill_tag === s.key ? null : (s.key as SkillTag) })}
            />
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs text-white/40">Who it’s for</p>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {GROUP_TAGS.map((g) => (
            <Chip
              key={g.key}
              label={g.label}
              on={value.group_tag === g.key}
              onClick={() => onChange({ ...value, group_tag: value.group_tag === g.key ? null : (g.key as GroupTag) })}
            />
          ))}
          <Chip label="30+" on={value.over_30} onClick={() => onChange({ ...value, over_30: !value.over_30 })} />
        </div>
      </div>
      <p className="text-xs text-white/40">Optional. Shown on the game and in your share message so the right people join.</p>
    </div>
  );
}
