-- ════════════════════════════════════════════════════════════════════════
--  S4 — no-show tools (PRODUCT-BRIEF.md).
--
--  1. "Still coming?" check-ins for accepted players:
--       • 24h before kickoff (only if they joined more than 24h before),
--       • 3h before kickoff (only if they haven't confirmed yet).
--     One confirmation is enough. Joining (or being accepted) less than 3h
--     before kickoff counts as confirmed. Players with an email get it by
--     email (Resend, sent by /api/cron/checkins); everyone also sees a
--     "Still coming?" card on the game page.
--  2. Auto-release: a spot still unconfirmed at the cutoff is freed so the
--     organiser can refill it. Cutoff = 90 min before kickoff, and never
--     less than 45 min after the 3h "last call" went out (so a late cron run
--     still leaves time to answer). Token-safe like cancel_participation: a
--     committed token is refunded (tokens are off by default). A release is
--     NOT a missed game: it doesn't touch games_missed / show-up rate.
--     The player can tap "I'm in" again if there's still room.
--  3. Show-up rate needs no schema: it is games_played / (played + missed)
--     (= reliability_score), fed by the organiser's ticks (set_attendance)
--     and settle_match.
--
--  Scheduling: pg_cron (already used by 0008 + 0026), every 10 minutes:
--  private.checkins_tick() runs public.run_checkins() (asks + releases, all
--  in SQL), then, if any email is due and the Vault secret
--  `checkins_cron_secret` exists, pings https://5sfindr.com/api/cron/checkins
--  through pg_net. That route claims the due emails and sends them via
--  Resend. Vercel Cron on the free plan only runs once a day, too coarse.
--  Kill switch:  select cron.unschedule('no-show-checkins');
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Columns + private check-in state ──────────────────────────────────
-- confirmed_at / released_at are fine to show on the roster (organiser view).
alter table public.match_players add column if not exists confirmed_at timestamptz;
alter table public.match_players add column if not exists released_at  timestamptz;

-- The confirm token lives here, NOT on match_players: anyone with a game's
-- link can read that roster. No grants: only SECURITY DEFINER code reads it.
create table if not exists public.match_checkins (
  match_player_id uuid primary key references public.match_players(id) on delete cascade,
  token           uuid not null unique default gen_random_uuid(),
  asked_24h_at    timestamptz,
  asked_3h_at     timestamptz,
  emailed_24h_at  timestamptz,
  emailed_3h_at   timestamptz,
  created_at      timestamptz not null default now()
);
alter table public.match_checkins enable row level security;
revoke all on public.match_checkins from public, anon, authenticated;

-- Backfill: organisers' own seats (Captain, 0014) never need confirming, and
-- seats on games in the next 24h count as confirmed, so nobody is released
-- by surprise the moment this ships.
update public.match_players mp
   set confirmed_at = now()
  from public.matches m
 where m.id = mp.match_id and mp.status in ('accepted', 'attended') and mp.confirmed_at is null
   and (mp.user_id = m.organizer_id
        or (m.status in ('open', 'full') and m.kickoff_at <= now() + interval '24 hours'));

-- ── 2. Becoming 'accepted' resets the check-in ───────────────────────────
-- Covers join_match (new seat or re-join), manager_respond, anything else.
-- accepted ↔ attended (organiser ticks) is not a new seat and is left alone.
create or replace function public.reset_checkin_on_accept()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_kickoff timestamptz;
  v_org     uuid;
begin
  if new.status = 'accepted'
     and (tg_op = 'INSERT' or old.status not in ('accepted', 'attended')) then
    select kickoff_at, organizer_id into v_kickoff, v_org from public.matches where id = new.match_id;
    new.released_at  := null;
    -- The organiser (auto-seated as Captain, 0014) is never asked.
    new.confirmed_at := case when new.user_id = v_org or v_kickoff - now() <= interval '3 hours'
                             then now() else null end;
    if tg_op = 'UPDATE' then
      delete from public.match_checkins where match_player_id = new.id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists match_players_reset_checkin on public.match_players;
create trigger match_players_reset_checkin
  before insert or update of status on public.match_players
  for each row execute function public.reset_checkin_on_accept();

-- ── 3. Player confirms ───────────────────────────────────────────────────
-- In the app (signed in, guests included).
create or replace function public.confirm_spot(p_match_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'NOT_AUTHED'; end if;
  update public.match_players
     set confirmed_at = coalesce(confirmed_at, now())
   where match_id = p_match_id and user_id = v_uid and status in ('accepted', 'attended');
  if not found then raise exception 'NOT_IN'; end if;
  return 'confirmed';
end;
$$;

-- From the email link (no session needed; the token is the secret).
-- Returns {result: confirmed | released | gone, slug}.
create or replace function public.confirm_spot_by_token(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_mp    public.match_players%rowtype;
  v_match public.matches%rowtype;
begin
  select mp.* into v_mp
    from public.match_checkins c join public.match_players mp on mp.id = c.match_player_id
   where c.token = p_token
   for update of mp;
  if not found then return jsonb_build_object('result', 'gone'); end if;

  select * into v_match from public.matches where id = v_mp.match_id;

  if v_mp.status in ('accepted', 'attended') then
    if v_match.status in ('open', 'full', 'in_progress') then
      update public.match_players set confirmed_at = coalesce(confirmed_at, now()) where id = v_mp.id;
      return jsonb_build_object('result', 'confirmed', 'slug', v_match.share_slug);
    end if;
  elsif v_mp.released_at is not null then
    return jsonb_build_object('result', 'released', 'slug', v_match.share_slug);
  end if;
  return jsonb_build_object('result', 'gone', 'slug', v_match.share_slug);
end;
$$;

-- ── 4. Release one unconfirmed spot (token-safe) ─────────────────────────
create or replace function public.release_unconfirmed_spot(p_match_player_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_mp    public.match_players%rowtype;
  v_match public.matches%rowtype;
begin
  select * into v_mp from public.match_players where id = p_match_player_id;
  if not found then return false; end if;
  -- Same lock order as join/cancel: match first, then the seat.
  select * into v_match from public.matches where id = v_mp.match_id for update;
  select * into v_mp from public.match_players where id = p_match_player_id for update;
  if v_mp.status <> 'accepted' or v_mp.confirmed_at is not null then return false; end if;
  if v_match.status not in ('open', 'full') then return false; end if;

  if v_mp.token_id is not null then
    update public.tokens set status = 'available', committed_match_id = null where id = v_mp.token_id;
    insert into public.token_transactions (token_id, user_id, type, match_id, note)
      values (v_mp.token_id, v_mp.user_id, 'refund', v_mp.match_id, 'Didn''t confirm — spot released, token refunded');
  end if;

  update public.match_players
     set status = 'cancelled_early', cancelled_at = now(), released_at = now(), team_color = null
   where id = v_mp.id;

  if v_match.status = 'full' then
    update public.matches set status = 'open', teams_assigned = false where id = v_match.id;
    update public.match_players set team_color = null
     where match_id = v_match.id and status in ('accepted', 'attended');
  end if;
  return true;
end;
$$;

-- ── 5. The sweep (pg_cron, every 10 minutes) ─────────────────────────────
create or replace function public.run_checkins()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_24h      int;
  v_3h       int;
  v_released int := 0;
  r          record;
begin
  -- 24h ask: kickoff in 3h–24h, joined/accepted more than 24h before kickoff.
  insert into public.match_checkins (match_player_id, asked_24h_at)
  select mp.id, now()
    from public.match_players mp join public.matches m on m.id = mp.match_id
   where mp.status = 'accepted' and mp.confirmed_at is null and mp.user_id <> m.organizer_id
     and m.status in ('open', 'full')
     and m.kickoff_at >  now() + interval '3 hours'
     and m.kickoff_at <= now() + interval '24 hours'
     and coalesce(mp.responded_at, mp.requested_at) < m.kickoff_at - interval '24 hours'
  on conflict (match_player_id) do nothing;
  get diagnostics v_24h = row_count;

  -- 3h "last call": kickoff in the next 3h, still unconfirmed.
  insert into public.match_checkins (match_player_id, asked_3h_at)
  select mp.id, now()
    from public.match_players mp join public.matches m on m.id = mp.match_id
   where mp.status = 'accepted' and mp.confirmed_at is null and mp.user_id <> m.organizer_id
     and m.status in ('open', 'full')
     and m.kickoff_at > now()
     and m.kickoff_at <= now() + interval '3 hours'
  on conflict (match_player_id) do update
     set asked_3h_at = now()
   where public.match_checkins.asked_3h_at is null;
  get diagnostics v_3h = row_count;

  -- Release: 90 min before kickoff and ≥45 min after the last call.
  for r in
    select mp.id
      from public.match_players mp
      join public.matches m        on m.id = mp.match_id
      join public.match_checkins c on c.match_player_id = mp.id
     where mp.status = 'accepted' and mp.confirmed_at is null and mp.user_id <> m.organizer_id
       and m.status in ('open', 'full')
       and now() >= m.kickoff_at - interval '90 minutes'
       and now() <  m.kickoff_at
       and c.asked_3h_at <= now() - interval '45 minutes'
  loop
    begin
      if public.release_unconfirmed_spot(r.id) then v_released := v_released + 1; end if;
    exception when others then
      raise warning 'release_unconfirmed_spot(%) failed: %', r.id, sqlerrm;
    end;
  end loop;

  return jsonb_build_object('asked_24h', v_24h, 'asked_3h', v_3h, 'released', v_released);
end;
$$;

-- Emails due: asked, not yet emailed, still unconfirmed and before kickoff,
-- player has a real (non-guest) email. Used by the sweep to decide whether
-- to ping the app.
create or replace function public.checkin_emails_due()
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int
    from public.match_checkins c
    join public.match_players mp on mp.id = c.match_player_id
    join public.matches m        on m.id = mp.match_id
    join auth.users u            on u.id = mp.user_id
   where mp.status = 'accepted' and mp.confirmed_at is null and mp.user_id <> m.organizer_id
     and m.status in ('open', 'full') and m.kickoff_at > now()
     and not coalesce(u.is_anonymous, false) and coalesce(u.email, '') <> ''
     and ((c.asked_3h_at is not null and c.emailed_3h_at is null)
       or (c.asked_3h_at is null and c.asked_24h_at is not null and c.emailed_24h_at is null));
$$;

-- /api/cron/checkins (service role) claims a batch and sends it. Claiming
-- marks the rows as emailed first, so two runs never send twice; a failed
-- send isn't retried (the game page card still asks).
create or replace function public.claim_checkin_emails(p_limit int default 50)
returns table (
  stage text, email text, name text, token uuid, kickoff_at timestamptz,
  venue text, title text, share_slug text, organizer_name text
) language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  return query
  with due as (
    select c.match_player_id,
           case when c.asked_3h_at is not null then '3h' else '24h' end as stage
      from public.match_checkins c
      join public.match_players mp on mp.id = c.match_player_id
      join public.matches m        on m.id = mp.match_id
      join auth.users u            on u.id = mp.user_id
     where mp.status = 'accepted' and mp.confirmed_at is null
       and m.status in ('open', 'full') and m.kickoff_at > now()
       and not coalesce(u.is_anonymous, false) and coalesce(u.email, '') <> ''
       and ((c.asked_3h_at is not null and c.emailed_3h_at is null)
         or (c.asked_3h_at is null and c.asked_24h_at is not null and c.emailed_24h_at is null))
     order by m.kickoff_at
     limit greatest(1, least(coalesce(p_limit, 50), 100))
     for update of c skip locked
  ), marked as (
    update public.match_checkins c
       set emailed_24h_at = coalesce(c.emailed_24h_at, now()),
           emailed_3h_at  = case when due.stage = '3h' then now() else c.emailed_3h_at end
      from due
     where c.match_player_id = due.match_player_id
    returning c.match_player_id, c.token, due.stage
  )
  select marked.stage, u.email::text, p.name, marked.token, m.kickoff_at,
         l.name, m.title, m.share_slug, o.name
    from marked
    join public.match_players mp on mp.id = marked.match_player_id
    join public.matches m        on m.id = mp.match_id
    join auth.users u            on u.id = mp.user_id
    join public.profiles p       on p.id = mp.user_id
    left join public.locations l on l.id = m.location_id
    left join public.profiles o  on o.id = m.organizer_id;
end;
$$;

-- ── 6. Cron tick: sweep, then ping the app if emails are due ─────────────
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.checkins_tick()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_secret text;
begin
  perform public.run_checkins();

  if public.checkin_emails_due() = 0 then return; end if;

  begin
    select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'checkins_cron_secret';
  exception when others then
    v_secret := null;  -- no Vault (local tests)
  end;
  if v_secret is null or v_secret = '' then
    raise log 'no-show-checkins: no checkins_cron_secret in Vault, emails not sent';
    return;
  end if;

  -- Own block: a failed ping must not roll back the asks/releases above.
  begin
    perform net.http_post(
      url     := 'https://5sfindr.com/api/cron/checkins',
      headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'),
      body    := '{}'::jsonb
    );
  exception when others then
    raise warning 'no-show-checkins: ping failed: %', sqlerrm;
  end;
end;
$$;

-- ── 7. Grants (0019 style: PUBLIC revoked, anon only where it must) ───────
revoke execute on function public.reset_checkin_on_accept()            from public, anon, authenticated;
revoke execute on function public.release_unconfirmed_spot(uuid)       from public, anon, authenticated;
revoke execute on function public.run_checkins()                       from public, anon, authenticated;
revoke execute on function public.checkin_emails_due()                 from public, anon, authenticated;
revoke execute on function public.claim_checkin_emails(int)            from public, anon, authenticated;
revoke execute on function private.checkins_tick()                     from public, anon, authenticated;
grant  execute on function public.claim_checkin_emails(int)            to service_role;

revoke execute on function public.confirm_spot(uuid)                   from public, anon;
grant  execute on function public.confirm_spot(uuid)                   to authenticated;
revoke execute on function public.confirm_spot_by_token(uuid)          from public;
grant  execute on function public.confirm_spot_by_token(uuid)          to anon, authenticated;

-- ── 8. Schedule (skipped where pg_cron isn't installed, e.g. local tests) ─
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'no-show-checkins') then
      perform cron.unschedule('no-show-checkins');
    end if;
    perform cron.schedule('no-show-checkins', '*/10 * * * *', 'select private.checkins_tick()');
    raise notice 'Scheduled cron job "no-show-checkins" every 10 minutes.';
  else
    raise notice 'pg_cron not available — no-show-checkins not scheduled.';
  end if;
end $$;
