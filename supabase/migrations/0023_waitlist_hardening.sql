-- ════════════════════════════════════════════════════════════════════════
--  Waitlist hardening for public traffic.
--
--  1) No overwrite by email. Before, re-joining with someone else's email
--     replaced their name, WhatsApp, areas and consents and handed back their
--     referral code. Now a re-join only refreshes the row when the WhatsApp
--     number matches the one on file; otherwise nothing changes and the
--     caller gets status 'exists' with no code or position.
--  2) Server-only entry point with a rate limit. The new 14-argument
--     join_waitlist() is EXECUTE-able by service_role only (the server action,
--     which also runs the honeypot), and takes p_client: a keyed hash of the
--     caller's IP, never the raw IP. Attempts per client are capped.
--
--  Rollout (see the PR): apply THIS migration first. It is backwards
--  compatible: the 13- and 12-argument signatures the live form uses keep
--  working (now with the no-overwrite rule). Then deploy the app, then apply
--  0024, which drops those old public signatures.
-- ════════════════════════════════════════════════════════════════════════

-- ── Attempt log for the rate limit (pruned to the last day) ──────────────
create table if not exists public.waitlist_attempts (
  client text        not null check (char_length(client) between 1 and 128),
  at     timestamptz not null default now()
);

create index if not exists waitlist_attempts_client_at_idx on public.waitlist_attempts (client, at);
create index if not exists waitlist_attempts_at_idx on public.waitlist_attempts (at);

alter table public.waitlist_attempts enable row level security;
revoke all on public.waitlist_attempts from anon, authenticated;

-- ── join_waitlist v3: server-only, rate-limited, no overwrite ────────────
-- p_ref, p_source and p_client have no defaults on purpose: a 13-key REST
-- call can then only match the old 13-argument signature, never this one.
create or replace function public.join_waitlist(
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
) returns table (status text, referral_code text, list_position bigint, referrals bigint)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_email  text := lower(btrim(p_email));
  v_ref    text := nullif(upper(btrim(coalesce(p_ref, ''))), '');
  v_client text := nullif(btrim(coalesce(p_client, '')), '');
  v_roles  text[];
  v_areas  text[];
  v_home   text := nullif(btrim(coalesce(p_home_neighbourhood, '')), '');
  v_code   text;
  v_row    public.waitlist;
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- no 0/O/1/I/L
  -- Generous because South African mobile networks put many people behind
  -- one public IP (CGNAT). Tune here if real people start hitting it.
  c_burst_max constant int := 20;  -- attempts per client per 10 minutes
  c_daily_max constant int := 200; -- attempts per client per day
begin
  -- Rate limit. One lock per client so parallel requests can't both slip
  -- under the cap. Attempts that later fail validation roll back with the
  -- rest of the call, so only calls that reach the insert count.
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

  -- Roles: de-duplicated, in a fixed order so roles[1] is the primary role.
  select array_agg(r order by array_position(array['player', 'organizer', 'venue'], r))
    into v_roles
    from (select distinct unnest(coalesce(p_roles, '{}')) as r) s;
  if v_roles is null or not v_roles <@ array['player', 'organizer', 'venue'] then
    raise exception 'invalid_roles' using errcode = '22023';
  end if;

  -- Areas: trimmed, de-duplicated, order kept as given.
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

  -- referrer must exist (self-referral on re-join is blocked below)
  if v_ref is not null and not exists (select 1 from public.waitlist w where w.referral_code = v_ref) then
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
    referral_code, referred_by, source
  ) values (
    btrim(p_name), v_email, btrim(p_whatsapp), v_roles[1], v_roles, v_home, v_areas, v_home,
    coalesce(p_availability, '{}'),
    true, coalesce(p_consent_email, false), coalesce(p_consent_whatsapp, false), p_consent_version,
    v_code, v_ref, nullif(btrim(coalesce(p_source, '')), '')
  )
  -- Re-joining with the same email AND the same WhatsApp number refreshes
  -- details and consents, keeping the original place in the queue, code and
  -- referrer. With a different number nothing is touched.
  on conflict (email) do update set
    name               = excluded.name,
    role               = excluded.role,
    roles              = excluded.roles,
    neighbourhood      = excluded.neighbourhood,
    neighbourhoods     = excluded.neighbourhoods,
    home_neighbourhood = excluded.home_neighbourhood,
    availability       = excluded.availability,
    consent_email      = excluded.consent_email,
    consent_whatsapp   = excluded.consent_whatsapp,
    consent_version    = excluded.consent_version,
    consent_at         = now(),
    updated_at         = now(),
    referred_by        = coalesce(w.referred_by, nullif(excluded.referred_by, w.referral_code))
  where w.whatsapp = excluded.whatsapp
  returning * into v_row;

  if not found then
    -- Email is taken by someone with a different number: reveal nothing.
    return query select 'exists'::text, null::text, null::bigint, null::bigint;
    return;
  end if;

  return query
    select 'joined'::text,
           v_row.referral_code,
           (select count(*) from public.waitlist w where w.seq <= v_row.seq),
           (select count(*) from public.waitlist w where w.referred_by = v_row.referral_code);
end;
$$;

revoke all on function public.join_waitlist(text,text,text,text[],text[],text,text[],boolean,boolean,boolean,text,text,text,text) from public, anon, authenticated;
grant execute on function public.join_waitlist(text,text,text,text[],text[],text,text[],boolean,boolean,boolean,text,text,text,text) to service_role;

-- ── 13-argument signature (the form live before this deploy) → wrapper ───
-- Same no-overwrite rule, no rate limit (it has no client key). A mismatched
-- re-join raises, so nothing leaks. Dropped by 0024 once the new app is live.
create or replace function public.join_waitlist(
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
  p_ref text default null,
  p_source text default null
) returns table (referral_code text, list_position bigint, referrals bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  select * into r from public.join_waitlist(
    p_name, p_email, p_whatsapp, p_roles, p_neighbourhoods, p_home_neighbourhood,
    p_availability, p_consent_profile, p_consent_email, p_consent_whatsapp, p_consent_version,
    p_ref, p_source, null::text
  );
  if r.status <> 'joined' then
    raise exception 'already_joined' using errcode = '22023';
  end if;
  return query select r.referral_code, r.list_position, r.referrals;
end;
$$;
