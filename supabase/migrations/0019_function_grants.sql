-- Tighten EXECUTE on SECURITY DEFINER functions. Supabase's default privileges
-- grant EXECUTE to PUBLIC, anon and authenticated on every new function in
-- public, so all of these were callable via /rest/v1/rpc/* with the anon key.
-- PUBLIC must be revoked too: anon inherits from it. postgres (owner, pg_cron)
-- and service_role keep their grants.

-- 1) Internal only: cron jobs (run as postgres), triggers (EXECUTE is checked
--    at CREATE TRIGGER, not when it fires), and helpers called from other
--    SECURITY DEFINER functions (which run as the owner). assign_teams and
--    recompute_reliability have no auth check of their own.
revoke execute on function public.settle_due_matches()            from public, anon, authenticated;
revoke execute on function public.seed_lifecycle()                from public, anon, authenticated;
revoke execute on function public.handle_new_user()               from public, anon, authenticated;
revoke execute on function public.add_organizer_as_captain()      from public, anon, authenticated;
revoke execute on function public.assign_teams(uuid)              from public, anon, authenticated;
revoke execute on function public.recompute_reliability(uuid)     from public, anon, authenticated;

-- 2) Signed-in only. settle_match / finalize_motm are called with the user's
--    cookie client (lazy settlement on the match page, organizer "end match");
--    both are time-gated and idempotent, so any signed-in caller is fine.
--    lock_match / ensure_match_code check organizer_id = auth.uid().
revoke execute on function public.settle_match(uuid)                                      from public, anon;
revoke execute on function public.finalize_motm(uuid)                                     from public, anon;
revoke execute on function public.lock_match(uuid)                                        from public, anon;
revoke execute on function public.ensure_match_code(uuid)                                 from public, anon;
revoke execute on function public.join_match(uuid)                                        from public, anon;
revoke execute on function public.cancel_participation(uuid)                              from public, anon;
revoke execute on function public.cancel_match(uuid)                                      from public, anon;
revoke execute on function public.check_in(uuid, text, double precision, double precision, text) from public, anon;
revoke execute on function public.manager_respond(uuid, uuid, boolean)                    from public, anon;
revoke execute on function public.vote_motm(uuid, uuid)                                   from public, anon;

grant execute on function public.settle_match(uuid)                                      to authenticated;
grant execute on function public.finalize_motm(uuid)                                     to authenticated;
grant execute on function public.lock_match(uuid)                                        to authenticated;
grant execute on function public.ensure_match_code(uuid)                                 to authenticated;
grant execute on function public.join_match(uuid)                                        to authenticated;
grant execute on function public.cancel_participation(uuid)                              to authenticated;
grant execute on function public.cancel_match(uuid)                                      to authenticated;
grant execute on function public.check_in(uuid, text, double precision, double precision, text) to authenticated;
grant execute on function public.manager_respond(uuid, uuid, boolean)                    to authenticated;
grant execute on function public.vote_motm(uuid, uuid)                                   to authenticated;

-- 3) Unchanged on purpose (anon must keep EXECUTE):
--    is_match_organizer — "roster is public for live matches" policy on match_players
--    is_match_participant — RLS helper alongside it
--    is_premium — public.leaderboard (security_invoker view) and insert policies
--    join_waitlist — pre-launch waitlist signup (0017)

-- Trigger function: pin search_path (function_search_path_mutable).
alter function public.set_updated_at() set search_path = public;
