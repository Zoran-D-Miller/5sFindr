-- ════════════════════════════════════════════════════════════════════════
--  5sFindr — CANONICAL SCHEMA (single source of truth)
--  Consolidated final state of migrations 0001–0011. Verified equivalent
--  to the migration chain via catalog signature diff.
--
--  Apply to a FRESH Supabase project's SQL Editor for a clean rebuild.
--  Assumes the Supabase platform provides: schema `auth` (auth.users,
--  auth.uid()), roles anon / authenticated / service_role, and the `storage`
--  schema. The §10 storage / realtime / pg_cron blocks are environment-guarded.
-- ════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────────────────
-- §1  ENUMS
-- ─────────────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────────
-- §2  SEQUENCES
-- ─────────────────────────────────────────────────────────────────────────
create sequence if not exists public.founding_seq;  -- founding-member ordinal

-- ─────────────────────────────────────────────────────────────────────────
-- §3  SHARED updated_at TRIGGER FUNCTION
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- §4  TABLES
-- ─────────────────────────────────────────────────────────────────────────

-- profiles (1:1 with auth.users)
create table public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  name                text not null default 'New Baller',
  profile_picture_url text,
  neighborhood        text,
  skill_level         int  not null default 3 check (skill_level between 1 and 5),
  preferred_positions position_enum[] not null default '{ANY}',
  weekly_availability jsonb,
  public_slug         text not null unique,
  instagram_url       text,
  tiktok_url          text,
  reliability_score   numeric(5,2) not null default 100 check (reliability_score between 0 and 100),
  games_played        int not null default 0,
  games_missed        int not null default 0,
  motm_count          int not null default 0,
  referral_code       text not null unique,
  referred_by_id      uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  -- columns appended by later migrations — kept in attnum order to match production:
  bio                    text,                              -- 0007
  avatar_url             text,                              -- 0007
  founding_number        int unique,                        -- 0007
  founding_bonus_awarded boolean not null default false,    -- 0007
  phone_number           text                               -- 0009
);
create index profiles_neighborhood_idx on public.profiles (neighborhood);

