# Spec: men-only and women-only games

Status: draft, not built. Written 2026-11-22.
Scope: product spec only. No code, no migrations, nothing applied to production.

## The idea in one paragraph

Every game on 5sFindr is either **men only** or **women only**. There are no mixed games.
Men are the main audience and nothing changes for them. Women get games organised by
women and closed to men: men can't join, see the roster, or even find the game. This fits
Zoran's aim (no free mixing, a wholesome way for women to play) and gives 5sFindr
something the WhatsApp poll can't do. We never ask anyone about religion.

> Conflicts with earlier plans: `PRODUCT-BRIEF.md` (S4.5 game labels) and `GROWTH-STRATEGY.md`
> list a **"mixed"** game label. This spec drops it. Update those lines if this is approved.

## 1. How a game is marked

- New field on every game: **Audience: Men only / Women only**.
- The organiser picks it when posting a game. The choice is required and can't be skipped.
- **It equals the organiser's own audience**: a man posts a men-only game, a woman posts a
  women-only game. In v1 that's the only option (see decision 3).
- **Locked once anyone else has joined.** Before that the organiser can change it. After
  that, the only way to change it is to cancel and post a new game.
- Shown everywhere the game appears: a badge on the feed card, the game page, the invite
  page and the WhatsApp share text.
- Games that already exist (pre-launch test games) become **Men only**.

## 2. Who can see and join

| | Men-only game | Women-only game |
|---|---|---|
| Logged-out visitor | Sees it (feed, game page, roster) | **Doesn't see it.** Not in the feed. The invite link shows a short "women only" page (see 4) |
| Signed-in man | Sees and joins | **Doesn't see it** |
| Signed-in woman | Can see it (hidden from her feed by default), **can't join** | Sees and joins |
| Organiser | Full view | Full view |

Rules:
- **Joining** checks one thing: the player's answer on their profile (section 3) must match
  the game's audience. Otherwise: "This game is for women only."
- **Women-only rosters** (names, photos) are visible only to signed-in women and the
  organiser. Everyone else sees nothing, not even a count.
- **Women-only games always need approval for new faces.** "Instant" join is turned off for
  players the organiser hasn't played with before. Regulars can still be instant. This is
  our main real-world check (see below).
