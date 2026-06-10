"use client";

import { useState } from "react";

// Referral loop: every signup via this link adds a free week to the user's trial.
export function ReferralCard({ code, siteUrl }: { code: string; siteUrl: string }) {
  const [copied, setCopied] = useState(false);
  const link = `${siteUrl}/signup?ref=${code}`;

  async function copy() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <section className="rounded-3xl border border-ink-700 bg-ink-800/60 p-6">
      <p className="text-sm font-semibold text-white/70">Invite a baller, earn a week</p>
      <p className="mt-1 text-xs text-white/40">
        Every mate who signs up with your link adds 7 free days to your Premium.
      </p>
      <div className="mt-4 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-xl border border-ink-600 bg-ink-900 px-3 py-2.5 text-sm text-white/70">
          {link}
        </code>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded-xl bg-pitch px-4 py-2.5 text-sm font-bold text-ink-900 transition hover:bg-pitch-dark"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
    </section>
  );
}
