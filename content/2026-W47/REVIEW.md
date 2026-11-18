# Review checklist: week 2026-W47 (Zoran, ~30 min)

**Moved:** the week now runs Thu 19 – Wed 25 Nov (3 days later, same order and times; see PLAN.md). Approve by Wed 18 Nov evening so post 02 can go out on Thu 19 at 12:30. Anything more than 3 h late is skipped, never posted late. Video 04 was re-rendered so its game list shows Sat 21 Nov.

Open each post folder, watch the MP4 (or flip through `slides/`), read `post.md`. Tick or fix.

## Decisions only you can make this week

- [x] **09 founding numbers:** NO, swapped for the spare (re-cut of 03). Was: OK to promise "500 founding numbers for Cape Town, given to people who join before their area opens"? The waitlist doesn't show numbers yet (S5). If not, use the spare in PLAN.md.
- [x] **05 + 09 wording:** YES, keep (05 only now). "founding perks free for your first year" (the founding free-Premium decision, without saying "Premium" while Premium is hidden). OK?
- [x] **02 slide 01** changed to "Players claim a spot from your link". Was: says players tap "I'm in" (S2 work). Keep it, or change it to "Players claim a spot from your link"?
- [x] **07** now also an IG + FB Reel. Was: TikTok only (building in public). Also post as a Reel?

## Every post

| Check | 01 | 02 | 03 | 04 | 05 | 06 | 07 | 08 | 09 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| Everything said is true today (unbuilt = "building"/"coming") | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| No fake scarcity or made-up numbers | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Plain line visible (free 5-a-side in Cape Town, 5sfindr.com) | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Hook readable on the cover / first second | ☐ | – | ☐ | ☐ | – | ☐ | ☐ | – | ☐ | ☐ |
| AI voice sounds right (pronunciation, pace) | ☐ | – | ☐ | ☐ | – | ☐ | ☐ | – | ☐ | ☐ |
| Burned-in captions match the voice | ☐ | – | ☐ | ☐ | – | ☐ | ☐ | – | ☐ | ☐ |
| Caption, hashtags, alt text OK (`queue.json`) | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |

The shorts are voiced by the Kokoro AI voice (`bm_george`) and carry the AI VOICE chip. Their captions end with
"AI voiceover." No recording needed. Watch 2–3 videos with sound on, and one muted (captions only).

## Approve

When you're happy, say **"approve 2026-W47"** in Claude Code (or "approve 2026-W47 except 09", or "07 not on
TikTok"). Nothing posts before that, and nothing posts at all until `content/AUTOPOST-SETUP.md` is done.
(W47's dates are already passing: treat this week as the test run, and approve W48.)

## Fixing text

Edit the on-screen text or a spoken line (`voText`) in that post's `props.json`, or the captions in `post.md`, then
(in `content/studio/`):

```bash
npm run voice 2026-W47 -- --only 04
```

```bash
npm run render:week 2026-W47 -- --only 04
```

```bash
npm run queue 2026-W47
```

Or ask Claude: "change 04's hook to …".
