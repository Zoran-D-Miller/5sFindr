# 5sFindr — Product Brief & Launch Plan

> Source of truth for product decisions. Written 2026-10-11 (ECC product-lens review).
> **Updated 2026-11-14** after the competitor review. The reasoning and research are in `GROWTH-STRATEGY.md`.
> Supersedes the sequencing in `LAUNCH-HANDOFF.md` (Aug 2026).

## Verdict: keep the codebase, cut the fat
The core is built and live: posting a game, joining a game, WhatsApp invites, public browsing,
profiles and auth (Vercel `5s-findr` + Supabase `5sFindr`). The problem is surface area, not the
foundations. **Hide** the extras behind flags rather than deleting them, and don't restart.

## The product in one line
**Find or fill a 5-a-side game in Cape Town, and meet people who play.** Said "Fives Finder."

**Positioning:** a **free tool for people who already organise games** (it replaces the WhatsApp poll),
plus **free open-field games** and a **social layer** (regulars, newcomers, the people you played with).
We sit alongside paid courts and don't compete with them: a game on a court booked through Pitchd can
still be filled through 5sFindr. We're the people layer, not the booking layer.

For: organisers who are short of players, travellers and people new to Cape Town, people making
friends through football, and anyone who wants a quick game when their schedule allows.

## Competitors (detail in `GROWTH-STRATEGY.md` §2)
- **Pitchd**: court booking + paid pickup games (R75–R90). Has the Fives Futbol chain, including
  Maynard Mall, plus Tekkerz. Few open games.
- **FootyFinder**: runs R80 refereed games where you pick your position (5/7/11-a-side). Two venues.
  Its name sounds a lot like ours.
- **Cape Town Play5**: social games for travellers and expats (R150, Meetup). Same audience as us,
  so a likely partner.
- **Stranger Soccer**: international, recently opened in Durban, opens new cities through local
  partners. Could arrive in Cape Town.
- All of them charge per game and either run the game or sell the court. No one serves the existing
  organiser, free open fields, or the social side.

## Where things stand (2026-11-14)
- Live on 5sfindr.com: waitlist, pre-launch gate, `/privacy`, link preview image, Umami.
  Seed bots were removed from prod on 2026-11-09.
