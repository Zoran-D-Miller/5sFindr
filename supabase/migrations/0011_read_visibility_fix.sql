-- ════════════════════════════════════════════════════════════════════════
--  Read-visibility fix + production drift convergence.
--
--  BUG: the leaderboard showed only the caller (and search returned nothing)
--  because is_premium() was SECURITY INVOKER and the subscriptions RLS only
--  exposes the caller's own row → is_premium(other_user) was always false →
--  every other player was filtered out of `where is_premium(p.id)`.
--
--  This migration makes is_premium SECURITY DEFINER, and re-asserts the public
--  read policies, the feed/leaderboard views, and the grants those reads depend
--  on — converging any production drift (e.g. a missing function-EXECUTE grant
--  that made the feed query error out and return an empty array).
--
--  Idempotent / safe to run on the live database.
-- ════════════════════════════════════════════════════════════════════════

-- 1) is_premium: read any user's subscription state (returns only a boolean).
create or replace function public.is_premium(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.subscriptions s
    where s.user_id = uid
      and (s.state = 'active'
           or (s.state = 'trialing' and coalesce(s.free_until, s.current_period_end, now()) > now()))
  );
$$;

-- 2) Re-assert public READ policies (drop+create = converge any drift).
drop policy if exists "profiles are public" on public.profiles;
create policy "profiles are public" on public.profiles for select using (true);

drop policy if exists "live matches are public" on public.matches;
create policy "live matches are public" on public.matches for select
  using (status in ('open','full','in_progress','completed'));
drop policy if exists "organizer reads own drafts" on public.matches;
create policy "organizer reads own drafts" on public.matches for select using (auth.uid() = organizer_id);

drop policy if exists "roster visible to organizer and participants" on public.match_players;
drop policy if exists "player or organizer reads roster" on public.match_players;  -- legacy name, if present
create policy "roster visible to organizer and participants" on public.match_players for select
  using (user_id = auth.uid() or public.is_match_organizer(match_id) or public.is_match_participant(match_id));

-- 3) Re-create the read views to canonical (security_invoker → caller RLS applies).
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

drop view if exists public.leaderboard;
create view public.leaderboard with (security_invoker = true) as
  select p.id, p.name, p.avatar_url, p.neighborhood, p.skill_level, p.preferred_positions,
         p.motm_count, p.reliability_score, p.games_played, p.founding_number,
         rank() over (order by p.motm_count desc, p.reliability_score desc, p.games_played desc) as position
  from public.profiles p
  where public.is_premium(p.id);

-- 4) Grants the reads depend on (harmless if already present).
grant usage on schema public to anon, authenticated;
grant select on public.profiles, public.matches, public.locations, public.match_players to anon, authenticated;
grant select on public.match_feed, public.leaderboard to anon, authenticated;
grant execute on function public.is_premium(uuid)            to anon, authenticated;
grant execute on function public.is_match_organizer(uuid)    to anon, authenticated;
grant execute on function public.is_match_participant(uuid)  to anon, authenticated;
