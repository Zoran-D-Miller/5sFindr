"use client";

import { useState } from "react";
import { buildGroupList } from "@/lib/whatsapp";
import { track } from "@/lib/analytics";

// One-tap share: the game as a WhatsApp group list (numbered names + spots
// left + the /m/<slug> link). Copy for any other chat.
export function WhatsAppInvite(props: {
  title?: string | null;
  venue: string;
  kickoffIso: string;
  pricePerPlayer: number;
  names: string[];
  maxPlayers: number;
  shareSlug: string;
  siteUrl: string;
}) {
  const [copied, setCopied] = useState(false);
  const { text, whatsappUrl } = buildGroupList(props);

  async function copy() {
    track("share", { via: "copy" });
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <section className="rounded-2xl border border-pitch/30 bg-pitch/5 p-4">
      <h3 className="text-sm font-bold uppercase tracking-wide text-white/50">Share to your group</h3>
      <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-xl bg-ink-900/60 p-3 font-sans text-xs leading-relaxed text-white/70">
        {text}
      </pre>
      <div className="mt-3 flex gap-2">
        <a
          href={whatsappUrl}
          onClick={() => track("share", { via: "whatsapp" })}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 rounded-2xl bg-pitch py-3 text-center font-bold text-ink-900 shadow-glow transition hover:bg-pitch-dark"
        >
          Share to WhatsApp
        </a>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded-2xl border border-ink-600 px-4 font-semibold text-white/70 transition hover:border-pitch hover:text-white"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
      <p className="mt-2 text-center text-[11px] text-white/30">
        Anyone with the link taps “I’m in”. No app or account needed.
      </p>
    </section>
  );
}
