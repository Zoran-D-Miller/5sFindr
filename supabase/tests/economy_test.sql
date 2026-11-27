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
--  PART B (scenarios 4–11): the launch rules, tokens OFF (the default).
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

-- ─────────────────────────────────────────────────────────────────────────
--  SCENARIO 9 — Paid court: payment details only for the list; I've paid → who's paid.
-- ─────────────────────────────────────────────────────────────────────────
do $$
declare
  v_org uuid := gen_random_uuid();
  v_p   uuid := gen_random_uuid();
  v_out uuid := gen_random_uuid();
  v_loc uuid;
  v_m   uuid;
  v_n   int;
begin
  insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data) values
    ('00000000-0000-0000-0000-000000000000', v_org, 'authenticated', 'authenticated', 's9_org@test.co', '{"name":"Org9"}'),
    ('00000000-0000-0000-0000-000000000000', v_p,   'authenticated', 'authenticated', 's9_p@test.co',   '{"name":"P9"}'),
    ('00000000-0000-0000-0000-000000000000', v_out, 'authenticated', 'authenticated', 's9_out@test.co', '{"name":"Out9"}');
  select id into v_loc from public.locations where is_seeded and type = 'official_court' limit 1;
  insert into public.matches (organizer_id, location_id, venue_type, kickoff_at, duration_min, ends_at,
                              max_players, join_mode, status, share_slug, price_per_player_zar)
    values (v_org, v_loc, 'official_court', now() + interval '2 days', 60, now() + interval '2 days 1 hour',
            10, 'instant', 'open', 's9-' || substr(md5(random()::text), 1, 8), 60) returning id into v_m;

  -- Organiser saves payment details through RLS.
  perform set_config('request.jwt.claims', json_build_object('sub', v_org)::text, true);
  set local role authenticated;
  insert into public.match_payment_info (match_id, details) values (v_m, 'SnapScan: snapscan.io/pay/test');
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', v_p)::text, true);
  perform public.join_match(v_m);

  -- Player on the list can read it; an outsider can't.
  set local role authenticated;
  select count(*) into v_n from public.match_payment_info where match_id = v_m;
  reset role;
  if v_n <> 1 then raise exception 'S9 FAIL: player can''t see payment details'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_out)::text, true);
  set local role authenticated;
  select count(*) into v_n from public.match_payment_info where match_id = v_m;
  reset role;
  if v_n <> 0 then raise exception 'S9 FAIL: outsider can see payment details'; end if;

  -- Outsider can't claim; player claims; only the organiser confirms.
  begin perform public.claim_paid(v_m, true);
        raise exception 'S9 FAIL: outsider claimed paid';
  exception when others then if sqlerrm not like '%NOT_IN%' then raise; end if; end;

  perform set_config('request.jwt.claims', json_build_object('sub', v_p)::text, true);
  if public.claim_paid(v_m, true) <> 'claimed' then raise exception 'S9 FAIL: claim'; end if;
  begin perform public.confirm_paid(v_m, v_p, true);
        raise exception 'S9 FAIL: player confirmed own payment';
  exception when others then if sqlerrm not like '%NOT_ORGANIZER%' then raise; end if; end;

  perform set_config('request.jwt.claims', json_build_object('sub', v_org)::text, true);
  perform public.confirm_paid(v_m, v_p, true);
  if (select paid_claimed_at is not null and paid_confirmed_at is not null
        from public.match_players where match_id = v_m and user_id = v_p) is not true
    then raise exception 'S9 FAIL: paid flags not set'; end if;
  perform public.confirm_paid(v_m, v_p, false);
  if (select paid_confirmed_at from public.match_players where match_id = v_m and user_id = v_p) is not null
    then raise exception 'S9 FAIL: untick'; end if;

  raise notice 'SCENARIO 9 PASSED — payment details list-only; I''ve paid → organiser ticks who''s paid';
end $$;

-- ─────────────────────────────────────────────────────────────────────────
--  SCENARIO 10 — S4 no-show tools: "Still coming?" at 24h/3h, auto-release.
-- ─────────────────────────────────────────────────────────────────────────
do $$
declare
  v_org  uuid := gen_random_uuid();
  v_a    uuid := gen_random_uuid();  -- confirms from the 24h email link
  v_b    uuid := gen_random_uuid();  -- never answers → released (had a token)
  v_g    uuid := gen_random_uuid();  -- guest, no email → in-app only, released
  v_c    uuid := gen_random_uuid();  -- confirms in the app after the 3h call
  v_late uuid := gen_random_uuid();  -- joins 80 min before → auto-confirmed
  v_loc  uuid;
  v_m    uuid;
  v_tok  uuid;
  v_res  jsonb;
  v_n    int;
  v_rows int;
