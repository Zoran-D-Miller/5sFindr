"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { joinWaitlist } from "@/server/actions/waitlist";
import { AVAILABILITY, CONSENT_COPY, NEIGHBOURHOODS, ROLES, type WaitlistState } from "@/lib/waitlist";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary w-full" data-umami-event="waitlist-submit">
      {pending ? "One sec…" : "Join the waitlist"}
    </button>
  );
}

function Check({ name, children, required }: { name: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-body text-white/70">
      <input
        type="checkbox"
        name={name}
        required={required}
        className="mt-0.5 h-5 w-5 shrink-0 rounded border-ink-600 bg-ink-800 accent-pitch"
      />
      <span>{children}</span>
    </label>
  );
}

// Pre-launch waitlist: email + WhatsApp number, separate opt-ins per channel
// (POPIA — nothing pre-ticked), plus what we need to hit the launch gate.
export function WaitlistForm({ refCode, source, siteUrl }: { refCode?: string; source?: string; siteUrl: string }) {
  const [state, formAction] = useFormState<WaitlistState, FormData>(joinWaitlist, {});
  // Areas in the order they were tapped; the first one is home until they pick.
  const [areas, setAreas] = useState<string[]>([]);
  const [home, setHome] = useState("");
  const [localError, setLocalError] = useState("");
  const homeArea = areas.includes(home) ? home : (areas[0] ?? "");

  if (state.joined) return <Joined {...state.joined} siteUrl={siteUrl} />;

  function toggleArea(n: string) {
    setAreas((prev) => (prev.includes(n) ? prev.filter((a) => a !== n) : [...prev, n]));
    if (n === home) setHome("");
    setLocalError("");
  }

  // Checkbox groups can't use `required`, so catch empty picks before the round trip.
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    const data = new FormData(e.currentTarget);
    const error =
      data.getAll("roles").length === 0
        ? "Tell us if you play, run a game, or are a venue (pick all that apply)."
        : areas.length === 0
          ? "Pick the areas you usually play in."
          : "";
    setLocalError(error);
    if (error) e.preventDefault();
  }

  const error = localError || state.error;

  return (
    <form action={formAction} onSubmit={onSubmit} className="card-hero space-y-4 p-5 text-left sm:p-6">
      <input name="name" placeholder="Your name" autoComplete="name" className="input-field" required maxLength={80} />
      <input
        name="email"
        type="email"
        placeholder="Email"
        autoComplete="email"
        inputMode="email"
        className="input-field"
        required
      />
      {/* South Africa only at launch: +27 is fixed, people type their number as
          they know it (082 123 4567) and the server turns it into +27821234567. */}
      <div>
        <div className="relative">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 flex items-center gap-1.5 border-r border-ink-600 pl-3.5 pr-3 text-white/60"
          >
            <span>🇿🇦</span>+27
          </span>
          <input
            name="whatsapp"
            type="tel"
            aria-label="South African WhatsApp number"
            aria-describedby="whatsapp-hint"
            placeholder="WhatsApp number"
            autoComplete="tel-national"
            inputMode="tel"
            className="input-field pl-[5.75rem]"
            required
          />
        </div>
        <p id="whatsapp-hint" className="mt-1.5 px-1 text-meta text-white/40">
          Type it as usual, e.g. 082 123 4567
        </p>
      </div>

      <fieldset>
        <legend className="mb-2 px-1 text-meta font-medium text-white/50">I’m joining as… (pick all that apply)</legend>
        <div className="flex flex-wrap gap-2">
          {ROLES.map((r) => (
            <label key={r.value} className="cursor-pointer">
              <input
                type="checkbox"
                name="roles"
                value={r.value}
                onChange={() => setLocalError("")}
                className="peer sr-only"
              />
              <span className="inline-block rounded-full border border-ink-600 px-4 py-2 text-body font-semibold text-white/70 transition peer-checked:border-pitch peer-checked:bg-pitch/10 peer-checked:text-pitch peer-focus-visible:ring-2 peer-focus-visible:ring-pitch">
                {r.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 px-1 text-meta font-medium text-white/50">
          Where do you usually play? (pick all that apply)
        </legend>
        <div className="flex flex-wrap gap-2">
          {NEIGHBOURHOODS.map((n) => (
            <label key={n} className="cursor-pointer">
              <input
                type="checkbox"
                name="neighbourhoods"
                value={n}
                checked={areas.includes(n)}
                onChange={() => toggleArea(n)}
                className="peer sr-only"
              />
              <span className="inline-block rounded-full border border-ink-600 px-3 py-1.5 text-meta font-medium text-white/60 transition peer-checked:border-pitch peer-checked:bg-pitch/10 peer-checked:text-pitch peer-focus-visible:ring-2 peer-focus-visible:ring-pitch">
                {n}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <input type="hidden" name="home_neighbourhood" value={homeArea} />
      {areas.length > 1 && (
        <fieldset className="surface-sunken p-3">
          <legend className="sr-only">Your home area</legend>
          <p className="mb-2 text-meta font-medium text-white/70">Which one’s home? (where you play most)</p>
          <div className="flex flex-wrap gap-2">
            {areas.map((n) => (
              <label key={n} className="cursor-pointer">
                <input
                  type="radio"
                  name="home_pick"
                  value={n}
                  checked={homeArea === n}
                  onChange={() => setHome(n)}
                  className="peer sr-only"
                />
                <span className="inline-block rounded-full border border-ink-600 px-3 py-1.5 text-meta font-medium text-white/60 transition peer-checked:border-pitch peer-checked:bg-pitch peer-checked:text-ink-900 peer-focus-visible:ring-2 peer-focus-visible:ring-pitch">
                  {homeArea === n && "🏠 "}
                  {n}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <fieldset>
        <legend className="mb-2 px-1 text-meta font-medium text-white/50">When do you usually play? (optional)</legend>
        <div className="flex flex-wrap gap-2">
          {AVAILABILITY.map((a) => (
            <label key={a.value} className="cursor-pointer">
              <input type="checkbox" name="availability" value={a.value} className="peer sr-only" />
              <span className="inline-block rounded-full border border-ink-600 px-3 py-1.5 text-meta font-medium text-white/60 transition peer-checked:border-electric peer-checked:bg-electric/15 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-electric">
                {a.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-3 border-t border-ink-700 pt-4">
        <Check name="consent_profile" required>
          {CONSENT_COPY.profile}
        </Check>
        <Check name="consent_email">{CONSENT_COPY.email}</Check>
        <Check name="consent_whatsapp">{CONSENT_COPY.whatsapp}</Check>
        {/* New tab, so a half-filled form isn't lost. */}
        <p className="pl-8 text-meta text-white/40">
          How we use your details:{" "}
          <a href="/privacy" target="_blank" rel="noopener" className="underline hover:text-white/70">
            privacy policy
          </a>
        </p>
      </div>

      {/* Honeypot — hidden from people, tempting to bots. */}
      <input name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      {refCode && <input type="hidden" name="ref" value={refCode} />}
      {source && <input type="hidden" name="source" value={source} />}

      {error && (
        <p role="alert" className="text-body text-red-400">
          {error}
        </p>
      )}

      <SubmitButton />
      <p className="text-center text-meta text-white/35">
        Change your mind any time: reply STOP on WhatsApp, or email{" "}
        <a href="mailto:5sfindr@gmail.com" className="underline">
          5sfindr@gmail.com
        </a>{" "}
        to update or delete your details.
      </p>
    </form>
  );
}

function Joined({
  code,
  position,
  referrals,
  communityUrl,
  siteUrl,
}: NonNullable<WaitlistState["joined"]> & { siteUrl: string }) {
  const [copied, setCopied] = useState(false);
  const link = `${siteUrl}/?ref=${code}`;
  const shareText = `I just joined the 5sFindr waitlist — find or fill a 5-a-side in Cape Town. Join the founding squad: ${link}`;

  async function copy() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="card-hero space-y-5 p-6 text-center">
      <div>
        <p className="section-label">You’re on the list</p>
        <p className="mt-1 text-display font-black text-pitch">#{position}</p>
        <p className="mt-1 text-body text-white/60">
          Welcome to the founding squad. We’ll be in touch before launch.
        </p>
      </div>

      <div className="surface-sunken space-y-3 p-4">
        <p className="text-body font-semibold">Bring your mates</p>
        <p className="truncate text-meta text-white/50">{link}</p>
        <div className="flex gap-2">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary flex-1"
            data-umami-event="waitlist-share"
          >
            Share on WhatsApp
          </a>
          <button type="button" onClick={copy} className="btn-outline shrink-0 px-4">
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </div>
        {referrals > 0 && (
          <p className="text-meta text-pitch">
            {referrals} {referrals === 1 ? "mate has" : "mates have"} joined with your link.
          </p>
        )}
      </div>

      <a
        href={communityUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-outline block"
        data-umami-event="waitlist-community"
      >
        Join the 5sFindr WhatsApp group
      </a>
    </div>
  );
}
