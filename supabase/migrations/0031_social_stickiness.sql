-- ════════════════════════════════════════════════════════════════════════
--  S6 — social stickiness, part 1 (PRODUCT-BRIEF.md). The Drop + Sessions
--  come in the next migration.
--
--  1. Game labels: skill (beginner / casual / competitive), who it's for
--     (women's / mixed) and 30+. Labels only: nobody is checked at the door.
--  2. "First game in Cape Town": a player ticks it on their own seat, only
--     while they've never played a 5sFindr game (Cape Town only), so the
--     organiser knows to say hi. Playing a game clears it on later seats.
--  3. "Played with" + regulars: after a game, add people you played with as
--     regulars. Only people you were both ticked as playing with in a game
--     that has ended (no adding strangers). Your list is private to you.
--  4. Regular alerts: when a regular joins a game you're not on, you get an
--     in-app card ("Your regulars are playing") and, with a real email, an
--     email (at most one every 12h, ≥10 min after the first regular joined so
--     several are grouped). Off switch: user_settings.regulars_email.
--     Sent by the existing 10-min cron (0029): checkins_tick now also pings
--     /api/cron/checkins when alert emails are due.
--  5. Shareable cards: game_recap() (organiser's recap card) and
--     player_card() (IG story card). Both only return data that is already
--     public (completed game rosters, public profile columns) + counts.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Game labels ───────────────────────────────────────────────────────
alter table public.matches add column if not exists skill_tag text
  constraint matches_skill_tag_check check (skill_tag in ('beginner', 'casual', 'competitive'));
alter table public.matches add column if not exists group_tag text
  constraint matches_group_tag_check check (group_tag in ('womens', 'mixed'));
alter table public.matches add column if not exists over_30 boolean not null default false;

-- Feed read model: same columns as 0011, labels appended.
create or replace view public.match_feed with (security_invoker = true) as
  select m.id, m.title, m.kickoff_at, m.ends_at, m.venue_type, m.join_mode, m.status,
         m.max_players, m.price_per_player_zar, m.organizer_id,
         l.name as location_name, l.neighborhood, l.type as location_type, l.latitude, l.longitude,
         coalesce(p.taken, 0) as spots_taken,
         m.skill_tag, m.group_tag, m.over_30
  from public.matches m
  join public.locations l on l.id = m.location_id
  left join (
    select match_id, count(*)::int as taken from public.match_players
    where status in ('accepted','attended') group by match_id
  ) p on p.match_id = m.id;
grant select on public.match_feed to anon, authenticated;

-- ── 2. First game in Cape Town ───────────────────────────────────────────
alter table public.match_players add column if not exists first_game_ct boolean not null default false;

create or replace function public.set_first_game_ct(p_match_id uuid, p_on boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_match public.matches%rowtype;
begin
  if v_uid is null then raise exception 'NOT_AUTHED'; end if;
  select * into v_match from public.matches where id = p_match_id;
  if not found then raise exception 'NO_MATCH'; end if;
  if v_match.kickoff_at <= now() or v_match.status not in ('open', 'full') then raise exception 'STARTED'; end if;
  if v_match.organizer_id = v_uid then raise exception 'OWN_MATCH'; end if;

  if coalesce(p_on, false) and (
       (select games_played from public.profiles where id = v_uid) > 0
       or exists (select 1 from public.match_players where user_id = v_uid and status = 'attended')
     ) then
    raise exception 'NOT_NEW';
  end if;

  update public.match_players set first_game_ct = coalesce(p_on, false)
   where match_id = p_match_id and user_id = v_uid and status in ('requested', 'accepted');
  if not found then raise exception 'NOT_IN'; end if;
  return coalesce(p_on, false);
end;
$$;

-- Once someone has played, their later seats aren't a first game any more.
create or replace function public.clear_first_game_ct()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'attended' and old.status <> 'attended' then
    update public.match_players mp
       set first_game_ct = false
      from public.matches m, public.matches this
     where mp.user_id = new.user_id and mp.id <> new.id and mp.first_game_ct
       and m.id = mp.match_id and this.id = new.match_id and m.kickoff_at > this.kickoff_at;
  end if;
  return new;
end;
$$;

drop trigger if exists match_players_clear_first_game on public.match_players;
create trigger match_players_clear_first_game
  after update of status on public.match_players
  for each row execute function public.clear_first_game_ct();

-- ── 3. Regulars ──────────────────────────────────────────────────────────
create table if not exists public.regulars (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  regular_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, regular_id),
  check (user_id <> regular_id)
);
create index if not exists regulars_regular_idx on public.regulars (regular_id);
alter table public.regulars enable row level security;
revoke all on public.regulars from public, anon, authenticated;
grant select on public.regulars to authenticated;
drop policy if exists "own regulars" on public.regulars;
create policy "own regulars" on public.regulars for select using (user_id = auth.uid());

-- True when a and b were both ticked as playing in the same game that has ended.
create or replace function public.played_together(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from public.match_players x
      join public.match_players y on y.match_id = x.match_id and y.user_id = b and y.status = 'attended'
      join public.matches m       on m.id = x.match_id
     where x.user_id = a and x.status = 'attended' and m.ends_at <= now() and m.status <> 'cancelled'
  );
$$;

create or replace function public.set_regular(p_user_id uuid, p_on boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'NOT_AUTHED'; end if;
  if p_user_id is null or p_user_id = v_uid then raise exception 'SELF'; end if;

  if coalesce(p_on, false) then
    if not public.played_together(v_uid, p_user_id) then raise exception 'NOT_PLAYED_WITH'; end if;
    if (select count(*) from public.regulars where user_id = v_uid) >= 200 then raise exception 'TOO_MANY'; end if;
    insert into public.regulars (user_id, regular_id) values (v_uid, p_user_id) on conflict do nothing;
    return true;
  end if;

  delete from public.regulars where user_id = v_uid and regular_id = p_user_id;
  return false;
end;
$$;

-- Everyone you've played with (ticked in the same ended game), most recent first.
create or replace function public.my_played_with(p_limit int default 60)
returns table (
  user_id uuid, name text, avatar_url text, public_slug text,
  games_together int, last_played timestamptz, is_regular boolean
) language sql stable security definer set search_path = public as $$
  select o.user_id, p.name, p.avatar_url, p.public_slug,
         count(distinct o.match_id)::int, max(m.kickoff_at),
         exists (select 1 from public.regulars r where r.user_id = auth.uid() and r.regular_id = o.user_id)
    from public.match_players me
    join public.matches m        on m.id = me.match_id and m.ends_at <= now() and m.status <> 'cancelled'
    join public.match_players o  on o.match_id = me.match_id and o.user_id <> me.user_id and o.status = 'attended'
    join public.profiles p       on p.id = o.user_id
   where me.user_id = auth.uid() and me.status = 'attended'
   group by o.user_id, p.name, p.avatar_url, p.public_slug
   order by max(m.kickoff_at) desc, p.name
   limit greatest(1, least(coalesce(p_limit, 60), 200));
$$;

-- ── 4. Regular alerts ────────────────────────────────────────────────────
create table if not exists public.user_settings (
  user_id        uuid primary key references public.profiles(id) on delete cascade,
  regulars_email boolean not null default true,
  updated_at     timestamptz not null default now()
);
alter table public.user_settings enable row level security;
revoke all on public.user_settings from public, anon, authenticated;
grant select, insert, update on public.user_settings to authenticated;
drop policy if exists "own settings read"   on public.user_settings;
drop policy if exists "own settings insert" on public.user_settings;
drop policy if exists "own settings update" on public.user_settings;
create policy "own settings read"   on public.user_settings for select using (user_id = auth.uid());
create policy "own settings insert" on public.user_settings for insert with check (user_id = auth.uid());
create policy "own settings update" on public.user_settings for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- One row per (person, game). Who's playing is worked out when it's shown or
-- emailed, so a regular who drops out isn't announced. No grants: read
-- through my_regular_alerts() / claim_regular_alert_emails().
create table if not exists public.regular_alerts (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  match_id   uuid not null references public.matches(id) on delete cascade,
  created_at timestamptz not null default now(),
  seen_at    timestamptz,
  emailed_at timestamptz,
  primary key (user_id, match_id)
);
create index if not exists regular_alerts_emailed_idx on public.regular_alerts (user_id, emailed_at);
alter table public.regular_alerts enable row level security;
revoke all on public.regular_alerts from public, anon, authenticated;

-- A player taking a seat (join, accepted request, re-join) queues an alert for
-- everyone who has them as a regular and isn't on the game. The organiser's
-- own Captain seat (0014) isn't "joining", so it doesn't alert.
create or replace function public.queue_regular_alerts()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'accepted'
     and (tg_op = 'INSERT' or old.status not in ('accepted', 'attended')) then
    insert into public.regular_alerts (user_id, match_id)
    select r.user_id, new.match_id
      from public.regulars r
      join public.matches m on m.id = new.match_id
     where r.regular_id = new.user_id
       and new.user_id <> m.organizer_id
       and r.user_id <> m.organizer_id
       and m.status in ('open', 'full')
       and m.kickoff_at > now()
       and not exists (
         select 1 from public.match_players mp
          where mp.match_id = new.match_id and mp.user_id = r.user_id
            and mp.status in ('requested', 'accepted', 'attended'))
    on conflict (user_id, match_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists match_players_queue_regular_alerts on public.match_players;
create trigger match_players_queue_regular_alerts
  after insert or update of status on public.match_players
  for each row execute function public.queue_regular_alerts();

-- Alerts worth showing: game open with a spot, not started, you're not on
-- it, and at least one of your regulars is still on it.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace view private.live_regular_alerts as
  select a.user_id, a.match_id, a.created_at, a.seen_at, a.emailed_at,
         m.share_slug, m.title, m.kickoff_at, m.max_players,
         l.name as venue, l.neighborhood,
         (m.max_players - (select count(*) from public.match_players t
                            where t.match_id = m.id and t.status in ('accepted', 'attended')))::int as spots_left,
         array(select split_part(p.name, ' ', 1)
                 from public.regulars r
                 join public.match_players mp on mp.match_id = m.id and mp.user_id = r.regular_id
                                             and mp.status in ('accepted', 'attended')
                 join public.profiles p on p.id = r.regular_id
                where r.user_id = a.user_id
                order by mp.requested_at) as regulars
    from public.regular_alerts a
    join public.matches m        on m.id = a.match_id
    left join public.locations l on l.id = m.location_id
   where m.status = 'open' and m.kickoff_at > now()
     and not exists (select 1 from public.match_players me
                      where me.match_id = a.match_id and me.user_id = a.user_id
                        and me.status in ('requested', 'accepted', 'attended'));
revoke all on private.live_regular_alerts from public, anon, authenticated;

-- In-app card. Showing an alert marks it seen, so it isn't emailed as well.
create or replace function public.my_regular_alerts()
returns table (
  match_id uuid, share_slug text, title text, kickoff_at timestamptz,
  venue text, neighborhood text, spots_left int, regulars text[]
) language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'NOT_AUTHED'; end if;
  return query
  with shown as (
    select * from private.live_regular_alerts v
     where v.user_id = v_uid and v.spots_left > 0 and cardinality(v.regulars) > 0
     order by v.kickoff_at
     limit 10
  ), stamp as (
    -- A data-modifying CTE always runs to completion, even unreferenced.
    update public.regular_alerts a set seen_at = coalesce(a.seen_at, now())
      from shown where a.user_id = v_uid and a.match_id = shown.match_id
    returning a.match_id
  )
  select s.match_id, s.share_slug, s.title, s.kickoff_at, s.venue, s.neighborhood, s.spots_left, s.regulars
    from shown s
   order by s.kickoff_at;
end;
$$;

-- Emails due: unseen, ≥10 min old, game ≥1h away with a spot, a regular on
-- it, recipient has a real email and hasn't turned these off, and hasn't had
-- one of these emails in the last 12h.
create or replace view private.due_regular_alert_emails as
  select v.*, u.email::text as email, p.name as recipient_name
    from private.live_regular_alerts v
    join auth.users u      on u.id = v.user_id
    join public.profiles p on p.id = v.user_id
    left join public.user_settings s on s.user_id = v.user_id
   where v.emailed_at is null and v.seen_at is null
     and v.created_at <= now() - interval '10 minutes'
     and v.kickoff_at > now() + interval '1 hour'
     and v.spots_left > 0 and cardinality(v.regulars) > 0
     and not coalesce(u.is_anonymous, false) and coalesce(u.email, '') <> ''
     and coalesce(s.regulars_email, true)
     and not exists (select 1 from public.regular_alerts x
                      where x.user_id = v.user_id and x.emailed_at > now() - interval '12 hours');
revoke all on private.due_regular_alert_emails from public, anon, authenticated;

create or replace function public.regular_alert_emails_due()
returns int language sql stable security definer set search_path = public as $$
  select count(distinct user_id)::int from private.due_regular_alert_emails;
$$;

-- /api/cron/checkins (service role) claims a batch: one email per person (the
-- soonest game), marked emailed first so two runs never send twice.
create or replace function public.claim_regular_alert_emails(p_limit int default 50)
returns table (
  email text, name text, share_slug text, title text, kickoff_at timestamptz,
  venue text, spots_left int, regulars text[]
) language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  return query
  with due as (
    select distinct on (d.user_id) d.*
      from private.due_regular_alert_emails d
     order by d.user_id, d.kickoff_at
  ), pick as (
    select * from due order by kickoff_at
     limit greatest(1, least(coalesce(p_limit, 50), 100))
  ), marked as (
    update public.regular_alerts a set emailed_at = now()
      from pick
     where a.user_id = pick.user_id and a.match_id = pick.match_id and a.emailed_at is null
    returning a.user_id, a.match_id
  )
  select pick.email, pick.recipient_name, pick.share_slug, pick.title, pick.kickoff_at,
         pick.venue, pick.spots_left, pick.regulars
    from pick join marked on marked.user_id = pick.user_id and marked.match_id = pick.match_id;
end;
$$;

-- The 10-min cron tick (0029) also pings the app when alert emails are due.
create or replace function private.checkins_tick()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_secret text;
begin
  perform public.run_checkins();

  if public.checkin_emails_due() = 0 and public.regular_alert_emails_due() = 0 then return; end if;

  begin
    select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'checkins_cron_secret';
  exception when others then
    v_secret := null;  -- no Vault (local tests)
  end;
  if v_secret is null or v_secret = '' then
    raise log 'no-show-checkins: no checkins_cron_secret in Vault, emails not sent';
    return;
  end if;

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

-- ── 5. Shareable cards ───────────────────────────────────────────────────
-- Organiser's recap of a completed game. New faces = players (not the
-- organiser) who hadn't played in one of this organiser's games before.
create or replace function public.game_recap(p_match_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  with m as (
    select m.*, l.name as venue, l.neighborhood, o.name as organizer_name
      from public.matches m
      left join public.locations l on l.id = m.location_id
      left join public.profiles o  on o.id = m.organizer_id
     where m.id = p_match_id and m.status = 'completed'
  ), played as (
    select mp.user_id, mp.first_game_ct, mp.requested_at, p.name, p.avatar_url,
           (mp.user_id <> m.organizer_id) as is_player,
           (mp.user_id <> m.organizer_id and not exists (
              select 1 from public.match_players e join public.matches em on em.id = e.match_id
               where e.user_id = mp.user_id and e.status = 'attended'
                 and em.organizer_id = m.organizer_id and em.id <> m.id and em.kickoff_at < m.kickoff_at
           )) as new_face
      from m
      join public.match_players mp on mp.match_id = m.id and mp.status = 'attended'
      join public.profiles p on p.id = mp.user_id
  )
  select jsonb_build_object(
           'title', m.title, 'kickoff_at', m.kickoff_at, 'venue', m.venue, 'neighborhood', m.neighborhood,
           'organizer_name', m.organizer_name, 'organizer_id', m.organizer_id,
           'skill_tag', m.skill_tag, 'group_tag', m.group_tag, 'over_30', m.over_30,
           'players', (select count(*) from played),
           'new_faces', (select count(*) from played where new_face),
           'first_game_ct', (select count(*) from played where first_game_ct),
           'faces', coalesce((select jsonb_agg(jsonb_build_object('name', split_part(f.name, ' ', 1), 'avatar_url', f.avatar_url)
                                               order by f.is_player, f.requested_at)
                                from (select * from played order by is_player, requested_at limit 10) f), '[]'::jsonb))
    from m;
$$;

-- IG story card: public profile columns + how many people they've played with.
create or replace function public.player_card(p_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
           'name', p.name, 'avatar_url', p.avatar_url, 'neighborhood', p.neighborhood,
           'preferred_positions', p.preferred_positions, 'founding_number', p.founding_number,
           'games_played', p.games_played, 'games_missed', p.games_missed,
           'reliability_score', p.reliability_score, 'created_at', p.created_at,
           'played_with', (
             select count(distinct o.user_id)
               from public.match_players me
               join public.matches m       on m.id = me.match_id and m.ends_at <= now() and m.status <> 'cancelled'
               join public.match_players o on o.match_id = me.match_id and o.user_id <> me.user_id and o.status = 'attended'
              where me.user_id = p.id and me.status = 'attended'))
    from public.profiles p
   where p.public_slug = p_slug;
$$;

-- ── 6. Grants (0019 style: PUBLIC revoked, anon only where it must) ───────
revoke execute on function public.clear_first_game_ct()                 from public, anon, authenticated;
revoke execute on function public.queue_regular_alerts()                from public, anon, authenticated;
revoke execute on function public.played_together(uuid, uuid)           from public, anon, authenticated;
revoke execute on function public.regular_alert_emails_due()            from public, anon, authenticated;
revoke execute on function public.claim_regular_alert_emails(int)       from public, anon, authenticated;
revoke execute on function private.checkins_tick()                      from public, anon, authenticated;
grant  execute on function public.claim_regular_alert_emails(int)       to service_role;

revoke execute on function public.set_first_game_ct(uuid, boolean)      from public, anon;
revoke execute on function public.set_regular(uuid, boolean)            from public, anon;
revoke execute on function public.my_played_with(int)                   from public, anon;
revoke execute on function public.my_regular_alerts()                   from public, anon;
grant  execute on function public.set_first_game_ct(uuid, boolean)      to authenticated;
grant  execute on function public.set_regular(uuid, boolean)            to authenticated;
grant  execute on function public.my_played_with(int)                   to authenticated;
grant  execute on function public.my_regular_alerts()                   to authenticated;

-- Card data is public already (completed rosters, public profile columns).
revoke execute on function public.game_recap(uuid)                      from public;
revoke execute on function public.player_card(text)                     from public;
grant  execute on function public.game_recap(uuid)                      to anon, authenticated;
grant  execute on function public.player_card(text)                     to anon, authenticated;
