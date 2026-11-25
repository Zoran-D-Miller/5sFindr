"use client";

import { useState } from "react";
import { track } from "@/lib/analytics";

// Shares a generated card image (next/og). On phones that can share files
// (iOS Safari, Android Chrome) this opens the share sheet with the PNG, so it
// can go straight to an IG story or WhatsApp. Elsewhere it opens the image to
// save it.
export function ShareImage({
  src,
  filename,
  label,
  via,
  text,
}: {
  src: string;
  filename: string;
  label: string;
  via: string;
  text?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  async function share() {
    setNote("");
    setBusy(true);
    track("share", { via });
    try {
      const res = await fetch(src);
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const file = new File([blob], filename, { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], text });
      } else {
        setNote("fallback");
      }
    } catch (err) {
      // A popup opened after an await gets blocked, so offer a link instead.
      if ((err as Error)?.name !== "AbortError") setNote("fallback");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={share} disabled={busy} className="btn-primary w-full disabled:opacity-60">
        {busy ? "Making the image…" : label}
      </button>
      {note === "fallback" && (
        <p className="mt-2 text-center text-xs text-white/50">
          <a href={src} target="_blank" rel="noopener" download={filename} className="font-semibold text-pitch underline">
            Open the image
          </a>
          , save it, then post it.
        </p>
      )}
    </div>
  );
}
