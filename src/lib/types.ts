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
  avatar_url: string | null;
  phone_number: string | null;
  bio: string | null;
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
  founding_number: number | null;
  referral_code: string;
  referred_by_id: string | null;
}

export type FoundingTier = "baller" | "member" | null;

/** Public slice shown in the slide-up user drawer. */
export interface DrawerProfile {
  id: string;
  name: string;
  avatar_url: string | null;
  bio: string | null;
  neighborhood: string | null;
  preferred_positions: Position[];
  reliability_score: number;
  motm_count: number;
  founding_number: number | null;
  created_at: string;
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

export type ViewMode = "player" | "organizer";

export type TeamColor = "light" | "dark";
export type ParticipantStatus =
  | "requested"
  | "accepted"
  | "rejected"
  | "cancelled_early"
  | "cancelled_late"
  | "no_show"
  | "attended";

/** A player on a match roster (joined with their profile). */
export interface RosterEntry {
  user_id: string;
  status: ParticipantStatus;
  team_color: TeamColor | null;
  position: Position | null;
  name: string;
  skill_level: number;
  reliability_score: number;
}

export type VenueType = "official_court" | "open_area";
export type JoinMode = "instant" | "manual";
export type MatchStatus =
  | "draft"
  | "open"
  | "full"
  | "in_progress"
  | "completed"
  | "cancelled";

/** One row of the match_feed view — drives the /feed cards. */
export interface MatchFeedItem {
  id: string;
  title: string | null;
  kickoff_at: string;
  ends_at: string;
  venue_type: VenueType;
  join_mode: JoinMode;
  status: MatchStatus;
  max_players: number;
  price_per_player_zar: number;
  organizer_id: string;
  location_name: string;
  neighborhood: string | null;
  location_type: VenueType;
  latitude: number | null;
  longitude: number | null;
  spots_taken: number;
}

/** A seeded venue option for the create-match dropdown. */
export interface VenueOption {
  id: string;
  name: string;
  type: VenueType;
  neighborhood: string | null;
}

/** Payload the create-match form sends to the createMatch server action. */
export interface CreateMatchInput {
  venueMode: "seeded" | "custom";
  locationId?: string;
  customVenueName?: string;
  customNeighborhood?: string;
  title?: string;
  kickoffAtIso: string; // UTC ISO, converted from the organizer's local time client-side
  durationMin: number;
  maxPlayers: number;
  pricePerPlayerZar: number;
  joinMode: JoinMode;
  // Instant-booking auto-accept criteria (ignored when joinMode = "manual"):
  minSkillLevel?: number;
  requiredPositions?: Position[];
  minReliabilityScore?: number;
}

/** The editable slice of a profile (what the Profile Editor writes back). */
export type ProfileDraft = Pick<
  Profile,
  | "name"
  | "bio"
  | "avatar_url"
  | "neighborhood"
  | "skill_level"
  | "preferred_positions"
  | "weekly_availability"
  | "instagram_url"
  | "tiktok_url"
>;
