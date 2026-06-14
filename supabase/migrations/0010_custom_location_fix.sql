-- ════════════════════════════════════════════════════════════════════════
--  Custom-location fix: make venue coordinates optional.
--
--  Custom community fields are typed in by name only (no map SDK / no GPS),
--  so latitude/longitude must allow NULL. (This re-applies 0003 explicitly —
--  the production database was provisioned without that migration.)
--
--  Idempotent: "drop not null" on an already-nullable column is a safe no-op.
-- ════════════════════════════════════════════════════════════════════════
alter table public.locations alter column latitude  drop not null;
alter table public.locations alter column longitude drop not null;
