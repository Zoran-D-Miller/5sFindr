# Content playbook

The rules every week's posts follow. Source: GROWTH-STRATEGY.md §4, §6/§6a, §7a, §11 and PRODUCT-BRIEF.md.

## Who we're talking to (in this order)

1. **Organisers** who already run a weekly game and lose 2 players a week. Supply comes first: one organiser brings 10 players.
2. **People new to Cape Town** (travellers, expats, people who just moved, students) who want a game *and* friends.
3. **Cape Town 5s regulars**, who share and comment and make the culture posts travel.

## Pillars

| Pillar | Job | Formats that work | Share of the week |
|---|---|---|---|
| **Organiser pain** (WhatsApp chaos, chasing cash) | Organisers feel seen, then see the fix | "Every group chat has…", chat recreation, "chasing R60", carousel comparisons | 30% |
| **New to Cape Town / making friends** | Belonging: "come alone, leave with a crew" | POV shorts, first-game guides, save-and-send carousels | 20% |
| **Cape Town 5s culture** | Reach and shares; Zoran's accent does the work | "Things every CT 5s player says", venue culture, kit/bibs/after-game rituals | 20% |
| **Product demos** | Show the "oh, I get it" moment | "Short 2 at 17:00, watch it fill", one link → spots claimed, the feed | 20% |
| **The inner circle** | Real scarcity and rituals | Area unlocks (50 players + 3 weekly games), founding numbers, The Drop, Sessions (later) | 10% |
| **Community spotlights** (once there are users) | Social proof | Organiser spotlights from their own phone clips, game recaps | Starts after the first live area |

## Cadence

- **TikTok:** 1 a day (7 a week).
- **IG Reels:** 4–5 a week, from the same shorts, also posted as FB Page Reels by the publisher.
- **Carousels:** 2–3 a week (IG + FB; optionally TikTok photo mode).
- **Stories:** daily, made by Zoran on his phone.
- So a week = **7 shorts + 3 carousels = 10 posts**, with 2–3 being the same short on several platforms.

## The look ("Open door, inner circle", layer 1)

- Night football under floodlights, film grain, near-black (`#070A09`), pitch green (`#0AE98A`) as the **only** signal colour.
- Raw condensed type (Anton, always uppercase) for headlines, stencil numbers (Big Shoulders Stencil) for stats and founding numbers, mono (IBM Plex Mono) for coordinates and times.
- Coordinates and times as graphics: `33.902° S, 18.409° E · THU 19:00`. Use real public places from `supabase/seed.sql`.
- Avoid: black-and-gold luxury, "members only", velvet-rope language, stock smiles.

## The message (layer 2): the two-line rule

**Every teaser carries a plain line underneath saying what this is and that it's free.**
"Sea Point unlocks Friday." / "Free 5-a-side games in Cape Town. 5sfindr.com".
The templates do this automatically: the end card and every carousel footer carry the plain line. Captions also say it plainly.

## Hooks: slightly cryptic, never confusing