- **0 real users.** Waitlist = 3 rows, all of them Zoran's tests.
- Socials: TikTok `@5sfindr.com`, IG `@5sfindr.official`. About 0 followers, nothing to report yet.
- Zoran: works **online only** (can't travel for now), **R0 marketing budget**, about 5–7 hours a day,
  and is a member of 2–3 social 5-a-side WhatsApp groups.
- Code: sign-in is email + password only. `join_match` still requires Premium and a R20 token (S2 not
  started). PRs #1–3 are applied to prod but not merged, so `main` is missing migrations 0019–0021.

## Locked decisions
| Topic | Decision |
|---|---|
| Codebase | Keep it. Hide features behind flags. |
| Positioning | Free organiser tool + social layer, alongside paid courts. (2026-11-14) |
| Geography | Cape Town only. Three areas: **City Bowl + Atlantic Seaboard, Southern Suburbs, Northern Suburbs**. Organisers can join from any of them. Player campaigns push one area at a time. |
| Launch | **Soft launch to organisers now.** Each area opens to the public once it reaches an unlock threshold (starting at **50 players + 3 weekly games**, adjustable). Replaces the old "15 organisers + 300 players" gate. |
| Supply | Organisers recruited online, starting with the admins of the groups Zoran is in. **Area Captains** (partner organisers) handle anything in person. Zoran doesn't host. |
| Venues | Don't chase Fives Futbol (Pitchd has it). Later: open fields, schools, clubs, independent courts. |
| Pricing | **Free.** No subscription at launch. Founding members get free Premium for their first year. |
| Commitment / money | **No R20 token at launch.** On paid courts, players pay the organiser directly and the organiser ticks off who's paid (see below). In-app share payment comes later. |
| Sign-in | **Join without an account:** tap "I'm in", enter first name + WhatsApp number, done. Keep the profile later with one tap: Continue with Google. (2026-11-14) |
| Brand | **"Open door, inner circle":** underground look and rituals, but anyone can join a game. Extras are earned by showing up and bringing new players. (`GROWTH-STRATEGY.md` §6a) |
| Marketing | Free channels only. Remotion product videos + carousels, voiced by Zoran (own voice). |

## Money on paid courts and no-shows
In real life, the organiser books and pays for the court, and players pay their share
(court ÷ players) in cash or by EFT, before or after kick-off.

| | Open field (`open_area`) | Paid court (`official_court`) |
|---|---|---|
| Cost to player | Free | Court share shown up front ("R__ each") |
| How the player pays (v1) | n/a | Directly to the organiser. The game page shows the organiser's SnapScan/EFT details with an auto-made reference (e.g. `5S-THU-ZORAN`). The player taps "I've paid." |
| Organiser view | Roster + attendance | Roster + **"who's paid" checklist** (players who tapped "I've paid" listed first; organiser confirms) |
| Money through 5sFindr | None | None in v1 |
| **Later** | n/a | Pay your share in the app to reserve the spot (Paystack split payments to the organiser's bank, small fee = revenue). That payment *is* the commitment, so no separate token is needed. |

**Why no token:** making a player buy a R20 token from us before their first game is the biggest
barrier to joining. Competitors take one payment that covers the spot. We'd be asking for an extra
payment that doesn't. If a deposit ever comes back, forfeited money goes **to the organiser**, never to 5sFindr.

**Free no-show tools for every game:** a "still coming?" check at 24h and 3h, unconfirmed spots
released automatically to the waiting list, and each player's show-up rate on their profile.

## Sign-in: as little admin as possible
- **Players:** "I'm in" → first name + WhatsApp number + POPIA tick → on the roster. This uses Supabase
  **anonymous sign-in**, so the session stays on the phone.
- **After the first game:** "Keep your profile and your regulars?" → **Continue with Google** (one tap,
  links to the anonymous account). Email magic link as the fallback, sent through Resend's free tier.
- **Organisers:** Google or magic link from the start, because their games have to persist across devices.
- **Cost:** R0. No SMS or WhatsApp codes (those cost per message). Abuse controls: Cloudflare Turnstile
  (free, invisible), rate limits, the organiser can remove players, and show-up rates.
- Existing email + password accounts keep working.

## Keep vs hide
**Keep (core + social):** feed, match page, post game, join/leave, WhatsApp share + `/m/<slug>` invite
page, profiles, followers, public browsing.
**Hide behind flags:** subscription/Premium UI and the Premium gate, **R20 tokens and `/wallet`**,
leaderboard, Man-of-the-Match, shirt colours, Player⇄Organizer switcher, GPS + 4-digit check-in
(the organiser ticks attendance instead).

## Build plan: about one session each
**Already done:** waitlist on Supabase, pre-launch gate (`src/lib/flags.ts`), `/privacy`, link preview +
metadata, pinch-zoom, 5sfindr.com on Vercel, Umami visits, seed bots removed.

**S1 — Leftover clean-up**
- [ ] Commit `PRODUCT-BRIEF.md`, `LAUNCH-HANDOFF.md`, `GROWTH-STRATEGY.md`. Decide what happens to `Waitlist/` (old page) and `z-seed profiles images/` (move into the demo setup)
- [ ] Reconcile PRs #1–3 (migrations 0019–0021 are in prod but not in `main`)
- [ ] Separate **demo** Supabase project holding the seed data, for filming videos
- [ ] Umami funnel events: waitlist submit, browse, "I'm in", post game, share
- [ ] By hand (Zoran): delete `seed-1.jpg` … `seed-30.jpg` from the `avatars` bucket

**S2 — Cut the fat + join in 2 taps**
- [ ] Expand `src/lib/flags.ts` (premium, tokens, leaderboard, motm, shirts, role switcher, GPS check-in)
- [ ] Migration: `join_match` and match creation stop requiring Premium and a token (a token only when the tokens flag is on)
- [ ] Hide everything listed above. The organiser ticks attendance
- [ ] Guest join: Supabase anonymous sign-in + name + WhatsApp + POPIA consent + Turnstile
- [ ] Continue with Google + linking it to the anonymous account. Magic-link fallback
- [ ] Update `supabase/tests/economy_test.sql` for the new rules

**S3 — Organiser soft launch**
- [ ] Gate: organisers can sign up (an "I run a game" path). **Anyone with a game's `/m/<slug>` link
      can join that game.** The area feed stays closed until the area unlocks
- [ ] Post a game in under 30 seconds: saved venues, last game's settings filled in, **repeat weekly**
- [ ] One-tap WhatsApp share message laid out like a group list ("Thu 19:00 · venue · R60 each · 1. … 3 spots left → link")
- [ ] Paid courts: payment details + reference on the game page, "I've paid", and the organiser's "who's paid" checklist
- [ ] `/m/<slug>` preview shows spots left + players' faces
- [ ] Admin view: counts by area and role, plus unlock progress

**S4 — No-show tools**
- [ ] Email through Resend (free tier, from `hello@5sfindr.com`; DNS records in Vercel)
- [ ] "Still coming?" at 24h/3h, unconfirmed spots auto-released, show-up rate on profile

**S5 — Unlock mechanics + landing redesign**
- [ ] Area progress board ("Sea Point 38/50"), Founding Member numbers, referrals that move your area closer to unlocking
- [ ] Landing page in the "Open door, inner circle" style: product first, tap-through "claim a spot"
      demo (6–7 steps, best part first), one main button, plain line under every teaser

**S6 — Social stickiness**
- [ ] "Played with" after each game, alerts when your regulars join a game, a "first game in Cape Town" newcomer tag
- [ ] Game labels: skill (beginner / casual / competitive), women's, mixed, 30+
- [ ] Shareable images: game recap card for organisers, player card for IG stories
- [ ] The Drop (new games released at a set time each week) and Sessions (secret-location game, run by Area Captains)

**S7 — Launch kit**
- [ ] "Claim your profile" email (magic link, pre-filled from the waitlist) sent in batches through Resend
- [ ] WhatsApp community link. Area unlock announcements

**Running alongside every session (not a session):** product videos and carousels, 3–4 posts a week.

**Later (after launch):** in-app share payment through Paystack split payments (revenue), interest
matching ("Thursdays after 6, near Claremont"), venue partners, more cities, paid marketing.

## Marketing (online only, R0)
- **Organisers first:** start with the admins of the 2–3 groups Zoran is in, then Cape Town 5-a-side
  FB groups, r/capetown, IG football pages, varsity clubs, and a partnership pitch to Cape Town Play5.
  Pitch: "Your group, your slot, free. Never cancel a game for being 2 short."
- **Travellers and newcomers:** hostels and co-working spaces by email + a printable QR poster, and
  expat/nomad groups. (Running a Meetup group costs money, so use organisers who are already on Meetup.)
- **Content:** formats are listed in `GROWTH-STRATEGY.md` §7a. Voiceovers in **Zoran's own voice**: the Cape
  Town accent is an asset with a local audience. Cloning is optional, using a free local model (e.g.
  Chatterbox or OpenVoice; check the licence allows commercial use first). Captions on every video.
- **Handles:** TikTok is `@5sfindr.com` and IG is `@5sfindr.official`. Pick one and use it on both if it's available.
- **Remixing viral clips, carefully:** reposting other people's footage gets copyright strikes, and new
  accounts get suppressed or banned fast. Use free stock (Pexels/Pixabay), the platforms' own
  Stitch/Duet tools, or creators' permission with credit.
- **Parked until there's budget:** Meta ads test, paid creator shoutouts, paid voice plan.

## Metrics
- Pre-launch: waitlist signups by role and area, organisers who post a game, unlock progress per area.
- North star after launch: **spots filled by strangers per week.**
- Secondary: show-up rate, **organiser week-2 retention** (did they post again?), and invite link → "I'm in" conversion.

## Domain & email
- `5sfindr.com` expires **2027-07-17**. Registrar: Hostinger (turn on auto-renew there). **DNS is in
  Vercel** since 2026-10-27, so Resend's email records go in Vercel.
- Launch emails come from `hello@5sfindr.com` (needs domain verification in Resend).
- Brand inbox: `5sfindr@gmail.com`.

## Open items
- Unlock threshold per area: starting at 50 players + 3 weekly games. Adjust once real numbers come in.
- Supabase: turn on anonymous sign-ins and check the RLS rules for `is_anonymous` users (S2).
- Google sign-in needs an OAuth client in Google Cloud (free, Zoran sets it up) + Supabase provider config.
- Paystack live keys: only needed once in-app share payment is built.
