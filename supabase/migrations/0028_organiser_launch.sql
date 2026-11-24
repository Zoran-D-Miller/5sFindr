-- ════════════════════════════════════════════════════════════════════════
--  S3 — organiser soft launch (PRODUCT-BRIEF.md).
--
--  1. matches.series_id groups the games made by "repeat weekly".
--  2. Paid courts: the organiser's payment details (SnapScan link / EFT)
--     live in match_payment_info, readable only by the organiser and people
--     on that game's list (not by anyone holding the invite link).
--  3. match_players.paid_claimed_at ("I've paid", set by the player) and
--     paid_confirmed_at (the organiser's "who's paid" tick). No money moves
--     through 5sFindr.
-- ════════════════════════════════════════════════════════════════════════

alter table public.matches add column if not exists series_id uuid;
create index if not exists matches_series_id_idx on public.matches (series_id) where series_id is not null;

alter table public.match_players add column if not exists paid_claimed_at   timestamptz;
alter table public.match_players add column if not exists paid_confirmed_at timestamptz;

create table if not exists public.match_payment_info (
  match_id   uuid primary key references public.matches(id) on delete cascade,
  details    text not null check (char_length(details) between 1 and 300),
  updated_at timestamptz not null default now()
);
alter table public.match_payment_info enable row level security;

drop policy if exists "organiser and players read payment info" on public.match_payment_info;
create policy "organiser and players read payment info" on public.match_payment_info
  for select using (public.is_match_organizer(match_id) or public.is_match_participant(match_id));

drop policy if exists "organiser writes payment info" on public.match_payment_info;
create policy "organiser writes payment info" on public.match_payment_info
  for all using (public.is_match_organizer(match_id))
  with check (public.is_match_organizer(match_id));

revoke all on public.match_payment_info from anon;
grant select, insert, update, delete on public.match_payment_info to authenticated;

-- Player: "I've paid" (or undo).
create or replace function public.claim_paid(p_match_id uuid, p_paid boolean)
returns text language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'NOT_AUTHED'; end if;
  update public.match_players
     set paid_claimed_at = case when p_paid then coalesce(paid_claimed_at, now()) else null end
   where match_id = p_match_id and user_id = v_uid
     and status in ('requested', 'accepted', 'attended');
  if not found then raise exception 'NOT_IN'; end if;
  return case when p_paid then 'claimed' else 'unclaimed' end;
end;
$$;

-- Organiser: tick who's paid (or untick).
create or replace function public.confirm_paid(p_match_id uuid, p_user_id uuid, p_paid boolean)
returns text language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'NOT_AUTHED'; end if;
  if not exists (select 1 from public.matches where id = p_match_id and organizer_id = v_uid)
    then raise exception 'NOT_ORGANIZER'; end if;
  update public.match_players
     set paid_confirmed_at = case when p_paid then coalesce(paid_confirmed_at, now()) else null end
   where match_id = p_match_id and user_id = p_user_id
     and status in ('requested', 'accepted', 'attended');
  if not found then raise exception 'NOT_IN'; end if;
  return case when p_paid then 'paid' else 'unpaid' end;
end;
$$;

revoke execute on function public.claim_paid(uuid, boolean)         from public, anon;
revoke execute on function public.confirm_paid(uuid, uuid, boolean) from public, anon;
grant  execute on function public.claim_paid(uuid, boolean)         to authenticated;
grant  execute on function public.confirm_paid(uuid, uuid, boolean) to authenticated;
