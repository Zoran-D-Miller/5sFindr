-- ════════════════════════════════════════════════════════════════════════
--  Pre-launch waitlist (S3). Collects email + WhatsApp number with separate,
--  timestamped POPIA consents so we can reach people on either channel.
--
--  Access model: the table has RLS on and NO policies, and anon/authenticated
--  have no table grants — nobody can read or list signups from the browser.
--  The only way in is join_waitlist() (SECURITY DEFINER), which validates,
--  normalises and upserts on email. Read the list from the Supabase dashboard
--  (or the service role); waitlist_stats tracks the launch gate.
-- ════════════════════════════════════════════════════════════════════════
create table if not exists public.waitlist (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  name              text not null check (char_length(name) between 1 and 80),
  email             text not null unique
                      check (email = lower(email) and char_length(email) <= 254
                             and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  -- E.164, e.g. +27821234567 (normalised by the app before it gets here)
  whatsapp          text not null check (whatsapp ~ '^\+[1-9][0-9]{7,14}$'),
  neighbourhood     text not null check (char_length(neighbourhood) between 1 and 60),
  role              text not null check (role in ('player', 'organizer', 'venue')),
  availability      text[] not null default '{}'
                      check (availability <@ array['weekday_mornings','weekday_lunch','weekday_evenings',
                                                   'weekend_mornings','weekend_afternoons','weekend_evenings']),
  -- POPIA: storing details is required to join; each marketing channel is a
  -- separate opt-in (unticked by default). consent_at/version record when and
  -- which wording they agreed to.
  consent_profile   boolean not null check (consent_profile),
  consent_email     boolean not null default false,
  consent_whatsapp  boolean not null default false,
  consent_at        timestamptz not null default now(),
  consent_version   text not null,
  referral_code     text not null unique,
  referred_by       text references public.waitlist (referral_code) on delete set null,
  source            text check (char_length(source) <= 120)
);

create index if not exists waitlist_created_at_idx on public.waitlist (created_at);
create index if not exists waitlist_referred_by_idx on public.waitlist (referred_by);

alter table public.waitlist enable row level security;
revoke all on public.waitlist from anon, authenticated;

-- ── join_waitlist: the single public entry point ─────────────────────────
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
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_email text := lower(btrim(p_email));
  v_ref   text := nullif(upper(btrim(coalesce(p_ref, ''))), '');
  v_code  text;
  v_row   public.waitlist;
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- no 0/O/1/I/L
begin
  if not coalesce(p_consent_profile, false) then
    raise exception 'consent_required' using errcode = '22023';
  end if;

  -- referrer must exist (and can't be yourself — checked below)
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
    name, email, whatsapp, neighbourhood, role, availability,
    consent_profile, consent_email, consent_whatsapp, consent_version,
    referral_code, referred_by, source
  ) values (
    btrim(p_name), v_email, btrim(p_whatsapp), btrim(p_neighbourhood), p_role,
    coalesce(p_availability, '{}'),
    true, coalesce(p_consent_email, false), coalesce(p_consent_whatsapp, false), p_consent_version,
    v_code, v_ref, nullif(btrim(coalesce(p_source, '')), '')
  )
  -- Re-joining with the same email refreshes details and consents, but keeps
  -- the original place in the queue, code and referrer.
  on conflict (email) do update set
    name             = excluded.name,
    whatsapp         = excluded.whatsapp,
    neighbourhood    = excluded.neighbourhood,
    role             = excluded.role,
    availability     = excluded.availability,
    consent_email    = excluded.consent_email,
    consent_whatsapp = excluded.consent_whatsapp,
    consent_version  = excluded.consent_version,
    consent_at       = now(),
    updated_at       = now(),
    referred_by      = coalesce(w.referred_by, nullif(excluded.referred_by, w.referral_code))
  returning * into v_row;

  return query
    select v_row.referral_code,
           (select count(*) from public.waitlist w where w.created_at <= v_row.created_at),
           (select count(*) from public.waitlist w where w.referred_by = v_row.referral_code);
end;
$$;

revoke all on function public.join_waitlist(text,text,text,text,text,text[],boolean,boolean,boolean,text,text,text) from public;
grant execute on function public.join_waitlist(text,text,text,text,text,text[],boolean,boolean,boolean,text,text,text) to anon, authenticated;

-- ── Launch-gate tracking (dashboard / service role only) ─────────────────
create or replace view public.waitlist_stats with (security_invoker = true) as
  select neighbourhood,
         count(*)                                          as total,
         count(*) filter (where role = 'player')           as players,
         count(*) filter (where role = 'organizer')        as organizers,
         count(*) filter (where role = 'venue')            as venues,
         count(*) filter (where consent_whatsapp)          as whatsapp_ok,
         count(*) filter (where consent_email)             as email_ok
  from public.waitlist
  group by neighbourhood
  order by total desc;

revoke all on public.waitlist_stats from anon, authenticated;
