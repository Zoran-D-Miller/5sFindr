-- ════════════════════════════════════════════════════════════════════════
--  5sFindr — economy stress test
--  Runs after migrations + seed. Everything inside one transaction that is
--  ROLLED BACK at the end, so it never pollutes the database.
--  Any failed assertion raises an exception → psql (ON_ERROR_STOP) exits != 0.
-- ════════════════════════════════════════════════════════════════════════
begin;

-- ═════════════════════════════════════════════════════════════════════════
--  PART A (scenarios 1–3): the token economy, with the tokens flag ON.
--  Kept so the deposit logic still works if NEXT_PUBLIC_FLAG_TOKENS returns.
--  PART B (scenarios 4–8): the S2 launch rules, tokens OFF (the default).
-- ═════════════════════════════════════════════════════════════════════════
update public.app_config set tokens_enabled = true;

-- A signed-up user is created by inserting into auth.users (fires the
-- handle_new_user trigger). We impersonate users via request.jwt.claims.

-- ─────────────────────────────────────────────────────────────────────────
--  SCENARIO 1 — Referral signup
--  New user: 30-day Premium trial + 1 free token. Referrer: +7 free days.
-- ─────────────────────────────────────────────────────────────────────────
do $$
declare
  v_ref  uuid := gen_random_uuid();
  v_new  uuid := gen_random_uuid();
  v_code text;
  v_free timestamptz;
  v_days numeric;
  v_tok  int;
begin
  insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
    values ('00000000-0000-0000-0000-000000000000', v_ref, 'authenticated', 'authenticated',
            's1_ref@test.co', '{"name":"Referrer"}');

  select referral_code into v_code from public.profiles where id = v_ref;
  if v_code is null then raise exception 'S1 FAIL: referrer has no referral_code'; end if;

  -- Referred user signs up carrying the referral code in their metadata.
  insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
    values ('00000000-0000-0000-0000-000000000000', v_new, 'authenticated', 'authenticated',
            's1_new@test.co', json_build_object('name', 'Newbie', 'referral_code', v_code));

  -- New user: trialing, ~30 days free, exactly 1 available token + grant ledger.
  if (select state from public.subscriptions where user_id = v_new) <> 'trialing'
    then raise exception 'S1 FAIL: new user not trialing'; end if;
  select free_until into v_free from public.subscriptions where user_id = v_new;
  v_days := extract(epoch from (v_free - now())) / 86400;
  if v_days < 29 or v_days > 31 then raise exception 'S1 FAIL: new trial = % days (want ~30)', round(v_days,1); end if;

  select count(*) into v_tok from public.tokens where owner_id = v_new and status = 'available';
  if v_tok <> 1 then raise exception 'S1 FAIL: new user has % tokens (want 1)', v_tok; end if;
  if not exists (select 1 from public.token_transactions where user_id = v_new and type = 'signup_grant')
    then raise exception 'S1 FAIL: no signup_grant ledger entry'; end if;

  -- Referrer: trial extended by 7 days → ~37 days total.
  select free_until into v_free from public.subscriptions where user_id = v_ref;
  v_days := extract(epoch from (v_free - now())) / 86400;
  if v_days < 36 or v_days > 38 then raise exception 'S1 FAIL: referrer = % days (want ~37)', round(v_days,1); end if;

  if not exists (select 1 from public.referrals
                 where referrer_id = v_ref and referred_id = v_new and reward_granted)
    then raise exception 'S1 FAIL: referral row missing/unrewarded'; end if;

  raise notice 'SCENARIO 1 PASSED — new user 30d trial + 1 token; referrer +7d';
end $$;

-- ─────────────────────────────────────────────────────────────────────────
--  SCENARIO 2 — Cancellation 12-hour fork
--  13h before  → token refunded, reliability untouched
--  11h before  → token forfeited to platform, reliability drops
-- ─────────────────────────────────────────────────────────────────────────
do $$
declare
  v_org uuid := gen_random_uuid();
  v_a   uuid := gen_random_uuid();
  v_b   uuid := gen_random_uuid();
  v_loc uuid;
  v_m1  uuid;
  v_m2  uuid;
  v_avail int; v_forf int; v_rel numeric; v_missed int;
