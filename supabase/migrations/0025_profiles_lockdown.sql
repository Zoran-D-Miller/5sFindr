-- ════════════════════════════════════════════════════════════════════════
--  Lock down public.profiles and the avatars bucket.
--
--  1. phone_number was readable by anyone holding the (public) anon key,
--     because "profiles are public" allows select on every row and the
--     table-level grant covered every column. Postgres can't hide a column
--     with RLS, so we swap the table-level SELECT for a column list that
--     leaves phone_number out. SECURITY DEFINER functions (signup trigger,
--     settlement) run as the owner and are unaffected; the views are
--     security_invoker but don't read phone_number.
--
--  2. "owner updates own profile" let a user change ANY column of their own
--     row through the API: reliability_score, games_played, motm_count,
--     founding_number, referral_code… Now authenticated users can only
--     update the fields the profile editor saves. Stats stay writable by the
--     SECURITY DEFINER economy functions only.
--
--  3. Nobody inserts or deletes profiles from the client (the signup trigger
--     creates them), so those grants go.
--
--  4. avatars bucket: cap at 5 MB (same as the upload form) and accept
--     raster images only (no SVG/HTML, which could carry script).
--
--  NOTE: with column grants, a NEW profiles column is not readable by
--  anon/authenticated until it's added to the grant below.
-- ════════════════════════════════════════════════════════════════════════

revoke select, insert, update, delete on public.profiles from anon, authenticated;

grant select (
  id, name, profile_picture_url, avatar_url, bio, neighborhood, skill_level,
  preferred_positions, weekly_availability, public_slug, instagram_url,
  tiktok_url, reliability_score, games_played, games_missed, motm_count,
  referral_code, referred_by_id, founding_number, founding_bonus_awarded,
  created_at, updated_at
) on public.profiles to anon, authenticated;

grant update (
  name, bio, avatar_url, neighborhood, skill_level, preferred_positions,
  weekly_availability, instagram_url, tiktok_url
) on public.profiles to authenticated;

-- Storage only exists on real Supabase (same guard as 0007).
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    update storage.buckets
       set file_size_limit = 5000000,
           allowed_mime_types = array[
             'image/jpeg', 'image/png', 'image/webp', 'image/gif',
             'image/heic', 'image/heif'
           ]
     where id = 'avatars';
  end if;
end $$;
