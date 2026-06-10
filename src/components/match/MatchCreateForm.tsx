"use client";

import { useState, useTransition } from "react";
import { createMatch } from "@/server/actions/match";
import { SkillMeter } from "@/components/profile/SkillMeter";
import { PositionPicker } from "@/components/profile/PositionPicker";
import type { CreateMatchInput, JoinMode, Position, VenueOption } from "@/lib/types";

const inputCls =
  "mt-2 w-full rounded-xl border border-ink-600 bg-ink-800 px-3.5 py-2.5 text-white placeholder:text-white/30 outline-none focus:border-pitch";

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm font-medium text-white/70">{label}</label>
      {children}
    </div>
  );
}

// Two-option segmented control (reused for venue mode + join mode).
function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { key: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="mt-2 grid grid-cols-2 gap-1 rounded-2xl border border-ink-700 bg-ink-800 p-1">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={`rounded-xl py-2.5 text-sm font-bold transition ${
            value === o.key ? "bg-pitch text-ink-900" : "text-white/60"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Chips<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { key: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={String(o.key)}
          type="button"
          onClick={() => onChange(o.key)}
          className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
            value === o.key
              ? "border-pitch bg-pitch/15 text-pitch"
              : "border-ink-600 text-white/60 hover:border-white/30"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function MatchCreateForm({ venues }: { venues: VenueOption[] }) {
  const [venueMode, setVenueMode] = useState<"seeded" | "custom">("seeded");
  const [locationId, setLocationId] = useState(venues[0]?.id ?? "");
  const [customVenueName, setCustomVenueName] = useState("");
  const [customNeighborhood, setCustomNeighborhood] = useState("");

  const [title, setTitle] = useState("");
  const [kickoffLocal, setKickoffLocal] = useState("");
  const [durationMin, setDurationMin] = useState(60);
  const [maxPlayers, setMaxPlayers] = useState(10);
  const [price, setPrice] = useState(0);

  const [joinMode, setJoinMode] = useState<JoinMode>("manual");
  const [minSkill, setMinSkill] = useState(3);
  const [reqPositions, setReqPositions] = useState<Position[]>([]);
  const [minReliability, setMinReliability] = useState(0);

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function submit() {
    setError("");
    if (venueMode === "seeded" && !locationId) return setError("Choose a venue.");
    if (venueMode === "custom" && !customVenueName.trim())
      return setError("Name your community field.");
    if (!kickoffLocal) return setError("Pick a kickoff time.");

    // datetime-local is in the organizer's local tz → convert to UTC ISO.
    const kickoffAtIso = new Date(kickoffLocal).toISOString();

    const payload: CreateMatchInput = {
      venueMode,
      locationId: venueMode === "seeded" ? locationId : undefined,
      customVenueName: venueMode === "custom" ? customVenueName : undefined,
      customNeighborhood: venueMode === "custom" ? customNeighborhood : undefined,
      title,
      kickoffAtIso,
      durationMin,
      maxPlayers,
      pricePerPlayerZar: price,
      joinMode,
      minSkillLevel: joinMode === "instant" ? minSkill : undefined,
      requiredPositions: joinMode === "instant" ? reqPositions : undefined,
      minReliabilityScore: joinMode === "instant" ? minReliability : undefined,
    };

    startTransition(async () => {
      const res = await createMatch(payload);
      if (res?.error) setError(res.error); // success path redirects server-side
    });
  }

  // local datetime min = now (rounded to the minute)
  const minLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);

  return (
    <div className="space-y-6 pb-28">
      {/* Venue */}
      <Section label="Where">
        <Segmented
          value={venueMode}
          onChange={setVenueMode}
          options={[
            { key: "seeded", label: "Popular venue" },
            { key: "custom", label: "Custom field" },
          ]}
        />
        {venueMode === "seeded" ? (
          <select
            className={inputCls}
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
          >
            {venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
                {v.neighborhood ? ` · ${v.neighborhood}` : ""}
              </option>
            ))}
          </select>
        ) : (
          <div className="space-y-2">
            <input
              className={inputCls}
              placeholder="Custom Community Field / Park (e.g. Green Point Common)"
              value={customVenueName}
              onChange={(e) => setCustomVenueName(e.target.value)}
              maxLength={80}
            />
            <input
              className={inputCls}
              placeholder="Neighborhood (optional)"
              value={customNeighborhood}
              onChange={(e) => setCustomNeighborhood(e.target.value)}
              maxLength={40}
            />
            <p className="text-xs text-white/40">
              No GPS pin for custom fields — players verify with your 4-digit match code.
            </p>
          </div>
        )}
      </Section>

      <Section label="Match name (optional)">
        <input
          className={inputCls}
          placeholder="e.g. Thursday Lunchtime Fives"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={60}
        />
      </Section>

      <Section label="Kickoff">
        <input
          type="datetime-local"
          className={inputCls}
          value={kickoffLocal}
          min={minLocal}
          onChange={(e) => setKickoffLocal(e.target.value)}
        />
      </Section>

      <Section label="Duration">
        <Chips
          value={durationMin}
          onChange={setDurationMin}
          options={[
            { key: 60, label: "60 min" },
            { key: 90, label: "90 min" },
            { key: 120, label: "120 min" },
          ]}
        />
      </Section>

      <Section label="Squad size">
        <Chips
          value={maxPlayers}
          onChange={setMaxPlayers}
          options={[
            { key: 8, label: "8" },
            { key: 10, label: "10" },
            { key: 12, label: "12" },
            { key: 14, label: "14" },
          ]}
        />
      </Section>

      <Section label="Price per player (R) — settled off-platform">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          className={inputCls}
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
          placeholder="0 for free fields"
        />
      </Section>

      {/* Join settings */}
      <Section label="Who can join">
        <Segmented
          value={joinMode}
          onChange={setJoinMode}
          options={[
            { key: "manual", label: "Manual request" },
            { key: "instant", label: "Instant booking" },
          ]}
        />
        <p className="mt-2 text-xs text-white/40">
          {joinMode === "instant"
            ? "Players meeting all criteria are auto-accepted. Others can still request."
            : "You approve every join request yourself."}
        </p>
      </Section>

      {joinMode === "instant" && (
        <div className="space-y-5 rounded-2xl border border-pitch/20 bg-pitch/5 p-4">
          <SkillMeter label="Minimum skill to auto-accept" value={minSkill} onChange={setMinSkill} />
          <PositionPicker
            label="Positions needed (optional)"
            value={reqPositions}
            onChange={setReqPositions}
          />
          <Section label="Minimum reliability">
            <Chips
              value={minReliability}
              onChange={setMinReliability}
              options={[
                { key: 0, label: "Any" },
                { key: 50, label: "50+" },
                { key: 70, label: "70+" },
                { key: 85, label: "85+" },
              ]}
            />
          </Section>
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      {/* Sticky create bar */}
      <div className="fixed inset-x-0 bottom-0 border-t border-ink-700 bg-ink-900/90 px-5 py-3 backdrop-blur">
        <div className="mx-auto max-w-md sm:max-w-2xl">
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="w-full rounded-2xl bg-pitch py-3.5 font-bold text-ink-900 shadow-glow transition hover:bg-pitch-dark disabled:opacity-60"
          >
            {pending ? "Creating…" : "Create match"}
          </button>
        </div>
      </div>
    </div>
  );
}
