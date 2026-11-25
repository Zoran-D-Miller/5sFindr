"use client";

import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";

// Tap-through "claim a spot" demo for the landing page (GROWTH-STRATEGY.md §4):
// 7 steps, best part first, one hint per step that sells rather than instructs,
// one straight path. Sample content only, labelled "Example". Every screen is
// something the app does today.

type Step = { hint: string; screen: React.ReactNode };

const FACES = ["S", "T", "M", "L", "K", "A", "J"];

function Faces({ extra }: { extra?: string }) {
  return (
    <div className="flex -space-x-2">
      {FACES.map((f, i) => (
        <span
          key={i}
          className="grid h-8 w-8 place-items-center rounded-full border-2 border-ink-800 bg-ink-700 text-meta font-black text-pitch"
        >
          {f}
        </span>
      ))}
      {extra && (
        <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-ink-800 bg-pitch text-meta font-black text-ink-900">
          {extra}
        </span>
      )}
    </div>
  );
}

function GameHead() {
  return (
    <div>
      <p className="font-mono text-micro uppercase tracking-widest text-white/40">33.91° S, 18.41° E · THU 19:00</p>
      <p className="mt-1 font-display text-title font-extrabold uppercase">Green Point · Thursday</p>
      <p className="text-meta text-white/50">5-a-side · 60 min · run by Sam</p>
    </div>
  );
}

const GAMES = [
  { time: "19:00", place: "Green Point", price: "Free", left: "3 spots left" },
  { time: "19:30", place: "Rondebosch", price: "R60 each", left: "1 spot left" },
  { time: "20:00", place: "Sea Point", price: "Free", left: "5 spots left" },
];

const STEPS: Step[] = [
  {
    hint: "Tonight near you: three games with open spots. Open fields and booked courts in one place.",
    screen: (
      <div className="space-y-2">
        <p className="font-mono text-micro uppercase tracking-widest text-white/40">Tonight · Cape Town</p>
        {GAMES.map((g) => (
          <div key={g.place} className="flex items-center gap-3 rounded-card border border-ink-700 bg-ink-900 p-3">
            <span className="font-display text-title font-extrabold tabular-nums">{g.time}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-body font-bold">{g.place}</span>
              <span className="block text-meta text-white/50">{g.price}</span>
            </span>
            <span className="shrink-0 text-meta font-semibold text-pitch">{g.left}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    hint: "See who’s playing before you go. Come alone: you’ll know a few names by full time.",
    screen: (
      <div className="space-y-4">
        <GameHead />
        <div className="flex items-center justify-between">
          <Faces />
          <span className="text-meta font-semibold text-pitch">7/10 in · 3 left</span>
        </div>
        <p className="rounded-card border border-ink-700 bg-ink-900 p-3 text-meta text-white/60">
          Sam · <span className="text-pitch">Shows up 96%</span> · runs this game every Thursday
        </p>
      </div>
    ),
  },
  {
    hint: "Claim a spot with your first name and WhatsApp number. No app to download, no password.",
    screen: (
      <div className="space-y-3">
        <GameHead />
        <div className="rounded-card border border-ink-600 bg-ink-900 px-3.5 py-3 text-body text-white/80">Lerato</div>
        <div className="rounded-card border border-ink-600 bg-ink-900 px-3.5 py-3 text-body text-white/40">🇿🇦 +27 082 123 4567</div>
        <div className="rounded-card bg-pitch py-3 text-center font-bold text-ink-900">I’m in</div>
      </div>
    ),
  },
  {
    hint: "You’re on the list. Sam sees it straight away, no WhatsApp back-and-forth.",
    screen: (
      <div className="space-y-4">
        <GameHead />
        <div className="flex items-center justify-between">
          <Faces extra="L" />
          <span className="text-meta font-semibold text-pitch">8/10 in · 2 left</span>
        </div>
        <p className="rounded-card border border-pitch/40 bg-pitch/10 p-3 text-center text-body font-bold text-pitch">
          You’re in. See you Thursday.
        </p>
      </div>
    ),
  },
  {
    hint: "Booked court? Your share is shown up front. Pay Sam directly, tap “I’ve paid”, done.",
    screen: (
      <div className="space-y-3">
        <p className="font-display text-title font-extrabold uppercase">R60 each</p>
        <p className="text-meta text-white/50">Court booked by Sam. Pay them directly.</p>
        <div className="rounded-card border border-ink-700 bg-ink-900 p-3 text-meta">
          <p className="text-white/50">Reference</p>
          <p className="font-mono text-body font-bold tracking-widest">5S-THU-SAM</p>
        </div>
        <div className="rounded-card border border-ink-600 py-3 text-center font-semibold text-white/80">I’ve paid</div>
      </div>
    ),
  },
  {
    hint: "One tap the day before. Can’t make it? Your spot goes to someone who can.",
    screen: (
      <div className="space-y-3">
        <GameHead />
        <div className="rounded-card border border-pitch/40 bg-pitch/10 p-4">
          <p className="font-bold">Still coming?</p>
          <p className="text-meta text-white/60">Thursday 19:00 · Green Point</p>
          <div className="mt-3 rounded-card bg-pitch py-3 text-center font-bold text-ink-900">Yes, I’m coming</div>
        </div>
      </div>
    ),
  },
  {
    hint: "Join before your area opens and you get a Founding Member number. Lower number, earlier in.",
    screen: (
      <div className="space-y-3 text-center">
        <p className="font-display text-heading font-extrabold uppercase tracking-[0.2em] text-white/60">Founding Member</p>
        <p className="font-display text-[4rem] font-extrabold leading-none text-pitch">#0??</p>
        <p className="text-meta text-white/50">Areas open as players join. Your signup counts.</p>
      </div>
    ),
  },
];

export function ClaimDemo() {
  const [i, setI] = useState(0);
  const last = STEPS.length - 1;
  const step = STEPS[i];

  useEffect(() => {
    if (i === last) track("demo", { step: i + 1 });
  }, [i, last]);

  return (
    <section aria-label="How it works: an example game" className="card-hero overflow-hidden">
      <div className="flex items-center justify-between border-b border-ink-700 px-5 py-3">
        <span className="font-mono text-micro uppercase tracking-widest text-white/40">Example · tap through</span>
        <span className="font-mono text-micro tabular-nums text-white/40">
          {String(i + 1).padStart(2, "0")}/{String(STEPS.length).padStart(2, "0")}
        </span>
      </div>

      {/* The whole screen is the tap target; Next/Back below do the same. */}
      <div
        onClick={() => setI((n) => Math.min(last, n + 1))}
        className={`min-h-[17.5rem] p-5 ${i < last ? "cursor-pointer" : ""}`}
      >
        {step.screen}
      </div>

      <div className="border-t border-ink-700 px-5 py-4">
        <p aria-live="polite" className="min-h-[2.75rem] text-body font-semibold text-white/85">
          {step.hint}
        </p>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex flex-1 gap-1.5" aria-hidden="true">
            {STEPS.map((_, n) => (
              <span key={n} className={`h-1 flex-1 rounded-full ${n <= i ? "bg-pitch" : "bg-ink-600"}`} />
            ))}
          </div>
          {i > 0 && (
            <button type="button" onClick={() => setI(i - 1)} className="text-meta font-semibold text-white/50">
              Back
            </button>
          )}
          {i < last ? (
            <button type="button" onClick={() => setI(i + 1)} className="text-meta font-bold text-pitch">
              Next →
            </button>
          ) : (
            <a href="#claim" className="text-meta font-bold text-pitch">
              Claim yours ↓
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
