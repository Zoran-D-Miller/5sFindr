-- ════════════════════════════════════════════════════════════════════════
--  Repair: add the MotM columns to matches on environments where the 0005
--  ALTERs never applied (production drift — diagnosed live via
--  "column matches.motm_awarded does not exist", code 42703).
--
--  These columns are part of the canonical schema (defined in 0005, present in
--  schema.sql) and are required by finalize_motm() and the match lobby's MotM
--  winner banner. Idempotent — safe to run anywhere.
-- ════════════════════════════════════════════════════════════════════════
alter table public.matches add column if not exists motm_awarded   boolean not null default false;
alter table public.matches add column if not exists motm_winner_id uuid references public.profiles(id) on delete set null;
