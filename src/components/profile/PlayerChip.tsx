"use client";

import { useState } from "react";
import { UserDrawer } from "./UserDrawer";

// A username with a "…" affordance that opens the premium slide-up drawer.
export function PlayerChip({
  userId,
  name,
  highlight = false,
}: {
  userId: string;
  name: string;
  highlight?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <span className="inline-flex items-center gap-1">
        <span className={highlight ? "font-bold text-pitch" : ""}>{name}</span>
        <button
          type="button"
          aria-label={`View ${name}`}
          onClick={() => setOpen(true)}
          className="grid h-6 w-6 place-items-center rounded-full text-white/40 transition hover:bg-ink-700 hover:text-white"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" />
          </svg>
        </button>
      </span>
      {open && <UserDrawer userId={userId} fallbackName={name} onClose={() => setOpen(false)} />}
    </>
  );
}

