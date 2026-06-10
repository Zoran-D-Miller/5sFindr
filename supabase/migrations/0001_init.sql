-- ════════════════════════════════════════════════════════════════════════
--  5sFindr — Initial schema (Phase 0)
--  Postgres / Supabase.  Run with:  supabase db reset   (or push to remote)
--
--  Models the finalized economy:
--   • Subscription (R20/mo membership) and Token (R20 recyclable deposit)
--     are STRICTLY SEPARATE ledgers — they never cross over.
--   • Free tier: signup, profile, view feed, view public profiles.
--   • Premium tier: create matches, join matches, leaderboard, shirt colors,
--     Man-of-the-Match voting/trophies.
--   • On signup: 30-day Premium trial (+ referral weeks) AND 1 free token,
--     granted automatically via the handle_new_user() trigger.
-- ════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;      -- gen_random_bytes / gen_random_uuid

-- ─────────────────────────────────────────────
--  ENUMS
-- ─────────────────────────────────────────────
create type position_enum     as enum ('GK','DEF','MID','FWD','ANY');
create type venue_type         as enum ('official_court','open_area');
create type join_mode          as enum ('instant','manual');
create type subscription_state as enum ('trialing','active','past_due','cancelled','free');
create type match_status       as enum ('draft','open','full','in_progress','completed','cancelled');
create type participant_status as enum ('requested','accepted','rejected','cancelled_early','cancelled_late','no_show','attended');
create type team_color         as enum ('light','dark');
create type check_in_method    as enum ('gps','match_code');
create type token_status       as enum ('available','committed','forfeited','consumed');
create type token_txn_type     as enum ('purchase','signup_grant','commit','return','refund','forfeit');

-- ─────────────────────────────────────────────
--  Shared updated_at trigger
-- ─────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ═════════════════════════════════════════════
--  PROFILES   (1:1 with auth.users)
-- ═════════════════════════════════════════════
create table public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  name                text not null default 'New Baller',
  profile_picture_url text,
  neighborhood        text,
  skill_level         int  not null default 3 check (skill_level between 1 and 5),
  preferred_positions position_enum[] not null default '{ANY}',
  weekly_availability jsonb,                       -- { "mon": ["18:00-20:00"], ... }

  -- Public sharing & social
  public_slug         text not null unique,        -- 5sfindr.com/p/<slug>
  instagram_url       text,
  tiktok_url          text,

  -- Reliability (starts perfect)
  reliability_score   numeric(5,2) not null default 100 check (reliability_score between 0 and 100),
  games_played        int not null default 0,
  games_missed        int not null default 0,      -- bailed / ghosted

  -- Trophies (Premium feature)
  motm_count          int not null default 0,

  -- Referral loop
  referral_code       text not null unique,
  referred_by_id      uuid references public.profiles(id) on delete set null,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index profiles_neighborhood_idx on public.profiles (neighborhood);
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ═════════════════════════════════════════════
--  SUBSCRIPTIONS   (Paystack-backed, R20/mo membership)
-- ═════════════════════════════════════════════
create table public.subscriptions (
  id                         uuid primary key default gen_random_uuid(),
  user_id                    uuid not null unique references public.profiles(id) on delete cascade,
  state                      subscription_state not null default 'trialing',

  paystack_customer_code     text,
  paystack_subscription_code text,
  paystack_email_token       text,                 -- required to cancel via Paystack API

  -- First-month trial + referral free-weeks roll into free_until
  free_until                 timestamptz,          -- entitled premium with no charge until this date
  current_period_end         timestamptz,
  cancel_at_period_end       boolean not null default false,

  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);
create trigger subscriptions_set_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- Single source of truth for "is this user Premium right now?"
create or replace function public.is_premium(uid uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.subscriptions s
    where s.user_id = uid
      and (
        s.state = 'active'
        or (s.state = 'trialing' and coalesce(s.free_until, s.current_period_end, now()) > now())
      )
  );
$$;

