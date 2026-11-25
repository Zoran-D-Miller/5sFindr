# 5sFindr — Session Handoff

> Start every new session with: **"Read LAUNCH-HANDOFF.md and PRODUCT-BRIEF.md, then do the next unchecked session."**
> Update this file at the end of each session (what got done + what's next).

## What it is
Next.js 14 PWA (Supabase + Paystack ZAR) for finding and filling 5-a-side games in Cape Town, social-first
(travellers, newcomers, making friends). Live on Vercel (`5s-findr`) with Supabase project `5sFindr`
(`ujhbbwptsaefpzangvwa`). All product decisions are in **`PRODUCT-BRIEF.md`**.

## Status (2026-10-11)
- Product review done; decisions locked: keep the codebase, hide features, free at launch, deposit only
  on paid courts, waitlist in Supabase, organizer early access, density-based launch gate.
- 0 real users. Prod contains 30 seed bots + 3 of the owner's test accounts.
- Nothing has been built since July 20 (`4aff981`).

## Update 2026-10-24 — waitlist shipped (part of S3)
- `/` on the Vercel app is now the waitlist (commit `e638705`): name, email, WhatsApp (stored E.164),
  neighbourhood, role, availability, referral link; separate POPIA consents (profile required; email and
  WhatsApp opt-ins unticked by default, stored with `consent_at` + `consent_version`).
- Supabase: `waitlist` table (RLS on, no public access), `join_waitlist()` RPC, `waitlist_stats` view
  (migrations 0017 + 0018, applied to prod). Read/export signups in the Supabase table editor.
- Domain: 5sfindr.com was on **Netlify DNS** (nameservers `dns*.p06.nsone.net`), serving the old Web3Forms
  page. 5sfindr.com + www are attached to the Vercel project; the switch needs the nameservers at Hostinger
  changed to `ns1.vercel-dns.com` / `ns2.vercel-dns.com`. Domain expires 2027-07-17 (not early 2027).
- After the switch: set Vercel `NEXT_PUBLIC_SITE_URL=https://5sfindr.com`, update Supabase Auth Site URL.
- Still open from S3: pre-launch flag hiding /signup, /login, /feed (they still show old Premium/R20 copy),
  admin counts page. Open task: lock down anon-callable SECURITY DEFINER functions (advisor warnings).

## Update 2026-11-01 — readiness check before social posting
- Live: 5sfindr.com on Vercel (DNS in Vercel), waitlist hardened (PR #5, migrations 0023 + 0024), no runtime errors
  in 7 days. Waitlist = 1 row (a test entry), so 0 real signups. `utm_source` is saved as `source`.
- Not ready for traffic yet: `/privacy` is 404 (PR #6 open, unmerged); no pre-launch gate, so `/feed`, `/leaderboard`,
  `/signup` and `/login` are public; `/feed` shows 10 upcoming seed-bot games (`seed-lifecycle` still runs nightly);
  no `og:image`, and the meta description still says "Tinder meets Strava"; Umami env var not set in Vercel;
  landing copy says "Every 5-a-side in Cape Town".
- All 30 bots have uploaded photos. `brag-output/brag-plan.md` says the seed photos are real people; not yet confirmed
  they're the same files.
- No signup has been logged since 0024, so test one real signup from a phone.
- PRs #1, #2, #3 are applied to prod but unmerged, so main is missing migrations 0019–0021.

## Update 2026-11-02 — pre-launch fixes live (PRs #6 + #7 merged)
- Live: pre-launch gate (`src/lib/flags.ts`, on unless `PRELAUNCH=false`), `public/og.png` + new metadata, landing copy,
  pinch-zoom allowed, `/privacy`. Umami is sending visits (ID set in Vercel, production only).
- Before posting: do a real signup on a phone, including the WhatsApp group link.
- With the gate on, new organizers can't create accounts (`/signup` redirects). Solve before organizer early access.
- 2026-11-09: seed bots removed from prod with `supabase/seed_remove.sql` (user approved). Left: 3 accounts (the user's),
  1 match, 6 venues, 144 ledger rows (user_id nulled), cron `settle-due-matches` only. Waitlist = 3 rows, all the user's tests.
- Still to do by hand: delete `seed-1.jpg` … `seed-30.jpg` from the Supabase `avatars` bucket (dashboard → Storage).
  Filming needs a separate demo project, seeded from `supabase/seed.sql`.

## Update 2026-11-14: strategy reset (no code changed)
- Competitor review in `GROWTH-STRATEGY.md`: Pitchd, FootyFinder and Cape Town Play5 are live in Cape Town.
  Pitchd has the Fives Futbol chain, including Maynard Mall.
- `PRODUCT-BRIEF.md` rewritten with the new decisions:
  - Free organiser tool + social layer, alongside paid courts.
  - Soft launch to organisers now, with each area unlocking at 50 players + 3 weekly games.
  - No R20 token at launch. Paid courts use pay-the-organiser + a "who's paid" checklist.
  - Guest join (Supabase anonymous sign-in) + Continue with Google.
  - The "Open door, inner circle" brand.
  - Online only and an R0 budget.
- Sessions re-ordered into S1–S7.

## Automation: what runs nightly (since 2026-11-15)
- **06:00 daily: scheduled task `5sfindr-waitlist-digest`** (Claude app → sidebar → Scheduled). It runs one read-only
  SELECT on Supabase `waitlist` and saves a Gmail **draft** in zoran.d.miller@gmail.com, To: 5sfindr@gmail.com. It never
  sends anything and never contacts anyone on the list. The draft holds counts, area unlock progress (50 players per
  launch area), source/utm, referrals (first names only) and one content hook. It excludes the founder's test rows
  (seq 7, 14, 15). It runs only while the Claude app is open, otherwise at the next launch.
  **To turn it off:** Scheduled → "5sFindr waitlist digest (06:00 draft)" → toggle off, or delete it. The prompt lives in
  `~/.claude/scheduled-tasks/5sfindr-waitlist-digest/SKILL.md`. Weekly games aren't counted yet; add them when S4 has games.

## Update 2026-11-15: battlecards + session order
- Battlecards: https://claude.ai/artifact/8RR9FmnuQRXcrvQD3dzYH5.
- Pitchd has had a Meta ad running since 2026-11-08 that uses our "new to Cape Town, meet players" angle.
- Meta ads are on hold until there's budget and an area with live games (`GROWTH-STRATEGY.md` §11).
- **Order (each one in its own new chat):**
  1. Content engine (social content made by Claude, Zoran approves, free scheduling, plus AI cinematic shorts).
  2. S1.
  3. S2, S3, and so on.

  Each chat starts by reading this file + `PRODUCT-BRIEF.md` + `GROWTH-STRATEGY.md`.
- AI cinematic shorts:
  - Characters shown using the app. Premium, exclusive, almost secretive tone (the "Open door, inner circle" look).
  - The best performer gets reused as a Meta ad later.
  - Rules:
    - Composite the real app UI onto phone screens. Never use AI-generated UI.
    - Never present AI characters as real users or testimonials.
    - No fake scarcity.
    - Teasers always carry a plain line saying it's free 5-a-side in Cape Town.

## Update 2026-11-15 (later): content engine built (nothing posted, nothing committed)
- **`content/`** is the weekly engine. Start with `content/README.md`. Also: `PLAYBOOK.md` (pillars, cadence, look, hooks,
  honesty rules) and `VOICE.md` (recording + `npm run vo`; Chatterbox and OpenVoice V2 are both MIT, so cloning is optional).
- **`content/studio/`** is a Remotion 4.0.539 project (pinned; free licence for ≤3 people). One toolchain for everything:
  - `Carousel`: 1080×1350 PNG stills (cover, point, stat, list, compare, cta).
  - `Short`: 1080×1920 MP4. Hook on screen from frame 0, burned-in captions, per-beat voice lines that stretch the beat,
    brand end card, TikTok/Reels safe zones.
  - `Cinematic`: AI clips + real-UI corner pin or insert. Exports 9:16, 4:5 and 1:1.
  - `npm run render:week <week>` (`--only NN`, `--preview`) and `npm run vo <week>`. Remotion bundles its own ffmpeg, so no install.
- **Product footage:** **mocked screens** (`studio/src/components/Phone.tsx`) copied from the real `MatchCard`, `/m/<slug>`
  and `Avatar` markup, with fictional names and seed venues. Local Supabase wasn't possible (no Docker on this Mac). Swap in
  screen recordings once S1 makes the demo project.
- **`/content-week`** (`.claude/commands/content-week.md`) plans, writes and renders the next week's 10 posts. The root
  `.gitignore` now tracks `.claude/commands/` (everything else in `.claude/` is still ignored).
- **Week 2026-W47 drafted:** `content/2026-W47/` has 7 shorts + 3 carousels, each with a script, voice lines, captions,
  hashtags and alt text. `PLAN.md` holds the calendar (TikTok 18:00 daily, Reels 18:30, carousels 12:30), daily story
  ideas and the reply routine. `REVIEW.md` is Zoran's checklist. Drafts render silent with captions until Zoran records.
  **Waiting on Zoran:** 09 (the 500 founding-numbers promise), the "founding perks free for your first year" wording,
  and slide 01 of 02 ("I'm in" is S2).
- **`content/cinematic/`:** generator research (15 Nov), pipeline, guardrails, Meta/TikTok AI-label rules,
  `CHARACTERS.md` (3 fictional characters) and 3 concepts with full prompt packs and ready edits:
  - c1 Coordinates: ready now.
  - c2 Numbered: only after S5 + Zoran's OK.
  - c3 Lights on: area unlock; the best ad candidate.
  Recommendation: **Google Flow / Veo** (50 free credits/day, visible watermark) as primary, **Runway** (125 one-time
  credits, commercial use allowed on free) as secondary. Kling and Pika free tiers don't allow commercial use.
  Zoran generates the clips in the web apps.
- Meta rule (checked 15 Nov): non-political ads get an automatic "AI info" label when AI is detected (photorealistic AI
  people can be labelled next to "Sponsored"). Self-disclosure is mandatory only for political/social-issue ads.
  Organic IG/FB and TikTok ask creators to label realistic AI. We always label + show an on-screen chip.

## Update 2026-11-16: content engine goes hands-off (AI voice + auto-publish; nothing live yet)
On branch `content-engine` (PR #9, not merged). Zoran chose **Kokoro AI voice** (no recording) and has IG Professional
linked to the FB Page.
- **New weekly loop:** `/content-week` makes the week (posts, `voText` → `npm run voice` → render → `npm run queue`,
  unapproved) → Zoran watches and says **"approve W48"** (optionally "except 05" / "07 not on TikTok") → Claude runs
  `npm run approve` (uploads to Supabase Storage bucket `content-media`, hash-approves `queue.json`, pushes it to the
  **`content-queue`** branch) → the GitHub Action `.github/workflows/content-publish.yml` (cron every 15 min) posts
  IG Reels/carousels + FB Page Reels/photos, and uploads TikTok videos to the **inbox as drafts** 30 min early with the
  caption on a GitHub issue → Zoran taps Post (~1 min/day) → replies/DMs stay manual.
- **AI voice:** Kokoro (Apache-2.0) via `kokoro-onnx` on CPU, voice `bm_george` (`content/voice.json`; samples via
  `npm run voice -- --samples`). Setup: `npm run voice:setup` (Python 3.12 venv + ~350 MB models, gitignored).
  AI label everywhere: on-screen AI VOICE chip, "AI voiceover." caption line, IG `is_ai_generated`, TikTok toggle in-app.
- **Fail-safes:** repo variable `CONTENT_PUBLISH_ENABLED=true` is the on switch (absent = dry runs only); only
  approved + hash-matching queues post; claim-before-post, no blind retries, >3 h late = skipped.
- **W47:** re-voiced and re-rendered; `content/2026-W47/queue.json` (25 items, unapproved). W47's dates are already
  passing, so it's a test week, not one to approve.
- **Waiting on Zoran:** `content/AUTOPOST-SETUP.md` (Supabase service key in `content/.env.local`; Meta app → Live +
  `connect.mjs meta`; TikTok app + Sandbox/review + `connect.mjs tiktok`; merge PR #9; set the switch). Possible
  blockers flagged there: Meta may ask for review before Live; TikTok wants a Terms URL (no `/terms` page yet).

## Update 2026-11-23: S1 essentials + S2 built (one PR, branch `claude/strange-ishizaka-c4807c`)
**S1**
- [x] Docs committed (this file, `PRODUCT-BRIEF.md`, `GROWTH-STRATEGY.md`).
- [x] PRs #1–3 reconciled: their three commits are cherry-picked, so `main` now has migrations 0019–0021 exactly as
  they run in prod (checked against prod's `supabase_migrations` list and the live functions/indexes on 2026-11-23).
  Nothing was re-run on prod. Close PRs #1–3 once this merges.
- [x] Umami funnel events (`src/lib/analytics.ts`): `waitlist_submit`, `browse` (feed; `who` = visitor/guest/member),
  `im_in` (`as` = guest/member), `post_game` (feed after `?posted=1`), `share` (`via` = whatsapp/copy/blast/waitlist_*).
  Create a funnel from them in Umami → Reports.
- [ ] **Deferred:** separate demo Supabase project for filming. Not on the critical path to S3; content keeps using
  the mocked screens. Pick it up when real screen recordings are needed.
- Open: decide what happens to `Waitlist/` and `z-seed profiles images/` (untracked in the main checkout).

**S2**
- [x] `src/lib/flags.ts`: `FEATURES.{premium,tokens,leaderboard,motm,shirts,roleSwitcher,gpsCheckIn}`, all off unless
  `NEXT_PUBLIC_FLAG_<NAME>=true` (set in Vercel + redeploy). Hidden: Premium gate/copy, tokens + `/wallet` (redirects to
  profile), `/leaderboard` (404) and the Ranks/Wallet tabs, MotM, shirt teams + "Lock match & assign teams", the role
  switcher (the feed is one page: "Post a game", "Your games", then all games), GPS + code check-in.
- [x] Migration **0027_free_join_guests** (applied to prod 2026-11-23 with Zoran's OK; verified functions, policies, grants; security advisor shows nothing new): `app_config.tokens_enabled` (default false, keep in step
  with `NEXT_PUBLIC_FLAG_TOKENS`); `join_match` needs no Premium and no token; posting a game / adding a venue needs any
  non-guest account; direct roster inserts closed (join via RPC only); `save_guest_details`; guests get a founding
  number only when they keep their profile; `set_attendance` (organiser ticks from kickoff until the game is closed).
  Settlement waits 24h after full time for anyone but the organiser; if nobody was ticked, the squad is credited, not
  marked no-shows. Late drop-out (<12h) still counts as a missed game.
- [x] Guest join (`GuestJoin.tsx`, `server/actions/guest.ts`): "I'm in" → first name + WhatsApp + POPIA tick
  (+ Turnstile when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set) → Supabase anonymous sign-in → on the roster.
  `/m/<slug>` now sends everyone to the game page to tap "I'm in" (no signup).
- [x] Keep profile (`KeepProfile.tsx`): Continue with Google (`linkIdentity`, same account) or "Email me a link"
  (`updateUser({ email })`). `/login` also has an email magic link (existing accounts only while PRELAUNCH is on) and
  Continue with Google (only shown when PRELAUNCH is off, because OAuth can't be limited to existing users).
  Callback: `/auth/callback`.
- [x] `supabase/tests/economy_test.sql`: the token scenarios 1–3 run with the tokens flag on; new 4–8 cover free join,
  guests, token-less cancels, organiser ticks and the 24h wait. `run-local.sh` now loads every migration (0026 skipped:
  needs pg_net/Vault). All pass locally (Postgres 15, no Docker).
- PRELAUNCH gate is still on: signed-out visitors and guests only reach the waitlist (guests also their game pages
  and `/auth/`), so none of this is visible in prod until S3 opens `/m/<slug>`.

**Zoran, before S3 (one-time setup, all free):**
1. ~~OK applying migration 0027 to prod~~ Done 2026-11-23.
2. Supabase → Authentication → Sign In / Providers: turn on **Allow anonymous sign-ins** and **Allow manual linking**.
3. Google: create an OAuth client in Google Cloud (Web; redirect URI `https://ujhbbwptsaefpzangvwa.supabase.co/auth/v1/callback`),
   then paste the client ID + secret into Supabase → Providers → Google.
4. Supabase → Authentication → URL Configuration: add `https://5sfindr.com/auth/callback` to the redirect URLs.
5. Cloudflare Turnstile (free): create a widget for 5sfindr.com, put the site key in Vercel as
   `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, and the secret in Supabase → Authentication → Attack Protection (CAPTCHA, Turnstile).
   Turn both on together: with CAPTCHA on and no site key, guest join fails.
6. Supabase's built-in email sender is rate-limited (a few emails an hour). Fine for testing; move magic links to
   Resend in S4.
- Not built (follow-ups): the organiser can't see guests' WhatsApp numbers in the app yet (`phone_number` stays
  private per 0025). The S3 "WhatsApp group list" share message is where that belongs.

## Update 2026-11-24: S3 built (organiser soft launch), branch `claude/s3-organiser-launch`
- [x] **Gate:** `/organise` ("Run a game? Post it here, free") is open under PRELAUNCH: Continue with Google or an email
  link creates the account (only this path can create accounts while the gate is on) and lands on "Post a game".
  `/m/<slug>` is open to everyone and is now the join page: the game, faces of who's in, spots left, and "I'm in"
  (guest join from S2). The landing page links to `/organise`. **The feed stays closed:** with PRELAUNCH on, `/feed`
  only shows games you run or are on, with a line explaining areas unlock at 50 players + 3 weekly games.
- [x] **Post in under 30s** (`MatchCreateForm`): venue picker has "Your fields" (fields you added before; same-name
  fields are reused, not duplicated) + popular venues; everything is filled in from your last game (same weekday and
  time, next week); "Repeat: just this one / weekly × 4 / weekly × 8" (games share `matches.series_id`); name, length
  and join rules sit under "More options"; "Anyone with the link" (instant) is the default. After posting you land on
  the game with the share box.
- [x] **WhatsApp share** (`buildGroupList`): `⚽ Thu 26 Nov, 19:00 · venue · R60 each` / `1. Zoran` / `2. Sam` /
  `8 spots left → link`. Old "first month free" copy is gone from all share text.
- [x] **Paid courts:** organiser adds "How players pay you" (SnapScan link / EFT details) when posting or on the game;
  only the organiser and people on that game's list can read it (`match_payment_info` + RLS). Players see
  "R60 each · Court booked by X, pay them directly", the reference (`5S-THU-SAM`) and "I've paid". The organiser gets
  "Who's paid (n/m)" with "says paid" players first and a tick per player. No money moves through 5sFindr.
- [x] **Link preview:** `/m/<slug>` has its own title/description and a 1200×630 image (faces, time, venue, price,
  "3 spots left" / "Full" / "Played").
- [x] **Admin:** `/admin` (only for emails in the `ADMIN_EMAILS` Vercel env var, else 404): waitlist / kept profiles /
  guests / organisers, unlock progress per launch area (waitlist players vs 50, games ±7 days vs 3), and a table by
  area and role. Counts only. Area mapping is `src/lib/areas.ts` (same as the 06:00 digest).
- **Migration 0028_organiser_launch** (`series_id`, `match_payment_info`, `paid_claimed_at` / `paid_confirmed_at`,
  `claim_paid`, `confirm_paid`): tested locally (scenario 9, all 10 scenarios pass). **Applied to prod 2026-11-24**
  with Zoran's OK and checked (columns, RLS, grants). Note: like the rest of a live game's roster, the paid
  timestamps are readable through the API by anyone with the link (not shown anywhere public); payment details are not.
- Checked in a local preview against prod data (read-only): `/m/<slug>` and `/organise` open signed-out, `/feed`
  still redirects to the waitlist, the preview image renders.

**Zoran, for S3:**
1. ~~OK applying 0028 to prod~~ Done 2026-11-24. Merge the S3 PR (#20).
2. Vercel → Settings → Environment Variables: `ADMIN_EMAILS` = your email (Production), then redeploy.
3. The S2 setup list above (anonymous sign-ins, manual linking, Google, redirect URL, Turnstile) is still needed for
   "I'm in" and Google to work. Until then, organisers can use the email link on `/organise`.

## Update 2026-11-24: S4 built (no-show tools), branch `claude/s4-no-show-tools-9b84f6`
- [x] **Email:** `src/server/email.ts` sends through Resend's HTTP API (batch, no SDK) from `hello@5sfindr.com`
  (`EMAIL_FROM` overrides). No `RESEND_API_KEY` → nothing is sent, so previews/dev can't email anyone. Free tier:
  100 emails/day, 3,000/month. Supabase's magic-link/auth emails move to Resend by **SMTP settings only** (no code).
- [x] **"Still coming?"** for accepted players (never the organiser's own Captain seat): a **24h** ask (only if they
  joined more than 24h before kickoff) and a **3h last call** (only if still unconfirmed). One confirmation is enough;
  joining or being accepted less than 3h before kickoff counts as confirmed. Players with an email get it by email
  (button → `/m/<slug>?c=<token>`, which confirms in the browser, so link scanners don't; works signed out). Everyone,
  guests with only WhatsApp included, sees a "Still coming? · Yes, I'm coming" card on the game page and `/m/` page
  for the 24h before kickoff.
- [x] **Auto-release:** still unconfirmed **90 min before kickoff** (and at least 45 min after the 3h last call went
  out, in case a cron run was late) → the spot is freed: status `cancelled_early` + `released_at`, a committed token
  is refunded (token-safe like `cancel_participation`; tokens are off anyway), a full game reopens. It is **not** a
  missed game. The organiser sees "Coming ✓ / Not confirmed" next to each player in the 24h window and "Freed (didn't
  confirm): Sam. Share the game again…"; the player sees why and can tap "I'm in" again if there's room.
- [x] **Show-up rate on profiles:** "Shows up 90%" (+ "Showed up 9 of 10 games") on your profile, the player drawer and
  join requests. It's `games_played / (played + missed)` (= `reliability_score`), fed by the organiser's ticks
  (`set_attendance`) and settled games; late drop-outs (<12h) count as missed, freed spots don't. No games → "New player".
- **Scheduling: pg_cron, not Vercel Cron.** Vercel's free plan only runs crons once a day, too coarse for 24h/3h/90-min
  windows; pg_cron is already in use (0008 settlement, 0026 publisher backup) and so are pg_net + Vault (0026). Job
  `no-show-checkins` runs every 10 min: `public.run_checkins()` does the asks and releases in SQL (works even if Vercel
  is down), then, only if an email is due, pings `https://5sfindr.com/api/cron/checkins` with the Vault secret
  `checkins_cron_secret`. That route (bearer `CHECKINS_CRON_SECRET`) claims up to 50 due emails and sends them in one
  Resend batch. Claimed = marked sent first, so nothing goes twice; a failed send isn't retried (the in-app card still
  asks). Kill switch: `select cron.unschedule('no-show-checkins');`
- **Migration 0029_no_show_tools** (`match_players.confirmed_at` / `released_at`; `match_checkins` holds the email
  tokens, no grants, because rosters are readable by anyone with the link; trigger resets the check-in whenever a seat
  becomes accepted; `confirm_spot`, `confirm_spot_by_token` (anon OK), `run_checkins`, `release_unconfirmed_spot`,
  `claim_checkin_emails` (service role only), `private.checkins_tick`). Backfill on apply: organisers' seats and seats
  on games in the next 24h count as confirmed, so nobody is freed by surprise. Tested locally: new scenario 10, all
  scenarios 1–10 pass. **Applied to prod 2026-11-24** with Zoran's OK and checked: columns, trigger, RLS on
  `match_checkins` (no grants), function grants (sweep/claim not callable by anon/authenticated), cron job
  `no-show-checkins` active every 10 min. The security advisor shows only the intended new items (`match_checkins` RLS
  with no policy, like `app_config`; `confirm_spot_by_token` callable signed out). No real email has been sent.

**Zoran, for S4 (one-time setup, all free):**
1. ~~OK applying migration 0029 to prod~~ Done 2026-11-24 (the cron job runs; with no Vault secret it only asks
   in-app and frees spots, no emails). Merge the S4 PR (#21).
2. Resend: sign up at resend.com (free plan) → Domains → Add `5sfindr.com` (region: any; EU/Ireland is closest).
3. Vercel → the 5sfindr.com domain → DNS records: add exactly the records Resend shows (an MX + TXT on the `send`
   subdomain for SPF, a TXT `resend._domainkey` for DKIM; optionally a TXT `_dmarc` = `v=DMARC1; p=none;`). Back in
   Resend, click Verify (usually a few minutes).
4. Resend → API Keys → create one with "Sending access" for 5sfindr.com. In Vercel → Settings → Environment Variables
   (Production): `RESEND_API_KEY` = that key. Optional: `EMAIL_FROM` (default `5sFindr <hello@5sfindr.com>`).
5. Make a long random secret (e.g. `openssl rand -hex 32`). Put it in Vercel as `CHECKINS_CRON_SECRET` (Production),
   and in Supabase → SQL editor: `select vault.create_secret('<the secret>', 'checkins_cron_secret');`
   Then redeploy in Vercel. (No secret = asks and releases still run, the app card still asks, but no emails go out.)
6. Supabase → Authentication → Emails → SMTP Settings → enable custom SMTP: host `smtp.resend.com`, port `465`,
   username `resend`, password = a Resend API key, sender `hello@5sfindr.com`, sender name `5sFindr`. Then raise the
   email rate limit under Authentication → Rate Limits (Resend free = 100/day across both uses).
7. Smoke test after deploy (sends a real email, so only when you're ready): join a test game with an account whose
   email you own, then in the SQL editor move that game to ~20h out and run `select public.run_checkins();` and
   `select private.checkins_tick();`.

## Update 2026-11-25: S5 built (unlock mechanics + landing), branch `claude/gifted-wozniak-3af1a7`
- [x] **Area progress board** (`src/server/areaProgress.ts` + `components/unlock/AreaBoard.tsx`): per launch area,
  players vs 50 and weekly games vs 3. Threshold stays in one place: `UNLOCK` in `src/lib/areas.ts`. Players = waitlist
  players who ticked the area + everyone on a game there (organisers too) not already counted (matched on WhatsApp
  number). Weekly games = games ±7 days, a weekly series counted once. Cached 5 min; a new signup refreshes it. Shown
  on the landing page, the soft-launch feed (your area highlighted) and your profile. `/admin` now uses the same
  numbers. Needs `SUPABASE_SERVICE_ROLE_KEY` (already in Vercel); without it the board is just hidden.
- [x] **Founding Member numbers, one per person:** waitlist signups now draw from the same sequence as profiles
  (existing waitlist rows numbered in signup order). An account / kept guest with the same **verified email** as a
  waitlist row takes that number (not the WhatsApp number: guests' numbers are unverified). Shown as
  "Founding Member #047" (≤1000; "Founding Baller" ≤100, as before) on the claim screen, your profile and the player
  drawer. The keep-profile card mentions it.
- [x] **Referrals that move your area:** profiles get an invite card (`/?ref=<their code>`, WhatsApp share, "3 mates
  have joined with your link"). The waitlist now accepts profile codes as well as waitlist codes
  (`waitlist.referred_by_profile`). A mate who claims a spot counts as a player in the areas they pick. The claim
  screen shows your home area's progress and asks you to invite mates.
- [x] **Landing page** ("Open door, inner circle"): condensed display type (Barlow Condensed, self-hosted by Next),
  monochrome + pitch green, coordinates as graphics. Product first: a 7-step tap-through "claim a spot" demo
  (labelled Example; only things the app does today), one main button ("Claim your spot"), a plain line under every
  teaser, the area board, then the form ("Claim my spot"). Umami event `demo` = reached the last demo step.
- **Migration 0030_unlock_founding** (`waitlist.founding_number` + backfill, `waitlist.referred_by_profile`,
  `private.founding_number_for`, `handle_new_user` / `handle_guest_upgraded` re-created with that one change,
  `join_waitlist` re-created with a `founding_number` result column (same args, service role only), `my_invites()`).
  Tested locally: new scenario 11, all scenarios 1–11 pass. **Applied to prod 2026-11-25** with Zoran's OK and
  checked: the 4 waitlist rows are numbered #094–#097 (profiles hold 1–93), both triggers use the waitlist lookup,
  `join_waitlist` is service-role only and returns `founding_number`, `my_invites` is callable signed in (not anon),
  `private.founding_number_for` is not callable by users. The security advisor's only new item is `my_invites`
  (signed-in, intended).
- Checked in a local preview (no Supabase env): landing page + demo (all 7 steps), board and invite card with sample
  data. Not checked against prod data.

**Zoran, for S5:**
1. ~~OK applying migration 0030 to prod~~ Done 2026-11-25. Merge the S5 PR (#22).
2. After deploy: open 5sfindr.com, check the board shows (all areas near 0/50 for now) and your profile shows your
   Founding Member number + invite link.

## Update 2026-11-25: S6 part 1 built (social stickiness boxes 1–3), branch `claude/s6-social-stickiness-8083fc`
- [x] **Game labels:** level (Beginner / Casual / Competitive), who it's for (Women's / Mixed) and 30+. Set when posting
  (pre-filled from your last game) or on the game ("Labels: … Edit", optionally for the later games in a weekly series).
  Shown on the game, the `/m/` invite + its link preview, feed cards and the WhatsApp group list. Labels only: nobody
  is checked at the door. `src/lib/labels.ts`.
- [x] **"First game in Cape Town":** a player on a game, before kickoff, who has never played a 5sFindr game sees
  "First game in Cape Town? Tag me" (game page + `/m/`). The tag shows next to their name on the list; the organiser
  sees "👋 First game in Cape Town: Sam. Say hi when they arrive." Playing a game clears it from later games.
- [x] **Played with + regulars:** after a game, everyone ticked as playing sees "You played with" with "+ Regular" per
  person; the profile has the full "Played with" list (games together). You can only add someone you were both ticked
  in an ended game with; your list is private (RLS, own rows only).
- [x] **Regular alerts:** when a regular joins (or is accepted into) a game you're not on, it shows as "Your regulars
  are playing" on `/feed` (guests: on their game page), with spots left → `/m/<slug>`. Email too, if the account has
  an email and "Email me when a regular joins…" (profile, default on) is on: sent ≥10 min after the first regular
  joined (so several are grouped), only if still unseen in the app, game ≥1h away with a spot, at most one per person
  per 12h. Sent by the existing 10-min cron: `private.checkins_tick` now also pings `/api/cron/checkins` when these are
  due, and the route sends both kinds in one Resend batch (≤50 + ≤50). Same Vault secret / env as S4, nothing new.
  The organiser's own Captain seat doesn't alert (posting isn't joining).
- [x] **Shareable cards** (`next/og`): `/api/card/game/<id>` = organiser's recap, 1080×1350 (players, new faces =
  first time in one of this organiser's games, first-game-in-Cape-Town count, labels, faces, "Run by Zoran on
  5sFindr"), completed games only, shown + "Share the recap" on the closed game. `/api/card/player/<slug>` = IG story
  card, 1080×1920 (name, Founding #, games, show-up %, played with). "Share your player card" on the profile. Share
  button uses the phone's share sheet with the PNG (straight to a story/WhatsApp), else a link to save it. Umami
  `share` with `via` = `recap_card` / `player_card`.
- Privacy page: added "When you play through the app" (games joined, the tag, regulars + alert emails).
- **Migration 0031_social_stickiness** (`matches.skill_tag/group_tag/over_30` + `match_feed` re-created with them;
  `match_players.first_game_ct`, `set_first_game_ct`, trigger `clear_first_game_ct`; `regulars` (select own only, no
  direct writes), `played_together`, `set_regular`, `my_played_with`; `user_settings` (own rows); `regular_alerts`
  (no grants), trigger `queue_regular_alerts`, views `private.live_regular_alerts` / `private.due_regular_alert_emails`,
  `my_regular_alerts`, `regular_alert_emails_due`, `claim_regular_alert_emails` (service role only),
  `private.checkins_tick` re-created; `game_recap` + `player_card` (anon OK, public data only)). Tested locally: new
  scenario 12, all scenarios 1–12 pass. **Not applied to prod yet.**
- Checked: `tsc`, `next build`, both card images rendered locally against a mock of the two RPCs. Game page, profile
  and feed changes not checked against real data (prod has no 0031 yet).

**Zoran, for S6 part 1:**
1. OK applying migration 0031 to prod (`ujhbbwptsaefpzangvwa`). Then merge the PR (deploys on merge).
2. After deploy: post a test game with labels, check the invite preview and WhatsApp text show them.

## Next session → S6 part 2 (The Drop + Sessions), then S7
The Drop (new games in an area released at a set time each week, with alerts) and Sessions (a secret-location game
run by an Area Captain, location revealed 24h before to those who claimed a spot; earned by showing up 3 times or
bringing a new player who shows up). Needs an Area Captain role. See GROWTH-STRATEGY.md §6a. Then S7 (launch kit) in
PRODUCT-BRIEF.md. Outreach to organisers (GROWTH-STRATEGY.md §12) runs alongside.

## Working style
- The user starts a fresh session every couple of prompts. Keep this file current; don't re-derive context.
- Plan before acting; ask clarifying questions when a decision is genuinely the user's.
- The ECC plugin is installed. Its GateGuard hook asks for "facts" before the first Bash/Write of a session — just answer and retry.
