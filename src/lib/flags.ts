// Pre-launch: signed-out visitors only get the waitlist. On unless
// PRELAUNCH=false, so a missing env var can't expose the app by accident.
export const PRELAUNCH = process.env.PRELAUNCH !== "false";

// Hidden extras (PRODUCT-BRIEF.md "Keep vs hide"). All OFF unless the env var
// is exactly "true". NEXT_PUBLIC_ so client components read the same value
// (inlined at build time: change it in Vercel, then redeploy).
const on = (v: string | undefined) => v === "true";

export const FEATURES = {
  /** Subscription / Premium UI and the Premium gate on posting games. */
  premium: on(process.env.NEXT_PUBLIC_FLAG_PREMIUM),
  /** R20 tokens and /wallet. Keep in step with public.app_config.tokens_enabled in the DB. */
  tokens: on(process.env.NEXT_PUBLIC_FLAG_TOKENS),
  leaderboard: on(process.env.NEXT_PUBLIC_FLAG_LEADERBOARD),
  /** Man-of-the-Match voting + trophy. */
  motm: on(process.env.NEXT_PUBLIC_FLAG_MOTM),
  /** Light/dark shirt teams ("match tickets"). */
  shirts: on(process.env.NEXT_PUBLIC_FLAG_SHIRTS),
  /** Player ⇄ Organizer switcher on the feed. */
  roleSwitcher: on(process.env.NEXT_PUBLIC_FLAG_ROLE_SWITCHER),
  /** GPS + 4-digit code self check-in. Off = the organiser ticks attendance. */
  gpsCheckIn: on(process.env.NEXT_PUBLIC_FLAG_GPS_CHECKIN),
} as const;

/** /wallet only has something to show when Premium or tokens are on. */
export const WALLET_ENABLED = FEATURES.premium || FEATURES.tokens;