-- ═════════════════════════════════════════════
--  TOKENS   (R20 recyclable commitment deposit) + LEDGER
--  available-balance = count(tokens where status = 'available')
-- ═════════════════════════════════════════════
create table public.tokens (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null references public.profiles(id) on delete cascade,
  status             token_status not null default 'available',
  committed_match_id uuid,                          -- FK added after matches table exists
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index tokens_owner_status_idx on public.tokens (owner_id, status);
create trigger tokens_set_updated_at before update on public.tokens
  for each row execute function public.set_updated_at();

create table public.token_transactions (
  id         uuid primary key default gen_random_uuid(),
  token_id   uuid not null references public.tokens(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  type       token_txn_type not null,
  match_id   uuid,
  amount_zar int not null default 20,
  note       text,
  created_at timestamptz not null default now()
);
create index token_txns_user_idx on public.token_transactions (user_id, created_at desc);

-- ═════════════════════════════════════════════
--  LOCATIONS   (seeded SA venues + custom drop-a-pin)
-- ═════════════════════════════════════════════
create table public.locations (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  type              venue_type not null,
  address           text,
  neighborhood      text,
  latitude          double precision not null,
  longitude         double precision not null,
  is_seeded         boolean not null default false,  -- true = curated SA venue
  geofence_radius_m int not null default 200,
  created_by_id     uuid references public.profiles(id) on delete set null,  -- null for seeded
  created_at        timestamptz not null default now()
);
create index locations_neighborhood_idx on public.locations (neighborhood);

-- ═════════════════════════════════════════════
--  MATCHES   (the lifecycle core)
-- ═════════════════════════════════════════════
create table public.matches (
  id                    uuid primary key default gen_random_uuid(),
  organizer_id          uuid not null references public.profiles(id) on delete cascade,
  location_id           uuid not null references public.locations(id) on delete restrict,

  title                 text,
  description           text,
  venue_type            venue_type not null,
  kickoff_at            timestamptz not null,
  duration_min          int not null default 60,
  ends_at               timestamptz not null,        -- kickoff_at + duration_min
  max_players           int not null default 10,     -- 5-a-side
  price_per_player_zar  int not null default 0,       -- venue fee, settled OFF-platform in v1

  join_mode             join_mode not null default 'manual',
  -- Instant-booking auto-accept criteria:
  min_skill_level       int,
  required_positions    position_enum[],
  min_reliability_score numeric(5,2),

  status                match_status not null default 'open',
  teams_assigned        boolean not null default false,

  -- Secondary verification layer (4-digit offline code)
  match_code            text,                         -- visible to organizer only (RLS)
  match_code_valid_until timestamptz,                 -- kickoff_at → ends_at + 60 min

  -- Viral share
  share_slug            text not null unique,         -- 5sfindr.com/m/<slug>

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index matches_status_kickoff_idx on public.matches (status, kickoff_at);
create trigger matches_set_updated_at before update on public.matches
  for each row execute function public.set_updated_at();

-- now that matches exists, wire the deferred token → match FK
alter table public.tokens
  add constraint tokens_committed_match_fk
  foreign key (committed_match_id) references public.matches(id) on delete set null;

-- ═════════════════════════════════════════════
--  MATCH_PLAYERS   (join + attendance + token link)
-- ═════════════════════════════════════════════
create table public.match_players (
  id              uuid primary key default gen_random_uuid(),
  match_id        uuid not null references public.matches(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,

  status          participant_status not null default 'requested',
  position        position_enum,
  team_color      team_color,                          -- assigned when match fills
  token_id        uuid unique references public.tokens(id) on delete set null,  -- the committed token

  requested_at    timestamptz not null default now(),
  responded_at    timestamptz,
  cancelled_at    timestamptz,

  -- Dual-layer verification
  check_in_method check_in_method,
  checked_in_at   timestamptz,
  check_in_lat    double precision,
  check_in_lng    double precision,

  unique (match_id, user_id)                            -- one slot per user per match
);
create index match_players_match_status_idx on public.match_players (match_id, status);

-- now-known match_id references on token_transactions/tokens are soft (no hard FK on txns
-- so the audit trail survives match deletion); enforce on tokens only (above).

-- ═════════════════════════════════════════════
--  REFERRALS   (1 free week to referrer per signup)
-- ═════════════════════════════════════════════
create table public.referrals (
  id             uuid primary key default gen_random_uuid(),
  referrer_id    uuid not null references public.profiles(id) on delete cascade,
  referred_id    uuid not null unique references public.profiles(id) on delete cascade,
  reward_granted boolean not null default false,
  created_at     timestamptz not null default now()
);

-- ═════════════════════════════════════════════
--  MATCH_VOTES   (Man of the Match — Premium feature)
-- ═════════════════════════════════════════════
create table public.match_votes (
  id          uuid primary key default gen_random_uuid(),
  match_id    uuid not null references public.matches(id) on delete cascade,
  voter_id    uuid not null references public.profiles(id) on delete cascade,
  votee_id    uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (match_id, voter_id),                          -- one vote per voter per match
  check (voter_id <> votee_id)                          -- can't vote for yourself
);
create index match_votes_match_idx on public.match_votes (match_id);

-- ═════════════════════════════════════════════
--  LEADERBOARD   (Premium-visible view; ranks by trophies then reliability)
-- ═════════════════════════════════════════════
create or replace view public.leaderboard as
  select
    p.id,
    p.name,
    p.profile_picture_url,
    p.neighborhood,
    p.skill_level,
    p.motm_count,
    p.reliability_score,
    p.games_played,
    rank() over (order by p.motm_count desc, p.reliability_score desc, p.games_played desc) as position
  from public.profiles p;

-- ════════════════════════════════════════════════════════════════════════
--  ACTIVATION TRIGGER
--  On every new auth.users row, atomically:
--    1. create profile (unique referral_code + public_slug, name/referral from metadata)
--    2. start a 30-day Premium trial subscription
--    3. grant ONE free 'available' token (+ signup_grant ledger entry)
--    4. if signed up via a referral code: record referral + add 7 free days
--       to the referrer's subscription
-- ════════════════════════════════════════════════════════════════════════
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_name        text;
  v_ref_code    text;
  v_slug        text;
  v_my_code     text;
  v_referrer_id uuid;
  v_token_id    uuid;
begin
  v_name     := coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), 'New Baller');
  v_ref_code := new.raw_user_meta_data->>'referral_code';   -- the code that referred THIS user

  -- generate unique-ish slug + personal referral code
  v_slug    := lower(regexp_replace(v_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || encode(gen_random_bytes(3), 'hex');
  v_my_code := upper(encode(gen_random_bytes(4), 'hex'));

  -- resolve referrer (if any)
  if v_ref_code is not null then
    select id into v_referrer_id from public.profiles where referral_code = v_ref_code limit 1;
  end if;

  -- 1) profile
  insert into public.profiles (id, name, public_slug, referral_code, referred_by_id)
  values (new.id, v_name, v_slug, v_my_code, v_referrer_id);

  -- 2) 30-day Premium trial
  insert into public.subscriptions (user_id, state, free_until)
  values (new.id, 'trialing', now() + interval '30 days');

  -- 3) one free token + ledger entry
  insert into public.tokens (owner_id, status) values (new.id, 'available') returning id into v_token_id;
  insert into public.token_transactions (token_id, user_id, type, note)
  values (v_token_id, new.id, 'signup_grant', 'Welcome token — your first match is on us');

  -- 4) referral reward: +7 days to the referrer
  if v_referrer_id is not null then
    insert into public.referrals (referrer_id, referred_id, reward_granted)
    values (v_referrer_id, new.id, true);

    update public.subscriptions
       set free_until = greatest(coalesce(free_until, now()), now()) + interval '7 days'
     where user_id = v_referrer_id;
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ════════════════════════════════════════════════════════════════════════
--  ROW LEVEL SECURITY
--  Trusted economy mutations (tokens, votes, attendance settlement) happen
--  server-side with the service-role key, which bypasses RLS. These policies
--  govern what the *browser* (anon/authenticated) may read/write directly.
-- ════════════════════════════════════════════════════════════════════════
alter table public.profiles           enable row level security;
alter table public.subscriptions      enable row level security;
alter table public.tokens             enable row level security;
alter table public.token_transactions enable row level security;
alter table public.locations          enable row level security;
alter table public.matches            enable row level security;
alter table public.match_players      enable row level security;
alter table public.referrals          enable row level security;
alter table public.match_votes        enable row level security;

