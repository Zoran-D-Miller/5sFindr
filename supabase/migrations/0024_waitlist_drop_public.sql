-- ════════════════════════════════════════════════════════════════════════
--  Close the public door to the waitlist.
--
--  Apply AFTER the app that calls the 14-argument join_waitlist() with the
--  service role (0023) is live in production. Applying it earlier breaks the
--  signup form until that deploy finishes.
--
--  Drops the old signatures that anon could call straight through
--  /rest/v1/rpc/join_waitlist (skipping the honeypot and the rate limit):
--  the 13-argument one (form from 0022) and the 12-argument one (0017 form).
--  What's left is the service-role-only 14-argument function.
-- ════════════════════════════════════════════════════════════════════════
drop function if exists public.join_waitlist(text,text,text,text,text,text[],boolean,boolean,boolean,text,text,text);
drop function if exists public.join_waitlist(text,text,text,text[],text[],text,text[],boolean,boolean,boolean,text,text,text);