begin
  insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
    values ('00000000-0000-0000-0000-000000000000', v_org, 'authenticated', 'authenticated',
            's2_org@test.co', '{"name":"Org2"}');
  select id into v_loc from public.locations where is_seeded limit 1;

  -- ── 2A: cancel 13h before kickoff → refund ──
  insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
    values ('00000000-0000-0000-0000-000000000000', v_a, 'authenticated', 'authenticated',
            's2_a@test.co', '{"name":"PlayerA"}');
  insert into public.matches (organizer_id, location_id, venue_type, kickoff_at, duration_min, ends_at,
                              max_players, join_mode, status, share_slug)
    values (v_org, v_loc, 'official_court', now() + interval '13 hours', 60, now() + interval '14 hours',
            10, 'instant', 'open', 's2a-' || substr(md5(random()::text), 1, 8))
    returning id into v_m1;

  perform set_config('request.jwt.claims', json_build_object('sub', v_a)::text, true);
  perform public.join_match(v_m1);
  perform public.cancel_participation(v_m1);

  select count(*) into v_avail from public.tokens where owner_id = v_a and status = 'available';
  select reliability_score into v_rel from public.profiles where id = v_a;
  if v_avail <> 1 then raise exception 'S2A FAIL: token not refunded (available=%)', v_avail; end if;
  if v_rel <> 100 then raise exception 'S2A FAIL: reliability changed to %', v_rel; end if;
  if (select status from public.match_players where match_id = v_m1 and user_id = v_a) <> 'cancelled_early'
    then raise exception 'S2A FAIL: status not cancelled_early'; end if;
  if exists (select 1 from public.platform_ledger where user_id = v_a)
    then raise exception 'S2A FAIL: platform ledger should be empty'; end if;
  if not exists (select 1 from public.token_transactions where user_id = v_a and type = 'refund' and match_id = v_m1)
    then raise exception 'S2A FAIL: no refund ledger entry'; end if;
  raise notice 'SCENARIO 2A PASSED — 13h before: token refunded, reliability intact (100)';

  -- ── 2B: cancel 11h before kickoff → forfeit + reliability drop ──
  insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
    values ('00000000-0000-0000-0000-000000000000', v_b, 'authenticated', 'authenticated',
            's2_b@test.co', '{"name":"PlayerB"}');
  insert into public.matches (organizer_id, location_id, venue_type, kickoff_at, duration_min, ends_at,
                              max_players, join_mode, status, share_slug)
    values (v_org, v_loc, 'official_court', now() + interval '11 hours', 60, now() + interval '12 hours',
            10, 'instant', 'open', 's2b-' || substr(md5(random()::text), 1, 8))
    returning id into v_m2;

  perform set_config('request.jwt.claims', json_build_object('sub', v_b)::text, true);
  perform public.join_match(v_m2);
  perform public.cancel_participation(v_m2);

  select count(*) into v_avail from public.tokens where owner_id = v_b and status = 'available';
  select count(*) into v_forf  from public.tokens where owner_id = v_b and status = 'forfeited';
  select reliability_score, games_missed into v_rel, v_missed from public.profiles where id = v_b;
  if v_avail <> 0 or v_forf <> 1 then raise exception 'S2B FAIL: token not forfeited (available=%, forfeited=%)', v_avail, v_forf; end if;
  if v_missed <> 1 then raise exception 'S2B FAIL: games_missed=% (want 1)', v_missed; end if;
  if v_rel <> 0 then raise exception 'S2B FAIL: reliability=% (want 0 after 0/1)', v_rel; end if;
  if (select status from public.match_players where match_id = v_m2 and user_id = v_b) <> 'cancelled_late'
    then raise exception 'S2B FAIL: status not cancelled_late'; end if;
  if not exists (select 1 from public.platform_ledger where user_id = v_b and reason = 'late_cancel' and match_id = v_m2)
    then raise exception 'S2B FAIL: no platform_ledger late_cancel row'; end if;
  if not exists (select 1 from public.token_transactions where user_id = v_b and type = 'forfeit' and match_id = v_m2)
    then raise exception 'S2B FAIL: no forfeit ledger entry'; end if;
  raise notice 'SCENARIO 2B PASSED — 11h before: token forfeited to platform, reliability dropped';
end $$;

-- ─────────────────────────────────────────────────────────────────────────
--  SCENARIO 3 — Match end: 8 checked in (GPS/code) refunded, 2 ghosts forfeit
-- ─────────────────────────────────────────────────────────────────────────
do $$
declare
  v_org     uuid := gen_random_uuid();
  v_players uuid[] := '{}';
  v_pid     uuid;
  v_loc     uuid;
  v_lat     double precision;
  v_lng     double precision;
  v_match   uuid;
  v_code    text;
  i         int;
  v_avail int; v_forf int; v_played int; v_missed int; v_rel numeric;
