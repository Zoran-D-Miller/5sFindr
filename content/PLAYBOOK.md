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
- **IG Reels:** 4–5 a week, from the same shorts, cross-posted to FB Reels by Business Suite.
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

## Hooks (first 2 seconds)

The hook is on screen from frame 0, which also makes it the cover. Patterns that fit us:
- **Number + time + problem:** "SHORT 2 AT 17:00"
- **Callout:** "RUN A WEEKLY 5s IN CAPE TOWN?"
- **POV / identity:** "MOVED TO CAPE TOWN. KNOW NOBODY."
- **List promise:** "EVERY 5s GROUP CHAT HAS THESE 5"
- **Money pain:** "CHASING R60 AFTER EVERY GAME?"

Keep it to 2–4 words per line and 3 lines at most. One word in pitch green.

## Voice

- Zoran's own voice and Cape Town accent: local, warm, a bit cheeky. "Bru", "lekker", "now now" are welcome where natural.
- Say **"5sFindr" as "Fives Finder"** every time, and write "(said Fives Finder)" in captions while the name is new.
- Short sentences. Show, don't explain. One idea per post.

## Honesty rules (non-negotiable)

1. **No fake scarcity.** Only real mechanics: area unlocks (50 players + 3 weekly games), founding numbers (first 500), founding organiser spots. No "only 3 spots left!" unless it's a real game.
2. **No fake traction.** Never show made-up user numbers, area progress or testimonials. All areas are at 0 until real signups exist.
3. **Unbuilt features are labelled** "building now" / "coming soon". Today: guest join + "I'm in" (S2), who's paid + weekly repeat + organiser signup (S3), no-show tools (S4), progress board + founding numbers in the UI (S5).
4. **Players can't join games yet.** CTAs are "Join the list" / "Get early access" / "Run a game?", not "Download" or "Book now".
5. **Mocked screens are mocks.** Built from real components, fictional names, public venues. Real recordings come after S1.
6. **AI people are never presented as real users,** and AI shorts always carry a disclosure (see `cinematic/README.md`).
7. **No one else's footage** without permission (copyright strikes kill new accounts). Use Stitch/Duet or ask creators and credit them.
8. **Name the competition never**, in posts. Battlecards stay internal.

## Hashtags

- TikTok (3–5): `#capetown #5aside #capetownfootball #fivesfootball #5sfindr`
- IG (5–8): add `#capetownlife #football #newincapetown`; area tags such as `#seapoint #greenpoint #claremont #bellville` when the post is about that area.

## What we measure each week (write it at the bottom of next week's PLAN.md)

- Per post: views, average watch time / 3-second hold, shares, saves, comments, profile visits.
- Funnel: link-in-bio clicks → waitlist signups by role and area (Supabase `waitlist_stats`, `source` = utm_source). Use `?utm_source=tiktok` / `?utm_source=instagram` in the bio links.
- Organisers reached by DM, and organisers who said yes.
- Keep doing what beats the account median, and drop what doesn't. Reels that do well organically become the first Meta ads when there's budget.
