-- Backup trigger for the social-media publisher (.github/workflows/content-publish.yml).
--
-- GitHub's own 15-minute schedule is unreliable on free repos (on 21–22 Nov 2026 it ran twice in ~18 h), and the
-- publisher skips anything more than 3 h late. So a few minutes after each posting slot, pg_cron asks GitHub to run
-- the workflow ("workflow_dispatch", not a dry run). The workflow's concurrency group queues overlapping runs, and the
-- publisher only acts on items that are due and not yet done, so an extra run never double-posts.
--
-- Slots (SAST = UTC+2): 07:00/07:30 weekdays, 09:00/09:30 weekends, 12:30, 19:00/19:30 (TikTok drafts go 30 min
-- before the post time). Runs at :03 and :33 of 05, 07, 10 and 17 UTC cover all of them (8 runs a day).
--
-- Needs a GitHub fine-grained token (this repo only, permission "Actions: Read and write") in Supabase Vault as
-- `github_publisher_dispatch_token`. Zoran adds it in the SQL editor; it is never in this repo. Without it the job
-- does nothing. Kill switches: the repo variable CONTENT_PUBLISH_ENABLED (posting), or
--   select cron.unschedule('content-publisher-backup');

create extension if not exists pg_net with schema extensions;

-- Not exposed through the API (only public is), so nobody can call this over PostgREST.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.dispatch_content_publisher()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  tok text;
begin
  select decrypted_secret into tok
  from vault.decrypted_secrets
  where name = 'github_publisher_dispatch_token';

  if tok is null or tok = '' then
    raise log 'content-publisher-backup: no github_publisher_dispatch_token in Vault, skipped';
    return;
  end if;

  perform net.http_post(
    url := 'https://api.github.com/repos/Zoran-D-Miller/5sFindr/actions/workflows/content-publish.yml/dispatches',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || tok,
      'Accept', 'application/vnd.github+json',
      'X-GitHub-Api-Version', '2022-11-28',
      'User-Agent', '5sfindr-publisher-backup',
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('ref', 'main', 'inputs', jsonb_build_object('dry_run', 'false'))
  );
end;
$$;

revoke all on function private.dispatch_content_publisher() from public, anon, authenticated;

select cron.schedule(
  'content-publisher-backup',
  '3,33 5,7,10,17 * * *',
  'select private.dispatch_content_publisher()'
);