begin
  insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, is_anonymous) values
    ('00000000-0000-0000-0000-000000000000', v_org,  'authenticated', 'authenticated', 's10_org@test.co', '{"name":"Org10"}', false),
    ('00000000-0000-0000-0000-000000000000', v_a,    'authenticated', 'authenticated', 's10_a@test.co',   '{"name":"A10"}',   false),
    ('00000000-0000-0000-0000-000000000000', v_b,    'authenticated', 'authenticated', 's10_b@test.co',   '{"name":"B10"}',   false),
    ('00000000-0000-0000-0000-000000000000', v_g,    'authenticated', 'authenticated', null,              '{"name":"G10"}',   true),
    ('00000000-0000-0000-0000-000000000000', v_c,    'authenticated', 'authenticated', 's10_c@test.co',   '{"name":"C10"}',   false),
    ('00000000-0000-0000-0000-000000000000', v_late, 'authenticated', 'authenticated', 's10_l@test.co',   '{"name":"L10"}',   false);
  update public.profiles set phone_number = '+27821234567' where id = v_g;
  select id into v_loc from public.locations where is_seeded limit 1;
  insert into public.matches (organizer_id, location_id, venue_type, kickoff_at, duration_min, ends_at,
                              max_players, join_mode, status, share_slug)
    values (v_org, v_loc, 'open_area', now() + interval '3 days', 60, now() + interval '3 days 1 hour',
            5, 'instant', 'open', 's10-' || substr(md5(random()::text), 1, 8)) returning id into v_m;

  -- A, G, C join with tokens off; B joins with tokens on (commits a token).
  perform set_config('request.jwt.claims', json_build_object('sub', v_a)::text, true);
  perform public.join_match(v_m);
  perform set_config('request.jwt.claims', json_build_object('sub', v_g, 'is_anonymous', true)::text, true);
  perform public.join_match(v_m);
  perform set_config('request.jwt.claims', json_build_object('sub', v_c)::text, true);
  perform public.join_match(v_m);
  update public.app_config set tokens_enabled = true;
  perform set_config('request.jwt.claims', json_build_object('sub', v_b)::text, true);
  perform public.join_match(v_m);
  update public.app_config set tokens_enabled = false;
  select token_id into v_tok from public.match_players where match_id = v_m and user_id = v_b;
  if v_tok is null then raise exception 'S10 FAIL: B has no committed token'; end if;
  if (select status from public.matches where id = v_m) <> 'full' then raise exception 'S10 FAIL: not full at 5/5 (Captain + 4)'; end if;
  if exists (select 1 from public.match_players where match_id = v_m and confirmed_at is not null and user_id <> v_org)
    then raise exception 'S10 FAIL: early joiners auto-confirmed'; end if;
  if (select confirmed_at from public.match_players where match_id = v_m and user_id = v_org) is null
    then raise exception 'S10 FAIL: organiser seat not auto-confirmed'; end if;
  perform set_config('request.jwt.claims', '', true);

  -- Nothing to ask 3 days out.
  v_res := public.run_checkins();
  if (v_res->>'asked_24h')::int <> 0 then raise exception 'S10 FAIL: asked 3 days out'; end if;

  -- They joined 2 days before kickoff. 20h before → 24h ask for all four.
  update public.match_players set requested_at = now() - interval '2 days', responded_at = now() - interval '2 days'
   where match_id = v_m;
  update public.matches set kickoff_at = now() + interval '20 hours', ends_at = now() + interval '21 hours' where id = v_m;
  v_res := public.run_checkins();
  if (v_res->>'asked_24h')::int <> 4 then raise exception 'S10 FAIL: 24h asks = % (want 4)', v_res->>'asked_24h'; end if;
  if public.checkin_emails_due() <> 3 then raise exception 'S10 FAIL: emails due = % (want 3, guest has none)', public.checkin_emails_due(); end if;
  select count(*) into v_n from public.claim_checkin_emails(50) where stage = '24h';
  if v_n <> 3 then raise exception 'S10 FAIL: claimed % 24h emails (want 3)', v_n; end if;
  select count(*) into v_n from public.claim_checkin_emails(50);
  if v_n <> 0 then raise exception 'S10 FAIL: emails claimed twice'; end if;

  -- A taps the email link (no session, anon role).
  select c.token into v_tok from public.match_checkins c join public.match_players mp on mp.id = c.match_player_id
   where mp.match_id = v_m and mp.user_id = v_a;
  set local role anon;
  v_res := public.confirm_spot_by_token(v_tok);
  reset role;
  if v_res->>'result' <> 'confirmed' then raise exception 'S10 FAIL: token confirm = %', v_res; end if;
  if v_res->>'slug' is null then raise exception 'S10 FAIL: no slug back'; end if;
  if public.confirm_spot_by_token(gen_random_uuid())->>'result' <> 'gone' then raise exception 'S10 FAIL: bad token accepted'; end if;

  -- 2h50 before → 3h last call only for the unconfirmed three.
  update public.matches set kickoff_at = now() + interval '170 minutes', ends_at = now() + interval '230 minutes' where id = v_m;
  v_res := public.run_checkins();
  if (v_res->>'asked_3h')::int <> 3 then raise exception 'S10 FAIL: 3h asks = % (want 3)', v_res->>'asked_3h'; end if;
  select count(*) into v_n from public.claim_checkin_emails(50) where stage = '3h';
  if v_n <> 2 then raise exception 'S10 FAIL: claimed % 3h emails (want 2: B, C)', v_n; end if;

  -- C confirms in the app. Someone not on the list can't.
  perform set_config('request.jwt.claims', json_build_object('sub', v_c)::text, true);
  if public.confirm_spot(v_m) <> 'confirmed' then raise exception 'S10 FAIL: in-app confirm'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_late)::text, true);
  begin perform public.confirm_spot(v_m);
        raise exception 'S10 FAIL: outsider confirmed a seat they don''t hold';
  exception when others then if sqlerrm not like '%NOT_IN%' then raise; end if; end;
  perform set_config('request.jwt.claims', '', true);

  -- Too early to release (last call just went out).
  update public.matches set kickoff_at = now() + interval '80 minutes', ends_at = now() + interval '140 minutes' where id = v_m;
  v_res := public.run_checkins();
  if (v_res->>'released')::int <> 0 then raise exception 'S10 FAIL: released < 45 min after last call'; end if;

  -- 50 min after the last call, 80 min before kickoff → B and G released.
  update public.match_checkins set asked_3h_at = now() - interval '50 minutes'
   where match_player_id in (select id from public.match_players where match_id = v_m);
  v_res := public.run_checkins();
  if (v_res->>'released')::int <> 2 then raise exception 'S10 FAIL: released % (want 2)', v_res->>'released'; end if;
  select count(*) into v_n from public.match_players
   where match_id = v_m and status = 'cancelled_early' and released_at is not null and user_id in (v_b, v_g);
  if v_n <> 2 then raise exception 'S10 FAIL: B/G not marked released'; end if;
  select count(*) into v_n from public.match_players
   where match_id = v_m and status = 'accepted' and user_id in (v_a, v_c, v_org);
  if v_n <> 3 then raise exception 'S10 FAIL: confirmed players / Captain touched'; end if;
  if (select status from public.matches where id = v_m) <> 'open' then raise exception 'S10 FAIL: game not reopened'; end if;
  select token_id into v_tok from public.match_players where match_id = v_m and user_id = v_b;
  if (select status from public.tokens where id = v_tok) <> 'available'
    then raise exception 'S10 FAIL: B''s token not refunded'; end if;
  if not exists (select 1 from public.token_transactions where token_id = v_tok and type = 'refund' and match_id = v_m)
    then raise exception 'S10 FAIL: no refund ledger row'; end if;
  if (select games_missed from public.profiles where id = v_b) <> 0
    then raise exception 'S10 FAIL: release counted as a missed game'; end if;
  if public.checkin_emails_due() <> 0 then raise exception 'S10 FAIL: email queued for a released spot'; end if;

  -- B's old link now says "released".
  select c.token into v_tok from public.match_checkins c join public.match_players mp on mp.id = c.match_player_id
   where mp.match_id = v_m and mp.user_id = v_b;
  if public.confirm_spot_by_token(v_tok)->>'result' <> 'released' then raise exception 'S10 FAIL: released link'; end if;

  -- Late joiner (80 min before) is confirmed on join and never released.
  perform set_config('request.jwt.claims', json_build_object('sub', v_late)::text, true);
  perform public.join_match(v_m);
  if (select confirmed_at from public.match_players where match_id = v_m and user_id = v_late) is null
    then raise exception 'S10 FAIL: late joiner not auto-confirmed'; end if;
  -- B rejoins: fresh seat, old check-in gone, auto-confirmed (inside 3h).
  perform set_config('request.jwt.claims', json_build_object('sub', v_b)::text, true);
  perform public.join_match(v_m);
  if (select released_at is not null or confirmed_at is null
        from public.match_players where match_id = v_m and user_id = v_b)
    then raise exception 'S10 FAIL: rejoin not reset'; end if;
  if public.confirm_spot_by_token(v_tok)->>'result' <> 'gone' then raise exception 'S10 FAIL: old token survived rejoin'; end if;
  perform set_config('request.jwt.claims', '', true);
  v_res := public.run_checkins();
  if (v_res->>'released')::int <> 0 then raise exception 'S10 FAIL: released a confirmed seat'; end if;

  -- Lockdown: callers can't run the sweep, the email queue or the table.
  set local role anon;
  begin perform public.run_checkins(); raise exception 'S10 FAIL: anon ran the sweep';
  exception when insufficient_privilege then null; end;
  begin perform public.claim_checkin_emails(5); raise exception 'S10 FAIL: anon claimed emails';
  exception when insufficient_privilege then null; end;
  reset role;
  set local role authenticated;
  begin perform public.release_unconfirmed_spot(gen_random_uuid()); raise exception 'S10 FAIL: user released a spot';
  exception when insufficient_privilege then null; end;
  begin select count(*) into v_rows from public.match_checkins; raise exception 'S10 FAIL: user read check-in tokens';
  exception when insufficient_privilege then null; end;
  reset role;

  raise notice 'SCENARIO 10 PASSED — 24h/3h asks (email + in-app), link + app confirm, auto-release refunds token, reopens game';
