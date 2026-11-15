---
description: Plan, write and render next week's 5sFindr social posts into content/<YYYY-Www>/ (drafts for Zoran's review; never posts)
argument-hint: "[YYYY-Www] [focus or notes, e.g. 'push Southern Suburbs, organiser spotlight from Thabo']"
---

# /content-week: the 5sFindr weekly content batch

You are making next week's organic social content for 5sFindr (said "Fives Finder"), a free 5-a-side organiser tool + player finder for Cape Town. **You draft and render. You never post, schedule, DM, comment or create accounts.** Zoran reviews everything.

Arguments: `$ARGUMENTS`. If no week is given, use the next ISO week (`python3 -c "import datetime as d; t=d.date.today()+d.timedelta(7); print('%d-W%02d'%t.isocalendar()[:2])"`).

## 1. Load context (read, don't skim)

- `LAUNCH-HANDOFF.md` (latest update: what's live, what's not) and `PRODUCT-BRIEF.md` (locked decisions, which S-sessions shipped).
- `content/PLAYBOOK.md`: pillars, cadence, look, hooks, voice, **honesty rules**.
- `content/README.md`: workflow and commands.
- The last 1–2 weeks in `content/` (their `PLAN.md` results table, what was posted). Don't repeat a hook within 4 weeks. Double down on formats that beat the median.
- Anything Zoran put in the arguments, plus organiser names or quotes he's shared (only use real people's names or clips with their OK).

Then write down for yourself what's **true right now**: which features are live (S2 guest join? S3 who's paid / weekly repeat / organiser signup? S5 founding numbers in the UI?), any real numbers (waitlist counts by area from Supabase `waitlist_stats`, only if Zoran gives them or you can read them read-only), and which area the player push is on. Anything not live gets "building now" or "coming soon", or gets left out.

## 2. Plan 10 posts

7 shorts (TikTok daily; 4–5 also as IG/FB Reels) + 3 carousels (IG + FB). Spread the pillars per PLAYBOOK.md (about 3 organiser pain, 2 newcomer, 2 culture, 2 demo, 1 inner circle; community spotlights once there are real users). One idea per post. Hook in the first 2 seconds.

Write `content/<week>/PLAN.md` (copy the shape of the previous week's): calendar with SAST times, 7 story ideas for Zoran, reply routine, bio links with UTM, empty results table. Add a spare post idea.

## 3. Write each post

For each post create `content/<week>/posts/NN-slug/`:
- `props.json`: template input. Shorts follow `ShortProps`, carousels `CarouselProps`, both in `content/studio/src/types.ts`. Use `*word*` for the pitch-green accent. Use real public places from `supabase/seed.sql` and fictional first names. Point `vo` paths at `vo/NN-hook.wav`, `vo/NN-b1.wav` … `vo/NN-end.wav`. Size beats with `minSec` (≈ 2.5 words a second).
- `post.md`: same sections as last week's posts. Day, pillar, format, where and when, footage source (mocked screens / screen recording / Pexels clip / AI), status. Voice-line table (file → line, written to be *said* in Zoran's Cape Town voice). TikTok caption + hashtags, IG/FB caption + hashtags, alt text (per slide for carousels), and an honesty-check note naming anything unbuilt or anything Zoran must confirm.

Caption rules: what it is + "free" + Cape Town in plain words; "(said Fives Finder)" while the name is new; one question to drive comments; CTA "link in bio" (IG) or 5sfindr.com (TikTok).

## 4. Render and check

```bash
cd content/studio && npm install && node scripts/render-week.mjs <week> --preview
```

Look at every slide and preview still: text fits, nothing overlaps the TikTok/Reels UI zones (bottom ~430 px, right ~150 px), the hook is readable at frame 0, and the plain line is present. Fix and re-run. Then render the shorts: `node scripts/render-week.mjs <week>` (run it in the background; ~1–2 minutes per short on this Mac). Drafts are silent with captions until Zoran records.

## 5. Review checklist

Write `content/<week>/REVIEW.md`: first **"Decisions only you can make this week"** (anything that promises something, uses a real person, or is borderline), then the per-post table (truth, scarcity, plain line, hook, VO recorded, captions match, copy OK, scheduled), then the record → `npm run vo <week>` → re-render steps.

## 6. Hand over

Tell Zoran in a few lines: the 10 posts (one line each), the decisions waiting for him, how many voice lines to record, and the path to `REVIEW.md`. Stop there: no posting, no scheduling, no commits unless he asks (and then on a `content-engine` branch, not `main`).

## Guardrails

- No fake scarcity, fake numbers, fake testimonials or fake users. Real mechanics only: area unlock at 50 players + 3 weekly games, founding numbers, founding organiser spots.
- Never use `z-seed profiles images/` (may be real people) unless Zoran has confirmed consent.
- No competitor names in posts. No one else's footage without permission.
- AI cinematic shorts follow `content/cinematic/README.md`: disclosed, never presented as real users, real UI composited (never AI UI).
