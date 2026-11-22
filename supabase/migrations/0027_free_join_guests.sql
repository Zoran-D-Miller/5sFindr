-- ════════════════════════════════════════════════════════════════════════
--  S2 — free to join, guests in 2 taps, organiser ticks attendance.
--  (PRODUCT-BRIEF.md, locked 2026-11-14)
--
--  1. public.app_config.tokens_enabled (default FALSE) mirrors the app's
--     NEXT_PUBLIC_FLAG_TOKENS. While it's off nobody commits, forfeits or gets
--     refunded a token, and joining / posting a game no longer needs Premium.
--  2. Guests: Supabase anonymous sign-in → save_guest_details(name, WhatsApp,
--     POPIA consent) → join_match. Anonymous users can't post games or add
--     venues, and get no founding number until they keep their profile
--     (link Google / email), when the auth.users update trigger assigns one.
--  3. set_attendance(): the organiser ticks who showed up (replaces GPS /
--     4-digit check-in while those are hidden). Settlement waits 24h after
--     full time for anyone but the organiser, so the cron or a passing viewer
--     can't settle before the organiser has ticked. If nobody was ticked at
--     all, attendance counts as not taken: everyone confirmed is credited as
--     attended instead of being marked a no-show.
--  4. Direct INSERTs into match_players are dropped: joining goes through
--     join_match only (the old policy let a Premium user insert themselves
--     as 'accepted' and skip every check).
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Config ────────────────────────────────────────────────────────────
create table if not exists public.app_config (
  id             boolean primary key default true check (id),  -- single row
  tokens_enabled boolean not null default false,
  updated_at     timestamptz not null default now()
);
insert into public.app_config (id) values (true) on conflict (id) do nothing;
alter table public.app_config enable row level security;
revoke all on public.app_config from anon, authenticated;

create or replace function public.tokens_enabled()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select tokens_enabled from public.app_config where id), false);
$$;

-- True for a Supabase anonymous (guest) session. Reads the JWT claim, like
-- Supabase's own docs recommend for RLS.
create or replace function public.is_guest()
returns boolean language sql stable set search_path = public as $$
  select coalesce((nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'is_anonymous')::boolean, false);
$$;

-- ── 2. Guests ────────────────────────────────────────────────────────────
alter table public.profiles add column if not exists consent_at timestamptz;
alter table public.profiles add column if not exists consent_version text;
-- Not added to 0025's column SELECT grant on purpose: private like phone_number.

-- Signup trigger: guests get no founding number (those are for kept profiles).
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
  v_guest       boolean := coalesce(new.is_anonymous, false);
begin
  v_name     := coalesce(nullif(trim(new.raw_user_meta_data->>'name'), ''),
                         nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
                         split_part(new.email, '@', 1), 'New Baller');
  v_ref_code := new.raw_user_meta_data->>'referral_code';
  v_phone    := nullif(trim(new.raw_user_meta_data->>'phone_number'), '');
  v_slug     := lower(regexp_replace(v_name, '[^a-zA-Z0-9]+', '-', 'g'))
                || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  v_my_code  := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  if v_ref_code is not null then
    select id into v_referrer_id from public.profiles where referral_code = v_ref_code limit 1;
  end if;

  insert into public.profiles (id, name, phone_number, public_slug, referral_code, referred_by_id, founding_number)
  values (new.id, v_name, v_phone, v_slug, v_my_code, v_referrer_id,
          case when v_guest then null else nextval('public.founding_seq') end);

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

-- A guest who links Google / an email becomes a kept profile → founding number.
create or replace function public.handle_guest_upgraded()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
     set founding_number = nextval('public.founding_seq')
   where id = new.id and founding_number is null;
  return new;
end;
$$;

drop trigger if exists on_guest_upgraded on auth.users;
create trigger on_guest_upgraded
  after update of is_anonymous on auth.users
  for each row
  when (old.is_anonymous is true and new.is_anonymous is false)
  execute function public.handle_guest_upgraded();

