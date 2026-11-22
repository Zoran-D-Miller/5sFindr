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
- [x] Migration **0027_free_join_guests** (not yet in prod): `app_config.tokens_enabled` (default false, keep in step
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
1. OK applying migration 0027 to prod (Claude applies it with the Supabase tool once you say so).
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

## Next session → S3 (organiser soft launch) in PRODUCT-BRIEF.md
Apply 0027 + the setup above first. Then S3: organiser signup path, open `/m/<slug>` to signed-out visitors under the
gate, fast "post a game", the WhatsApp list share message, paid-court "who's paid", admin counts.
Content runs alongside: each week, `/content-week` → Zoran reviews `REVIEW.md` → records → schedules.

## Working style
- The user starts a fresh session every couple of prompts. Keep this file current; don't re-derive context.
- Plan before acting; ask clarifying questions when a decision is genuinely the user's.
- The ECC plugin is installed. Its GateGuard hook asks for "facts" before the first Bash/Write of a session — just answer and retry.
