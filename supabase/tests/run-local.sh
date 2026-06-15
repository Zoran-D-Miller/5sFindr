#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════
#  Docker-free economy test runner.
#  Spins up a throwaway local Postgres cluster, loads the auth shim + all
#  migrations + seed, runs the economy assertions, then tears everything down.
#
#  Usage:  ./supabase/tests/run-local.sh
#  Requires: a local PostgreSQL 15 install (no Docker, no Supabase stack).
#  On CI/real Supabase you'd instead use `supabase test db` (pgTAP).
# ════════════════════════════════════════════════════════════════════════
set -euo pipefail

# macOS: avoid "postmaster became multithreaded during startup".
export LC_ALL=C LANG=C

PGBIN="${PGBIN:-/usr/local/opt/postgresql@15/bin}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PORT="${PGPORT:-55432}"
# Short socket path (Unix socket paths are length-limited).
TMP="/tmp/5sfindr_pgtest.$$"
rm -rf "$TMP"; mkdir -p "$TMP"

cleanup() {
  "$PGBIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap cleanup EXIT

echo "▸ initdb (throwaway cluster)…"
"$PGBIN/initdb" -D "$TMP/data" -U postgres --auth=trust --locale=C >/dev/null

echo "▸ starting postgres on socket $TMP (port $PORT)…"
"$PGBIN/pg_ctl" -D "$TMP/data" \
  -o "-k $TMP -p $PORT -c listen_addresses=''" \
  -l "$TMP/log" -w start >/dev/null

"$PGBIN/createdb" -h "$TMP" -p "$PORT" -U postgres fivestest

run() {
  echo "▸ load $(basename "$1")"
  "$PGBIN/psql" -v ON_ERROR_STOP=1 -h "$TMP" -p "$PORT" -U postgres -d fivestest -q -f "$1"
}

run "$ROOT/supabase/tests/00_bootstrap.sql"
run "$ROOT/supabase/migrations/0001_init.sql"
run "$ROOT/supabase/migrations/0002_match_feed.sql"
run "$ROOT/supabase/migrations/0003_nullable_coords.sql"
run "$ROOT/supabase/migrations/0004_lifecycle.sql"
run "$ROOT/supabase/migrations/0005_attendance.sql"
run "$ROOT/supabase/migrations/0006_realtime.sql"
run "$ROOT/supabase/migrations/0007_premium.sql"
run "$ROOT/supabase/migrations/0008_settlement_cron.sql"
run "$ROOT/supabase/migrations/0009_phone.sql"
run "$ROOT/supabase/migrations/0010_custom_location_fix.sql"
run "$ROOT/supabase/migrations/0011_read_visibility_fix.sql"
run "$ROOT/supabase/seed.sql"

echo "▸ running economy_test.sql …"
"$PGBIN/psql" -v ON_ERROR_STOP=1 -h "$TMP" -p "$PORT" -U postgres -d fivestest -f "$ROOT/supabase/tests/economy_test.sql"

echo ""
echo "✅ ALL ECONOMY TESTS PASSED"