begin
  insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
    values ('00000000-0000-0000-0000-000000000000', v_org, 'authenticated', 'authenticated',
            's3_org@test.co', '{"name":"Org3"}');
  select id, latitude, longitude into v_loc, v_lat, v_lng
    from public.locations where name = 'Fives Futbol Century City' limit 1;
  if v_lat is null then raise exception 'S3 FAIL: seeded venue missing coords'; end if;

  -- max_players 11 = Captain (organizer, auto-added by the 0014 trigger) + 10 joiners.
  insert into public.matches (organizer_id, location_id, venue_type, kickoff_at, duration_min, ends_at,
                              max_players, join_mode, status, share_slug)
    values (v_org, v_loc, 'official_court', now() + interval '2 hours', 60, now() + interval '3 hours',
            11, 'instant', 'open', 's3-' || substr(md5(random()::text), 1, 8))
    returning id into v_match;

  for i in 1..10 loop
    v_pid := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
      values ('00000000-0000-0000-0000-000000000000', v_pid, 'authenticated', 'authenticated',
              's3_p' || i || '@test.co', json_build_object('name', 'P' || i));
    v_players := v_players || v_pid;
    perform set_config('request.jwt.claims', json_build_object('sub', v_pid)::text, true);
    perform public.join_match(v_match);
  end loop;

  if (select status from public.matches where id = v_match) <> 'full'
    then raise exception 'S3 FAIL: match not full after 10 joins'; end if;
  if not (select teams_assigned from public.matches where id = v_match)
    then raise exception 'S3 FAIL: teams not assigned on fill'; end if;

  -- Time-travel: the match has now kicked off and just ended.
  update public.matches set kickoff_at = now() - interval '65 minutes',
                            ends_at     = now() - interval '5 minutes'
   where id = v_match;

  -- Organizer reveals the 4-digit code (valid until ends_at + 60 min).
  perform set_config('request.jwt.claims', json_build_object('sub', v_org)::text, true);
  v_code := public.ensure_match_code(v_match);
  if v_code !~ '^\d{4}$' then raise exception 'S3 FAIL: bad match code %', v_code; end if;
  -- The Captain (organizer) is also an accepted player → must check in too.
  perform public.check_in(v_match, 'gps', v_lat, v_lng, null);

  -- Players 1–4 check in via GPS (at the venue), 5–8 via the code, 9–10 ghost.
  for i in 1..8 loop
    v_pid := v_players[i];
    perform set_config('request.jwt.claims', json_build_object('sub', v_pid)::text, true);
    if i <= 4 then
      perform public.check_in(v_match, 'gps', v_lat, v_lng, null);
    else
      perform public.check_in(v_match, 'match_code', null, null, v_code);
    end if;
  end loop;

  -- End the match → automated settlement (cron / no user).
  perform set_config('request.jwt.claims', '', true);
  perform public.settle_match(v_match);
  if (select status from public.matches where id = v_match) <> 'completed'
    then raise exception 'S3 FAIL: match not completed after settle'; end if;

  -- Attendees (1–8): token back, games_played=1, reliability 100.
  for i in 1..8 loop
    v_pid := v_players[i];
    select count(*) into v_avail from public.tokens where owner_id = v_pid and status = 'available';
    select games_played, games_missed, reliability_score into v_played, v_missed, v_rel
      from public.profiles where id = v_pid;
    if v_avail <> 1 then raise exception 'S3 FAIL: attendee % token not returned (available=%)', i, v_avail; end if;
    if v_played <> 1 or v_missed <> 0 then raise exception 'S3 FAIL: attendee % counters played=% missed=%', i, v_played, v_missed; end if;
    if v_rel <> 100 then raise exception 'S3 FAIL: attendee % reliability=%', i, v_rel; end if;
  end loop;

  -- Ghosts (9–10): token forfeited, games_missed=1, reliability dropped to 0.
  for i in 9..10 loop
    v_pid := v_players[i];
    select count(*) into v_avail from public.tokens where owner_id = v_pid and status = 'available';
    select count(*) into v_forf  from public.tokens where owner_id = v_pid and status = 'forfeited';
    select games_played, games_missed, reliability_score into v_played, v_missed, v_rel
      from public.profiles where id = v_pid;
    if v_avail <> 0 or v_forf <> 1 then raise exception 'S3 FAIL: ghost % token not forfeited (available=%, forfeited=%)', i, v_avail, v_forf; end if;
    if v_played <> 0 or v_missed <> 1 then raise exception 'S3 FAIL: ghost % counters played=% missed=%', i, v_played, v_missed; end if;
    if v_rel <> 0 then raise exception 'S3 FAIL: ghost % reliability=% (want 0)', i, v_rel; end if;
  end loop;

  if (select count(*) from public.platform_ledger where match_id = v_match and reason = 'no_show') <> 2
    then raise exception 'S3 FAIL: expected 2 no_show ledger rows'; end if;

  raise notice 'SCENARIO 3 PASSED — 8 checked-in tokens returned; 2 ghosts forfeited + reliability dropped';
