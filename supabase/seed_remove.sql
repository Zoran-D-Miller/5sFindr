-- ════════════════════════════════════════════════════════════════════════
--  ADMIN: remove the seed community — run when real volume has taken over.
--  One shot, idempotent. Deletes every seed account (seed+N@5sfindr.local);
--  cascades clean their profiles, subscriptions, tokens, ledgers, follows,
--  pings, roster rows, and every match they organized. Real users' accounts,
--  matches, and the seeded VENUES are untouched (venue created_by is null).
--
--  Note: real users who joined a seed match lose that roster row with the
--  match (their committed token was already returned/settled by then).
--  platform_ledger keeps its rows with user_id nulled — the money audit
--  trail survives.
-- ════════════════════════════════════════════════════════════════════════

-- 1) Stop the lifecycle automation
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and exists (select 1 from cron.job where jobname = 'seed-lifecycle') then
    perform cron.unschedule('seed-lifecycle');
  end if;
end $$;

drop function if exists public.seed_lifecycle();

-- 2) Delete the seed accounts (cascades do the rest)
delete from auth.users where email like 'seed+%@5sfindr.local';

-- 3) Verify: all three counts should be 0
select
  (select count(*) from auth.users where email like 'seed+%@5sfindr.local') as seed_accounts_left,
  (select count(*) from public.matches where share_slug like 'seed-%')       as seed_matches_left,
  (select count(*) from cron.job where jobname = 'seed-lifecycle')           as lifecycle_jobs_left;