-- Name + WhatsApp + POPIA consent for the signed-in user (guest or not).
-- phone_number isn't client-writable (0025), so it's set here, validated.
create or replace function public.save_guest_details(p_name text, p_phone text, p_consent_version text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_name text := trim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
begin
  if v_uid is null then raise exception 'NOT_AUTHED'; end if;
  if length(v_name) < 1 or length(v_name) > 40 then raise exception 'BAD_NAME'; end if;
  if p_phone is null or p_phone !~ '^\+[1-9][0-9]{7,14}$' then raise exception 'BAD_PHONE'; end if;
  if nullif(trim(coalesce(p_consent_version, '')), '') is null then raise exception 'NO_CONSENT'; end if;

  update public.profiles
     set name = v_name, phone_number = p_phone,
         consent_at = now(), consent_version = trim(p_consent_version)
   where id = v_uid;
end;
$$;

-- ── 3. Posting a game / adding a venue: any kept account, no Premium ──────
drop policy if exists "premium creates matches" on public.matches;
drop policy if exists "members create matches" on public.matches;
create policy "members create matches" on public.matches for insert
  with check (auth.uid() = organizer_id and not public.is_guest());

drop policy if exists "premium adds locations" on public.locations;
drop policy if exists "members add locations" on public.locations;
create policy "members add locations" on public.locations for insert
  with check (auth.uid() = created_by_id and not public.is_guest());

-- Joining only through join_match (section 4).
drop policy if exists "premium requests to join" on public.match_players;

-- ── 4. join / cancel / decline: token only when tokens_enabled() ──────────
create or replace function public.join_match(p_match_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_match   public.matches%rowtype;
  v_prof    public.profiles%rowtype;
  v_token   uuid;
  v_taken   int;
  v_meets   boolean;
  v_status  participant_status;
begin
  if v_uid is null then raise exception 'NOT_AUTHED'; end if;

  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'NO_MATCH'; end if;
  if v_match.organizer_id = v_uid then raise exception 'OWN_MATCH'; end if;
  if v_match.status <> 'open' then raise exception 'NOT_OPEN'; end if;
  if v_match.kickoff_at <= now() then raise exception 'STARTED'; end if;

  if exists (
    select 1 from public.match_players
    where match_id = p_match_id and user_id = v_uid
      and status in ('requested', 'accepted', 'attended')
  ) then raise exception 'ALREADY_IN'; end if;

  if exists (
    select 1 from public.match_players
    where match_id = p_match_id and user_id = v_uid and status = 'rejected'
  ) then raise exception 'DECLINED'; end if;

  select * into v_prof from public.profiles where id = v_uid;
  -- The organiser needs a name and a WhatsApp number for everyone on the list.
  if public.is_guest() and v_prof.phone_number is null then raise exception 'NEED_DETAILS'; end if;

  if public.tokens_enabled() then
    -- Lock exactly one available token (race-safe).
    select id into v_token from public.tokens
     where owner_id = v_uid and status = 'available'
     order by created_at
     limit 1 for update skip locked;
    if v_token is null then raise exception 'NO_TOKEN'; end if;
  end if;

  -- Instant booking auto-accepts only when ALL criteria are met.
  v_meets := v_match.join_mode = 'instant'
    and v_prof.skill_level >= coalesce(v_match.min_skill_level, 1)
    and v_prof.reliability_score >= coalesce(v_match.min_reliability_score, 0)
    and (
      v_match.required_positions is null
      or v_prof.preferred_positions && v_match.required_positions
      or 'ANY' = any(v_prof.preferred_positions)
    );
  v_status := (case when v_meets then 'accepted' else 'requested' end)::participant_status;

  if v_token is not null then
    update public.tokens set status = 'committed', committed_match_id = p_match_id where id = v_token;
    insert into public.token_transactions (token_id, user_id, type, match_id, note)
      values (v_token, v_uid, 'commit', p_match_id, 'Committed to match');
  end if;

  -- New seat, or reactivate a cancelled one (0021).
  insert into public.match_players (match_id, user_id, status, token_id, responded_at)
    values (p_match_id, v_uid, v_status, v_token, case when v_meets then now() else null end)
  on conflict (match_id, user_id) do update
     set status          = excluded.status,
         token_id        = excluded.token_id,
         requested_at    = now(),
         responded_at    = excluded.responded_at,
         cancelled_at    = null,
         team_color      = null,
         check_in_method = null,
         checked_in_at   = null,
         check_in_lat    = null,
         check_in_lng    = null
   where public.match_players.status in ('cancelled_early', 'cancelled_late');
  if not found then raise exception 'ALREADY_IN'; end if;

  if v_meets then
    select count(*) into v_taken from public.match_players
      where match_id = p_match_id and status in ('accepted', 'attended');
    if v_taken >= v_match.max_players then
      update public.matches set status = 'full' where id = p_match_id;
      perform public.assign_teams(p_match_id);
    end if;
  end if;

  return v_status::text;  -- 'accepted' | 'requested'
end;
$$;

-- Late cancel (<12h) still counts as a missed game; the token part only runs
-- when the seat holds a token. Returns 'forfeited' / 'refunded' as before.
create or replace function public.cancel_participation(p_match_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_match public.matches%rowtype;
  v_mp    public.match_players%rowtype;
  v_late  boolean;
begin
  if v_uid is null then raise exception 'NOT_AUTHED'; end if;

  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'NO_MATCH'; end if;

  select * into v_mp from public.match_players
   where match_id = p_match_id and user_id = v_uid
     and status in ('requested', 'accepted', 'attended')
   for update;
  if not found then raise exception 'NOT_IN'; end if;

  v_late := now() >= (v_match.kickoff_at - interval '12 hours');

  if v_late then
    if v_mp.token_id is not null then
      update public.tokens set status = 'forfeited' where id = v_mp.token_id;
      insert into public.token_transactions (token_id, user_id, type, match_id, note)
        values (v_mp.token_id, v_uid, 'forfeit', p_match_id, 'Late cancellation — token forfeited');
      insert into public.platform_ledger (user_id, match_id, token_id, reason)
        values (v_uid, p_match_id, v_mp.token_id, 'late_cancel');
    end if;
    update public.match_players
       set status = 'cancelled_late', cancelled_at = now(), team_color = null
     where id = v_mp.id;
    update public.profiles set games_missed = games_missed + 1 where id = v_uid;
    perform public.recompute_reliability(v_uid);
  else
    if v_mp.token_id is not null then
      update public.tokens set status = 'available', committed_match_id = null where id = v_mp.token_id;
      insert into public.token_transactions (token_id, user_id, type, match_id, note)
        values (v_mp.token_id, v_uid, 'refund', p_match_id, 'Early cancellation — token refunded');
    end if;
    update public.match_players
       set status = 'cancelled_early', cancelled_at = now(), team_color = null
     where id = v_mp.id;
  end if;

  if v_mp.status in ('accepted', 'attended') and v_match.status = 'full' then
    update public.matches set status = 'open', teams_assigned = false where id = p_match_id;
    update public.match_players set team_color = null
     where match_id = p_match_id and status in ('accepted', 'attended');
  end if;

  return case when v_late then 'forfeited' else 'refunded' end;
end;
$$;

create or replace function public.manager_respond(p_match_id uuid, p_user_id uuid, p_accept boolean)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_match public.matches%rowtype;
  v_mp    public.match_players%rowtype;
  v_taken int;
begin
  if v_uid is null then raise exception 'NOT_AUTHED'; end if;

  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'NO_MATCH'; end if;
  if v_match.organizer_id <> v_uid then raise exception 'NOT_ORGANIZER'; end if;

  select * into v_mp from public.match_players
   where match_id = p_match_id and user_id = p_user_id and status = 'requested'
   for update;
  if not found then raise exception 'NO_REQUEST'; end if;

  if p_accept then
    select count(*) into v_taken from public.match_players
      where match_id = p_match_id and status in ('accepted', 'attended');
    if v_taken >= v_match.max_players then raise exception 'MATCH_FULL'; end if;

    update public.match_players set status = 'accepted', responded_at = now() where id = v_mp.id;

    if v_taken + 1 >= v_match.max_players then
      update public.matches set status = 'full' where id = p_match_id;
      perform public.assign_teams(p_match_id);
    end if;
    return 'accepted';
  else
    if v_mp.token_id is not null then
      update public.tokens set status = 'available', committed_match_id = null where id = v_mp.token_id;
      insert into public.token_transactions (token_id, user_id, type, match_id, note)
        values (v_mp.token_id, p_user_id, 'refund', p_match_id, 'Request declined — token refunded');
    end if;
    update public.match_players set status = 'rejected', responded_at = now() where id = v_mp.id;
    return 'rejected';
  end if;
end;
$$;

-- ── 5. Organiser ticks attendance ─────────────────────────────────────────
create or replace function public.set_attendance(p_match_id uuid, p_user_id uuid, p_attended boolean)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_match public.matches%rowtype;
  v_mp    public.match_players%rowtype;
begin
  if v_uid is null then raise exception 'NOT_AUTHED'; end if;

  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'NO_MATCH'; end if;
  if v_match.organizer_id <> v_uid then raise exception 'NOT_ORGANIZER'; end if;
  if v_match.status in ('completed', 'cancelled') then raise exception 'WINDOW_CLOSED'; end if;
  if now() < v_match.kickoff_at then raise exception 'TOO_EARLY'; end if;

  select * into v_mp from public.match_players
   where match_id = p_match_id and user_id = p_user_id and status in ('accepted', 'attended')
   for update;
  if not found then raise exception 'NOT_CONFIRMED'; end if;

  update public.match_players
     set status          = (case when p_attended then 'attended' else 'accepted' end)::participant_status,
         checked_in_at   = case when p_attended then now() else null end,
         check_in_method = null, check_in_lat = null, check_in_lng = null
   where id = v_mp.id;

  return case when p_attended then 'attended' else 'accepted' end;
end;
$$;

-- ── 6. Settlement waits for the organiser ─────────────────────────────────
create or replace function public.settle_match(p_match_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_match  public.matches%rowtype;
  v_uid    uuid := auth.uid();
  v_tokens boolean := public.tokens_enabled();
begin
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'NO_MATCH'; end if;
  if v_match.status in ('completed','cancelled') then return 'noop'; end if;
  if now() < v_match.ends_at then raise exception 'NOT_ENDED'; end if;

  if not v_tokens then
    -- Give the organiser 24h after full time to tick attendance.
    if (v_uid is null or v_uid <> v_match.organizer_id)
       and now() < v_match.ends_at + interval '24 hours' then
      return 'waiting';
    end if;
    -- Nobody ticked → attendance wasn't taken; don't mark the squad no-shows.
    if not exists (select 1 from public.match_players
                   where match_id = p_match_id and status = 'attended') then
      update public.match_players set status = 'attended'
       where match_id = p_match_id and status = 'accepted';
    end if;
  end if;

  -- Attendees → return token (token-less seats skip token ops, keep credit)
  insert into public.token_transactions (token_id, user_id, type, match_id, note)
    select token_id, user_id, 'return', p_match_id, 'Match completed — token returned'
    from public.match_players where match_id = p_match_id and status = 'attended' and token_id is not null;
  update public.tokens set status = 'available', committed_match_id = null
    where id in (select token_id from public.match_players where match_id = p_match_id and status = 'attended' and token_id is not null);
  update public.profiles set games_played = games_played + 1
    where id in (select user_id from public.match_players where match_id = p_match_id and status = 'attended');

  -- Pending requests → refund
  insert into public.token_transactions (token_id, user_id, type, match_id, note)
    select token_id, user_id, 'refund', p_match_id, 'Match ended while pending — token refunded'
    from public.match_players where match_id = p_match_id and status = 'requested' and token_id is not null;
  update public.tokens set status = 'available', committed_match_id = null
    where id in (select token_id from public.match_players where match_id = p_match_id and status = 'requested' and token_id is not null);
  update public.match_players set status = 'rejected' where match_id = p_match_id and status = 'requested';

  -- No-shows → forfeit (token-less seats skip forfeit, keep games_missed)
  insert into public.token_transactions (token_id, user_id, type, match_id, note)
    select token_id, user_id, 'forfeit', p_match_id, 'No-show — token forfeited'
    from public.match_players where match_id = p_match_id and status = 'accepted' and token_id is not null;
  insert into public.platform_ledger (user_id, match_id, token_id, reason)
    select user_id, p_match_id, token_id, 'no_show'
    from public.match_players where match_id = p_match_id and status = 'accepted' and token_id is not null;
  update public.tokens set status = 'forfeited'
    where id in (select token_id from public.match_players where match_id = p_match_id and status = 'accepted' and token_id is not null);
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

-- The cron sweep only picks up matches past the organiser's window (when
-- tokens are off); settle_match re-checks anyway.
create or replace function public.settle_due_matches()
returns int language plpgsql security definer set search_path = public as $$
declare
  r record;
  n int := 0;
  v_grace interval := case when public.tokens_enabled() then interval '0' else interval '24 hours' end;
begin
  for r in
    select id from public.matches
    where status in ('open', 'full', 'in_progress') and ends_at + v_grace < now()
  loop
    begin
      perform public.settle_match(r.id);
      n := n + 1;
    exception when others then
      raise warning 'settle_match(%) failed: %', r.id, sqlerrm;
    end;
  end loop;

  for r in
    select id from public.matches
    where status = 'completed' and not motm_awarded and ends_at + interval '24 hours' < now()
  loop
    begin
      perform public.finalize_motm(r.id);
    exception when others then
      raise warning 'finalize_motm(%) failed: %', r.id, sqlerrm;
    end;
  end loop;

  return n;
end;
$$;

-- ── 7. Grants (0019 style: PUBLIC revoked, anon never) ────────────────────
-- tokens_enabled is called from SECURITY DEFINER functions (run as owner).
revoke execute on function public.tokens_enabled()            from public, anon, authenticated;
revoke execute on function public.handle_guest_upgraded()     from public, anon, authenticated;
revoke execute on function public.handle_new_user()           from public, anon, authenticated;
revoke execute on function public.settle_due_matches()        from public, anon, authenticated;
-- is_guest is used in RLS policies and only reads the caller's own JWT.
grant  execute on function public.is_guest()                  to anon, authenticated;

revoke execute on function public.save_guest_details(text, text, text)     from public, anon;
revoke execute on function public.set_attendance(uuid, uuid, boolean)      from public, anon;
revoke execute on function public.join_match(uuid)                         from public, anon;
revoke execute on function public.cancel_participation(uuid)               from public, anon;
revoke execute on function public.manager_respond(uuid, uuid, boolean)     from public, anon;
revoke execute on function public.settle_match(uuid)                       from public, anon;
grant  execute on function public.save_guest_details(text, text, text)     to authenticated;
grant  execute on function public.set_attendance(uuid, uuid, boolean)      to authenticated;
grant  execute on function public.join_match(uuid)                         to authenticated;
grant  execute on function public.cancel_participation(uuid)               to authenticated;
grant  execute on function public.manager_respond(uuid, uuid, boolean)     to authenticated;
grant  execute on function public.settle_match(uuid)                       to authenticated;
