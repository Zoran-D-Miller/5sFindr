# Review checklist: week 2026-W47 (Zoran, ~30 min)

Open each post folder, watch the MP4 (or flip through `slides/`), read `post.md`. Tick or fix.

## Decisions only you can make this week

- [ ] **09 founding numbers:** OK to promise "500 founding numbers for Cape Town, given to people who join before their area opens"? The waitlist doesn't show numbers yet (S5). If not, use the spare in PLAN.md.
- [ ] **05 + 09 wording:** "founding perks free for your first year" (the founding free-Premium decision, without saying "Premium" while Premium is hidden). OK?
- [ ] **02 slide 01** says players tap "I'm in" (S2 work). Keep it, or change it to "Players claim a spot from your link"?
- [ ] **07** is TikTok only (building in public). Also post as a Reel?

## Every post

| Check | 01 | 02 | 03 | 04 | 05 | 06 | 07 | 08 | 09 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| Everything said is true today (unbuilt = "building"/"coming") | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| No fake scarcity or made-up numbers | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Plain line visible (free 5-a-side in Cape Town, 5sfindr.com) | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Hook readable on the cover / first second | ☐ | – | ☐ | ☐ | – | ☐ | ☐ | – | ☐ | ☐ |
| Voice lines recorded → `vo-raw/` | ☐ | – | ☐ | ☐ | – | ☐ | ☐ | – | ☐ | ☐ |
| Captions match what you actually said | ☐ | – | ☐ | ☐ | – | ☐ | ☐ | – | ☐ | ☐ |
| Caption, hashtags, alt text OK | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Scheduled (TikTok / Business Suite) | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |

## After recording

```bash
npm run vo 2026-W47
```

```bash
npm run render:week 2026-W47
```

Run both in `content/studio/`. Then watch 2–3 videos with sound on, and one muted (captions only).

## Fixing text

Edit the text in that post's `props.json` (on-screen) or `post.md` (captions), then:

```bash
npm run render:week 2026-W47 -- --only 04
```

Or ask Claude: "change 04's hook to …".
