-- ════════════════════════════════════════════════════════════════════════
--  ADMIN-ONLY cold-start injector — "the live stage seed".
--  Run MANUALLY in the Supabase SQL Editor (service role). NOT a migration.
--  Seeds 10 organisers + 20 players (authentic Cape Town names) and 15
--  upcoming matches across Century City / Green Point / Footy, each
--  pre-filled with 4–7 players so the marketplace never looks empty.
--
--  Idempotent: re-running is a no-op once the seed marker exists.
--  Seed accounts use @5sfindr.local emails and never log in.
-- ════════════════════════════════════════════════════════════════════════
do $$
declare
  names text[] := array[
    'Sipho Mokoena','Chad Adams','Yusuf Patel','Dylan Smith','Thabo Nkosi',
    'Liam Botha','Ayanda Dlamini','Riaan van Wyk','Kyle Daniels','Tariq Ismail',
    'Sizwe Khumalo','Ethan Pillay','Lwazi Mthembu','Jared Naidoo','Imran Davids',
    'Bongani Zulu','Devon Arendse','Ashwin Govender','Kagiso Mahlangu','Ruan Fourie',
    'Tristan Jacobs','Mandla Sithole','Zaid Salie','Connor Murphy','Tshepo Maluleke',
    'Brandon Petersen','Faried Achmat','Lungelo Cele','Daniel Hendricks','Keenan Fortuin'
  ];
  hoods text[]  := array['Century City','Green Point','Montague Gardens','Sea Point','Observatory','Claremont'];
  bios  text[]  := array[
    'Box-to-box midfielder. Never miss a Thursday.','Pace to burn down the wing.',
    'Reliable keeper, safe hands.','Weekend warrior, big engine.','Target man up top.',
    'Left foot only — but what a left foot.','Defensive rock, talks all game.',
    'Five-a-side veteran. Always early.','Quick feet, loves a nutmeg.','Plays anywhere you need.'
  ];
  positions position_enum[] := array['GK','DEF','MID','FWD','ANY'];

  v_uid uuid;
  v_ids uuid[] := '{}';
  v_venue_cc uuid; v_venue_gp uuid; v_venue_ft uuid;
  v_venues uuid[]; v_vhoods text[];
  v_match uuid; v_org uuid; v_vidx int; v_slots int; v_player uuid; v_token uuid;
  i int; s int; v_kick timestamptz;
begin
  if exists (select 1 from auth.users where email like 'seed+%@5sfindr.local') then
    raise notice 'Cold-start seed already applied — skipping.';
    return;
  end if;

  -- Create 30 confirmed accounts (fires handle_new_user → profile/sub/token).
  for i in 1..array_length(names, 1) loop
    v_uid := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, email_confirmed_at, created_at, updated_at)
    values ('00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
            'seed+' || i || '@5sfindr.local',
            json_build_object('name', names[i]), now(), now(), now());
    v_ids := v_ids || v_uid;

    update public.profiles set
      neighborhood = hoods[1 + (i % array_length(hoods,1))],
      skill_level  = 2 + (i % 4),
      preferred_positions = array[positions[1 + (i % 5)]],
      bio = bios[1 + (i % array_length(bios,1))]
    where id = v_uid;
  end loop;

  -- Resolve the three venues by name; CREATE them if missing so this script
  -- never depends on seed.sql having run and location_id is never null.
  select id into v_venue_cc from public.locations where name = 'Fives Futbol Century City' limit 1;
  if v_venue_cc is null then
    insert into public.locations (name, type, neighborhood, latitude, longitude, is_seeded)
    values ('Fives Futbol Century City', 'official_court', 'Century City', -33.89160, 18.51060, true)
    returning id into v_venue_cc;
  end if;

  select id into v_venue_gp from public.locations where name = 'Green Point Urban Park' limit 1;
  if v_venue_gp is null then
    insert into public.locations (name, type, neighborhood, latitude, longitude, is_seeded)
    values ('Green Point Urban Park', 'open_area', 'Green Point', -33.90200, 18.40900, true)
    returning id into v_venue_gp;
  end if;

  select id into v_venue_ft from public.locations where name = 'Goal Diggers Indoor (Footy)' limit 1;
  if v_venue_ft is null then
    insert into public.locations (name, type, neighborhood, latitude, longitude, is_seeded)
    values ('Goal Diggers Indoor (Footy)', 'official_court', 'Montague Gardens', -33.86700, 18.53800, true)
    returning id into v_venue_ft;
  end if;

  v_venues := array[v_venue_cc, v_venue_gp, v_venue_ft];
  v_vhoods := array['Century City', 'Green Point', 'Montague Gardens'];

  if v_venue_cc is null or v_venue_gp is null or v_venue_ft is null then
    raise exception 'Could not resolve or create seed venues — aborting.';
  end if;

  -- 15 upcoming matches over the next ~3 weeks.
  for i in 1..15 loop
    v_org  := v_ids[1 + (i % 10)];                 -- organisers = first 10 ids
    v_vidx := 1 + (i % 3);
    v_kick := date_trunc('day', now()) + ((1 + (i % 20)) * interval '1 day')
              + (17 + (i % 4)) * interval '1 hour';  -- evening kickoffs 17:00–20:00

    insert into public.matches (organizer_id, location_id, venue_type, title, kickoff_at, duration_min, ends_at,
                                max_players, price_per_player_zar, join_mode, status, share_slug)
    values (v_org, v_venues[v_vidx], 'official_court',
            (array['Lunchtime Fives','After-Work Kickabout','Sunday Social','Midweek Madness','Friday Night Lights'])[1 + (i % 5)],
            v_kick, 60, v_kick + interval '60 minutes', 10,
            (array[0,40,60])[1 + (i % 3)],
            (case when i % 2 = 0 then 'instant' else 'manual' end)::join_mode,
            'open', 'seed-' || substr(replace(gen_random_uuid()::text,'-',''),1,8))
    returning id into v_match;

    -- Pre-fill 4–7 player slots (players = ids 11..30), each with its own committed token.
    v_slots := 4 + (i % 4);
    for s in 1..v_slots loop
      v_player := v_ids[11 + ((i * 3 + s) % 20)];
      insert into public.tokens (owner_id, status, committed_match_id) values (v_player, 'committed', v_match)
        returning id into v_token;
      insert into public.token_transactions (token_id, user_id, type, match_id, note)
        values (v_token, v_player, 'commit', v_match, 'Committed to match');
      insert into public.match_players (match_id, user_id, status, token_id, responded_at)
        values (v_match, v_player, 'accepted', v_token, now())
        on conflict (match_id, user_id) do nothing;
    end loop;
  end loop;

  raise notice 'Cold-start seed applied: % users, 15 matches.', array_length(v_ids,1);
end $$;
