-- ════════════════════════════════════════════════════════════════════════
--  S5: unlock mechanics (PRODUCT-BRIEF.md, GROWTH-STRATEGY.md §6a).
--
--  1. One Founding Member number per person. Waitlist signups now draw from
--     the same public.founding_seq as profiles, so "Founding Member #047" on
--     the claim screen is the number the person keeps: when an account is
--     created (or a guest keeps their profile) with the same verified email
--     as a waitlist row, the profile takes that row's number instead of a new
--     one. Email only, never the WhatsApp number: guests type any number
--     unverified, so matching on it would let someone take another person's
--     number. Existing waitlist rows are numbered in signup order.
--  2. Personal invite links for profiles. Waitlist people already have one
--     (/?ref=<6-char code>). Profiles have an 8-char referral_code; the
--     waitlist now accepts it too and stores the referrer in
--     waitlist.referred_by_profile (waitlist.referred_by keeps its FK to
--     waitlist codes). Each mate who joins counts as a player in the areas
--     they ticked, so invites move those areas toward unlocking.
--  3. public.my_invites(): how many people joined with the caller's link.
--
--  The area progress board itself is computed in the app
--  (src/server/areaProgress.ts) from the same data as /admin, with the
--  threshold in src/lib/areas.ts (UNLOCK). No new table grants.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Founding numbers on the waitlist ──────────────────────────────────
alter table public.waitlist add column if not exists founding_number int;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'waitlist_founding_number_key') then
    alter table public.waitlist add constraint waitlist_founding_number_key unique (founding_number);
  end if;
end $$;

-- Backfill in signup order (seq is the strict queue order from 0018).
do $$
declare r record;
begin
  for r in select id from public.waitlist where founding_number is null order by seq loop
    update public.waitlist set founding_number = nextval('public.founding_seq') where id = r.id;
  end loop;
end $$;

-- ── 2. Profile referral codes on the waitlist ────────────────────────────
alter table public.waitlist
  add column if not exists referred_by_profile uuid references public.profiles (id) on delete set null;
create index if not exists waitlist_referred_by_profile_idx on public.waitlist (referred_by_profile);

-- ── Number for a new kept profile: the waitlist one if the email matches ─
-- and no profile holds it yet, else the next number.
create schema if not exists private;
create or replace function private.founding_number_for(p_email text)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_n int;
begin
  if nullif(btrim(coalesce(p_email, '')), '') is not null then
    select w.founding_number into v_n
      from public.waitlist w
     where w.email = lower(btrim(p_email))
       and w.founding_number is not null
       and not exists (select 1 from public.profiles p where p.founding_number = w.founding_number)
     limit 1;
  end if;
  return coalesce(v_n, nextval('public.founding_seq')::int);
end;
$$;
revoke all on function private.founding_number_for(text) from public, anon, authenticated;

-- Signup trigger (0027) with the founding number taken from the waitlist when
-- the email matches. Everything else is unchanged.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_name        text;
  v_ref_code    text;
  v_phone       text;
  v_slug        text;
  v_my_code     text;
  v_referrer_id uuid;
  v_token_id    uuid;
  v_guest       boolean := coalesce(new.is_anonymous, false);
begin
  v_name     := coalesce(nullif(trim(new.raw_user_meta_data->>'name'), ''),
                         nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
                         split_part(new.email, '@', 1), 'New Baller');
  v_ref_code := new.raw_user_meta_data->>'referral_code';
  v_phone    := nullif(trim(new.raw_user_meta_data->>'phone_number'), '');
  v_slug     := lower(regexp_replace(v_name, '[^a-zA-Z0-9]+', '-', 'g'))
                || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  v_my_code  := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  if v_ref_code is not null then
    select id into v_referrer_id from public.profiles where referral_code = v_ref_code limit 1;
  end if;

  insert into public.profiles (id, name, phone_number, public_slug, referral_code, referred_by_id, founding_number)
  values (new.id, v_name, v_phone, v_slug, v_my_code, v_referrer_id,
          case when v_guest then null else private.founding_number_for(new.email) end);

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
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- A guest who keeps their profile: same rule (the email is set by then).
create or replace function public.handle_guest_upgraded()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
     set founding_number = private.founding_number_for(new.email)
   where id = new.id and founding_number is null;
  return new;
end;
$$;
revoke execute on function public.handle_guest_upgraded() from public, anon, authenticated;

-- ── join_waitlist v4: + founding_number, + profile referral codes ────────
-- Same arguments, checks and rate limit as 0023. The return type changes, so
-- the function is dropped and re-created (grants re-applied below).
drop function if exists public.join_waitlist(text,text,text,text[],text[],text,text[],boolean,boolean,boolean,text,text,text,text);

create function public.join_waitlist(
  p_name text,
  p_email text,
  p_whatsapp text,
  p_roles text[],
  p_neighbourhoods text[],
  p_home_neighbourhood text,
  p_availability text[],
  p_consent_profile boolean,
  p_consent_email boolean,
  p_consent_whatsapp boolean,
  p_consent_version text,
  p_ref text,
  p_source text,
  p_client text
) returns table (status text, referral_code text, list_position bigint, referrals bigint, founding_number int)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_email  text := lower(btrim(p_email));
  v_ref    text := nullif(upper(btrim(coalesce(p_ref, ''))), '');
  v_ref_profile uuid;
  v_client text := nullif(btrim(coalesce(p_client, '')), '');
  v_roles  text[];
  v_areas  text[];
  v_home   text := nullif(btrim(coalesce(p_home_neighbourhood, '')), '');
  v_code   text;
  v_row    public.waitlist;
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- no 0/O/1/I/L
  c_burst_max constant int := 20;  -- attempts per client per 10 minutes
  c_daily_max constant int := 200; -- attempts per client per day
