-- ════════════════════════════════════════════════════════════════════════
--  Organizer = Captain. On every new match, the organizer automatically
--  occupies a roster slot as an 'accepted' player (token_id null — they don't
--  spend a deposit on their own game). Atomic with match creation via trigger,
--  so it applies to the create-match action, the cold-start seed, and any RPC.
-- ════════════════════════════════════════════════════════════════════════
create or replace function public.add_organizer_as_captain()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.match_players (match_id, user_id, status, responded_at)
  values (new.id, new.organizer_id, 'accepted', now())
  on conflict (match_id, user_id) do nothing;
  return new;
end;
$$;

create or replace trigger matches_add_captain
  after insert on public.matches
  for each row execute function public.add_organizer_as_captain();
