// Umami funnel events (cloud.umami.is script, loaded in app/layout.tsx when
// NEXT_PUBLIC_UMAMI_WEBSITE_ID is set). No-op when the script isn't there
// (dev, previews, ad blockers). Event names are the funnel in PRODUCT-BRIEF.md.
export type FunnelEvent = "waitlist_submit" | "browse" | "im_in" | "post_game" | "share";

type Umami = { track: (name: string, data?: Record<string, string | number>) => void };

export function track(name: FunnelEvent, data?: Record<string, string | number>) {
  if (typeof window === "undefined") return;
  try {
    (window as unknown as { umami?: Umami }).umami?.track(name, data);
  } catch {
    // analytics must never break the app
  }
}