-- subscriptions (Paystack-backed, R20/mo)
create table public.subscriptions (
  id                         uuid primary key default gen_random_uuid(),
  user_id                    uuid not null unique references public.profiles(id) on delete cascade,
  state                      subscription_state not null default 'trialing',
  paystack_customer_code     text,
  paystack_subscription_code text,
  paystack_email_token       text,
  free_until                 timestamptz,
  current_period_end         timestamptz,
  cancel_at_period_end       boolean not null default false,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

-- tokens (R20 recyclable deposit) — committed_match_id FK added after matches
create table public.tokens (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null references public.profiles(id) on delete cascade,
  status             token_status not null default 'available',
  committed_match_id uuid,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index tokens_owner_status_idx on public.tokens (owner_id, status);

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

-- locations (seeded venues + custom typed fields; lat/lng NULLABLE)
create table public.locations (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  type              venue_type not null,
  address           text,
  neighborhood      text,
  latitude          double precision,
  longitude         double precision,
  is_seeded         boolean not null default false,
  geofence_radius_m int not null default 200,
  created_by_id     uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now()
);
create index locations_neighborhood_idx on public.locations (neighborhood);

-- matches
create table public.matches (
  id                    uuid primary key default gen_random_uuid(),
  organizer_id          uuid not null references public.profiles(id) on delete cascade,
  location_id           uuid not null references public.locations(id) on delete restrict,
  title                 text,
  description           text,
  venue_type            venue_type not null,
  kickoff_at            timestamptz not null,
  duration_min          int not null default 60,
  ends_at               timestamptz not null,
  max_players           int not null default 10,
  price_per_player_zar  int not null default 0,
  join_mode             join_mode not null default 'manual',
  min_skill_level       int,
  required_positions    position_enum[],
  min_reliability_score numeric(5,2),
  status                match_status not null default 'open',
  teams_assigned        boolean not null default false,
  match_code            text,
  match_code_valid_until timestamptz,
  share_slug            text not null unique,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  -- appended by 0007 — kept in attnum order to match production:
  motm_awarded          boolean not null default false,
  motm_winner_id        uuid references public.profiles(id) on delete set null
);
create index matches_status_kickoff_idx on public.matches (status, kickoff_at);

alter table public.tokens
  add constraint tokens_committed_match_fk
  foreign key (committed_match_id) references public.matches(id) on delete set null;

-- match_players (join + attendance + token link)
create table public.match_players (
  id              uuid primary key default gen_random_uuid(),
  match_id        uuid not null references public.matches(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  status          participant_status not null default 'requested',
  position        position_enum,
  team_color      team_color,
  token_id        uuid unique references public.tokens(id) on delete set null,
  requested_at    timestamptz not null default now(),
  responded_at    timestamptz,
  cancelled_at    timestamptz,
  check_in_method check_in_method,
  checked_in_at   timestamptz,
  check_in_lat    double precision,
  check_in_lng    double precision,
  unique (match_id, user_id)
);
create index match_players_match_status_idx on public.match_players (match_id, status);

create table public.referrals (
  id             uuid primary key default gen_random_uuid(),
  referrer_id    uuid not null references public.profiles(id) on delete cascade,
  referred_id    uuid not null unique references public.profiles(id) on delete cascade,
  reward_granted boolean not null default false,
  created_at     timestamptz not null default now()
);

create table public.match_votes (
  id          uuid primary key default gen_random_uuid(),
  match_id    uuid not null references public.matches(id) on delete cascade,
  voter_id    uuid not null references public.profiles(id) on delete cascade,
  votee_id    uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (match_id, voter_id),
  check (voter_id <> votee_id)
);
create index match_votes_match_idx on public.match_votes (match_id);

-- platform ledger (forfeited deposits to 5sFindr)
create table public.platform_ledger (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles(id) on delete set null,
  match_id   uuid references public.matches(id) on delete set null,
  token_id   uuid,
  amount_zar int  not null default 20,
  reason     text not null,
  created_at timestamptz not null default now()
);

-- match codes (organizer-only; hidden from players)
create table public.match_codes (
  match_id    uuid primary key references public.matches(id) on delete cascade,
  code        text not null,
  valid_until timestamptz not null,
  created_at  timestamptz not null default now()
);

-- follows (social graph)
create table public.follows (
  id           uuid primary key default gen_random_uuid(),
  follower_id  uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  unique (follower_id, following_id),
  check (follower_id <> following_id)
);
create index follows_following_idx on public.follows(following_id);
create index follows_follower_idx  on public.follows(follower_id);

-- region match pings (Ping Nearby Ballers, Layer 1)
create table public.match_pings (
  id           uuid primary key default gen_random_uuid(),
  match_id     uuid not null references public.matches(id) on delete cascade,
  organizer_id uuid not null references public.profiles(id) on delete cascade,
  neighborhood text,
  message      text not null,
  created_at   timestamptz not null default now()
);
create index match_pings_region_idx on public.match_pings(neighborhood, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────
-- §5  FUNCTIONS
-- ─────────────────────────────────────────────────────────────────────────

-- Premium gate. SECURITY DEFINER: it must read ANY user's subscription state
-- (subscriptions RLS only exposes the caller's own row, which would otherwise
-- make is_premium(other) always false — breaking the leaderboard filter).
create or replace function public.is_premium(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.subscriptions s
    where s.user_id = uid
      and (
        s.state = 'active'
        or (s.state = 'trialing' and coalesce(s.free_until, s.current_period_end, now()) > now())
      )
  );
$$;

-- Roster-visibility helpers (SECURITY DEFINER → avoid RLS recursion)
create or replace function public.is_match_organizer(p_match_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.matches m where m.id = p_match_id and m.organizer_id = auth.uid());
$$;

create or replace function public.is_match_participant(p_match_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.match_players mp
    where mp.match_id = p_match_id and mp.user_id = auth.uid()
      and mp.status in ('requested','accepted','attended')
  );
$$;

-- Reliability = played / (played + missed); 100 when no history
create or replace function public.recompute_reliability(p_uid uuid)
returns void language sql security definer set search_path = public as $$
  update public.profiles set reliability_score = case
    when (games_played + games_missed) = 0 then 100
    else round(100.0 * games_played / (games_played + games_missed), 2) end
  where id = p_uid;
$$;

-- Balanced Light/Dark assignment
create or replace function public.assign_teams(p_match_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  with ranked as (
    select mp.id, row_number() over (order by p.skill_level desc, mp.requested_at) as rn
    from public.match_players mp
    join public.profiles p on p.id = mp.user_id
    where mp.match_id = p_match_id and mp.status in ('accepted','attended')
  )
  update public.match_players mp
     set team_color = case when (r.rn % 2) = 1 then 'light'::team_color else 'dark'::team_color end
    from ranked r where r.id = mp.id;
  update public.matches set teams_assigned = true where id = p_match_id;
end;
$$;

-- Signup activation trigger fn: profile + 30d trial + 1 token + referral +7d,
-- capturing phone_number and stamping the founding ordinal.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_name        text;
  v_ref_code    text;
  v_phone       text;
  v_slug        text;
  v_my_code     text;
  v_referrer_id uuid;
  v_token_id    uuid;
begin
  v_name     := coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), 'New Baller');
  v_ref_code := new.raw_user_meta_data->>'referral_code';
  v_phone    := nullif(trim(new.raw_user_meta_data->>'phone_number'), '');
  v_slug     := lower(regexp_replace(v_name, '[^a-zA-Z0-9]+', '-', 'g'))
                || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  v_my_code  := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  if v_ref_code is not null then
    select id into v_referrer_id from public.profiles where referral_code = v_ref_code limit 1;
  end if;

  insert into public.profiles (id, name, phone_number, public_slug, referral_code, referred_by_id, founding_number)
  values (new.id, v_name, v_phone, v_slug, v_my_code, v_referrer_id, nextval('public.founding_seq'));

  insert into public.subscriptions (user_id, state, free_until)
  values (new.id, 'trialing', now() + interval '30 days');

  insert into public.tokens (owner_id, status) values (new.id, 'available') returning id into v_token_id;
  insert into public.token_transactions (token_id, user_id, type, note)
  values (v_token_id, new.id, 'signup_grant', 'Welcome token — your first match is on us');

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

-- Join: Premium + token gate, race-safe token commit, instant/manual
create or replace function public.join_match(p_match_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_match public.matches%rowtype;
  v_prof public.profiles%rowtype;
  v_token uuid;
  v_taken int;
  v_meets boolean;
  v_status participant_status;
begin
  if v_uid is null then raise exception 'NOT_AUTHED'; end if;
  if not public.is_premium(v_uid) then raise exception 'NOT_PREMIUM'; end if;
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'NO_MATCH'; end if;
  if v_match.organizer_id = v_uid then raise exception 'OWN_MATCH'; end if;
  if v_match.status <> 'open' then raise exception 'NOT_OPEN'; end if;
  if v_match.kickoff_at <= now() then raise exception 'STARTED'; end if;
  if exists (select 1 from public.match_players where match_id = p_match_id and user_id = v_uid
             and status in ('requested','accepted','attended')) then raise exception 'ALREADY_IN'; end if;

  select * into v_prof from public.profiles where id = v_uid;
  select id into v_token from public.tokens
   where owner_id = v_uid and status = 'available' order by created_at limit 1 for update skip locked;
  if v_token is null then raise exception 'NO_TOKEN'; end if;

  v_meets := v_match.join_mode = 'instant'
    and v_prof.skill_level >= coalesce(v_match.min_skill_level, 1)
    and v_prof.reliability_score >= coalesce(v_match.min_reliability_score, 0)
    and (v_match.required_positions is null
         or v_prof.preferred_positions && v_match.required_positions
         or 'ANY' = any(v_prof.preferred_positions));
  v_status := (case when v_meets then 'accepted' else 'requested' end)::participant_status;

  update public.tokens set status = 'committed', committed_match_id = p_match_id where id = v_token;
  insert into public.token_transactions (token_id, user_id, type, match_id, note)
    values (v_token, v_uid, 'commit', p_match_id, 'Committed to match');
  insert into public.match_players (match_id, user_id, status, token_id, responded_at)
    values (p_match_id, v_uid, v_status, v_token, case when v_meets then now() else null end);

  if v_meets then
    select count(*) into v_taken from public.match_players
      where match_id = p_match_id and status in ('accepted','attended');
    if v_taken >= v_match.max_players then
      update public.matches set status = 'full' where id = p_match_id;
      perform public.assign_teams(p_match_id);
    end if;
  end if;
  return v_status::text;
end;
$$;

-- Cancel: 12-hour fork (refund vs forfeit + reliability drop)
create or replace function public.cancel_participation(p_match_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_match public.matches%rowtype;
  v_mp public.match_players%rowtype;
  v_late boolean;
begin
  if v_uid is null then raise exception 'NOT_AUTHED'; end if;
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'NO_MATCH'; end if;
  select * into v_mp from public.match_players
   where match_id = p_match_id and user_id = v_uid and status in ('requested','accepted','attended') for update;
  if not found then raise exception 'NOT_IN'; end if;

  v_late := now() >= (v_match.kickoff_at - interval '12 hours');

  if v_late then
    update public.tokens set status = 'forfeited' where id = v_mp.token_id;
    insert into public.token_transactions (token_id, user_id, type, match_id, note)
      values (v_mp.token_id, v_uid, 'forfeit', p_match_id, 'Late cancellation — token forfeited');
    insert into public.platform_ledger (user_id, match_id, token_id, reason)
      values (v_uid, p_match_id, v_mp.token_id, 'late_cancel');
    update public.match_players set status = 'cancelled_late', cancelled_at = now(), team_color = null where id = v_mp.id;
    update public.profiles set games_missed = games_missed + 1 where id = v_uid;
    perform public.recompute_reliability(v_uid);
  else
    update public.tokens set status = 'available', committed_match_id = null where id = v_mp.token_id;
    insert into public.token_transactions (token_id, user_id, type, match_id, note)
      values (v_mp.token_id, v_uid, 'refund', p_match_id, 'Early cancellation — token refunded');
    update public.match_players set status = 'cancelled_early', cancelled_at = now(), team_color = null where id = v_mp.id;
  end if;

  if v_mp.status in ('accepted','attended') and v_match.status = 'full' then
    update public.matches set status = 'open', teams_assigned = false where id = p_match_id;
    update public.match_players set team_color = null where match_id = p_match_id and status in ('accepted','attended');
  end if;
  return case when v_late then 'forfeited' else 'refunded' end;
end;
$$;

-- Organizer accept/decline a manual request
create or replace function public.manager_respond(p_match_id uuid, p_user_id uuid, p_accept boolean)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_match public.matches%rowtype;
  v_mp public.match_players%rowtype;
  v_taken int;
begin
  if v_uid is null then raise exception 'NOT_AUTHED'; end if;
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'NO_MATCH'; end if;
  if v_match.organizer_id <> v_uid then raise exception 'NOT_ORGANIZER'; end if;
  select * into v_mp from public.match_players
   where match_id = p_match_id and user_id = p_user_id and status = 'requested' for update;
  if not found then raise exception 'NO_REQUEST'; end if;

  if p_accept then
    select count(*) into v_taken from public.match_players
      where match_id = p_match_id and status in ('accepted','attended');
    if v_taken >= v_match.max_players then raise exception 'MATCH_FULL'; end if;
    update public.match_players set status = 'accepted', responded_at = now() where id = v_mp.id;
    if v_taken + 1 >= v_match.max_players then
      update public.matches set status = 'full' where id = p_match_id;
      perform public.assign_teams(p_match_id);
    end if;
    return 'accepted';
  else
    update public.tokens set status = 'available', committed_match_id = null where id = v_mp.token_id;
    insert into public.token_transactions (token_id, user_id, type, match_id, note)
      values (v_mp.token_id, p_user_id, 'refund', p_match_id, 'Request declined — token refunded');
    update public.match_players set status = 'rejected', responded_at = now() where id = v_mp.id;
    return 'rejected';
  end if;
end;
$$;

-- Organizer locks an open match early and assigns teams
create or replace function public.lock_match(p_match_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_match public.matches%rowtype;
begin
  if v_uid is null then raise exception 'NOT_AUTHED'; end if;
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'NO_MATCH'; end if;
  if v_match.organizer_id <> v_uid then raise exception 'NOT_ORGANIZER'; end if;
  update public.matches set status = 'full' where id = p_match_id and status = 'open';
  perform public.assign_teams(p_match_id);
end;
$$;

-- Organizer reveals (generates once) the 4-digit attendance code
create or replace function public.ensure_match_code(p_match_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_match public.matches%rowtype; v_code text;
begin
  if v_uid is null then raise exception 'NOT_AUTHED'; end if;
  select * into v_match from public.matches where id = p_match_id;
  if not found then raise exception 'NO_MATCH'; end if;
  if v_match.organizer_id <> v_uid then raise exception 'NOT_ORGANIZER'; end if;
  select code into v_code from public.match_codes where match_id = p_match_id;
  if v_code is null then
    v_code := lpad(((floor(random() * 9000) + 1000)::int)::text, 4, '0');
    insert into public.match_codes (match_id, code, valid_until)
      values (p_match_id, v_code, v_match.ends_at + interval '60 minutes');
  end if;
  return v_code;
end;
$$;

-- Dual-layer check-in: GPS (<=200m) OR 4-digit code
create or replace function public.check_in(
  p_match_id uuid, p_method text,
  p_lat double precision default null, p_lng double precision default null, p_code text default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_match public.matches%rowtype;
  v_loc public.locations%rowtype;
  v_mp public.match_players%rowtype;
  v_dist double precision;
  v_mc public.match_codes%rowtype;
begin
  if v_uid is null then raise exception 'NOT_AUTHED'; end if;
  select * into v_match from public.matches where id = p_match_id;
  if not found then raise exception 'NO_MATCH'; end if;
  if now() < v_match.kickoff_at then raise exception 'TOO_EARLY'; end if;
  if now() > v_match.ends_at + interval '60 minutes' then raise exception 'WINDOW_CLOSED'; end if;
  select * into v_mp from public.match_players where match_id = p_match_id and user_id = v_uid for update;
  if not found then raise exception 'NOT_IN'; end if;
  if v_mp.status = 'attended' then return 'already'; end if;
  if v_mp.status <> 'accepted' then raise exception 'NOT_CONFIRMED'; end if;

  if p_method = 'gps' then
    select * into v_loc from public.locations where id = v_match.location_id;
    if v_loc.latitude is null or p_lat is null then raise exception 'NO_GEO'; end if;
    v_dist := 2 * 6371000 * asin(sqrt(
      power(sin(radians(p_lat - v_loc.latitude) / 2), 2) +
      cos(radians(v_loc.latitude)) * cos(radians(p_lat)) *
      power(sin(radians(p_lng - v_loc.longitude) / 2), 2)));
    if v_dist > v_loc.geofence_radius_m then raise exception 'TOO_FAR'; end if;
    update public.match_players set status = 'attended', check_in_method = 'gps', checked_in_at = now(),
           check_in_lat = p_lat, check_in_lng = p_lng where id = v_mp.id;
  else
    select * into v_mc from public.match_codes where match_id = p_match_id;
    if v_mc.code is null then raise exception 'CODE_NOT_SET'; end if;
    if now() > v_mc.valid_until then raise exception 'CODE_EXPIRED'; end if;
    if p_code is distinct from v_mc.code then raise exception 'BAD_CODE'; end if;
    update public.match_players set status = 'attended', check_in_method = 'match_code', checked_in_at = now()
      where id = v_mp.id;
  end if;
  return 'verified';
end;
$$;

-- End-of-match settlement (idempotent): return / forfeit / refund + reliability;
-- Founding Baller (<=100) first filled+completed host → +30 free days
create or replace function public.settle_match(p_match_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_match public.matches%rowtype;
begin
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'NO_MATCH'; end if;
  if v_match.status in ('completed','cancelled') then return 'noop'; end if;
  if now() < v_match.ends_at then raise exception 'NOT_ENDED'; end if;

  insert into public.token_transactions (token_id, user_id, type, match_id, note)
    select token_id, user_id, 'return', p_match_id, 'Match completed — token returned'
    from public.match_players where match_id = p_match_id and status = 'attended';
  update public.tokens set status = 'available', committed_match_id = null
    where id in (select token_id from public.match_players where match_id = p_match_id and status = 'attended');
  update public.profiles set games_played = games_played + 1
    where id in (select user_id from public.match_players where match_id = p_match_id and status = 'attended');

  insert into public.token_transactions (token_id, user_id, type, match_id, note)
    select token_id, user_id, 'refund', p_match_id, 'Match ended while pending — token refunded'
    from public.match_players where match_id = p_match_id and status = 'requested';
  update public.tokens set status = 'available', committed_match_id = null
    where id in (select token_id from public.match_players where match_id = p_match_id and status = 'requested');
  update public.match_players set status = 'rejected' where match_id = p_match_id and status = 'requested';

  insert into public.token_transactions (token_id, user_id, type, match_id, note)
    select token_id, user_id, 'forfeit', p_match_id, 'No-show — token forfeited'
    from public.match_players where match_id = p_match_id and status = 'accepted';
  insert into public.platform_ledger (user_id, match_id, token_id, reason)
    select user_id, p_match_id, token_id, 'no_show'
    from public.match_players where match_id = p_match_id and status = 'accepted';
  update public.tokens set status = 'forfeited'
    where id in (select token_id from public.match_players where match_id = p_match_id and status = 'accepted');
  update public.profiles set games_missed = games_missed + 1
    where id in (select user_id from public.match_players where match_id = p_match_id and status = 'accepted');
  update public.match_players set status = 'no_show' where match_id = p_match_id and status = 'accepted';

  update public.profiles set reliability_score = case
      when (games_played + games_missed) = 0 then 100
      else round(100.0 * games_played / (games_played + games_missed), 2) end
    where id in (select user_id from public.match_players where match_id = p_match_id and status in ('attended','no_show'));

  if v_match.teams_assigned then
    update public.profiles set founding_bonus_awarded = true
      where id = v_match.organizer_id and coalesce(founding_number, 1000000) <= 100 and not founding_bonus_awarded;
    if found then
      update public.subscriptions set free_until = greatest(coalesce(free_until, now()), now()) + interval '30 days'
        where user_id = v_match.organizer_id;
    end if;
  end if;

  update public.matches set status = 'completed' where id = p_match_id;
  return 'completed';
end;
$$;

-- MotM voting + trophy finalization
create or replace function public.vote_motm(p_match_id uuid, p_votee_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'NOT_AUTHED'; end if;
  if v_uid = p_votee_id then raise exception 'SELF_VOTE'; end if;
  if not public.is_premium(v_uid) then raise exception 'NOT_PREMIUM'; end if;
  if not exists (select 1 from public.matches where id = p_match_id and status = 'completed') then raise exception 'NOT_COMPLETED'; end if;
  if not exists (select 1 from public.match_players where match_id = p_match_id and user_id = v_uid and status = 'attended') then raise exception 'NOT_ATTENDEE'; end if;
  if not exists (select 1 from public.match_players where match_id = p_match_id and user_id = p_votee_id and status = 'attended') then raise exception 'BAD_VOTEE'; end if;
  insert into public.match_votes (match_id, voter_id, votee_id) values (p_match_id, v_uid, p_votee_id);
  return 'voted';
exception when unique_violation then raise exception 'ALREADY_VOTED';
end;
$$;

create or replace function public.finalize_motm(p_match_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_match public.matches%rowtype; v_winner uuid;
begin
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'NO_MATCH'; end if;
  if v_match.status <> 'completed' or v_match.motm_awarded then return 'noop'; end if;
  if now() < v_match.ends_at + interval '24 hours' then return 'voting_open'; end if;
  select votee_id into v_winner from public.match_votes where match_id = p_match_id
    group by votee_id order by count(*) desc, votee_id limit 1;
  if v_winner is not null then
    update public.profiles set motm_count = motm_count + 1 where id = v_winner;
    update public.matches set motm_winner_id = v_winner, motm_awarded = true where id = p_match_id;
  else
    update public.matches set motm_awarded = true where id = p_match_id;
  end if;
  return 'awarded';
end;
$$;

-- Automated settlement sweep (pg_cron backstop)
create or replace function public.settle_due_matches()
returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in select id from public.matches where status in ('open','full','in_progress') and ends_at < now() loop
    begin perform public.settle_match(r.id); n := n + 1;
    exception when others then raise warning 'settle_match(%) failed: %', r.id, sqlerrm; end;
  end loop;
  for r in select id from public.matches where status = 'completed' and not motm_awarded and ends_at + interval '24 hours' < now() loop
    begin perform public.finalize_motm(r.id);
    exception when others then raise warning 'finalize_motm(%) failed: %', r.id, sqlerrm; end;
  end loop;
  return n;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- §6  VIEWS  (security_invoker → RLS of the caller applies)
-- ─────────────────────────────────────────────────────────────────────────
create or replace view public.match_feed with (security_invoker = true) as
  select m.id, m.title, m.kickoff_at, m.ends_at, m.venue_type, m.join_mode, m.status,
         m.max_players, m.price_per_player_zar, m.organizer_id,
         l.name as location_name, l.neighborhood, l.type as location_type, l.latitude, l.longitude,
         coalesce(p.taken, 0) as spots_taken
  from public.matches m
  join public.locations l on l.id = m.location_id
  left join (
    select match_id, count(*)::int as taken from public.match_players
    where status in ('accepted','attended') group by match_id
  ) p on p.match_id = m.id;

create or replace view public.leaderboard with (security_invoker = true) as
  select p.id, p.name, p.avatar_url, p.neighborhood, p.skill_level, p.preferred_positions,
         p.motm_count, p.reliability_score, p.games_played, p.founding_number,
         rank() over (order by p.motm_count desc, p.reliability_score desc, p.games_played desc) as position
  from public.profiles p
  where public.is_premium(p.id);

-- ─────────────────────────────────────────────────────────────────────────
-- §7  TRIGGERS
-- ─────────────────────────────────────────────────────────────────────────
create trigger profiles_set_updated_at      before update on public.profiles      for each row execute function public.set_updated_at();
create trigger subscriptions_set_updated_at before update on public.subscriptions for each row execute function public.set_updated_at();
create trigger tokens_set_updated_at        before update on public.tokens        for each row execute function public.set_updated_at();
create trigger matches_set_updated_at       before update on public.matches       for each row execute function public.set_updated_at();

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────
-- §8  ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────
alter table public.profiles           enable row level security;
alter table public.subscriptions      enable row level security;
alter table public.tokens             enable row level security;
alter table public.token_transactions enable row level security;
alter table public.locations          enable row level security;
alter table public.matches            enable row level security;
alter table public.match_players      enable row level security;
alter table public.referrals          enable row level security;
alter table public.match_votes        enable row level security;
alter table public.platform_ledger    enable row level security;  -- no policies: service-role only
alter table public.match_codes        enable row level security;
alter table public.follows            enable row level security;
alter table public.match_pings        enable row level security;

create policy "profiles are public"        on public.profiles for select using (true);
create policy "owner updates own profile"  on public.profiles for update using (auth.uid() = id);

create policy "owner reads own sub"        on public.subscriptions for select using (auth.uid() = user_id);

create policy "owner reads own tokens"     on public.tokens for select using (auth.uid() = owner_id);
create policy "owner reads own token txns" on public.token_transactions for select using (auth.uid() = user_id);

create policy "locations are public"       on public.locations for select using (true);
create policy "premium adds locations"     on public.locations for insert
  with check (auth.uid() = created_by_id and public.is_premium(auth.uid()));

create policy "live matches are public"    on public.matches for select
  using (status in ('open','full','in_progress','completed'));
create policy "organizer reads own drafts" on public.matches for select using (auth.uid() = organizer_id);
create policy "premium creates matches"    on public.matches for insert
  with check (auth.uid() = organizer_id and public.is_premium(auth.uid()));
create policy "organizer updates match"    on public.matches for update using (auth.uid() = organizer_id);

create policy "roster visible to organizer and participants" on public.match_players for select
  using (user_id = auth.uid() or public.is_match_organizer(match_id) or public.is_match_participant(match_id));
create policy "premium requests to join"   on public.match_players for insert
  with check (auth.uid() = user_id and public.is_premium(auth.uid()));

create policy "referrer reads referrals"   on public.referrals for select using (auth.uid() = referrer_id);

create policy "votes are public"           on public.match_votes for select using (true);
create policy "premium participant votes"  on public.match_votes for insert
  with check (auth.uid() = voter_id and public.is_premium(auth.uid())
    and exists (select 1 from public.match_players mp
      where mp.match_id = match_votes.match_id and mp.user_id = auth.uid() and mp.status = 'attended'));

create policy "organizer reads own match code" on public.match_codes for select using (public.is_match_organizer(match_id));

create policy "follows are public"         on public.follows for select using (true);
create policy "user manages own follows"   on public.follows for insert with check (auth.uid() = follower_id);
create policy "user removes own follows"   on public.follows for delete using (auth.uid() = follower_id);

create policy "pings are public"           on public.match_pings for select using (true);
create policy "organizer creates pings"    on public.match_pings for insert
  with check (auth.uid() = organizer_id and public.is_match_organizer(match_id));

-- ─────────────────────────────────────────────────────────────────────────
-- §9  GRANTS (function execution + view reads)
-- ─────────────────────────────────────────────────────────────────────────
grant execute on function public.is_premium(uuid)                     to anon, authenticated;
grant execute on function public.join_match(uuid)                     to authenticated;
grant execute on function public.cancel_participation(uuid)           to authenticated;
grant execute on function public.manager_respond(uuid, uuid, boolean) to authenticated;
grant execute on function public.lock_match(uuid)                     to authenticated;
grant execute on function public.is_match_organizer(uuid)             to anon, authenticated;
grant execute on function public.is_match_participant(uuid)           to anon, authenticated;
grant execute on function public.ensure_match_code(uuid)              to authenticated;
grant execute on function public.check_in(uuid, text, double precision, double precision, text) to authenticated;
grant execute on function public.settle_match(uuid)                   to authenticated;
grant execute on function public.vote_motm(uuid, uuid)                to authenticated;
grant execute on function public.finalize_motm(uuid)                  to authenticated;
grant select on public.match_feed  to anon, authenticated;
grant select on public.leaderboard to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- §10  ENVIRONMENT-MANAGED (Supabase). Guarded so a plain Postgres skips them.
-- ─────────────────────────────────────────────────────────────────────────

-- Avatars storage bucket + owner-scoped policies
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public) values ('avatars','avatars',true) on conflict (id) do nothing;
    execute 'drop policy if exists "avatars public read" on storage.objects';
    execute 'drop policy if exists "avatars owner upload" on storage.objects';
    execute 'drop policy if exists "avatars owner update" on storage.objects';
    execute 'drop policy if exists "avatars owner delete" on storage.objects';
    execute $p$ create policy "avatars public read" on storage.objects for select using (bucket_id = 'avatars') $p$;
    execute $p$ create policy "avatars owner upload" on storage.objects for insert with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text) $p$;
    execute $p$ create policy "avatars owner update" on storage.objects for update using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text) $p$;
    execute $p$ create policy "avatars owner delete" on storage.objects for delete using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text) $p$;
  end if;
end $$;

-- Realtime: publish lobby tables (RLS still scopes events)
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  begin alter publication supabase_realtime add table public.match_players; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.matches;       exception when duplicate_object then null; end;
end $$;
alter table public.match_players replica identity full;
alter table public.matches       replica identity full;

-- pg_cron: nightly settlement sweep (00:00 SAST / 22:00 UTC)
do $$
begin
  create extension if not exists pg_cron;
exception when others then
  raise notice 'pg_cron not auto-enabled (%). Enable in Dashboard → Database → Extensions.', sqlerrm;
end $$;
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'settle-due-matches') then perform cron.unschedule('settle-due-matches'); end if;
    perform cron.schedule('settle-due-matches', '0 22 * * *', 'select public.settle_due_matches();');
  end if;
end $$;