end $$;

-- ─────────────────────────────────────────────────────────────────────────
--  SCENARIO 11 — S5: Founding Member numbers + invite links.
--  Waitlist signups draw from founding_seq (re-joins keep theirs, never burn
--  one); an account / kept guest with the same email takes that number;
--  profile codes work as invite links and my_invites() counts them.
-- ─────────────────────────────────────────────────────────────────────────
do $$
declare
  r      record;
  v_w1   record;
  v_w2   record;
  v_p    uuid := gen_random_uuid();
  v_x    uuid := gen_random_uuid();
  v_g    uuid := gen_random_uuid();
  v_code text;
  v_n    int;
begin
  -- New signup: numbered.
  select * into v_w1 from public.join_waitlist('Ana', 's11_ana@test.co', '+27820000011', array['player'],
    array['Rondebosch / Newlands'], null, '{}', true, false, false, 'v', null, null, null);
  if v_w1.status <> 'joined' or v_w1.founding_number is null then raise exception 'S11 FAIL: no founding number'; end if;
  if (select founding_number from public.waitlist where email = 's11_ana@test.co') <> v_w1.founding_number
    then raise exception 'S11 FAIL: number not stored'; end if;

  -- Re-join (same email + number): same number, and none is burnt.
  select * into r from public.join_waitlist('Ana B', 's11_ana@test.co', '+27820000011', array['player'],
    array['Rondebosch / Newlands'], null, '{}', true, false, false, 'v', null, null, null);
  if r.founding_number <> v_w1.founding_number then raise exception 'S11 FAIL: re-join changed the number'; end if;

  -- A mate joins with Ana's link (lower-case is fine): next number, Ana's referrals = 1.
  select * into v_w2 from public.join_waitlist('Ben', 's11_ben@test.co', '+27820000012', array['player'],
    array['Claremont / Kenilworth'], null, '{}', true, false, false, 'v', lower(v_w1.referral_code), null, null);
  if v_w2.founding_number <> v_w1.founding_number + 1 then
    raise exception 'S11 FAIL: number burnt on re-join (% then %)', v_w1.founding_number, v_w2.founding_number; end if;
  select * into r from public.join_waitlist('Ana', 's11_ana@test.co', '+27820000011', array['player'],
    array['Rondebosch / Newlands'], null, '{}', true, false, false, 'v', null, null, null);
  if r.referrals <> 1 then raise exception 'S11 FAIL: waitlist referral not counted'; end if;

  -- Someone else's email with a different number: nothing revealed, no number.
  select * into r from public.join_waitlist('X', 's11_ana@test.co', '+27820009999', array['player'],
    array['City Bowl'], null, '{}', true, false, false, 'v', null, null, null);
  if r.status <> 'exists' or r.founding_number is not null then raise exception 'S11 FAIL: leaked a number'; end if;

  -- A profile's code is an invite link too.
  insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data) values
    ('00000000-0000-0000-0000-000000000000', v_p, 'authenticated', 'authenticated', 's11_org@test.co', '{"name":"Org11"}');
  select referral_code into v_code from public.profiles where id = v_p;
  select * into r from public.join_waitlist('Cal', 's11_cal@test.co', '+27820000013', array['player'],
    array['City Bowl'], null, '{}', true, false, false, 'v', v_code, null, null);
  if (select referred_by_profile from public.waitlist where email = 's11_cal@test.co') <> v_p
    then raise exception 'S11 FAIL: profile code not credited'; end if;
  if (select referred_by from public.waitlist where email = 's11_cal@test.co') is not null
    then raise exception 'S11 FAIL: profile code stored as a waitlist code'; end if;
  -- …and a later re-join with another code doesn't move the credit.
  select * into r from public.join_waitlist('Cal', 's11_cal@test.co', '+27820000013', array['player'],
    array['City Bowl'], null, '{}', true, false, false, 'v', v_w1.referral_code, null, null);
  if (select referred_by_profile from public.waitlist where email = 's11_cal@test.co') <> v_p
     or (select referred_by from public.waitlist where email = 's11_cal@test.co') is not null
    then raise exception 'S11 FAIL: referrer changed on re-join'; end if;
  -- Unknown codes are ignored.
  select * into r from public.join_waitlist('Dee', 's11_dee@test.co', '+27820000014', array['player'],
    array['City Bowl'], null, '{}', true, false, false, 'v', 'NOPE1234', null, null);
  if (select referred_by is not null or referred_by_profile is not null from public.waitlist where email = 's11_dee@test.co')
    then raise exception 'S11 FAIL: unknown code credited'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_p)::text, true);
  if public.my_invites() <> 1 then raise exception 'S11 FAIL: my_invites = % (want 1)', public.my_invites(); end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_p, 'is_anonymous', true)::text, true);
  if public.my_invites() <> 0 then raise exception 'S11 FAIL: guest got an invite count'; end if;
  perform set_config('request.jwt.claims', '', true);

  -- An account with a waitlist email takes the waitlist number.
  insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data) values
    ('00000000-0000-0000-0000-000000000000', v_x, 'authenticated', 'authenticated', 'S11_Ben@test.co', '{"name":"Ben"}');
  if (select founding_number from public.profiles where id = v_x) <> v_w2.founding_number
    then raise exception 'S11 FAIL: account did not take its waitlist number'; end if;

  -- A guest who keeps their profile with a waitlist email takes it too.
  select founding_number into v_n from public.waitlist where email = 's11_dee@test.co';
  insert into auth.users (instance_id, id, aud, role, email, is_anonymous) values
    ('00000000-0000-0000-0000-000000000000', v_g, 'authenticated', 'authenticated', null, true);
  if (select founding_number from public.profiles where id = v_g) is not null then raise exception 'S11 FAIL: guest numbered'; end if;
  update auth.users set is_anonymous = false, email = 's11_dee@test.co' where id = v_g;
  if (select founding_number from public.profiles where id = v_g) <> v_n
    then raise exception 'S11 FAIL: kept guest did not take its waitlist number'; end if;

  -- The 'exists' caller's number is never handed to anyone: a fresh account
  -- with no waitlist row gets a new, unused number.
  if (select founding_number from public.profiles where id = v_p) in
       (select founding_number from public.waitlist where founding_number is not null and email <> 's11_org@test.co')
    then raise exception 'S11 FAIL: fresh account reused a waitlist number'; end if;

  -- Lockdown: only the server (service role) can join; anon can't count invites.
  set local role anon;
  begin
    perform public.join_waitlist('E', 's11_e@test.co', '+27820000015', array['player'], array['City Bowl'],
      null, '{}', true, false, false, 'v', null, null, null);
    raise exception 'S11 FAIL: anon called join_waitlist';
  exception when insufficient_privilege then null; end;
  begin perform public.my_invites(); raise exception 'S11 FAIL: anon called my_invites';
  exception when insufficient_privilege then null; end;
  reset role;
  set local role authenticated;
  begin
    perform public.join_waitlist('E', 's11_e@test.co', '+27820000015', array['player'], array['City Bowl'],
      null, '{}', true, false, false, 'v', null, null, null);
    raise exception 'S11 FAIL: user called join_waitlist';
  exception when insufficient_privilege then null; end;
  begin perform private.founding_number_for('s11_ana@test.co'); raise exception 'S11 FAIL: user called founding_number_for';
  exception when insufficient_privilege then null; end;
  reset role;

  raise notice 'SCENARIO 11 PASSED — founding numbers shared with the waitlist (kept on re-join, carried to accounts/kept guests); profile invite links counted';
