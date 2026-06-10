-- ════════════════════════════════════════════════════════════════════════
--  Custom community fields are typed in by name only (no map SDK), so they
--  have no coordinates. Make lat/lng nullable. Matches at such venues fall
--  back to the Secondary attendance layer (4-digit match code); the Primary
--  GPS geofence layer simply doesn't apply when coordinates are absent.
-- ════════════════════════════════════════════════════════════════════════
alter table public.locations alter column latitude  drop not null;
alter table public.locations alter column longitude drop not null;
