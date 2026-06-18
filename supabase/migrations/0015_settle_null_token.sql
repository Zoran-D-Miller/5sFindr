-- ════════════════════════════════════════════════════════════════════════
--  settle_match: tolerate token-less players (the Captain joins their own match
--  with token_id NULL via 0014). The token_transactions.token_id NOT NULL
--  constraint made settlement fail for any match with a Captain. Guard every
--  token op with `token_id is not null`; still credit games_played/games_missed
--  and reliability for the Captain.
-- ════════════════════════════════════════════════════════════════════════
create or replace function public.settle_match(p_match_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_match public.matches%rowtype;
begin
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'NO_MATCH'; end if;
  if v_match.status in ('completed','cancelled') then return 'noop'; end if;
  if now() < v_match.ends_at then raise exception 'NOT_ENDED'; end if;

  -- Attendees → return token (token-less Captain skips token ops, keeps credit)
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

  -- No-shows → forfeit (token-less Captain skips forfeit, keeps games_missed)
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
