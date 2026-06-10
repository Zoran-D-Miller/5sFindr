# 5sFindr ⚽

Next-generation 5-a-side matchmaking PWA for South Africa — *Tinder meets Strava for football*. Launching in Cape Town.

## Stack
- **Next.js 14** (App Router) + **next-pwa** — mobile-first, installable PWA
- **Supabase** — Postgres + Auth + Realtime + Storage
- **Paystack** — ZAR subscriptions (R20/mo) + token top-ups
- **Browser Geolocation + Haversine** — 200m geofenced check-in (no paid map SDK)
- **Tailwind** — dark-mode-first, pitch-green / electric-blue brand

## The economy (two strictly-separate ledgers)
| | Subscription | Token |
|---|---|---|
| **What** | R20/mo membership utility fee | R20 recyclable security deposit |
| **Purpose** | Unlocks Premium features | Holds your spot in a match |
| **Lifecycle** | Billed monthly via Paystack | Committed on join → returned on attendance, forfeited on late-bail/ghost |

They **never cross over** — a token can't become a subscription month.

**Free tier:** sign up, edit profile, view feed, view public profiles.
**Premium tier:** create matches, request to join, leaderboard, shirt colors, Man-of-the-Match voting/trophies.

**Activation (automatic on signup, via the `handle_new_user` trigger):** a 30-day Premium trial + 1 free token, so a brand-new user can claim a game on Day 1 without a card. Referrals add 7 free days to the referrer.

## Getting started
```bash
# 1. install deps
npm install

# 2. start local Supabase (Docker required) and apply schema + Cape Town seed
supabase start
supabase db reset            # runs supabase/migrations/0001_init.sql + supabase/seed.sql

# 3. env
cp .env.example .env         # fill in Supabase + Paystack keys

# 4. run
npm run dev                  # http://localhost:3000
```

> PWA service worker is disabled in dev and enabled automatically in `next build`.

## Layout
```
supabase/
  migrations/0001_init.sql   # full schema: profiles, subscriptions, tokens(+ledger),
                             # locations, matches, match_players, referrals, match_votes,
                             # leaderboard view, is_premium(), activation trigger, RLS
  seed.sql                   # popular Cape Town 5-a-side venues
src/
  app/(marketing)/page.tsx   # landing page  ✅ Phase 1 started
  lib/supabase/              # browser + server + service-role clients
  lib/geo.ts                 # haversine geofence math
  lib/entitlements.ts        # isPremium() gate (mirrors SQL)
```

## Roadmap
- [x] **Phase 0** — scaffold, schema migration, Cape Town venue seed
- [~] **Phase 1** — landing page + public profile/invite surfaces
- [ ] **Phase 2** — profile, Paystack subscription, token wallet, referrals
- [ ] **Phase 3** — Player ⇄ Organizer dashboard switcher
- [ ] **Phase 4** — match-creation engine (venue picker + join settings)
- [ ] **Phase 5** — join/cancel + token commit/forfeit + team split
- [ ] **Phase 6** — dual-layer attendance verification (GPS + 4-digit code)
- [ ] **Phase 7** — WhatsApp viral invite engine
- [ ] **Phase 8** — realtime, offline polish, Cape Town launch
```
