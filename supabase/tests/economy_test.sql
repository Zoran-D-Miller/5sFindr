-- ════════════════════════════════════════════════════════════════════════
--  5sFindr — economy stress test
--  Runs after migrations + seed. Everything inside one transaction that is
--  ROLLED BACK at the end, so it never pollutes the database.
--  Any failed assertion raises an exception → psql (ON_ERROR_STOP) exits != 0.
-- ════════════════════════════════════════════════════════════════════════
begin;

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

  -- Future kickoff so joins are allowed; 10 players each commit their token.
  insert into public.matches (organizer_id, location_id, venue_type, kickoff_at, duration_min, ends_at,
                              max_players, join_mode, status, share_slug)
    values (v_org, v_loc, 'official_court', now() + interval '2 hours', 60, now() + interval '3 hours',
            10, 'instant', 'open', 's3-' || substr(md5(random()::text), 1, 8))
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

  -- End the match → automated settlement.
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

rollback;  -- leave the database untouched
