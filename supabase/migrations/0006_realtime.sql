-- ════════════════════════════════════════════════════════════════════════
--  Phase 8 — enable Realtime on the match lobby tables.
--  Clients subscribe to postgres_changes on these; RLS still governs which
--  rows a given user is allowed to receive (roster = participants + organizer).
--  Idempotent so it's safe to re-run and works on the local test cluster too.
-- ════════════════════════════════════════════════════════════════════════
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.match_players;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.matches;
exception when duplicate_object then null;
end $$;

-- Carry full row data on update/delete events.
alter table public.match_players replica identity full;
alter table public.matches       replica identity full;
