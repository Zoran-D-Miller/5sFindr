-- ════════════════════════════════════════════════════════════════════════
--  ADMIN: seed-community lifecycle (APPLIED TO PRODUCTION 2026-07-20).
--  Keeps the 30 seed accounts visible indefinitely and the feed populated
--  until real volume takes over. Touches ONLY seed accounts
--  (seed+N@5sfindr.local) and seed matches (share_slug 'seed-%').
--
--  What it does:
--   • Keepalive: seed subscriptions get free_until = now() + 100 years, so
--     they stay Premium (leaderboard-visible) indefinitely.
--   • seed_lifecycle() runs daily at 21:30 UTC (before the 22:00 settle
--     sweep): marks seed players 'attended' on ended seed matches (tokens
--     return, stats stay healthy) and tops upcoming seed matches up to 10,
--     each pre-filled with 4–7 seed players over the next two weeks.
--
--  REMOVAL: run supabase/seed_remove.sql — unschedules the job, drops the
--  function, and deletes every seed account (cascades clean all their data).
--  Idempotent: safe to re-run.
-- ════════════════════════════════════════════════════════════════════════

-- 1) Keepalive
update public.subscriptions s
set free_until = now() + interval '100 years', state = 'trialing'
from auth.users u
where u.id = s.user_id and u.email like 'seed+%@5sfindr.local';

-- 2) Lifecycle function
create or replace function public.seed_lifecycle()
returns text language plpgsql security definer set search_path = public as $$
declare
  v_attended int;
  v_upcoming int;
  v_org uuid; v_loc uuid; v_match uuid; v_kick timestamptz;
  v_slots int; v_player uuid; v_token uuid;
  i int; s int; v_created int := 0;
begin
  -- Seed players show up to their ended seed matches (real users untouched).
  with upd as (
    update public.match_players mp
       set status = 'attended', check_in_method = 'match_code', checked_in_at = now()
      from public.matches m, auth.users u
     where m.id = mp.match_id and u.id = mp.user_id
       and mp.status = 'accepted'
       and m.ends_at < now() and m.status not in ('completed','cancelled')
       and m.share_slug like 'seed-%'
       and u.email like 'seed+%@5sfindr.local'
     returning mp.id
  ) select count(*) into v_attended from upd;

  -- Top upcoming seed matches back up to 10.
  select count(*) into v_upcoming from public.matches
   where share_slug like 'seed-%' and status = 'open' and kickoff_at > now();

  for i in 1..(10 - v_upcoming) loop
    select p.id into v_org
      from public.profiles p join auth.users u on u.id = p.id
     where u.email like 'seed+%@5sfindr.local'
     order by random() limit 1;
    exit when v_org is null;

    select id into v_loc from public.locations where is_seeded order by random() limit 1;
    exit when v_loc is null;

    v_kick := date_trunc('day', now()) + ((1 + floor(random()*14))::int * interval '1 day')
              + ((17 + floor(random()*4))::int * interval '1 hour');

    insert into public.matches (organizer_id, location_id, venue_type, title, kickoff_at,
                                duration_min, ends_at, max_players, price_per_player_zar,
                                join_mode, status, share_slug)
      select v_org, v_loc, l.type,
             (array['Lunchtime Fives','After-Work Kickabout','Sunday Social','Midweek Madness','Friday Night Lights'])[1 + floor(random()*5)::int],
             v_kick, 60, v_kick + interval '60 minutes', 10,
             (array[0,40,60])[1 + floor(random()*3)::int],
             (case when random() < 0.5 then 'instant' else 'manual' end)::join_mode,
             'open', 'seed-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)
        from public.locations l where l.id = v_loc
      returning id into v_match;
    v_created := v_created + 1;

    -- Pre-fill 4–7 seed players (organizer auto-added as Captain by trigger).
    v_slots := 4 + floor(random()*4)::int;
    for s in 1..v_slots loop
      select p.id into v_player
        from public.profiles p join auth.users u on u.id = p.id
       where u.email like 'seed+%@5sfindr.local' and p.id <> v_org
         and not exists (select 1 from public.match_players mp
                          where mp.match_id = v_match and mp.user_id = p.id)
       order by random() limit 1;
      continue when v_player is null;

      -- Reuse an available token; mint only if the player has none.
      select id into v_token from public.tokens
       where owner_id = v_player and status = 'available' limit 1;
      if v_token is null then
        insert into public.tokens (owner_id, status) values (v_player, 'available')
          returning id into v_token;
      end if;
      update public.tokens set status = 'committed', committed_match_id = v_match where id = v_token;
      insert into public.token_transactions (token_id, user_id, type, match_id, note)
        values (v_token, v_player, 'commit', v_match, 'Committed to match');
      insert into public.match_players (match_id, user_id, status, token_id, responded_at)
        values (v_match, v_player, 'accepted', v_token, now())
        on conflict (match_id, user_id) do nothing;
    end loop;
  end loop;

  return 'attended=' || v_attended || ' created=' || v_created;
end;
$$;

-- 3) Schedule daily at 21:30 UTC (before the 22:00 UTC settle sweep)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'seed-lifecycle') then
      perform cron.unschedule('seed-lifecycle');
    end if;
    perform cron.schedule('seed-lifecycle', '30 21 * * *', 'select public.seed_lifecycle();');
  end if;
end $$;

-- 4) Run once immediately so the feed repopulates without waiting for cron
select public.seed_lifecycle();