end $$;

-- ═════════════════════════════════════════════════════════════════════════
--  PART B — S2 launch rules: tokens OFF, no Premium, guests, organiser ticks.
-- ═════════════════════════════════════════════════════════════════════════
update public.app_config set tokens_enabled = false;

-- Supabase grants table privileges to these roles by default; the local shim
-- doesn't, so grant them here (rolled back) to test the RLS policies for real.
grant usage on schema public to authenticated;
grant select, insert on public.matches, public.locations, public.match_players to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
--  SCENARIO 4 — No Premium, no token: post a game and join one for free.
-- ─────────────────────────────────────────────────────────────────────────
do $$
declare
  v_org uuid := gen_random_uuid();
  v_p   uuid := gen_random_uuid();
  v_loc uuid;
  v_m   uuid;
  v_res text;
begin
  insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data) values
    ('00000000-0000-0000-0000-000000000000', v_org, 'authenticated', 'authenticated', 's4_org@test.co', '{"name":"Org4"}'),
    ('00000000-0000-0000-0000-000000000000', v_p,   'authenticated', 'authenticated', 's4_p@test.co',   '{"name":"P4"}');
  -- Neither is Premium any more, and the player has spent their token elsewhere.
  update public.subscriptions set state = 'free', free_until = now() - interval '1 day' where user_id in (v_org, v_p);
  update public.tokens set status = 'forfeited' where owner_id = v_p;
  if public.is_premium(v_org) then raise exception 'S4 FAIL: setup, organiser still premium'; end if;

  select id into v_loc from public.locations where is_seeded limit 1;

  -- Organiser posts a game through RLS as a non-Premium member.
  perform set_config('request.jwt.claims', json_build_object('sub', v_org, 'is_anonymous', false)::text, true);
  set local role authenticated;
  insert into public.matches (organizer_id, location_id, venue_type, kickoff_at, duration_min, ends_at,
                              max_players, join_mode, status, share_slug)
    values (v_org, v_loc, 'official_court', now() + interval '2 days', 60, now() + interval '2 days 1 hour',
            10, 'instant', 'open', 's4-' || substr(md5(random()::text), 1, 8))
    returning id into v_m;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', v_p, 'is_anonymous', false)::text, true);
  v_res := public.join_match(v_m);
  if v_res <> 'accepted' then raise exception 'S4 FAIL: join returned %', v_res; end if;
  if (select token_id from public.match_players where match_id = v_m and user_id = v_p) is not null
    then raise exception 'S4 FAIL: a token was committed with tokens off'; end if;
  if exists (select 1 from public.token_transactions where user_id = v_p and type = 'commit')
    then raise exception 'S4 FAIL: commit ledger row written with tokens off'; end if;

  -- Direct inserts into the roster are closed (join_match only).
  begin
    set local role authenticated;
    insert into public.match_players (match_id, user_id, status) values (v_m, v_org, 'accepted');
    reset role;
    raise exception 'S4 FAIL: direct roster insert allowed';
  exception when insufficient_privilege or unique_violation then reset role;
  end;

  raise notice 'SCENARIO 4 PASSED — non-Premium member posts a game; join is free, no token';
end $$;

-- ─────────────────────────────────────────────────────────────────────────
--  SCENARIO 5 — Guest (anonymous sign-in): details + POPIA, then join.
--  Guests can't post games, get no founding number until they keep the profile.
-- ─────────────────────────────────────────────────────────────────────────
do $$
declare
  v_org uuid := gen_random_uuid();
  v_g   uuid := gen_random_uuid();
  v_loc uuid;
  v_m   uuid;
  v_err text;
