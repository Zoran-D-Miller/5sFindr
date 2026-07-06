-- ════════════════════════════════════════════════════════════════════════
--  Public browsing: unauthenticated users may view the match feed and match
--  details (roster included) without logging in. Writes stay fully guarded.
--
--  Roster visibility: previously only the player themself, the organizer, or
--  a co-participant could read match_players — which meant anonymous visitors
--  saw spot-counts of 0 and an empty squad sheet. Profiles are already public,
--  so the roster of a LIVE match is now public-read too. Drafts stay hidden
--  because the parent match row is only visible to its organizer.
-- ════════════════════════════════════════════════════════════════════════
drop policy if exists "roster visible to organizer and participants" on public.match_players;
drop policy if exists "roster is public for live matches" on public.match_players;
create policy "roster is public for live matches" on public.match_players
  for select using (
    user_id = auth.uid()
    or public.is_match_organizer(match_id)
    or exists (
      select 1 from public.matches m
      where m.id = match_id
        and m.status in ('open','full','in_progress','completed')
    )
  );

-- Anonymous visitors also need the read views (idempotent re-grant).
grant select on public.match_feed, public.leaderboard to anon;
grant select on public.matches, public.locations, public.match_players, public.profiles to anon;