- Leaderboard, Man-of-the-Match and region pings are behind flags at launch. If any come
  back, they must follow the same rules (women's names and games never shown to men).

### How it's checked without collecting religion (or ID)

We check **what the player says about themselves**, plus checks by people. We don't check
documents.
1. **The player chooses** Men's games or Women's games once. They can't flip it themselves
   later. Changing it means emailing 5sFindr, which stops someone switching to look around
   and switching back.
2. **The woman organiser approves every new player** for her game, and can remove anyone.
3. **Anyone can report** a player who shouldn't be in a game (section 5). Confirmed cases
   are banned.
4. **No religion question, anywhere.** Not on the waitlist, not on the profile, not as a game
   label. There's no "Muslim game" or "sisters' game" tag, because joining one would reveal
   a player's religion, which POPIA treats as special personal information. Rules that
   matter to players (e.g. "modest dress", "indoor venue, no spectators") go in the game
   description, written by the organiser. They describe the game, not the player.
5. **No ID or selfie checks** in v1. They cost money, are often biometric (also special
   personal information), and would put most women off before their first game.

Be honest about the limit: a man who lies can create an account. He still can't get into a
women's game without the organiser letting him in, and if he tries he'll be reported and
banned.

## 3. What the profile needs

- New profile field: **"Which games do you play in?" → Men's games / Women's games.** The
  player picks it themselves. There's no "other" or "prefer not to say", because every game
  is one or the other.
- Asked **when it's first needed**: when the player joins or posts their first game.
  Existing accounts are asked once, the next time they try to join. In the quick "I'm in"
  sign-in (first name + WhatsApp + POPIA tick), it's one more tap.
- **Private.** It isn't on the public profile page, and other people can't look it up.
  (Being on a women-only roster shows it to the other women in that game, and that's the
  point.)
- Waitlist signups who answered get the answer copied into their profile at launch.

### Waitlist wording (new required question)

> **Which games do you want?**
> ( ) Men's games  ( ) Women's games
> *Every 5sFindr game is men only or women only. We use this only to show you the right
> games. It's never shown on your profile.*

The existing "Save my details" consent box already covers storing it, so the consent text
doesn't change. The privacy policy does (below), so its effective date moves.

### Privacy policy additions (`/privacy`)

Under **What we collect**, add:
> - whether you play in men's games or women's games (you choose)

Under **Why we use it**, add:
> - to show you the right games and keep women's games for women only

New short section, **Men's and women's games**:
> Every game on 5sFindr is for men only or women only. We ask which one you play in so we
> can show you the right games. It isn't shown on your public profile. Other players in a
> game you join, and its organiser, will know that you joined a men's or a women's game.
> We don't ask about your religion or beliefs, and you never need to tell us. To change your
> answer, email us.

Gender is ordinary personal information under POPIA (not "special"), so the existing
consent plus clear wording about why we ask is enough. Religion would be special, which is
why we never ask. (Not legal advice. Worth a quick check before launch.)

## 4. Invite links (`/m/<slug>`)

- **Men-only game:** works as it does today.
- **Women-only game, opened by a signed-in woman:** works as it does today.
- **Women-only game, opened by anyone else:** a short page that says only:
  > **This is a women-only game.** Sign in as a woman to see the details and join.
  > [I'm in] [Sign in]

  It shows no time, venue, organiser name or roster. It only confirms the link is real.
- **Signing up from that page** asks "Which games do you play in?" first, then continues to
  the game. Picking "Men's games" there ends with "This game is for women only" and a link
  to men's games nearby.
- **WhatsApp share text** for women-only games leaves out the venue and the exact time:
  "Women-only 5-a-side this Thursday in Claremont. Join: 5sfindr.com/m/…". That keeps the
  details out of forwarded messages.
- The link preview image for women-only games shows the badge only: no venue, no names.

## 5. Moderation and reporting

v1 is small on purpose: Zoran is the only moderator and there's no budget.

- **Report button** on every player in a roster and on every game page. Reasons:
  *Shouldn't be in this game* · *Harassment or rude* · *Inappropriate photo or name* ·
  *Unsafe behaviour* · *Something else* (+ optional note).
- Reports go to a private list only Zoran can read (Supabase dashboard). The nightly digest
  gets one line: "Reports today: N".
- **Organiser tools** (already planned): remove a player. New: removing a player from a
  women-only game with the reason "Shouldn't be here" also files a report.
- **Zoran's actions:** warn the player (email or WhatsApp), lock their answer, or ban them
  (they can't join or post games). A ban is a flag on the account. Nothing is deleted.
- **Women reviewing women's reports.** Reports about women-only games involve women's names
  and photos, so a trusted woman moderator should handle them (decision 4). Until then,
  Zoran handles them from the text alone, without opening photos.
- Rate limit: a few reports per person per day, to stop report spam.
- Later, not v1: blocking a user, appeals, a moderator screen in the app.

## 6. Honest marketing line

Use:
> **5sFindr: men's games and women's games, never mixed. Women-only games are run by women
> and closed to men.**

Short version for posts:
> **Women-only 5-a-side in Cape Town. Organised by women, closed to men.**

Don't say:
- "verified women only" or "100% safe": we don't check ID.
- "halal certified", or anything that sounds like a religious endorsement: nobody has
  certified it. If Zoran wants to talk about faith, he should say it as himself ("I built
  this so my sisters could play too"), not as a product claim.
- Don't show women players in posts aimed at the main (men's) audience. Content about women's
  games needs the women's clear permission and belongs on channels aimed at women.

## 7. Smallest first version

1. Profile answer: Men's / Women's games. Asked at the first join or post, private, changed
   by email only.
2. Audience on every game: picked when posting, equal to the organiser's own, locked after
   the first join. Existing games become men only.
3. Join check: the audience must match. New faces in women-only games need approval.
4. Visibility: women-only games, their rosters and their invite-link details are hidden from
   men and logged-out visitors. The feed shows your own audience's games by default.
5. Invite link: the short "women-only" page for everyone else, and share text without the
   venue or time.
6. Report button → private list → one line in the nightly digest. Ban flag.
7. Waitlist question + privacy policy update.

Not in v1: ID or selfie checks, blocking, a moderator screen, women-only profile pages,
hiding profile photos from men, venues or men organising women's games, mixed or family
games.

## 8. Supabase changes (described, not written)

The next free migration number is **0026** (0019–0021 are used by open PRs #1–#3). Roll out
the way 0023/0024 did: apply a backwards-compatible database change first, ship the app,
then remove the old paths.

**Profiles**
- New column `gender` (allowed: `man`, `woman`; empty until the player answers).
- **Not in the public column grant** from 0025, so nobody can read it through the API, not
  even the owner. The app gets the owner's own answer from a small `SECURITY DEFINER`
  function that returns only the caller's value.
- **Not in the update grant** either. It's set once through a function that only works while
  it's empty. Changing it later is a dashboard job for Zoran.
- New column `banned_at`, also not readable or writable by clients.
- A helper function, "the caller's audience" (`men` / `women` / none), for the policies
  below to use.

**Matches**
- New column `audience` (`men` / `women`), required. Existing rows backfilled to `men`.
- Insert policy: `audience` must equal the organiser's own audience, and the organiser isn't
  banned.
- A trigger blocks changing `audience` once anyone other than the organiser is on the roster.
- The read policy "live matches are public" becomes: live **and** (men only **or** the
  caller's audience is women). The organiser keeps their own read policy.
- `match_feed` view: add `audience`. The view is `security_invoker`, so it follows the new
  matches rule by itself.

**Roster (`match_players`) and joining**
- The read policy "roster is public for live matches" gets the same audience condition, so a
  women-only roster is readable only by women and the organiser.
- `join_match` (and the planned "I'm in" join for quick sign-ins) rejects with a new error,
  `WRONG_AUDIENCE`, when the audiences don't match, and with `BANNED` for banned players. In
  a women-only game, a player who hasn't played with this organiser before always gets
  "requested", even in instant mode.
- `manager_respond` re-checks the audience before accepting.

**Invite links**
- New `SECURITY DEFINER` function, "invite preview by slug", that returns only the audience
  and whether the game is open. `/m/<slug>` uses it to show the "women-only" page without
  exposing the game row.

**Other tables that could leak games or people**
- `match_pings` ("pings are public"): pings for women-only games become readable only by women
  and the organiser.
- `follows` stays public in v1, though it shows who follows whom across men and women.
  Revisit when the follow feature is switched on.
- `leaderboard` view: flagged off. If it's turned on, it must filter by the viewer's audience.

**Reports (new table)**
- Columns: reporter, reported player, game (optional), reason (fixed list), note, status,
  created at.
- RLS on, **no read policies**: only Zoran (dashboard or service role) reads reports. Clients
  file them only through a function that checks the reporter is signed in and applies the
  daily rate limit.

**Waitlist**
- New column `gender` (`man` / `woman`), empty for people who joined before the change.
- `join_waitlist` gets a new 15-argument signature (service-role only, like 0023) that takes
  the answer. The current 14-argument one becomes a wrapper until the new form is live, and
  is dropped after that.
- `waitlist_stats` gets a `women` count per area, to see where women-only games could start.
- `src/lib/waitlist.ts`: add the two options. `CONSENT_VERSION` stays the same (the consent
  text doesn't change). The privacy page's `EFFECTIVE_DATE` moves.

## Decisions for Zoran

1. **Should women-only games be completely invisible to men and logged-out visitors, or
   should they see a teaser like "Women-only game · Thursday · Claremont"?** (Invisible is
   safer. A teaser is better marketing.)
2. **Should the waitlist ask "Men's games / Women's games" now, or only once the app
   launches?** (Asking now shows where women's games could start, at the cost of one more
   question on the form.)
3. **Can a man ever organise a women-only game (for example a dad for his daughter's team,
   or a venue manager), or only women?** (v1 assumes only women.)
4. **Is there a woman you trust who could handle reports about women-only games?** (Then you
   don't have to look at women's photos or details.)
5. **Should women-only games launch on day one, or after the men's side is running?** (Day
   one is a stronger story. Later means fewer moving parts at launch.)
