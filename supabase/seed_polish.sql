-- ════════════════════════════════════════════════════════════════════════
--  ADMIN-ONLY polish patch — run in the Supabase SQL Editor after the
--  cold-start seed. Idempotent-ish (re-running just re-randomizes / re-maps).
--  Seed accounts are identified by their seed+N@5sfindr.local emails.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1) Realistic historical stats for the 30 seed users ─────────────────
--     reliability_score 70–100, games_played 2–45.
--     (Our column is games_played, not matches_played.)
update public.profiles p
set reliability_score = floor(random() * 31) + 70,   -- 70..100
    games_played      = floor(random() * 44) + 2      -- 2..45
from auth.users u
where u.id = p.id
  and u.email like 'seed+%@5sfindr.local';

-- ── 3) Map seed avatars to your public `avatars` bucket ─────────────────
--     Files seed-1.jpg … seed-30.jpg. REPLACE <YOUR-PROJECT-REF> with your
--     Supabase project ref (the subdomain of your Project URL, e.g. abcd1234
--     from https://abcd1234.supabase.co).
update public.profiles p
set avatar_url = 'https://<YOUR-PROJECT-REF>.supabase.co/storage/v1/object/public/avatars/seed-'
                 || split_part(split_part(u.email, '+', 2), '@', 1)  -- the N in seed+N@…
                 || '.jpg'
from auth.users u
where u.id = p.id
  and u.email like 'seed+%@5sfindr.local';

-- ── Backfill: make the organizer the Captain on EXISTING matches ────────
--     (New matches get this automatically via the 0014 trigger; this covers
--     matches created before that trigger existed.)
insert into public.match_players (match_id, user_id, status, responded_at)
select m.id, m.organizer_id, 'accepted', now()
from public.matches m
where m.status not in ('cancelled')
on conflict (match_id, user_id) do nothing;