begin
  insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data) values
    ('00000000-0000-0000-0000-000000000000', v_org, 'authenticated', 'authenticated', 's5_org@test.co', '{"name":"Org5"}');
  insert into auth.users (instance_id, id, aud, role, email, is_anonymous) values
    ('00000000-0000-0000-0000-000000000000', v_g, 'authenticated', 'authenticated', null, true);
  if (select founding_number from public.profiles where id = v_g) is not null
    then raise exception 'S5 FAIL: guest got a founding number'; end if;

  select id into v_loc from public.locations where is_seeded limit 1;
  insert into public.matches (organizer_id, location_id, venue_type, kickoff_at, duration_min, ends_at,
                              max_players, join_mode, status, share_slug)
    values (v_org, v_loc, 'open_area', now() + interval '1 day', 60, now() + interval '1 day 1 hour',
            10, 'instant', 'open', 's5-' || substr(md5(random()::text), 1, 8))
    returning id into v_m;

  perform set_config('request.jwt.claims', json_build_object('sub', v_g, 'is_anonymous', true)::text, true);

  -- No WhatsApp number yet → NEED_DETAILS.
  begin
    perform public.join_match(v_m);
    raise exception 'S5 FAIL: guest joined without details';
  exception when others then
    if sqlerrm not like '%NEED_DETAILS%' then raise; end if;
  end;

  -- Bad number / missing consent are rejected.
  begin perform public.save_guest_details('Sam', '0821234567', 'popia-2026-11');
        raise exception 'S5 FAIL: non-E.164 number accepted';
  exception when others then if sqlerrm not like '%BAD_PHONE%' then raise; end if; end;
  begin perform public.save_guest_details('Sam', '+27821234567', '');
        raise exception 'S5 FAIL: missing consent accepted';
  exception when others then if sqlerrm not like '%NO_CONSENT%' then raise; end if; end;

  perform public.save_guest_details('  Sam  ', '+27821234567', 'popia-2026-11');
  if (select name from public.profiles where id = v_g) <> 'Sam' then raise exception 'S5 FAIL: name not saved'; end if;
  if (select consent_at from public.profiles where id = v_g) is null then raise exception 'S5 FAIL: consent not stamped'; end if;

  if public.join_match(v_m) <> 'accepted' then raise exception 'S5 FAIL: guest not accepted'; end if;

  -- Guests can't post a game (RLS).
  begin
    set local role authenticated;
    insert into public.matches (organizer_id, location_id, venue_type, kickoff_at, duration_min, ends_at,
                                max_players, join_mode, status, share_slug)
      values (v_g, v_loc, 'open_area', now() + interval '1 day', 60, now() + interval '1 day 1 hour',
              10, 'instant', 'open', 's5g-' || substr(md5(random()::text), 1, 8));
    reset role;
    raise exception 'S5 FAIL: guest posted a game';
  exception when insufficient_privilege then reset role;
  end;

  -- Keeping the profile (Google / email linked) assigns a founding number.
  update auth.users set is_anonymous = false, email = 's5_guest@test.co' where id = v_g;
  if (select founding_number from public.profiles where id = v_g) is null
    then raise exception 'S5 FAIL: no founding number after upgrade'; end if;

  raise notice 'SCENARIO 5 PASSED — guest: NEED_DETAILS → details + consent → joined; can''t post; upgrade numbers them';
end $$;

-- ─────────────────────────────────────────────────────────────────────────
--  SCENARIO 6 — Cancelling without tokens: early is free, late counts as missed.
-- ─────────────────────────────────────────────────────────────────────────
do $$
declare
  v_org uuid := gen_random_uuid();
  v_a   uuid := gen_random_uuid();
  v_b   uuid := gen_random_uuid();
  v_loc uuid;
  v_m1  uuid;
  v_m2  uuid;
