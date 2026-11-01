-- ════════════════════════════════════════════════════════════════════════
--  join_match: let a player who cancelled rejoin the same match.
--
--  cancel_participation / cancel_match leave the player's row in place as
--  'cancelled_early' / 'cancelled_late', and it keeps the
--  UNIQUE (match_id, user_id) slot. join_match's ALREADY_IN check passed but
--  its plain INSERT then failed with match_players_match_id_user_id_key.
--
--  Now the existing row is reactivated with the new token instead:
--   - cancelled_early: token was refunded, no penalty → rejoin freely.
--   - cancelled_late:  forfeit + games_missed stand; they commit a fresh
--                      token like anyone else.
--   - rejected (organizer declined): stays declined → DECLINED.
--   - attended / no_show only exist after settlement, when the match is no
--     longer 'open', so NOT_OPEN already covers them.
--  requested_at resets to now(): a rejoiner goes to the back of the queue.
--  Token history lives in token_transactions / platform_ledger, not the row.
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

  if exists (
    select 1 from public.match_players
    where match_id = p_match_id and user_id = v_uid and status = 'rejected'
  ) then raise exception 'DECLINED'; end if;

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

  -- New seat, or reactivate a cancelled one. The match row lock above
  -- serialises joins per match, and the checks above leave only
  -- cancelled_early / cancelled_late as a possible existing row.
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

-- CREATE OR REPLACE keeps the ACL; restated so 0019's lockdown is explicit.
revoke execute on function public.join_match(uuid) from public, anon;
grant  execute on function public.join_match(uuid) to authenticated;
