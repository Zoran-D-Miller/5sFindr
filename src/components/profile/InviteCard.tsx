"use client";

import { useState } from "react";
import { track } from "@/lib/analytics";
import { UNLOCK } from "@/lib/areas";
import { foundingNo, foundingTier, FOUNDING_LABEL } from "@/lib/positions";

// Profile header for S5: Founding Member number + personal invite link.
// A mate who claims a spot with the link counts as a player in the areas they
// pick, so it moves those areas toward opening (src/server/areaProgress.ts).
export function InviteCard({
  foundingNumber,
  code,
  invited,
  siteUrl,
  areaLabel,
}: {
  foundingNumber: number | null;
  code: string;
  invited: number;
  siteUrl: string;
  areaLabel: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const tier = foundingTier(foundingNumber);
  const link = `${siteUrl}/?ref=${code}`;
  const shareText = areaLabel
    ? `Free 5-a-side games in Cape Town on 5sFindr. ${areaLabel} opens at ${UNLOCK.players} players, and you count if you join with my link: ${link}`
    : `Free 5-a-side games in Cape Town on 5sFindr. Join with my link: ${link}`;

  async function copy() {
    track("share", { via: "profile_copy" });
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <section className="card space-y-4 p-5">
      {tier && foundingNumber != null && (
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-display text-heading font-extrabold uppercase tracking-[0.15em] text-white/60">
            {FOUNDING_LABEL[tier]}
          </p>
          <p className="font-display text-display font-extrabold text-pitch">{foundingNo(foundingNumber)}</p>
        </div>
      )}
      <div className="space-y-3">
        <div>
          <p className="text-body font-semibold">Invite mates, open your area sooner</p>
          <p className="text-meta text-white/50">
            Everyone who joins with your link counts toward the {UNLOCK.players} players their area needs.
          </p>
        </div>
        <p className="truncate rounded-card border border-ink-700 bg-ink-900 px-3 py-2 text-meta text-white/60">{link}</p>
        <div className="flex gap-2">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
            onClick={() => track("share", { via: "profile_whatsapp" })}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary flex-1"
          >
            Share on WhatsApp
          </a>
          <button type="button" onClick={copy} className="btn-outline shrink-0 px-4">
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </div>
        <p className="text-meta text-white/50">
          {invited > 0
            ? `${invited} ${invited === 1 ? "mate has" : "mates have"} joined with your link.`
            : "No one has joined with your link yet."}
        </p>
      </div>
    </section>
  );
}
