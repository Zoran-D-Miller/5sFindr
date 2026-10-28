-- ════════════════════════════════════════════════════════════════════════
--  Waitlist v2: people can pick several roles and several areas, and mark one
--  area as home (where they play most).
--
--  New columns roles[], neighbourhoods[] and home_neighbourhood hold the
--  answers. The original role / neighbourhood columns stay, kept in sync as
--  "primary role" and "home area", so older queries keep working.
--
--  Rollout-safe: the old 12-argument join_waitlist() becomes a thin wrapper
--  around the new one, so the form that is live before this deploy keeps
--  working once this migration is applied. Apply this BEFORE shipping the new
--  form (which calls the new signature).
-- ════════════════════════════════════════════════════════════════════════

-- ── Columns (backfilled from the single-choice answers) ──────────────────
alter table public.waitlist
  add column if not exists roles              text[],
  add column if not exists neighbourhoods     text[],
  add column if not exists home_neighbourhood text;

update public.waitlist
   set roles              = coalesce(roles, array[role]),
       neighbourhoods     = coalesce(neighbourhoods, array[neighbourhood]),
       home_neighbourhood = coalesce(home_neighbourhood, neighbourhood);

alter table public.waitlist
  alter column roles              set not null,
  alter column neighbourhoods     set not null,
  alter column home_neighbourhood set not null,
  add constraint waitlist_roles_check
    check (cardinality(roles) between 1 and 3
           and roles <@ array['player', 'organizer', 'venue']),
  add constraint waitlist_neighbourhoods_check
    check (cardinality(neighbourhoods) between 1 and 12),
  add constraint waitlist_home_neighbourhood_check
    check (char_length(home_neighbourhood) between 1 and 60
           and home_neighbourhood = any (neighbourhoods)),
  -- SA numbers must be a full mobile: +27 then 9 digits starting 6, 7 or 8
  -- (catches a doubled trunk 0 like +270821234567).
  add constraint waitlist_whatsapp_sa_check
    check (whatsapp !~ '^\+27' or whatsapp ~ '^\+27[678][0-9]{8}$');

create index if not exists waitlist_neighbourhoods_idx on public.waitlist using gin (neighbourhoods);

-- ── join_waitlist v2: the single public entry point ──────────────────────
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
#variable_conflict use_column
declare
  v_email text := lower(btrim(p_email));
  v_ref   text := nullif(upper(btrim(coalesce(p_ref, ''))), '');
  v_roles text[];
  v_areas text[];
  v_home  text := nullif(btrim(coalesce(p_home_neighbourhood, '')), '');
  v_code  text;
  v_row   public.waitlist;
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- no 0/O/1/I/L
begin
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
  -- Re-joining with the same email refreshes details and consents, but keeps
  -- the original place in the queue, code and referrer.
  on conflict (email) do update set
    name               = excluded.name,
    whatsapp           = excluded.whatsapp,
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
  returning * into v_row;

  return query
    select v_row.referral_code,
           (select count(*) from public.waitlist w where w.seq <= v_row.seq),
           (select count(*) from public.waitlist w where w.referred_by = v_row.referral_code);
end;
$$;

revoke all on function public.join_waitlist(text,text,text,text[],text[],text,text[],boolean,boolean,boolean,text,text,text) from public;
grant execute on function public.join_waitlist(text,text,text,text[],text[],text,text[],boolean,boolean,boolean,text,text,text) to anon, authenticated;

-- ── Old single-choice signature → wrapper (keeps the pre-deploy form working)
-- Drop once the new form has been live for a while.
create or replace function public.join_waitlist(
  p_name text,
  p_email text,
  p_whatsapp text,
  p_neighbourhood text,
  p_role text,
  p_availability text[],
  p_consent_profile boolean,
  p_consent_email boolean,
  p_consent_whatsapp boolean,
  p_consent_version text,
  p_ref text default null,
  p_source text default null
) returns table (referral_code text, list_position bigint, referrals bigint)
language sql
security definer
set search_path = public
as $$
  select * from public.join_waitlist(
    p_name, p_email, p_whatsapp,
    array[p_role], array[p_neighbourhood], p_neighbourhood,
    p_availability, p_consent_profile, p_consent_email, p_consent_whatsapp, p_consent_version,
    p_ref, p_source
  );
$$;

revoke all on function public.join_waitlist(text,text,text,text,text,text[],boolean,boolean,boolean,text,text,text) from public;
grant execute on function public.join_waitlist(text,text,text,text,text,text[],boolean,boolean,boolean,text,text,text) to anon, authenticated;

-- ── Launch-gate tracking (dashboard / service role only) ─────────────────
-- One row per area. home = people who play there most; plays_here = everyone
-- who ticked it (a person counts in every area they picked). Role and consent
-- counts are over plays_here.
drop view if exists public.waitlist_stats;
create view public.waitlist_stats with (security_invoker = true) as
  select a.neighbourhood,
         count(*) filter (where w.home_neighbourhood = a.neighbourhood) as home,
         count(*)                                                       as plays_here,
         count(*) filter (where 'player'    = any (w.roles))            as players,
         count(*) filter (where 'organizer' = any (w.roles))            as organizers,
         count(*) filter (where 'venue'     = any (w.roles))            as venues,
         count(*) filter (where w.consent_whatsapp)                     as whatsapp_ok,
         count(*) filter (where w.consent_email)                        as email_ok
  from public.waitlist w
  cross join lateral unnest(w.neighbourhoods) as a(neighbourhood)
  group by a.neighbourhood
  order by plays_here desc, home desc;

revoke all on public.waitlist_stats from anon, authenticated;
