"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { guestJoin } from "@/server/actions/guest";
import { track } from "@/lib/analytics";

const TURNSTILE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

type Turnstile = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id?: string) => void;
};

// "I'm in" → first name + WhatsApp + POPIA tick → on the roster. No account.
export function GuestJoin({ matchId, startOpen = false }: { matchId: string; startOpen?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(startOpen);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [captcha, setCaptcha] = useState("");
  const [scriptReady, setScriptReady] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);

  useEffect(() => {
    const ts = (window as unknown as { turnstile?: Turnstile }).turnstile;
    if (!open || !TURNSTILE_KEY || !box.current || widget.current || !ts) return;
    widget.current = ts.render(box.current, {
      sitekey: TURNSTILE_KEY,
      appearance: "interaction-only",
      callback: (t: string) => setCaptcha(t),
      "expired-callback": () => setCaptcha(""),
    });
  }, [open, scriptReady]);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setError("");
    if (TURNSTILE_KEY && !captcha) {
      setError("One sec, checking you’re not a bot…");
      return;
    }
    start(async () => {
      const res = await guestJoin(matchId, {
        name: String(f.get("name") ?? ""),
        phone: String(f.get("phone") ?? ""),
        consent: f.get("consent") === "on",
        captchaToken: captcha,
      });
      if (res.ok) {
        track("im_in", { as: "guest" });
        router.refresh();
      } else {
        setError(res.error);
        setCaptcha("");
        const ts = (window as unknown as { turnstile?: Turnstile }).turnstile;
        if (widget.current) ts?.reset(widget.current);
      }
    });
  }

  if (!open) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full rounded-2xl bg-pitch py-3.5 text-center font-bold text-ink-900 shadow-glow transition hover:bg-pitch-dark"
        >
          I’m in
        </button>
        <p className="text-center text-xs text-white/40">Free. No account needed: just your name and WhatsApp.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-pitch/30 bg-pitch/5 p-4">
      {TURNSTILE_KEY && (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="afterInteractive"
          onReady={() => setScriptReady(true)}
        />
      )}
      <p className="text-sm font-bold">Claim your spot</p>
      <input name="name" placeholder="First name" autoComplete="given-name" maxLength={40} required className="input-field" />
      <input
        name="phone"
        type="tel"
        placeholder="WhatsApp number (082 123 4567)"
        autoComplete="tel"
        inputMode="tel"
        required
        className="input-field"
      />
      <label className="flex items-start gap-2 text-xs leading-relaxed text-white/60">
        <input type="checkbox" name="consent" required className="mt-0.5 accent-pitch" />
        <span>
          The organiser and 5sFindr can use my name and WhatsApp number to sort out this game. See the{" "}
          <a href="/privacy" target="_blank" rel="noopener" className="underline">privacy policy</a>.
        </span>
      </label>
      <div ref={box} />
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Adding you…" : "I’m in"}
      </button>
      {error && <p className="text-center text-sm text-red-400">{error}</p>}
    </form>
  );
}
