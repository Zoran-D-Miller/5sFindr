-- ════════════════════════════════════════════════════════════════════════
--  Phase 6 — Attendance, automated closure, and the post-match loop.
-- ════════════════════════════════════════════════════════════════════════

-- MotM bookkeeping on the match.
alter table public.matches add column if not exists motm_awarded   boolean not null default false;
alter table public.matches add column if not exists motm_winner_id uuid references public.profiles(id) on delete set null;

-- ── Match codes live in their OWN table so the code never leaks to players ─
-- (matches rows are publicly readable; only the organizer may read here).
create table public.match_codes (
  match_id    uuid primary key references public.matches(id) on delete cascade,
  code        text not null,
  valid_until timestamptz not null,        -- kickoff → ends_at + 60 min
  created_at  timestamptz not null default now()
);
alter table public.match_codes enable row level security;
create policy "organizer reads own match code" on public.match_codes
  for select using (public.is_match_organizer(match_id));
-- No client writes — only the SECURITY DEFINER function below writes here.

-- ════════════════════════════════════════════════════════════════════════
--  ensure_match_code — organizer reveals the 4-digit code (generated once).
--  Valid from now until ends_at + 60 minutes.
-- ════════════════════════════════════════════════════════════════════════
create or replace function public.ensure_match_code(p_match_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_match public.matches%rowtype;
  v_code  text;
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

-- ════════════════════════════════════════════════════════════════════════
--  check_in — Dual layer. method 'gps' (<=200m) OR 'match_code'.
--  Either one satisfied marks the player present. Window: kickoff → ends+60.
-- ════════════════════════════════════════════════════════════════════════
create or replace function public.check_in(
  p_match_id uuid,
  p_method   text,
  p_lat      double precision default null,
  p_lng      double precision default null,
  p_code     text default null
)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_match public.matches%rowtype;
  v_loc   public.locations%rowtype;
  v_mp    public.match_players%rowtype;
  v_dist  double precision;
  v_mc    public.match_codes%rowtype;
begin
  if v_uid is null then raise exception 'NOT_AUTHED'; end if;

  select * into v_match from public.matches where id = p_match_id;
  if not found then raise exception 'NO_MATCH'; end if;
  if now() < v_match.kickoff_at then raise exception 'TOO_EARLY'; end if;
  if now() > v_match.ends_at + interval '60 minutes' then raise exception 'WINDOW_CLOSED'; end if;

  select * into v_mp from public.match_players
   where match_id = p_match_id and user_id = v_uid for update;
  if not found then raise exception 'NOT_IN'; end if;
  if v_mp.status = 'attended' then return 'already'; end if;
  if v_mp.status <> 'accepted' then raise exception 'NOT_CONFIRMED'; end if;

  if p_method = 'gps' then
    select * into v_loc from public.locations where id = v_match.location_id;
    if v_loc.latitude is null or p_lat is null then raise exception 'NO_GEO'; end if;
    -- haversine (metres)
    v_dist := 2 * 6371000 * asin(sqrt(
      power(sin(radians(p_lat - v_loc.latitude) / 2), 2) +
      cos(radians(v_loc.latitude)) * cos(radians(p_lat)) *
      power(sin(radians(p_lng - v_loc.longitude) / 2), 2)
    ));
    if v_dist > v_loc.geofence_radius_m then raise exception 'TOO_FAR'; end if;

    update public.match_players
       set status = 'attended', check_in_method = 'gps', checked_in_at = now(),
           check_in_lat = p_lat, check_in_lng = p_lng
     where id = v_mp.id;
  else
    select * into v_mc from public.match_codes where match_id = p_match_id;
    if v_mc.code is null then raise exception 'CODE_NOT_SET'; end if;
    if now() > v_mc.valid_until then raise exception 'CODE_EXPIRED'; end if;
    if p_code is distinct from v_mc.code then raise exception 'BAD_CODE'; end if;

    update public.match_players
       set status = 'attended', check_in_method = 'match_code', checked_in_at = now()
     where id = v_mp.id;
  end if;

  return 'verified';
end;
$$;

-- ════════════════════════════════════════════════════════════════════════
--  settle_match — fires once a match has ended. Attendees get tokens back +
--  games_played++. No-shows forfeit to the platform + games_missed++.
--  Pending (never-accepted) requests are refunded. Idempotent.
-- ════════════════════════════════════════════════════════════════════════
create or replace function public.settle_match(p_match_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_match public.matches%rowtype;
begin
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'NO_MATCH'; end if;
  if v_match.status in ('completed', 'cancelled') then return 'noop'; end if;
  if now() < v_match.ends_at then raise exception 'NOT_ENDED'; end if;

  -- 1) Attendees → return token (+ ledger), games_played++
  insert into public.token_transactions (token_id, user_id, type, match_id, note)
    select token_id, user_id, 'return', p_match_id, 'Match completed — token returned'
    from public.match_players where match_id = p_match_id and status = 'attended';
  update public.tokens set status = 'available', committed_match_id = null
    where id in (select token_id from public.match_players
                 where match_id = p_match_id and status = 'attended');
  update public.profiles set games_played = games_played + 1
    where id in (select user_id from public.match_players
                 where match_id = p_match_id and status = 'attended');

  -- 2) Pending requests that never got in → refund, mark rejected
  insert into public.token_transactions (token_id, user_id, type, match_id, note)
    select token_id, user_id, 'refund', p_match_id, 'Match ended while pending — token refunded'
    from public.match_players where match_id = p_match_id and status = 'requested';
  update public.tokens set status = 'available', committed_match_id = null
    where id in (select token_id from public.match_players
                 where match_id = p_match_id and status = 'requested');
  update public.match_players set status = 'rejected'
    where match_id = p_match_id and status = 'requested';

  -- 3) Accepted but no check-in → no-show: forfeit to platform, games_missed++
  insert into public.token_transactions (token_id, user_id, type, match_id, note)
    select token_id, user_id, 'forfeit', p_match_id, 'No-show — token forfeited'
    from public.match_players where match_id = p_match_id and status = 'accepted';
  insert into public.platform_ledger (user_id, match_id, token_id, reason)
    select user_id, p_match_id, token_id, 'no_show'
    from public.match_players where match_id = p_match_id and status = 'accepted';
  update public.tokens set status = 'forfeited'
    where id in (select token_id from public.match_players
                 where match_id = p_match_id and status = 'accepted');
  update public.profiles set games_missed = games_missed + 1
    where id in (select user_id from public.match_players
                 where match_id = p_match_id and status = 'accepted');
  update public.match_players set status = 'no_show'
    where match_id = p_match_id and status = 'accepted';

  -- 4) Recompute reliability for everyone whose counters moved
  update public.profiles set reliability_score = case
      when (games_played + games_missed) = 0 then 100
      else round(100.0 * games_played / (games_played + games_missed), 2) end
    where id in (select user_id from public.match_players
                 where match_id = p_match_id and status in ('attended', 'no_show'));

  update public.matches set status = 'completed' where id = p_match_id;
  return 'completed';
