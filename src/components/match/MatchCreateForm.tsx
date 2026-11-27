"use client";

import { useState, useTransition } from "react";
import { createMatch } from "@/server/actions/match";
import { SkillMeter } from "@/components/profile/SkillMeter";
import { PositionPicker } from "@/components/profile/PositionPicker";
import { NEIGHBOURHOODS } from "@/lib/waitlist";
import { LabelPicker } from "@/components/match/LabelPicker";
import { cleanLabels, type GameLabels } from "@/lib/labels";
import type { CreateMatchInput, JoinMode, LastGameDefaults, Position, VenueOption } from "@/lib/types";

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

const NEW_FIELD = "__new__";
const AREAS = NEIGHBOURHOODS.filter((n) => n !== "Just visiting Cape Town");

// datetime-local value (organiser's local time) for a Date.
function toLocalInput(d: Date) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

// Same weekday + time as the last game, in the future.
function nextSlot(lastIso: string): string {
  const d = new Date(lastIso);
  const soon = Date.now() + 30 * 60_000;
  while (d.getTime() < soon) d.setDate(d.getDate() + 7);
  return toLocalInput(d);
}

export function MatchCreateForm({
  venues,
  savedVenues = [],
  defaults = null,
}: {
  venues: VenueOption[];
  savedVenues?: VenueOption[];
  defaults?: LastGameDefaults | null;
}) {
  const known = [...savedVenues, ...venues];
  const startVenue =
    defaults && known.some((v) => v.id === defaults.locationId)
      ? defaults.locationId
      : savedVenues[0]?.id ?? venues[0]?.id ?? NEW_FIELD;

  const [venueChoice, setVenueChoice] = useState(startVenue);
  const [customVenueName, setCustomVenueName] = useState("");
  const [customNeighborhood, setCustomNeighborhood] = useState<string>(AREAS[0]);

  const [title, setTitle] = useState(defaults?.title ?? "");
  const [kickoffLocal, setKickoffLocal] = useState(defaults ? nextSlot(defaults.kickoffAtIso) : "");
  const [durationMin, setDurationMin] = useState(defaults?.durationMin ?? 60);
  const [maxPlayers, setMaxPlayers] = useState(defaults?.maxPlayers ?? 10);
  const [price, setPrice] = useState(defaults?.pricePerPlayerZar ?? 0);
  const [paymentDetails, setPaymentDetails] = useState(defaults?.paymentDetails ?? "");
  const [repeatWeeks, setRepeatWeeks] = useState(1);
  const [labels, setLabels] = useState<GameLabels>(cleanLabels(defaults?.labels));

  const [moreOpen, setMoreOpen] = useState(false);
  const [joinMode, setJoinMode] = useState<JoinMode>(defaults?.joinMode ?? "instant");
  const [minSkill, setMinSkill] = useState(1);
  const [reqPositions, setReqPositions] = useState<Position[]>([]);
  const [minReliability, setMinReliability] = useState(0);

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const isNew = venueChoice === NEW_FIELD;

  function submit() {
    setError("");
    if (isNew && !customVenueName.trim()) return setError("Name the field or court.");
    if (!kickoffLocal) return setError("Pick a kickoff time.");

    // datetime-local is in the organiser's local tz → convert to UTC ISO.
    const kickoffAtIso = new Date(kickoffLocal).toISOString();
    const payload: CreateMatchInput = {
      venueMode: isNew ? "custom" : "seeded",
      locationId: isNew ? undefined : venueChoice,
      customVenueName: isNew ? customVenueName : undefined,
      customNeighborhood: isNew ? customNeighborhood : undefined,
      title,
      kickoffAtIso,
      durationMin,
      maxPlayers,
      pricePerPlayerZar: price,
      joinMode,
      minSkillLevel: joinMode === "instant" ? minSkill : undefined,
      requiredPositions: joinMode === "instant" ? reqPositions : undefined,
      minReliabilityScore: joinMode === "instant" ? minReliability : undefined,
      repeatWeeks,
      paymentDetails: price > 0 ? paymentDetails : undefined,
      labels,
    };

    startTransition(async () => {
      const res = await createMatch(payload);
      if (res?.error) setError(res.error); // success path redirects server-side
    });
  }

  const minLocal = toLocalInput(new Date());

  return (
    <div className="space-y-6 pb-12">
      {defaults && (
        <p className="rounded-2xl border border-pitch/20 bg-pitch/5 px-4 py-3 text-xs text-white/60">
          Filled in from your last game. Change anything, then post.
        </p>
      )}

      <Section label="Where">
        <select className={inputCls} value={venueChoice} onChange={(e) => setVenueChoice(e.target.value)}>
          {savedVenues.length > 0 && (
            <optgroup label="Your fields">
              {savedVenues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                  {v.neighborhood ? ` · ${v.neighborhood}` : ""}
                </option>
              ))}
            </optgroup>
          )}
          <optgroup label="Popular venues">
            {venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
                {v.neighborhood ? ` · ${v.neighborhood}` : ""}
              </option>
            ))}
          </optgroup>
          <option value={NEW_FIELD}>+ Another field or court</option>
        </select>
        {isNew && (
          <div className="space-y-2">
            <input
              className={inputCls}
              placeholder="Field or court name (e.g. Green Point Common)"
              value={customVenueName}
              onChange={(e) => setCustomVenueName(e.target.value)}
              maxLength={80}
            />
            <select className={inputCls} value={customNeighborhood} onChange={(e) => setCustomNeighborhood(e.target.value)}>
              {AREAS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            <p className="text-xs text-white/40">Saved for next time.</p>
          </div>
        )}
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

      <Section label="Players (including you)">
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

      <Section label="Cost per player (R, 0 = free)">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          className={inputCls}
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
        />
      </Section>

      {price > 0 && (
        <Section label="How players pay you">
          <textarea
            className={inputCls}
            rows={3}
            maxLength={300}
            value={paymentDetails}
            onChange={(e) => setPaymentDetails(e.target.value)}
            placeholder="SnapScan link, or bank + account number + branch code. Only people on the list see this."
          />
        </Section>
      )}

      <Section label="Repeat">
        <Chips
          value={repeatWeeks}
          onChange={setRepeatWeeks}
          options={[
            { key: 1, label: "Just this one" },
            { key: 4, label: "Weekly × 4" },
            { key: 8, label: "Weekly × 8" },
          ]}
        />
      </Section>

      <Section label="Labels">
        <LabelPicker value={labels} onChange={setLabels} />
      </Section>

      <button
        type="button"
        onClick={() => setMoreOpen((o) => !o)}
        className="text-sm font-semibold text-white/50 underline"
      >
        {moreOpen ? "Fewer options" : "More options (name, length, who can join)"}
      </button>

      {moreOpen && (
        <div className="space-y-6">
          <Section label="Game name (optional)">
            <input
              className={inputCls}
              placeholder="e.g. Thursday Lunchtime Fives"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={60}
            />
          </Section>

          <Section label="Length">
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

          <Section label="Who can join">
            <Segmented
              value={joinMode}
              onChange={setJoinMode}
              options={[
                { key: "instant", label: "Anyone with the link" },
                { key: "manual", label: "I approve each one" },
              ]}
            />
          </Section>

          {joinMode === "instant" && (
            <div className="space-y-5 rounded-2xl border border-pitch/20 bg-pitch/5 p-4">
              <SkillMeter label="Minimum skill to auto-accept" value={minSkill} onChange={setMinSkill} />
              <PositionPicker label="Positions needed (optional)" value={reqPositions} onChange={setReqPositions} />
              <Section label="Minimum show-up rate">
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
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="w-full rounded-2xl bg-pitch py-3.5 font-bold text-ink-900 shadow-glow transition hover:bg-pitch-dark disabled:opacity-60"
      >
        {pending ? "Posting…" : repeatWeeks > 1 ? `Post ${repeatWeeks} weekly games` : "Post game"}
      </button>
    </div>
  );
}
