// Domain types — mirror the Supabase column shapes (snake_case) from 0001_init.sql.

export type Position = "GK" | "DEF" | "MID" | "FWD" | "ANY";
export type SubscriptionState = "trialing" | "active" | "past_due" | "cancelled" | "free";
export type TokenStatus = "available" | "committed" | "forfeited" | "consumed";
export type TokenTxnType =
  | "purchase"
  | "signup_grant"
  | "commit"
  | "return"
  | "refund"
  | "forfeit";

export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type Daypart = "morning" | "afternoon" | "evening";
export type WeeklyAvailability = Partial<Record<DayKey, Daypart[]>>;

export interface Profile {
  id: string;
  name: string;
  profile_picture_url: string | null;
  neighborhood: string | null;
  skill_level: number; // 1–5
  preferred_positions: Position[];
  weekly_availability: WeeklyAvailability | null;
  public_slug: string;
  instagram_url: string | null;
  tiktok_url: string | null;
  reliability_score: number; // 0–100
  games_played: number;
  games_missed: number;
  motm_count: number;
  referral_code: string;
  referred_by_id: string | null;
}

export interface Subscription {
  state: SubscriptionState;
  free_until: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

export interface Token {
  id: string;
  status: TokenStatus;
  committed_match_id: string | null;
}

export interface TokenTransaction {
  id: string;
  type: TokenTxnType;
  amount_zar: number;
  note: string | null;
  match_id: string | null;
  created_at: string;
}

/** The editable slice of a profile (what the Profile Editor writes back). */
export type ProfileDraft = Pick<
  Profile,
  | "name"
  | "neighborhood"
  | "skill_level"
  | "preferred_positions"
  | "weekly_availability"
  | "instagram_url"
  | "tiktok_url"
>;