end $$;

-- ─────────────────────────────────────────────────────────────────────────
--  SCENARIO 12 — S6: game labels, "first game in Cape Town", played with +
--  regulars, regular alerts (in-app + email queue), recap + player cards.
-- ─────────────────────────────────────────────────────────────────────────
do $$
declare
  v_o   uuid := gen_random_uuid();   -- organiser of the played game
  v_o2  uuid := gen_random_uuid();   -- another organiser
  v_a   uuid := gen_random_uuid();
  v_b   uuid := gen_random_uuid();
  v_c   uuid := gen_random_uuid();   -- never played with anyone
  v_loc uuid;
  v_m1  uuid; v_m2 uuid; v_m3 uuid; v_m4 uuid; v_m5 uuid;
  v_n   int;
  v_j   jsonb;
  r     record;
begin
  insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data) values
    ('00000000-0000-0000-0000-000000000000', v_o,  'authenticated', 'authenticated', 's12_o@test.co',  '{"name":"Org12 Smith"}'),
    ('00000000-0000-0000-0000-000000000000', v_o2, 'authenticated', 'authenticated', 's12_o2@test.co', '{"name":"Org12b"}'),
    ('00000000-0000-0000-0000-000000000000', v_a,  'authenticated', 'authenticated', 's12_a@test.co',  '{"name":"Ana Twelve"}'),
    ('00000000-0000-0000-0000-000000000000', v_b,  'authenticated', 'authenticated', 's12_b@test.co',  '{"name":"Ben Twelve"}'),
    ('00000000-0000-0000-0000-000000000000', v_c,  'authenticated', 'authenticated', 's12_c@test.co',  '{"name":"Cal"}');
  select id into v_loc from public.locations where is_seeded limit 1;

  insert into public.matches (organizer_id, location_id, venue_type, kickoff_at, duration_min, ends_at, max_players, join_mode, status, share_slug)
    values (v_o, v_loc, 'open_area', now() + interval '2 days', 60, now() + interval '2 days 1 hour', 10, 'instant', 'open',
            's12a-' || substr(md5(random()::text), 1, 8)) returning id into v_m1;
  insert into public.matches (organizer_id, location_id, venue_type, kickoff_at, duration_min, ends_at, max_players, join_mode, status, share_slug)
    values (v_o, v_loc, 'open_area', now() + interval '9 days', 60, now() + interval '9 days 1 hour', 10, 'instant', 'open',
            's12b-' || substr(md5(random()::text), 1, 8)) returning id into v_m2;

  -- ── Labels ──
  update public.matches set skill_tag = 'beginner', group_tag = 'mixed', over_30 = true where id = v_m1;
  begin update public.matches set skill_tag = 'pro' where id = v_m1; raise exception 'S12 FAIL: bad skill label saved';
  exception when check_violation then null; end;
  begin update public.matches set group_tag = 'men' where id = v_m1; raise exception 'S12 FAIL: bad group label saved';
  exception when check_violation then null; end;
  if (select skill_tag || group_tag || over_30::text from public.match_feed where id = v_m1) <> 'beginnermixedtrue'
    then raise exception 'S12 FAIL: labels missing from match_feed'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_a)::text, true);
  perform public.join_match(v_m1);
  perform public.join_match(v_m2);
  perform set_config('request.jwt.claims', json_build_object('sub', v_b)::text, true);
  perform public.join_match(v_m1);

  -- ── First game in Cape Town ──
  perform set_config('request.jwt.claims', json_build_object('sub', v_a)::text, true);
  if not public.set_first_game_ct(v_m1, true) then raise exception 'S12 FAIL: newcomer tag'; end if;
  perform public.set_first_game_ct(v_m2, true);
  if not (select first_game_ct from public.match_players where match_id = v_m1 and user_id = v_a)
    then raise exception 'S12 FAIL: newcomer tag not stored'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_c)::text, true);
  begin perform public.set_first_game_ct(v_m1, true); raise exception 'S12 FAIL: tagged a game they are not on';
  exception when others then if sqlerrm not like '%NOT_IN%' then raise; end if; end;
  perform set_config('request.jwt.claims', json_build_object('sub', v_o)::text, true);
  begin perform public.set_first_game_ct(v_m1, true); raise exception 'S12 FAIL: organiser tagged own game';
  exception when others then if sqlerrm not like '%OWN_MATCH%' then raise; end if; end;

  -- ── Regulars need a game played together ──
  perform set_config('request.jwt.claims', json_build_object('sub', v_a)::text, true);
  begin perform public.set_regular(v_b, true); raise exception 'S12 FAIL: regular added before playing';
  exception when others then if sqlerrm not like '%NOT_PLAYED_WITH%' then raise; end if; end;

  update public.matches set kickoff_at = now() - interval '65 minutes', ends_at = now() - interval '5 minutes' where id = v_m1;
  begin perform public.set_first_game_ct(v_m1, false); raise exception 'S12 FAIL: tag changed after kickoff';
  exception when others then if sqlerrm not like '%STARTED%' then raise; end if; end;

  perform set_config('request.jwt.claims', json_build_object('sub', v_o)::text, true);
  perform public.set_attendance(v_m1, v_o, true);
  perform public.set_attendance(v_m1, v_a, true);
  perform public.set_attendance(v_m1, v_b, true);
  -- Ana has now played: her later seat isn't a first game any more.
  if (select first_game_ct from public.match_players where match_id = v_m2 and user_id = v_a)
    then raise exception 'S12 FAIL: later newcomer tag not cleared'; end if;
  if not (select first_game_ct from public.match_players where match_id = v_m1 and user_id = v_a)
    then raise exception 'S12 FAIL: played game lost its newcomer tag'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_a)::text, true);
  begin perform public.set_first_game_ct(v_m2, true); raise exception 'S12 FAIL: player re-tagged after playing';
  exception when others then if sqlerrm not like '%NOT_NEW%' then raise; end if; end;

  if not public.set_regular(v_b, true) then raise exception 'S12 FAIL: add regular'; end if;
  if not public.set_regular(v_o, true) then raise exception 'S12 FAIL: add organiser as regular'; end if;
  perform public.set_regular(v_b, true);  -- twice is fine
  begin perform public.set_regular(v_c, true); raise exception 'S12 FAIL: stranger added as regular';
  exception when others then if sqlerrm not like '%NOT_PLAYED_WITH%' then raise; end if; end;
  begin perform public.set_regular(v_a, true); raise exception 'S12 FAIL: self as regular';
  exception when others then if sqlerrm not like '%SELF%' then raise; end if; end;

  select count(*) into v_n from public.my_played_with(50);
  if v_n <> 2 then raise exception 'S12 FAIL: played with % (want 2)', v_n; end if;
  if not exists (select 1 from public.my_played_with(50) where user_id = v_b and is_regular and games_together = 1)
    then raise exception 'S12 FAIL: played-with row for Ben'; end if;

  -- Regular lists are private; nobody writes them directly.
  set local role authenticated;
  select count(*) into v_n from public.regulars;
  if v_n <> 2 then raise exception 'S12 FAIL: Ana sees % of her regulars', v_n; end if;
  begin insert into public.regulars (user_id, regular_id) values (v_a, v_c); raise exception 'S12 FAIL: direct regulars insert';
  exception when insufficient_privilege then null; end;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_b)::text, true);
  set local role authenticated;
  select count(*) into v_n from public.regulars;
  if v_n <> 0 then raise exception 'S12 FAIL: Ben can read Ana''s regulars'; end if;
  reset role;

  -- Removing works.
  perform set_config('request.jwt.claims', json_build_object('sub', v_a)::text, true);
  if public.set_regular(v_o, false) then raise exception 'S12 FAIL: remove regular'; end if;
  perform public.set_regular(v_o, true);

  -- ── Recap + player card ──
  if public.game_recap(v_m1) is not null then raise exception 'S12 FAIL: recap before the game closed'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_o)::text, true);
  if public.settle_match(v_m1) <> 'completed' then raise exception 'S12 FAIL: settle'; end if;
  v_j := public.game_recap(v_m1);
  if (v_j->>'players')::int <> 3 or (v_j->>'new_faces')::int <> 2 or (v_j->>'first_game_ct')::int <> 1
    then raise exception 'S12 FAIL: recap counts %', v_j; end if;
  if v_j->'faces'->0->>'name' <> 'Org12' or jsonb_array_length(v_j->'faces') <> 3
    then raise exception 'S12 FAIL: recap faces %', v_j->'faces'; end if;
  if v_j->>'skill_tag' <> 'beginner' then raise exception 'S12 FAIL: recap labels'; end if;
  v_j := public.player_card((select public_slug from public.profiles where id = v_a));
  if (v_j->>'games_played')::int <> 1 or (v_j->>'played_with')::int <> 2
    then raise exception 'S12 FAIL: player card %', v_j; end if;
  if public.player_card('no-such-slug') is not null then raise exception 'S12 FAIL: card for unknown slug'; end if;

  -- ── Regular alerts ──
  insert into public.matches (organizer_id, location_id, venue_type, kickoff_at, duration_min, ends_at, max_players, join_mode, status, share_slug)
    values (v_o2, v_loc, 'open_area', now() + interval '3 days', 60, now() + interval '3 days 1 hour', 10, 'instant', 'open',
            's12c-' || substr(md5(random()::text), 1, 8)) returning id into v_m3;
  insert into public.matches (organizer_id, location_id, venue_type, kickoff_at, duration_min, ends_at, max_players, join_mode, status, share_slug)
    values (v_o2, v_loc, 'open_area', now() + interval '4 days', 60, now() + interval '4 days 1 hour', 10, 'instant', 'open',
            's12d-' || substr(md5(random()::text), 1, 8)) returning id into v_m4;
  -- Ana's regular (the organiser) posting a game isn't "joining" it: no alert.
  insert into public.matches (organizer_id, location_id, venue_type, kickoff_at, duration_min, ends_at, max_players, join_mode, status, share_slug)
    values (v_o, v_loc, 'open_area', now() + interval '5 days', 60, now() + interval '5 days 1 hour', 10, 'instant', 'open',
            's12e-' || substr(md5(random()::text), 1, 8)) returning id into v_m5;
  if exists (select 1 from public.regular_alerts where match_id = v_m5) then raise exception 'S12 FAIL: organiser seat alerted'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_b)::text, true);
  perform public.join_match(v_m3);
  if (select count(*) from public.regular_alerts where match_id = v_m3) <> 1
     or not exists (select 1 from public.regular_alerts where match_id = v_m3 and user_id = v_a)
    then raise exception 'S12 FAIL: alert not queued for Ana only'; end if;

  -- Email waits 10 min (so several regulars are grouped), respects the off switch.
  if public.regular_alert_emails_due() <> 0 then raise exception 'S12 FAIL: alert email due immediately'; end if;
  update public.regular_alerts set created_at = now() - interval '11 minutes' where match_id = v_m3;
  if public.regular_alert_emails_due() <> 1 then raise exception 'S12 FAIL: alert email not due'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_a)::text, true);
  set local role authenticated;
  insert into public.user_settings (user_id, regulars_email) values (v_a, false);
  begin insert into public.user_settings (user_id, regulars_email) values (v_b, false); raise exception 'S12 FAIL: wrote someone else''s settings';
  exception when insufficient_privilege then null; end;
  reset role;
  if public.regular_alert_emails_due() <> 0 then raise exception 'S12 FAIL: email due after opting out'; end if;
  update public.user_settings set regulars_email = true where user_id = v_a;

  -- The server claims it once; the second run finds nothing.
  select count(*) into v_n from public.claim_regular_alert_emails(10) c
   where c.email = 's12_a@test.co' and c.regulars = array['Ben'] and c.spots_left = 8 and c.name = 'Ana Twelve';
  if v_n <> 1 then raise exception 'S12 FAIL: claim returned % rows', v_n; end if;
  if (select count(*) from public.claim_regular_alert_emails(10)) <> 0 then raise exception 'S12 FAIL: claimed twice'; end if;

  -- In-app card shows it (and stamps seen).
  perform set_config('request.jwt.claims', json_build_object('sub', v_a)::text, true);
  select * into r from public.my_regular_alerts();
  if r.match_id <> v_m3 or r.regulars <> array['Ben'] or r.spots_left <> 8 then raise exception 'S12 FAIL: in-app alert %', r; end if;
  if (select seen_at from public.regular_alerts where match_id = v_m3 and user_id = v_a) is null
    then raise exception 'S12 FAIL: alert not marked seen'; end if;

  -- A second game the same day: in-app yes, email no (one per 12h).
  perform set_config('request.jwt.claims', json_build_object('sub', v_b)::text, true);
  perform public.join_match(v_m4);
  update public.regular_alerts set created_at = now() - interval '11 minutes' where match_id = v_m4;
  if public.regular_alert_emails_due() <> 0 then raise exception 'S12 FAIL: second email inside 12h'; end if;
  -- Ben drops out → that game is no longer announced.
  perform public.cancel_participation(v_m4);
  perform set_config('request.jwt.claims', json_build_object('sub', v_a)::text, true);
  if exists (select 1 from public.my_regular_alerts() where match_id = v_m4) then raise exception 'S12 FAIL: alert after regular left'; end if;
  -- Ana joins the first game → it drops off her list.
  perform public.join_match(v_m3);
  if exists (select 1 from public.my_regular_alerts()) then raise exception 'S12 FAIL: alert for a game she is on'; end if;
  perform set_config('request.jwt.claims', '', true);

  -- ── Lockdown ──
  set local role anon;
  begin perform public.set_regular(v_b, true); raise exception 'S12 FAIL: anon set_regular';
  exception when insufficient_privilege then null; end;
  begin perform public.my_regular_alerts(); raise exception 'S12 FAIL: anon my_regular_alerts';
  exception when insufficient_privilege then null; end;
  begin perform public.my_played_with(5); raise exception 'S12 FAIL: anon my_played_with';
  exception when insufficient_privilege then null; end;
  begin perform public.set_first_game_ct(v_m2, true); raise exception 'S12 FAIL: anon set_first_game_ct';
  exception when insufficient_privilege then null; end;
  begin select count(*) into v_n from public.regulars; raise exception 'S12 FAIL: anon read regulars';
  exception when insufficient_privilege then null; end;
  perform public.game_recap(v_m1);          -- public: completed games only
  perform public.player_card('no-such-slug');
  reset role;
  set local role authenticated;
  begin perform public.claim_regular_alert_emails(5); raise exception 'S12 FAIL: user claimed alert emails';
  exception when insufficient_privilege then null; end;
  begin perform public.regular_alert_emails_due(); raise exception 'S12 FAIL: user counted due emails';
  exception when insufficient_privilege then null; end;
  begin perform public.played_together(v_a, v_b); raise exception 'S12 FAIL: user called played_together';
  exception when insufficient_privilege then null; end;
  begin select count(*) into v_n from public.regular_alerts; raise exception 'S12 FAIL: user read regular_alerts';
  exception when insufficient_privilege then null; end;
  begin select count(*) into v_n from private.live_regular_alerts; raise exception 'S12 FAIL: user read private view';
  exception when insufficient_privilege then null; end;
  reset role;

  raise notice 'SCENARIO 12 PASSED — labels, first-game tag, played with + regulars (private, earned), alerts (grouped, throttled, opt-out), recap + player card';
end $$;


rollback;  -- leave the database untouched
