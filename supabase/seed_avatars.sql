-- ════════════════════════════════════════════════════════════════════════
--  ADMIN-ONLY: map the 30 seed users' avatars to ROOT objects in the public
--  `avatars` bucket (files seed-1.jpg … seed-30.jpg sitting at the bucket root).
--
--  Root-object public URL format (NO folder segment):
--    https://<REF>.supabase.co/storage/v1/object/public/avatars/seed-<N>.jpg
--  (A foldered upload would be …/public/avatars/<uid>/file.jpg — not the case here.)
--
--  ⚠️ REPLACE <YOUR-PROJECT-REF> with your project ref — the subdomain of your
--  Supabase Project URL (e.g. abcd1234 from https://abcd1234.supabase.co).
-- ════════════════════════════════════════════════════════════════════════
update public.profiles p
set avatar_url = 'https://<YOUR-PROJECT-REF>.supabase.co/storage/v1/object/public/avatars/seed-'
                 || split_part(split_part(u.email, '+', 2), '@', 1)   -- the N in seed+N@…
                 || '.jpg'
from auth.users u
where u.id = p.id
  and u.email like 'seed+%@5sfindr.local';

-- Verify one mapping, then paste it into a browser tab — it must load the image:
--   select name, avatar_url from public.profiles
--   where avatar_url like '%/avatars/seed-1.jpg' limit 1;
