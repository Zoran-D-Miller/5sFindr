-- ════════════════════════════════════════════════════════════════════════
--  Premium production layer: social profiles, founding tiers, region pings.
-- ════════════════════════════════════════════════════════════════════════

-- ── Profile extensions ──────────────────────────────────────────────────
alter table public.profiles add column if not exists bio        text;
alter table public.profiles add column if not exists avatar_url text;
-- Founding ordinal (1..N) assigned at signup. Gold ≤100, Silver ≤1000.
alter table public.profiles add column if not exists founding_number int;
alter table public.profiles add column if not exists founding_bonus_awarded boolean not null default false;

create sequence if not exists public.founding_seq;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_founding_number_key') then
    alter table public.profiles add constraint profiles_founding_number_key unique (founding_number);
  end if;
end $$;

-- ── Re-create handle_new_user to stamp the founding ordinal ─────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_name        text;
  v_ref_code    text;
  v_slug        text;
  v_my_code     text;
  v_referrer_id uuid;
  v_token_id    uuid;
begin
  v_name     := coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), 'New Baller');
  v_ref_code := new.raw_user_meta_data->>'referral_code';
  v_slug     := lower(regexp_replace(v_name, '[^a-zA-Z0-9]+', '-', 'g'))
                || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  v_my_code  := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  if v_ref_code is not null then
    select id into v_referrer_id from public.profiles where referral_code = v_ref_code limit 1;
  end if;

  insert into public.profiles (id, name, public_slug, referral_code, referred_by_id, founding_number)
  values (new.id, v_name, v_slug, v_my_code, v_referrer_id, nextval('public.founding_seq'));

  insert into public.subscriptions (user_id, state, free_until)
  values (new.id, 'trialing', now() + interval '30 days');

  insert into public.tokens (owner_id, status) values (new.id, 'available') returning id into v_token_id;
  insert into public.token_transactions (token_id, user_id, type, note)
  values (v_token_id, new.id, 'signup_grant', 'Welcome token — your first match is on us');

  if v_referrer_id is not null then
    insert into public.referrals (referrer_id, referred_id, reward_granted)
    values (v_referrer_id, new.id, true);
    update public.subscriptions
       set free_until = greatest(coalesce(free_until, now()), now()) + interval '7 days'
     where user_id = v_referrer_id;
  end if;

  return new;
end;
$$;

-- ── Follows ─────────────────────────────────────────────────────────────
create table if not exists public.follows (
  id           uuid primary key default gen_random_uuid(),
  follower_id  uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  unique (follower_id, following_id),
  check (follower_id <> following_id)
);
create index if not exists follows_following_idx on public.follows(following_id);
create index if not exists follows_follower_idx  on public.follows(follower_id);

alter table public.follows enable row level security;
drop policy if exists "follows are public"        on public.follows;
drop policy if exists "user manages own follows"  on public.follows;
drop policy if exists "user removes own follows"   on public.follows;
create policy "follows are public"       on public.follows for select using (true);
create policy "user manages own follows" on public.follows for insert with check (auth.uid() = follower_id);
create policy "user removes own follows" on public.follows for delete using (auth.uid() = follower_id);

-- ── Region match pings (in-app "Ping Nearby Ballers", Layer 1) ──────────
create table if not exists public.match_pings (
  id           uuid primary key default gen_random_uuid(),
  match_id     uuid not null references public.matches(id) on delete cascade,
  organizer_id uuid not null references public.profiles(id) on delete cascade,
  neighborhood text,
  message      text not null,
  created_at   timestamptz not null default now()
);
create index if not exists match_pings_region_idx on public.match_pings(neighborhood, created_at desc);

alter table public.match_pings enable row level security;
drop policy if exists "pings are public"        on public.match_pings;
drop policy if exists "organizer creates pings" on public.match_pings;
create policy "pings are public"        on public.match_pings for select using (true);
create policy "organizer creates pings" on public.match_pings for insert
  with check (auth.uid() = organizer_id and public.is_match_organizer(match_id));