The first second decides the scroll. The hook is on screen from frame 0 (it's also the cover) **and** spoken in the
first ~1.5 seconds. No logo, no greeting, no "hey guys". It should make people think "wait, what?", then the post
answers that question by second 8–10. A stranger watching on mute must know what this is and that it's free by the
end card (the two-line rule above still holds).

Formulas (use a different one for each post in a week, and write it in PLAN.md):

| Formula | On screen (≤ 6 words) | First spoken line |
|---|---|---|
| **Cold detail:** a precise time, number or place, no context | "17:04. ONE MESSAGE." | "Five oh four p.m. One message. And Thursday's game is dead." |
| **Unfinished sentence:** the payoff is the rest of the post | "THE WORST TEXT IN CAPE TOWN 5s IS…" | "The worst text in Cape Town football is three words long." |
| **Number with a gap:** the number makes no sense yet | "38 PEOPLE. 0 REPLIES." | "Thirty-eight people in the group. Zero replies." |
| **Pattern break:** the opposite of what they expect | "STOP ADDING PEOPLE TO YOUR GROUP CHAT" | "Stop adding people to your group chat. Seriously." |
| **POV / identity:** they see themselves | "POV: YOU'RE THE ORGANISER AT 17:00" | "You're the organiser. It's five o'clock. Two just pulled out." |
| **Insider rule:** how the culture really works | "EVERY CAPE TOWN 5s HAS ONE RULE" | "Every five-a-side in Cape Town has one unwritten rule." |
| **Coordinates:** our look, as a riddle | "33.90° S, 18.41° E · THU 19:00" | "Thursday. Seven p.m. These coordinates." |

On screen: 2–4 words per line, 3 lines at most, one word in pitch green.

Cryptic must stay honest and simple:
- **Always pay it off.** A hook the video doesn't answer is clickbait: people feel tricked and the platforms bury it.
- **No fake secrets.** "Secret", "hidden" or "invite only" only when it's a real mechanic (an area unlock, Sessions).
- **One idea, small words.** If a 12-year-old wouldn't get it by the end, rewrite it.

## The 5-part short (12–20 seconds)

| Part | Job | Example (W48 01) |
|---|---|---|
| **1. Hook** (0–2 s) | Cryptic detail + stakes. Opens the loop. | "Five oh four p.m. One message. And Thursday's game is dead." |
| **2. The pain, in their words** | They recognise it. Local voice. | "Sorry bru, can't make it. Now you're two short. Again." |
| **3. The turn** | One surprising fact, number or question. A pattern break. | "So you beg the group chat. Thirty-eight people. Zero replies." |
| **4. The reveal** (by ~10 s) | What 5sFindr does, closing the loop. Honest tense ("building now"). | "What if one link filled that spot for you? We're building it. Cape Town first." |
| **5. One action** | The end card, said out loud. | "Fives Finder. Free for organisers. Get on the list at Fives Finder dot com." |

Keep the attention up the whole way:
- **Something changes every 2–3 seconds**: a new visual kind (type → phone → stat → phone), a number, a cut. Never two
  beats in a row with the same visual kind.
- **Tight read, no dead air:** the voice flows from line to line (`gapSec` 0.12). Silence is used on purpose, once at
  most (a "…" in a line), not between every line.
- **Loop-friendly endings** help re-watches: the last line can lead back into the hook ("…before five oh four.").

## Voice

- Voiceover is **the machine narrator** (`VOICE.md`): an AI voice that is openly a machine, robotic and glitching,
  breaking down mid-sentence now and then, like a transmission from an old terminal. It fits the cryptic, underground
  look, it stops the scroll, and nobody can mistake it for a person. The *words* still carry the Cape Town feel: local
  places, local slang where natural ("bru", "lekker", "now now"), dry and a bit cheeky. It reports, it doesn't sell:
  no hype-man energy.
- **Glitch on purpose, not everywhere.** The pipeline breaks about one word per line. Put a deliberate breakdown on
  the word with the most tension by wrapping it in tildes (`Two short. ~Again:tapestop~.`, `One message. ~And:pitch~`).
  A marked line glitches only its marked words, so an approved take stays exactly the same.
  Never on the brand, the site or the offer: those must be crystal clear.
- **Sound design, never music** (Zoran's rule): no songs, beats, melodies or scores, and no trending audio. Each short
  gets 1–2 effect cues per segment from the library in `VOICE.md` (CRT on at frame 0, IM alerts on chat messages,
  static and glitch bursts on cuts, dial-up under "connecting" moments, CRT off at the very end so it loops back to
  the start) over the "machine" room tone. Effects mark cuts and reveals. They never cover a word that matters.
- Write `voText` the way you'd say it to a mate:
  - Short lines, one breath each (≤ 12 words). Fragments are good: "Two short. Again."
  - Contractions ("you're", "can't"). Questions lift the voice; use one or two per post.
  - "…" gives a beat before a reveal. At most one "!" per post: it gets shouty fast.
  - "Fives Finder" for 5sFindr, "Fives Finder dot com" for the site, numbers and times as words ("five oh four p.m.",
    "sixty rand"). No emoji, symbols, ALL CAPS or sound tags like [laugh].
- After `npm run voice`, any `⚠ … Heard: "…"` line means the transcript check thinks a word came out wrong. Listen,
  and reword the line if it's really off.
- Write "(said Fives Finder)" in captions while the name is new.
- Zoran's real voice and face live in **stories** and replies, where the "inner circle" feeling comes from.

## The funnel: post → 5sfindr.com → on the list

Every post pushes **one** action, always the same: go to **5sfindr.com** and get on the list. The landing page opens
on the waitlist form, so there are no extra steps.
- **Same words everywhere:** the end card, the last spoken line and the caption all say "Get on the list ·
  5sfindr.com" (organiser posts: "Free for organisers · 5sfindr.com").
- **Per platform:** TikTok caption links aren't clickable, so the caption says "5sfindr.com" plainly (and the bio link
  carries `?utm_source=tiktok`). IG and FB share one caption, so it ends "Get on the list: 5sfindr.com (link in bio)":
  Facebook turns the domain into a link, and on IG people tap the bio link (`?utm_source=instagram`).
- **Say what happens, not what to do with the app:** "get on the list", "get in early". Never "download", "book now"
  or "sign up for games" while players can't join games yet.
- **One CTA only.** No "follow for more" plus "link in bio" plus "comment below". The comment question is engagement,
  not a second CTA.
- Zoran can pin a comment with "5sfindr.com: free, takes a minute" on TikTok and IG when posting (by hand).

## Honesty rules (non-negotiable)

1. **No fake scarcity.** Only real mechanics: area unlocks (50 players + 3 weekly games), founding numbers (first 500), founding organiser spots. No "only 3 spots left!" unless it's a real game.
2. **No fake traction.** Never show made-up user numbers, area progress or testimonials. All areas are at 0 until real signups exist.
3. **Unbuilt features are labelled** "building now" / "coming soon". Today: guest join + "I'm in" (S2), who's paid + weekly repeat + organiser signup (S3), no-show tools (S4), progress board + founding numbers in the UI (S5).
4. **Players can't join games yet.** CTAs are "Join the list" / "Get early access" / "Run a game?", not "Download" or "Book now".
5. **Mocked screens are mocks.** Built from real components, fictional names, public venues. Real recordings come after S1.
6. **AI people are never presented as real users,** and AI shorts always carry a disclosure (see `cinematic/README.md`).
7. **No one else's footage** without permission (copyright strikes kill new accounts). Use Stitch/Duet or ask creators and credit them.
8. **Name the competition never**, in posts. Battlecards stay internal.
9. **AI voice is labelled, always:** the on-screen AI VOICE chip, an "AI voiceover." caption line, Meta's AI info flag
   on Instagram, and TikTok's "AI-generated content" toggle when Zoran posts the draft. The AI voice never pretends to
   be Zoran or a user ("I'm Zoran…", testimonials): it narrates.
10. **Nothing posts without Zoran's approval** of that exact week (`approve <week>` → hash-checked `queue.json`).
    Replies, comments and DMs are always written by hand.

## Hashtags

- TikTok (3–5): `#capetown #5aside #capetownfootball #fivesfootball #5sfindr`
- IG (5–8): add `#capetownlife #football #newincapetown`; area tags such as `#seapoint #greenpoint #claremont #bellville` when the post is about that area.

## What we measure each week (write it at the bottom of next week's PLAN.md)

- Per post: views, average watch time / 3-second hold, shares, saves, comments, profile visits.
- Funnel: link-in-bio clicks → waitlist signups by role and area (Supabase `waitlist_stats`, `source` = utm_source). Use `?utm_source=tiktok` / `?utm_source=instagram` in the bio links.
- Organisers reached by DM, and organisers who said yes.
- Keep doing what beats the account median, and drop what doesn't. Reels that do well organically become the first Meta ads when there's budget.
