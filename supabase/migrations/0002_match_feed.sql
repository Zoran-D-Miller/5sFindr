-- ════════════════════════════════════════════════════════════════════════
--  match_feed — denormalized read model for the /feed screen.
--  Joins location fields and precomputes spots_taken (accepted + attended).
--  security_invoker = true → the caller's RLS on matches/locations still
--  applies, so drafts stay private to their organizer.
-- ════════════════════════════════════════════════════════════════════════
create or replace view public.match_feed
with (security_invoker = true) as
  select
    m.id,
    m.title,
    m.kickoff_at,
    m.ends_at,
    m.venue_type,
    m.join_mode,
    m.status,
    m.max_players,
    m.price_per_player_zar,
    m.organizer_id,
    l.name        as location_name,
    l.neighborhood,
    l.type        as location_type,
    l.latitude,
    l.longitude,
    coalesce(p.taken, 0) as spots_taken
  from public.matches m
  join public.locations l on l.id = m.location_id
  left join (
    select match_id, count(*)::int as taken
    from public.match_players
    where status in ('accepted', 'attended')
    group by match_id
  ) p on p.match_id = m.id;

grant select on public.match_feed to anon, authenticated;