-- ── settle_match + Founding Baller perk (first filled+completed host → +30d) ─
create or replace function public.settle_match(p_match_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_match public.matches%rowtype;
begin
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'NO_MATCH'; end if;
  if v_match.status in ('completed', 'cancelled') then return 'noop'; end if;
  if now() < v_match.ends_at then raise exception 'NOT_ENDED'; end if;

  -- 1) Attendees → return token (+ ledger), games_played++
  insert into public.token_transactions (token_id, user_id, type, match_id, note)
    select token_id, user_id, 'return', p_match_id, 'Match completed — token returned'
    from public.match_players where match_id = p_match_id and status = 'attended';
  update public.tokens set status = 'available', committed_match_id = null
    where id in (select token_id from public.match_players where match_id = p_match_id and status = 'attended');
  update public.profiles set games_played = games_played + 1
    where id in (select user_id from public.match_players where match_id = p_match_id and status = 'attended');

  -- 2) Pending requests → refund, reject
  insert into public.token_transactions (token_id, user_id, type, match_id, note)
    select token_id, user_id, 'refund', p_match_id, 'Match ended while pending — token refunded'
    from public.match_players where match_id = p_match_id and status = 'requested';
  update public.tokens set status = 'available', committed_match_id = null
    where id in (select token_id from public.match_players where match_id = p_match_id and status = 'requested');
  update public.match_players set status = 'rejected' where match_id = p_match_id and status = 'requested';

  -- 3) No-shows → forfeit to platform, games_missed++
  insert into public.token_transactions (token_id, user_id, type, match_id, note)
    select token_id, user_id, 'forfeit', p_match_id, 'No-show — token forfeited'
    from public.match_players where match_id = p_match_id and status = 'accepted';
  insert into public.platform_ledger (user_id, match_id, token_id, reason)
    select user_id, p_match_id, token_id, 'no_show'
    from public.match_players where match_id = p_match_id and status = 'accepted';
  update public.tokens set status = 'forfeited'
    where id in (select token_id from public.match_players where match_id = p_match_id and status = 'accepted');
  update public.profiles set games_missed = games_missed + 1
    where id in (select user_id from public.match_players where match_id = p_match_id and status = 'accepted');
  update public.match_players set status = 'no_show' where match_id = p_match_id and status = 'accepted';

  -- 4) Recompute reliability for affected players
  update public.profiles set reliability_score = case
      when (games_played + games_missed) = 0 then 100
      else round(100.0 * games_played / (games_played + games_missed), 2) end
    where id in (select user_id from public.match_players where match_id = p_match_id and status in ('attended', 'no_show'));

  -- 5) Founding Baller (≤100) perk: first FILLED + completed hosted match → +30 free days
  if v_match.teams_assigned then
    update public.profiles set founding_bonus_awarded = true
      where id = v_match.organizer_id
        and coalesce(founding_number, 1000000) <= 100
        and not founding_bonus_awarded;
    if found then
      update public.subscriptions
         set free_until = greatest(coalesce(free_until, now()), now()) + interval '30 days'
       where user_id = v_match.organizer_id;
    end if;
  end if;

  update public.matches set status = 'completed' where id = p_match_id;
  return 'completed';
end;
$$;

-- ── Leaderboard view: expose avatar + founding ordinal for rings/badges ──
-- Drop first: the column set changed (profile_picture_url → avatar_url), which
-- CREATE OR REPLACE VIEW can't do.
drop view if exists public.leaderboard;
create view public.leaderboard
with (security_invoker = true) as
  select
    p.id, p.name, p.avatar_url, p.neighborhood, p.skill_level, p.preferred_positions,
    p.motm_count, p.reliability_score, p.games_played, p.founding_number,
    rank() over (order by p.motm_count desc, p.reliability_score desc, p.games_played desc) as position
  from public.profiles p
  where public.is_premium(p.id);
grant select on public.leaderboard to anon, authenticated;

-- ── Avatars Storage bucket + policies (guarded: only on real Supabase) ──
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public)
      values ('avatars', 'avatars', true)
      on conflict (id) do nothing;

    execute 'drop policy if exists "avatars public read" on storage.objects';
    execute 'drop policy if exists "avatars owner upload" on storage.objects';
    execute 'drop policy if exists "avatars owner update" on storage.objects';
    execute 'drop policy if exists "avatars owner delete" on storage.objects';

    -- Public read; authenticated users may write only inside their own <uid>/ folder.
    execute $p$ create policy "avatars public read" on storage.objects
      for select using (bucket_id = 'avatars') $p$;
    execute $p$ create policy "avatars owner upload" on storage.objects
      for insert with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text) $p$;
    execute $p$ create policy "avatars owner update" on storage.objects
      for update using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text) $p$;
    execute $p$ create policy "avatars owner delete" on storage.objects
      for delete using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text) $p$;
  end if;
end $$;
