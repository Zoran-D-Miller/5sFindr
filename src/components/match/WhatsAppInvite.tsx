"use client";

import { useState } from "react";
import { buildWhatsAppInvite } from "@/lib/whatsapp";

// Viral share. Builds the spec invite text + /m/<slug> link and opens WhatsApp;
// also offers a plain copy for any other group chat.
export function WhatsAppInvite({
  organizerName,
  venue,
  kickoffIso,
  shareSlug,
  siteUrl,
}: {
  organizerName: string;
  venue: string;
  kickoffIso: string;
  shareSlug: string;
  siteUrl: string;
}) {
  const [copied, setCopied] = useState(false);
  const { text, link, whatsappUrl } = buildWhatsAppInvite({
    organizerName,
    venue,
    kickoffIso,
    shareSlug,
    siteUrl,
  });

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <section className="rounded-2xl border border-ink-700 bg-ink-800/60 p-4">
      <h3 className="text-sm font-bold uppercase tracking-wide text-white/50">Fill the squad</h3>
      <p className="mt-1 text-xs text-white/40">
        Drop this in your WhatsApp group — newcomers claim a spot and you earn a free week per signup.
      </p>
      <div className="mt-3 flex gap-2">
        <a
          href={whatsappUrl}
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
      <p className="mt-2 truncate text-center text-[11px] text-white/30">{link}</p>
    </section>
  );
}
