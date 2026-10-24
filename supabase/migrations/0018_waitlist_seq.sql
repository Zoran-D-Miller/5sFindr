-- Queue position needs a strict order: created_at ties when two people join in
-- the same transaction/instant. seq is assigned on insert and never changes.
alter table public.waitlist add column if not exists seq bigint generated always as identity;
create unique index if not exists waitlist_seq_key on public.waitlist (seq);

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
           (select count(*) from public.waitlist w where w.seq <= v_row.seq),
           (select count(*) from public.waitlist w where w.referred_by = v_row.referral_code);
end;
$$;
