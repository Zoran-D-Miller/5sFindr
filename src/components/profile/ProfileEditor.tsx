"use client";

import { useState, useTransition } from "react";
import { updateProfile } from "@/server/actions/profile";
import type { Profile, ProfileDraft, Position, WeeklyAvailability } from "@/lib/types";
import { SkillMeter } from "./SkillMeter";
import { PositionPicker } from "./PositionPicker";
import { AvailabilityGrid } from "./AvailabilityGrid";
import { ReliabilityBadge } from "./ReliabilityBadge";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-white/70">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "mt-2 w-full rounded-xl border border-ink-600 bg-ink-800 px-3.5 py-2.5 text-white placeholder:text-white/30 outline-none focus:border-pitch";

export function ProfileEditor({ profile }: { profile: Profile }) {
  const [name, setName] = useState(profile.name);
  const [neighborhood, setNeighborhood] = useState(profile.neighborhood ?? "");
  const [skill, setSkill] = useState(profile.skill_level);
  const [positions, setPositions] = useState<Position[]>(profile.preferred_positions);
  const [availability, setAvailability] = useState<WeeklyAvailability>(
    profile.weekly_availability ?? {},
  );
  const [instagram, setInstagram] = useState(profile.instagram_url ?? "");
  const [tiktok, setTiktok] = useState(profile.tiktok_url ?? "");

  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState("");

  function save() {
    const draft: ProfileDraft = {
      name,
      neighborhood,
      skill_level: skill,
      preferred_positions: positions,
      weekly_availability: availability,
      instagram_url: instagram,
      tiktok_url: tiktok,
    };
    startTransition(async () => {
      const res = await updateProfile(draft);
      if (res.ok) {
        setStatus("saved");
        setTimeout(() => setStatus("idle"), 2000);
      } else {
        setStatus("error");
        setError(res.error);
      }
    });
  }

  return (
    <div className="space-y-6 pb-28">
      {/* Header: avatar + reliability */}
      <div className="flex items-center gap-4">
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-ink-700 text-2xl font-black text-pitch">
          {name.charAt(0).toUpperCase() || "?"}
        </div>
        <div className="min-w-0">
          <p className="truncate text-lg font-bold">{name || "Your name"}</p>
          <div className="mt-1.5">
            <ReliabilityBadge
              score={profile.reliability_score}
              gamesPlayed={profile.games_played}
              gamesMissed={profile.games_missed}
            />
          </div>
        </div>
      </div>

      <Field label="Display name">
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} maxLength={50} />
      </Field>

      <Field label="Neighborhood">
        <input
          className={inputCls}
          value={neighborhood}
          onChange={(e) => setNeighborhood(e.target.value)}
          placeholder="e.g. Sea Point"
        />
      </Field>

      <SkillMeter value={skill} onChange={setSkill} />
      <PositionPicker value={positions} onChange={setPositions} />
      <AvailabilityGrid value={availability} onChange={setAvailability} />

      <div className="grid grid-cols-2 gap-3">
        <Field label="Instagram">
          <input
            className={inputCls}
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
            placeholder="@handle"
          />
        </Field>
        <Field label="TikTok">
          <input
            className={inputCls}
            value={tiktok}
            onChange={(e) => setTiktok(e.target.value)}
            placeholder="@handle"
          />
        </Field>
      </div>

      {status === "error" && <p className="text-sm text-red-400">{error}</p>}

      {/* Sticky save bar — thumb-reachable on mobile */}
      <div className="fixed inset-x-0 bottom-0 border-t border-ink-700 bg-ink-900/90 px-5 py-3 backdrop-blur">
        <div className="mx-auto max-w-md sm:max-w-2xl">
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="w-full rounded-2xl bg-pitch py-3.5 font-bold text-ink-900 shadow-glow transition hover:bg-pitch-dark disabled:opacity-60"
          >
            {pending ? "Saving…" : status === "saved" ? "Saved ✓" : "Save profile"}
          </button>
        </div>
      </div>
    </div>
  );
}