begin
  insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data) values
    ('00000000-0000-0000-0000-000000000000', v_org, 'authenticated', 'authenticated', 's6_org@test.co', '{"name":"Org6"}'),
    ('00000000-0000-0000-0000-000000000000', v_a,   'authenticated', 'authenticated', 's6_a@test.co',   '{"name":"A6"}'),
    ('00000000-0000-0000-0000-000000000000', v_b,   'authenticated', 'authenticated', 's6_b@test.co',   '{"name":"B6"}');
  select id into v_loc from public.locations where is_seeded limit 1;
  insert into public.matches (organizer_id, location_id, venue_type, kickoff_at, duration_min, ends_at,
                              max_players, join_mode, status, share_slug)
    values (v_org, v_loc, 'open_area', now() + interval '13 hours', 60, now() + interval '14 hours',
            10, 'instant', 'open', 's6a-' || substr(md5(random()::text), 1, 8)) returning id into v_m1;
  insert into public.matches (organizer_id, location_id, venue_type, kickoff_at, duration_min, ends_at,
                              max_players, join_mode, status, share_slug)
    values (v_org, v_loc, 'open_area', now() + interval '11 hours', 60, now() + interval '12 hours',
            10, 'instant', 'open', 's6b-' || substr(md5(random()::text), 1, 8)) returning id into v_m2;

  perform set_config('request.jwt.claims', json_build_object('sub', v_a)::text, true);
  perform public.join_match(v_m1);
  if public.cancel_participation(v_m1) <> 'refunded' then raise exception 'S6 FAIL: early cancel outcome'; end if;
  if (select games_missed from public.profiles where id = v_a) <> 0 then raise exception 'S6 FAIL: early cancel penalised'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_b)::text, true);
  perform public.join_match(v_m2);
  if public.cancel_participation(v_m2) <> 'forfeited' then raise exception 'S6 FAIL: late cancel outcome'; end if;
  if (select games_missed from public.profiles where id = v_b) <> 1 then raise exception 'S6 FAIL: late cancel not counted'; end if;
  if exists (select 1 from public.platform_ledger where user_id in (v_a, v_b))
    then raise exception 'S6 FAIL: platform ledger written with tokens off'; end if;
  if exists (select 1 from public.tokens where owner_id in (v_a, v_b) and status <> 'available')
    then raise exception 'S6 FAIL: a token moved with tokens off'; end if;

  -- Rejoin after cancelling (0021) still works token-less.
  perform set_config('request.jwt.claims', json_build_object('sub', v_a)::text, true);
  if public.join_match(v_m1) <> 'accepted' then raise exception 'S6 FAIL: rejoin after early cancel'; end if;

  raise notice 'SCENARIO 6 PASSED — early cancel free; late cancel = 1 missed game; no token or ledger moves';
end $$;

-- ─────────────────────────────────────────────────────────────────────────
--  SCENARIO 7 — Organiser ticks attendance; settlement waits for them.
-- ─────────────────────────────────────────────────────────────────────────
do $$
declare
  v_org uuid := gen_random_uuid();
  v_p   uuid[] := '{}';
  v_pid uuid;
  v_loc uuid;
  v_m   uuid;
  i     int;
