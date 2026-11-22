"use client";

import { useEffect } from "react";
import { track, type FunnelEvent } from "@/lib/analytics";

// Fires one Umami event when it mounts (server pages render this to log a
// funnel step). Retries briefly in case the Umami script is still loading.
export function TrackEvent({ name, data }: { name: FunnelEvent; data?: Record<string, string | number> }) {
  useEffect(() => {
    let tries = 0;
    const id = setInterval(() => {
      const ready = !!(window as unknown as { umami?: unknown }).umami;
      if (ready || ++tries > 10) {
        clearInterval(id);
        if (ready) track(name, data);
      }
    }, 300);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);
  return null;
}