-- PROFILES: public read (shareable profiles); only owner updates
create policy "profiles are public"        on public.profiles for select using (true);
create policy "owner updates own profile"  on public.profiles for update using (auth.uid() = id);

-- SUBSCRIPTIONS: owner reads own; no client writes (Paystack webhook uses service role)
create policy "owner reads own sub"        on public.subscriptions for select using (auth.uid() = user_id);

-- TOKENS + LEDGER: owner reads own; no client writes
create policy "owner reads own tokens"     on public.tokens for select using (auth.uid() = owner_id);
create policy "owner reads own token txns" on public.token_transactions for select using (auth.uid() = user_id);

-- LOCATIONS: anyone reads; Premium users may add custom pins
create policy "locations are public"       on public.locations for select using (true);
create policy "premium adds locations"     on public.locations for insert
  with check (auth.uid() = created_by_id and public.is_premium(auth.uid()));

-- MATCHES: public read of live matches; only PREMIUM users may create; organizer updates
create policy "live matches are public"    on public.matches for select
  using (status in ('open','full','in_progress','completed'));
create policy "organizer reads own drafts" on public.matches for select using (auth.uid() = organizer_id);
create policy "premium creates matches"    on public.matches for insert
  with check (auth.uid() = organizer_id and public.is_premium(auth.uid()));
create policy "organizer updates match"    on public.matches for update using (auth.uid() = organizer_id);

-- MATCH_PLAYERS: the player and the organizer can read; player may request-to-join only if PREMIUM
create policy "player or organizer reads roster" on public.match_players for select
  using (
    auth.uid() = user_id
    or auth.uid() in (select organizer_id from public.matches m where m.id = match_id)
  );
create policy "premium requests to join"   on public.match_players for insert
  with check (auth.uid() = user_id and public.is_premium(auth.uid()));
-- (status transitions, token commit and team assignment are server-side / service role)

-- REFERRALS: referrer reads their own referrals
create policy "referrer reads referrals"   on public.referrals for select using (auth.uid() = referrer_id);

-- MATCH_VOTES: a Premium participant may cast one vote; everyone may read tallies
create policy "votes are public"           on public.match_votes for select using (true);
create policy "premium participant votes"  on public.match_votes for insert
  with check (
    auth.uid() = voter_id
    and public.is_premium(auth.uid())
    and exists (
      select 1 from public.match_players mp
      where mp.match_id = match_votes.match_id and mp.user_id = auth.uid() and mp.status = 'attended'
    )
  );