begin
  insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data) values
    ('00000000-0000-0000-0000-000000000000', v_org, 'authenticated', 'authenticated', 's7_org@test.co', '{"name":"Org7"}');
  select id into v_loc from public.locations where is_seeded limit 1;
  insert into public.matches (organizer_id, location_id, venue_type, kickoff_at, duration_min, ends_at,
                              max_players, join_mode, status, share_slug)
    values (v_org, v_loc, 'open_area', now() + interval '2 hours', 60, now() + interval '3 hours',
            10, 'instant', 'open', 's7-' || substr(md5(random()::text), 1, 8)) returning id into v_m;
  for i in 1..4 loop
    v_pid := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
      values ('00000000-0000-0000-0000-000000000000', v_pid, 'authenticated', 'authenticated',
              's7_p' || i || '@test.co', json_build_object('name', 'P7-' || i));
    v_p := v_p || v_pid;
    perform set_config('request.jwt.claims', json_build_object('sub', v_pid)::text, true);
    perform public.join_match(v_m);
  end loop;

  -- Before kickoff → TOO_EARLY.
  perform set_config('request.jwt.claims', json_build_object('sub', v_org)::text, true);
  begin perform public.set_attendance(v_m, v_p[1], true);
        raise exception 'S7 FAIL: ticked before kickoff';
  exception when others then if sqlerrm not like '%TOO_EARLY%' then raise; end if; end;

  update public.matches set kickoff_at = now() - interval '65 minutes', ends_at = now() - interval '5 minutes' where id = v_m;

  -- Only the organiser can tick.
  perform set_config('request.jwt.claims', json_build_object('sub', v_p[1])::text, true);
  begin perform public.set_attendance(v_m, v_p[1], true);
        raise exception 'S7 FAIL: player ticked themselves';
  exception when others then if sqlerrm not like '%NOT_ORGANIZER%' then raise; end if; end;

  -- A player viewing the ended game (lazy settle) and the cron both wait.
  if public.settle_match(v_m) <> 'waiting' then raise exception 'S7 FAIL: player settled inside the window'; end if;
  perform set_config('request.jwt.claims', '', true);
  perform public.settle_due_matches();
  if (select status from public.matches where id = v_m) = 'completed' then raise exception 'S7 FAIL: cron settled inside the window'; end if;

  -- Organiser ticks themselves + players 1–3 (and un-ticks/re-ticks 3); player 4 didn't come.
  perform set_config('request.jwt.claims', json_build_object('sub', v_org)::text, true);
  perform public.set_attendance(v_m, v_org, true);
  for i in 1..3 loop perform public.set_attendance(v_m, v_p[i], true); end loop;
  if public.set_attendance(v_m, v_p[3], false) <> 'accepted' then raise exception 'S7 FAIL: untick'; end if;
  perform public.set_attendance(v_m, v_p[3], true);

  if public.settle_match(v_m) <> 'completed' then raise exception 'S7 FAIL: organiser could not settle'; end if;
  for i in 1..3 loop
    if (select games_played from public.profiles where id = v_p[i]) <> 1
      then raise exception 'S7 FAIL: ticked player % not credited', i; end if;
  end loop;
  if (select status from public.match_players where match_id = v_m and user_id = v_p[4]) <> 'no_show'
    then raise exception 'S7 FAIL: unticked player not a no-show'; end if;
  if (select reliability_score from public.profiles where id = v_p[4]) <> 0
    then raise exception 'S7 FAIL: no-show reliability not dropped'; end if;
  if exists (select 1 from public.platform_ledger where match_id = v_m)
    then raise exception 'S7 FAIL: ledger written with tokens off'; end if;

  -- Ticking after settlement is closed.
  begin perform public.set_attendance(v_m, v_p[4], true);
        raise exception 'S7 FAIL: ticked after settlement';
  exception when others then if sqlerrm not like '%WINDOW_CLOSED%' then raise; end if; end;

  raise notice 'SCENARIO 7 PASSED — organiser ticks 3 of 4; others wait 24h; unticked = no-show';
end $$;

-- ─────────────────────────────────────────────────────────────────────────
--  SCENARIO 8 — Organiser never ticked: after 24h the cron credits everyone.
-- ─────────────────────────────────────────────────────────────────────────
do $$
declare
  v_org uuid := gen_random_uuid();
  v_a   uuid := gen_random_uuid();
  v_loc uuid;
  v_m   uuid;
begin
  insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data) values
    ('00000000-0000-0000-0000-000000000000', v_org, 'authenticated', 'authenticated', 's8_org@test.co', '{"name":"Org8"}'),
    ('00000000-0000-0000-0000-000000000000', v_a,   'authenticated', 'authenticated', 's8_a@test.co',   '{"name":"A8"}');
  select id into v_loc from public.locations where is_seeded limit 1;
  insert into public.matches (organizer_id, location_id, venue_type, kickoff_at, duration_min, ends_at,
                              max_players, join_mode, status, share_slug)
    values (v_org, v_loc, 'open_area', now() + interval '2 hours', 60, now() + interval '3 hours',
            10, 'instant', 'open', 's8-' || substr(md5(random()::text), 1, 8)) returning id into v_m;
  perform set_config('request.jwt.claims', json_build_object('sub', v_a)::text, true);
  perform public.join_match(v_m);

  update public.matches set kickoff_at = now() - interval '26 hours', ends_at = now() - interval '25 hours' where id = v_m;
  perform set_config('request.jwt.claims', '', true);
  perform public.settle_due_matches();

  if (select status from public.matches where id = v_m) <> 'completed' then raise exception 'S8 FAIL: not settled after 24h'; end if;
  if (select status from public.match_players where match_id = v_m and user_id = v_a) <> 'attended'
    then raise exception 'S8 FAIL: player marked no-show when attendance wasn''t taken'; end if;
  if (select games_played from public.profiles where id = v_a) <> 1 then raise exception 'S8 FAIL: player not credited'; end if;

  raise notice 'SCENARIO 8 PASSED — no ticks + 24h → cron settles, squad credited, nobody a no-show';
end $$;

rollback;  -- leave the database untouched
