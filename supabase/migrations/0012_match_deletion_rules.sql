-- ════════════════════════════════════════════════════════════════════════
--  Fair-play match cancellation (organizer), governed by a 24-hour window.
--
--  >24h to kickoff: organizer may cancel. Soft-cancels the match (status
--    'cancelled') and REFUNDS the committed token to every RSVP'd player.
--    No reliability penalty for anyone — the organizer pulled the game, not
--    the players.
--  <=24h to kickoff: blocked (TOO_LATE) — prevents last-minute abandonment;
--    the UI nudges them to message players via the WhatsApp group instead.
--
--  Soft-cancel (not a hard DELETE) preserves history/ledger for accountability.
-- ════════════════════════════════════════════════════════════════════════
create or replace function public.cancel_match(p_match_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_match public.matches%rowtype;
begin
  if v_uid is null then raise exception 'NOT_AUTHED'; end if;
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'NO_MATCH'; end if;
  if v_match.organizer_id <> v_uid then raise exception 'NOT_ORGANIZER'; end if;
  if v_match.status in ('completed', 'cancelled') then raise exception 'NOT_CANCELLABLE'; end if;
  if now() > (v_match.kickoff_at - interval '24 hours') then raise exception 'TOO_LATE'; end if;

  -- Refund every active participant's committed token (reliability untouched).
  insert into public.token_transactions (token_id, user_id, type, match_id, note)
    select token_id, user_id, 'refund', p_match_id, 'Match cancelled by organizer — token refunded'
    from public.match_players
    where match_id = p_match_id and status in ('requested','accepted','attended') and token_id is not null;

  update public.tokens set status = 'available', committed_match_id = null
    where id in (select token_id from public.match_players
                 where match_id = p_match_id and status in ('requested','accepted','attended'));

  update public.match_players
     set status = 'cancelled_early', cancelled_at = now(), team_color = null
   where match_id = p_match_id and status in ('requested','accepted','attended');

  update public.matches set status = 'cancelled', teams_assigned = false where id = p_match_id;
  return 'cancelled';
end;
$$;

grant execute on function public.cancel_match(uuid) to authenticated;
