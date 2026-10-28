// Waitlist options shared by the form and the server action. Values must stay
// in sync with the CHECK constraints in supabase/migrations/0017_waitlist.sql
// and 0022_waitlist_multi.sql (several roles, several areas + one home area).

// Bump when the consent wording below changes — stored per signup (POPIA).
export const CONSENT_VERSION = "2026-10-24";

export const CONSENT_COPY = {
  profile: "Save my details so 5sFindr can set up my profile at launch.",
  email: "Email me launch news and game invites.",
  whatsapp: "WhatsApp me launch news and game invites.",
} as const;

export const NEIGHBOURHOODS = [
  "City Bowl",
  "Green Point / Sea Point",
  "Woodstock / Observatory",
  "Rondebosch / Newlands",
  "Claremont / Kenilworth",
  "Wynberg / Southern Suburbs",
  "Pinelands",
  "Century City / Milnerton",
  "Bellville / Northern Suburbs",
  "Athlone / Cape Flats",
  "Just visiting Cape Town",
  "Other",
] as const;

export const ROLES = [
  { value: "player", label: "Player" },
  { value: "organizer", label: "I run a regular game" },
  { value: "venue", label: "A venue" },
] as const;

export const AVAILABILITY = [
  { value: "weekday_mornings", label: "Weekday mornings" },
  { value: "weekday_lunch", label: "Weekday lunch" },
  { value: "weekday_evenings", label: "Weekday evenings" },
  { value: "weekend_mornings", label: "Weekend mornings" },
  { value: "weekend_afternoons", label: "Weekend afternoons" },
  { value: "weekend_evenings", label: "Weekend evenings" },
] as const;

export type WaitlistState = {
  error?: string;
  joined?: { code: string; position: number; referrals: number; communityUrl: string };
};