begin
  if v_client is not null then
    perform pg_advisory_xact_lock(hashtextextended('join_waitlist:' || v_client, 0));
    delete from public.waitlist_attempts where at < now() - interval '1 day';
    if (select count(*) from public.waitlist_attempts a
         where a.client = v_client and a.at > now() - interval '10 minutes') >= c_burst_max
       or (select count(*) from public.waitlist_attempts a where a.client = v_client) >= c_daily_max then
      raise exception 'rate_limited' using errcode = '22023';
    end if;
    insert into public.waitlist_attempts (client) values (v_client);
  end if;

  if not coalesce(p_consent_profile, false) then
    raise exception 'consent_required' using errcode = '22023';
  end if;

  select array_agg(r order by array_position(array['player', 'organizer', 'venue'], r))
    into v_roles
    from (select distinct unnest(coalesce(p_roles, '{}')) as r) s;
  if v_roles is null or not v_roles <@ array['player', 'organizer', 'venue'] then
    raise exception 'invalid_roles' using errcode = '22023';
  end if;

  select array_agg(a order by first_pos)
    into v_areas
    from (select btrim(a) as a, min(pos) as first_pos
            from unnest(coalesce(p_neighbourhoods, '{}')) with ordinality as t(a, pos)
           where btrim(a) <> ''
           group by btrim(a)) s;
  if v_areas is null or cardinality(v_areas) > 12
     or exists (select 1 from unnest(v_areas) a where char_length(a) > 60) then
    raise exception 'invalid_neighbourhoods' using errcode = '22023';
  end if;
  if v_home is null and cardinality(v_areas) = 1 then
    v_home := v_areas[1];
  end if;
  if v_home is null or not v_home = any (v_areas) then
    raise exception 'invalid_home_neighbourhood' using errcode = '22023';
  end if;

  -- Referrer: a waitlist code (6 chars) or a profile's code (8 chars). The
  -- alphabets and lengths differ, so a code can only belong to one of them.
  if v_ref is not null and not exists (select 1 from public.waitlist w where w.referral_code = v_ref) then
    select p.id into v_ref_profile from public.profiles p where p.referral_code = v_ref limit 1;
    v_ref := null;
  end if;

  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.waitlist w where w.referral_code = v_code);
  end loop;

  insert into public.waitlist as w (
    name, email, whatsapp, role, roles, neighbourhood, neighbourhoods, home_neighbourhood, availability,
    consent_profile, consent_email, consent_whatsapp, consent_version,
    referral_code, referred_by, referred_by_profile, source
  ) values (
    btrim(p_name), v_email, btrim(p_whatsapp), v_roles[1], v_roles, v_home, v_areas, v_home,
    coalesce(p_availability, '{}'),
    true, coalesce(p_consent_email, false), coalesce(p_consent_whatsapp, false), p_consent_version,
    v_code, v_ref, v_ref_profile, nullif(btrim(coalesce(p_source, '')), '')
  )
  -- Same no-overwrite rule as 0023. A referrer is only ever set once: either
  -- a waitlist code or a profile, whichever came first.
  on conflict (email) do update set
    name                = excluded.name,
    role                = excluded.role,
    roles               = excluded.roles,
    neighbourhood       = excluded.neighbourhood,
    neighbourhoods      = excluded.neighbourhoods,
    home_neighbourhood  = excluded.home_neighbourhood,
    availability        = excluded.availability,
    consent_email       = excluded.consent_email,
    consent_whatsapp    = excluded.consent_whatsapp,
    consent_version     = excluded.consent_version,
    consent_at          = now(),
    updated_at          = now(),
    referred_by         = case when w.referred_by is null and w.referred_by_profile is null
                               then nullif(excluded.referred_by, w.referral_code) else w.referred_by end,
    referred_by_profile = case when w.referred_by is null and w.referred_by_profile is null
                               then excluded.referred_by_profile else w.referred_by_profile end
  where w.whatsapp = excluded.whatsapp
  returning * into v_row;

  if not found then
    return query select 'exists'::text, null::text, null::bigint, null::bigint, null::int;
    return;
  end if;

  -- Numbered after the insert, so a re-join keeps its number and never burns one.
  if v_row.founding_number is null then
    update public.waitlist w set founding_number = nextval('public.founding_seq')
     where w.id = v_row.id
     returning * into v_row;
  end if;

  return query
    select 'joined'::text,
           v_row.referral_code,
           (select count(*) from public.waitlist w where w.seq <= v_row.seq),
           (select count(*) from public.waitlist w where w.referred_by = v_row.referral_code),
           v_row.founding_number;
end;
$$;

revoke all on function public.join_waitlist(text,text,text,text[],text[],text,text[],boolean,boolean,boolean,text,text,text,text) from public, anon, authenticated;
grant execute on function public.join_waitlist(text,text,text,text[],text[],text,text[],boolean,boolean,boolean,text,text,text,text) to service_role;

-- ── 3. my_invites: people who joined with the caller's link ──────────────
-- Waitlist signups made with the profile's code, plus accounts created with
-- it (the older signup form). Kept profiles only; guests have no link yet.
create or replace function public.my_invites()
returns int language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or public.is_guest() then return 0; end if;
  return (select count(*) from public.waitlist w where w.referred_by_profile = v_uid)
       + (select count(*) from public.profiles p where p.referred_by_id = v_uid);
end;
$$;
revoke all on function public.my_invites() from public, anon;
grant execute on function public.my_invites() to authenticated;
