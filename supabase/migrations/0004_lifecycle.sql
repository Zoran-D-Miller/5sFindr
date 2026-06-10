-- ════════════════════════════════════════════════════════════════════════
--  Phase 5 — Join / Commit / Cancel lifecycle.
--  All token movements run inside a single transaction with row locks, as
--  SECURITY DEFINER functions (they bypass RLS — the trusted economy path —
--  but verify auth.uid() themselves). Called from server actions via RPC.
-- ════════════════════════════════════════════════════════════════════════

-- ── Platform ledger: deposits forfeited to 5sFindr ──────────────────────
create table public.platform_ledger (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles(id) on delete set null,
  match_id   uuid references public.matches(id) on delete set null,
  token_id   uuid,
  amount_zar int  not null default 20,
  reason     text not null,                 -- 'late_cancel' | 'no_show'
  created_at timestamptz not null default now()
);
alter table public.platform_ledger enable row level security;
-- No policies → no client access. Only SECURITY DEFINER functions write here.

-- ── Roster visibility helpers (avoid RLS self-recursion on match_players) ─
create or replace function public.is_match_organizer(p_match_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.matches m
    where m.id = p_match_id and m.organizer_id = auth.uid()
  );
$$;

create or replace function public.is_match_participant(p_match_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.match_players mp
    where mp.match_id = p_match_id and mp.user_id = auth.uid()
      and mp.status in ('requested', 'accepted', 'attended')
  );
$$;

-- Co-participants (and the organizer) can now read the full roster / tickets.
drop policy if exists "player or organizer reads roster" on public.match_players;
create policy "roster visible to organizer and participants" on public.match_players
  for select using (
    user_id = auth.uid()
    or public.is_match_organizer(match_id)
    or public.is_match_participant(match_id)
  );

-- ── Reliability = played / (played + missed), 100 when no history ───────
create or replace function public.recompute_reliability(p_uid uuid)
returns void language sql security definer set search_path = public as $$
  update public.profiles
     set reliability_score = case
       when (games_played + games_missed) = 0 then 100
       else round(100.0 * games_played / (games_played + games_missed), 2)
     end
   where id = p_uid;
$$;

-- ── Balanced Light/Dark split over accepted+attended players ────────────
create or replace function public.assign_teams(p_match_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  with ranked as (
    select mp.id,
           row_number() over (order by p.skill_level desc, mp.requested_at) as rn
    from public.match_players mp
    join public.profiles p on p.id = mp.user_id
    where mp.match_id = p_match_id and mp.status in ('accepted', 'attended')
  )
  update public.match_players mp
     set team_color = case when (r.rn % 2) = 1 then 'light'::team_color else 'dark'::team_color end
    from ranked r
   where r.id = mp.id;

  update public.matches set teams_assigned = true where id = p_match_id;
end;
$$;

-- ════════════════════════════════════════════════════════════════════════
--  join_match — Premium + token gate, lock a token, accept or queue.
-- ════════════════════════════════════════════════════════════════════════
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
  if not public.is_premium(v_uid) then raise exception 'NOT_PREMIUM'; end if;

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

  select * into v_prof from public.profiles where id = v_uid;

  -- Lock exactly one available token (race-safe).
  select id into v_token from public.tokens
   where owner_id = v_uid and status = 'available'
   order by created_at
   limit 1 for update skip locked;
  if v_token is null then raise exception 'NO_TOKEN'; end if;

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

  -- Commit the token (lock it to this match) + ledger entry.
  update public.tokens set status = 'committed', committed_match_id = p_match_id where id = v_token;
  insert into public.token_transactions (token_id, user_id, type, match_id, note)
    values (v_token, v_uid, 'commit', p_match_id, 'Committed to match');

  insert into public.match_players (match_id, user_id, status, token_id, responded_at)
    values (p_match_id, v_uid, v_status, v_token, case when v_meets then now() else null end);

  -- If that filled the squad, lock the match and assign teams.
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

-- ════════════════════════════════════════════════════════════════════════
--  cancel_participation — the 12-hour fork.
-- ════════════════════════════════════════════════════════════════════════
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
    -- Forfeit the deposit to the platform + reliability hit.
    update public.tokens set status = 'forfeited' where id = v_mp.token_id;
    insert into public.token_transactions (token_id, user_id, type, match_id, note)
      values (v_mp.token_id, v_uid, 'forfeit', p_match_id, 'Late cancellation — token forfeited');
    insert into public.platform_ledger (user_id, match_id, token_id, reason)
      values (v_uid, p_match_id, v_mp.token_id, 'late_cancel');
    update public.match_players
       set status = 'cancelled_late', cancelled_at = now(), team_color = null
     where id = v_mp.id;
    update public.profiles set games_missed = games_missed + 1 where id = v_uid;
    perform public.recompute_reliability(v_uid);
  else
    -- Full refund, reliability untouched.
    update public.tokens set status = 'available', committed_match_id = null where id = v_mp.token_id;
    insert into public.token_transactions (token_id, user_id, type, match_id, note)
      values (v_mp.token_id, v_uid, 'refund', p_match_id, 'Early cancellation — token refunded');
    update public.match_players
       set status = 'cancelled_early', cancelled_at = now(), team_color = null
     where id = v_mp.id;
  end if;

  -- Freed a confirmed spot in a full match → reopen + clear teams (rebalanced on refill).
  if v_mp.status in ('accepted', 'attended') and v_match.status = 'full' then
    update public.matches set status = 'open', teams_assigned = false where id = p_match_id;
    update public.match_players set team_color = null
     where match_id = p_match_id and status in ('accepted', 'attended');
  end if;

  return case when v_late then 'forfeited' else 'refunded' end;
end;
$$;

-- ════════════════════════════════════════════════════════════════════════
--  manager_respond — organizer approves/declines a manual request.
--  Declining refunds the requester's token (reliability untouched).
-- ════════════════════════════════════════════════════════════════════════
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
    update public.tokens set status = 'available', committed_match_id = null where id = v_mp.token_id;
    insert into public.token_transactions (token_id, user_id, type, match_id, note)
      values (v_mp.token_id, p_user_id, 'refund', p_match_id, 'Request declined — token refunded');
    update public.match_players set status = 'rejected', responded_at = now() where id = v_mp.id;
    return 'rejected';
  end if;
end;
$$;

-- ════════════════════════════════════════════════════════════════════════
--  lock_match — organizer locks an open match early and assigns teams.
-- ════════════════════════════════════════════════════════════════════════
create or replace function public.lock_match(p_match_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_match public.matches%rowtype;
begin
  if v_uid is null then raise exception 'NOT_AUTHED'; end if;
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'NO_MATCH'; end if;
  if v_match.organizer_id <> v_uid then raise exception 'NOT_ORGANIZER'; end if;

  update public.matches set status = 'full' where id = p_match_id and status = 'open';
  perform public.assign_teams(p_match_id);
end;
$$;

grant execute on function public.join_match(uuid)                       to authenticated;
grant execute on function public.cancel_participation(uuid)             to authenticated;
grant execute on function public.manager_respond(uuid, uuid, boolean)   to authenticated;
grant execute on function public.lock_match(uuid)                       to authenticated;
grant execute on function public.is_match_organizer(uuid)               to anon, authenticated;
grant execute on function public.is_match_participant(uuid)             to anon, authenticated;
