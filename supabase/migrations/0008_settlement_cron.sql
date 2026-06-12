-- ════════════════════════════════════════════════════════════════════════
--  Phase 8 — automated settlement backstop via pg_cron.
--  Lazy settlement (on match view) handles the common case promptly; this is
--  the guaranteed sweep for matches nobody reopens. Runs nightly at midnight
--  SAST (22:00 UTC). Bump the cadence to '*/15 * * * *' for near-instant
--  token returns if you prefer.
-- ════════════════════════════════════════════════════════════════════════

-- Sweep: settle every ended-but-unsettled match, and award MotM for any
-- completed match whose 24h voting window has closed. Per-match error
-- isolation so one bad row can't abort the whole run.
create or replace function public.settle_due_matches()
returns int language plpgsql security definer set search_path = public as $$
declare
  r record;
  n int := 0;
begin
  for r in
    select id from public.matches
    where status in ('open', 'full', 'in_progress') and ends_at < now()
  loop
    begin
      perform public.settle_match(r.id);
      n := n + 1;
    exception when others then
      raise warning 'settle_match(%) failed: %', r.id, sqlerrm;
    end;
  end loop;

  for r in
    select id from public.matches
    where status = 'completed' and not motm_awarded and ends_at + interval '24 hours' < now()
  loop
    begin
      perform public.finalize_motm(r.id);
    exception when others then
      raise warning 'finalize_motm(%) failed: %', r.id, sqlerrm;
    end;
  end loop;

  return n;
end;
$$;

-- Try to enable pg_cron (no-op if already on; clear notice if not permitted).
do $$
begin
  create extension if not exists pg_cron;
exception when others then
  raise notice 'Could not auto-enable pg_cron (%). Enable it in Dashboard → Database → Extensions, then re-run this file.', sqlerrm;
end $$;

-- Schedule the nightly sweep (idempotent: replace any existing job of this name).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'settle-due-matches') then
      perform cron.unschedule('settle-due-matches');
    end if;
    perform cron.schedule('settle-due-matches', '0 22 * * *', 'select public.settle_due_matches();');
    raise notice 'Scheduled cron job "settle-due-matches" nightly at 22:00 UTC (00:00 SAST).';
  else
    raise notice 'pg_cron not available — settlement sweep not scheduled (lazy settlement still works).';
  end if;
end $$;