end;
$$;

-- ════════════════════════════════════════════════════════════════════════
--  vote_motm — a Premium attendee casts one MotM vote on a completed match.
-- ════════════════════════════════════════════════════════════════════════
create or replace function public.vote_motm(p_match_id uuid, p_votee_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'NOT_AUTHED'; end if;
  if v_uid = p_votee_id then raise exception 'SELF_VOTE'; end if;
  if not public.is_premium(v_uid) then raise exception 'NOT_PREMIUM'; end if;
  if not exists (select 1 from public.matches where id = p_match_id and status = 'completed')
    then raise exception 'NOT_COMPLETED'; end if;
  if not exists (select 1 from public.match_players
    where match_id = p_match_id and user_id = v_uid and status = 'attended')
    then raise exception 'NOT_ATTENDEE'; end if;
  if not exists (select 1 from public.match_players
    where match_id = p_match_id and user_id = p_votee_id and status = 'attended')
    then raise exception 'BAD_VOTEE'; end if;

  insert into public.match_votes (match_id, voter_id, votee_id)
    values (p_match_id, v_uid, p_votee_id);
  return 'voted';
exception when unique_violation then
  raise exception 'ALREADY_VOTED';
end;
$$;

-- ════════════════════════════════════════════════════════════════════════
--  finalize_motm — award the trophy to the top-voted player once voting
--  closes (24h after kickoff end). Idempotent. Updates profiles.motm_count
--  which drives the leaderboard rank.
-- ════════════════════════════════════════════════════════════════════════
create or replace function public.finalize_motm(p_match_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_match  public.matches%rowtype;
  v_winner uuid;
begin
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'NO_MATCH'; end if;
  if v_match.status <> 'completed' or v_match.motm_awarded then return 'noop'; end if;
  if now() < v_match.ends_at + interval '24 hours' then return 'voting_open'; end if;

  select votee_id into v_winner
    from public.match_votes where match_id = p_match_id
    group by votee_id order by count(*) desc, votee_id limit 1;

  if v_winner is not null then
    update public.profiles set motm_count = motm_count + 1 where id = v_winner;
    update public.matches set motm_winner_id = v_winner, motm_awarded = true where id = p_match_id;
  else
    update public.matches set motm_awarded = true where id = p_match_id;  -- no votes; close it out
  end if;
  return 'awarded';
end;
$$;

-- ── Leaderboard now lists ONLY Premium members (a Premium perk) ──────────
create or replace view public.leaderboard
with (security_invoker = true) as
  select
    p.id, p.name, p.profile_picture_url, p.neighborhood, p.skill_level,
    p.motm_count, p.reliability_score, p.games_played,
    rank() over (order by p.motm_count desc, p.reliability_score desc, p.games_played desc) as position
  from public.profiles p
  where public.is_premium(p.id);

grant select on public.leaderboard to anon, authenticated;
grant execute on function public.ensure_match_code(uuid)                              to authenticated;
grant execute on function public.check_in(uuid, text, double precision, double precision, text) to authenticated;
grant execute on function public.settle_match(uuid)                                   to authenticated;
grant execute on function public.vote_motm(uuid, uuid)                                to authenticated;
grant execute on function public.finalize_motm(uuid)                                  to authenticated;
