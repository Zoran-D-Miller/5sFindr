-- ════════════════════════════════════════════════════════════════════════
--  match_players.token_id: unique per LIVE seat, not forever.
--
--  Tokens are reusable deposits: settle_match returns an attendee's token to
--  'available' but leaves match_players.token_id set on the 'attended' row as
--  history. The global UNIQUE (token_id) from 0001 then rejects the next
--  commit of that token (join_match, seed_lifecycle) with
--  match_players_token_id_key. seed-lifecycle had failed every night since
--  2026-07-22, leaving no upcoming seed matches; any real player would hit the
--  same error joining their second match.
--
--  Every path that releases a token also moves the row out of
--  'requested'/'accepted' (settle → attended/rejected/no_show, cancel →
--  cancelled_early/late, decline → rejected) except 'attended', whose token
--  stays committed until settlement. So "one token, one live seat" holds with
--  a partial unique index over the two pre-match states.
-- ════════════════════════════════════════════════════════════════════════
alter table public.match_players drop constraint match_players_token_id_key;

create unique index match_players_live_token_key
  on public.match_players (token_id)
  where status in ('requested', 'accepted');

-- Keeps the tokens FK (on delete set null) lookup indexed for all rows.
create index match_players_token_id_idx on public.match_players (token_id);
