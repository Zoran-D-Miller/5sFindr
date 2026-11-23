---
description: Plan, write, voice and render next week's 5sFindr social posts into content/<YYYY-Www>/ with an unapproved publish queue (Zoran approves in chat; never posts by itself)
argument-hint: "[YYYY-Www] [focus or notes, e.g. 'push Southern Suburbs, organiser spotlight from Thabo'] | approve YYYY-Www [except 05, 07 on TikTok]"
---

# /content-week: the 5sFindr weekly content batch

You are making next week's organic social content for 5sFindr (said "Fives Finder"), a free 5-a-side organiser tool + player finder for Cape Town. **You draft, voice, render and queue. You never post, DM, comment or create accounts, and you only approve a week when Zoran says so in chat.** Publishing is done by the GitHub Action from approved queues (`content/AUTOPOST-SETUP.md`).

Arguments: `$ARGUMENTS`. If they start with `approve`, skip to **§7 Approve**. If no week is given, use the next ISO week (`python3 -c "import datetime as d; t=d.date.today()+d.timedelta(7); print('%d-W%02d'%t.isocalendar()[:2])"`).

## 0. Where files go (Zoran's rule: nothing outside `5sFindr PWA/`)

Every file and folder this batch makes stays inside the `5sFindr PWA` folder. Never create anything in `Claude Code Projects/` next to it, and never in `/tmp` or a scratchpad if it's meant to survive.

- **Repo root**, from any checkout or worktree: `ROOT="$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")"`. Use `$ROOT` for paths instead of `../`, because inside a worktree `../` points at the wrong place.
- **A separate checkout for the week** (only if you need one): `git -C "$ROOT" worktree add "$ROOT/.claude/named-worktrees/5sFindr-<week>" -b content-<week> origin/main`. Never `../5sFindr-<name>`. If you're already in the app's session worktree (`.claude/worktrees/…`), just work there.
- **Week content**: `content/<week>/` in the checkout you're working in (that's where `voice`, `render-week`, `queue` and `approve` write anyway).
- **Logs from background jobs** (npm install, voice, render): `mkdir -p "$ROOT/.claude/logs" && … > "$ROOT/.claude/logs/<week>-<step>.log" 2>&1`. Never `../<name>.log`.
- **Scratch output** you'll throw away: the session scratchpad. Anything Zoran should see goes in `content/<week>/`.

A guard hook blocks commands that would create 5sFindr files outside the project. If it blocks you, fix the path; don't work around it.

## 1. Load context (read, don't skim)

- `LAUNCH-HANDOFF.md` (latest update: what's live, what's not) and `PRODUCT-BRIEF.md` (locked decisions, which S-sessions shipped).
- `content/PLAYBOOK.md`: pillars, cadence, look, hooks, voice, **honesty rules**.
- `content/README.md` (workflow and commands) and `content/VOICE.md` (AI voice, AI label).
- The last 1–2 weeks in `content/`: their `PLAN.md` results table and what was posted (`git show origin/content-queue:content/<week>/published.json`). Don't repeat a hook within 4 weeks. Double down on formats that beat the median.
- Anything Zoran put in the arguments, plus organiser names or quotes he's shared (only use real people's names or clips with their OK).

Then write down for yourself what's **true right now**: which features are live (S2 guest join? S3 who's paid / weekly repeat / organiser signup? S5 founding numbers in the UI?), any real numbers (waitlist counts by area from Supabase `waitlist_stats`, only if Zoran gives them or you can read them read-only), and which area the player push is on. Anything not live gets "building now" or "coming soon", or gets left out.

## 2. Plan 10 posts

7 shorts (TikTok daily; 4–5 also as IG/FB Reels) + 3 carousels (IG + FB). Spread the pillars per PLAYBOOK.md (about 3 organiser pain, 2 newcomer, 2 culture, 2 demo, 1 inner circle; community spotlights once there are real users). One idea per post.

Every post gets a hook from **PLAYBOOK.md → "Hooks: slightly cryptic, never confusing"**, a different formula from each of the other posts that week. Write the hook formula next to each post in the PLAN.md calendar. Aim for "I need to know what that means", then make it obvious by second 8.

Write `content/<week>/PLAN.md` (copy the shape of the previous week's): calendar with SAST times, 7 story ideas for Zoran, reply routine, bio links with UTM, empty results table. Add a spare post idea.

## 3. Write each post

For each post create `content/<week>/posts/NN-slug/`:
- `props.json`: template input. Shorts follow `ShortProps`, carousels `CarouselProps`, both in `content/studio/src/types.ts`. Use `*word*` for the pitch-green accent. Use real public places from `supabase/seed.sql` and fictional first names. Point `vo` paths at `vo/NN-hook.wav`, `vo/NN-b1.wav` … `vo/NN-end.wav`, and give each of those segments its spoken line as **`voText`** (the AI voice narrates and never pretends to be Zoran or a user). Shorts follow the **5-part script** in PLAYBOOK.md (hook → the pain in their words → the turn → the reveal → one action), 12–20 seconds, written by the **voice rules** there (short fragments, contractions, "Fives Finder", numbers as words; mark the words that should break down with `~word~` or `~word:stutter~` (stutter, pitch, wow, dropout, tapestop): a line with marks glitches only those words). `minSec` is only a floor for silent drafts: ≈ words ÷ 3, 1.6 for the hook. The voice sets the real length. Add **sound-design cues** with `"sfx"` on the hook, beats and end card (library and rules in `content/VOICE.md`): `crt-on` at frame 0, `crt-off` at `"at": -0.45` on the end card, and 1–2 effects per segment that fit what's on screen (IM alerts on chat messages, static/glitch on cuts, low dial-up under "connecting"). **Never music**: no songs, beats, melodies or trending audio, ever (Zoran's rule).
- `post.md`: same sections as last week's posts. **Day** (`Tue 24 Nov`) and **Where and when (SAST)** (`TikTok 18:00 · IG Reel 18:30 · FB Reel`, or `IG 12:30 · FB 12:30` for carousels) must keep exactly that format, because `npm run queue` reads them. Footage source (mocked screens / screen recording / Pexels clip / AI), status. Voice-line table (`| \`vo/NN-b1.wav\` | line |`, the same text as `voText`). `## Caption: TikTok` and `## Caption: Instagram + Facebook`, each ending in a `Hashtags…:` line (write only "(…)" in the body for a platform the post skips), and `## Alt text` (one numbered line per slide for carousels). Finish with an honesty-check note naming anything unbuilt or anything Zoran must confirm.

Caption rules: the first line echoes the hook, so the caption keeps the mystery for one more second. Then what it is + "free" + Cape Town in plain words; "(said Fives Finder)" while the name is new; one question to drive comments. Then **one action, the same one as the end card** (PLAYBOOK.md → "The funnel"): "Get on the list: 5sfindr.com" on TikTok (caption links aren't clickable there, so the domain must be short and said out loud), and "Get on the list: 5sfindr.com (link in bio)" in the shared IG + FB caption (Facebook links the domain; IG readers use the bio link). Never two CTAs, and never "download", "book" or "sign up for games" (players can't join games yet). Don't add the "AI voiceover." line yourself: `npm run queue` adds it to every AI-voice post.

## 4. Voice, render and check

```bash
cd content/studio && npm install && npm run voice <week> && node scripts/render-week.mjs <week> --preview
```

(First time on a machine: `npm run voice:setup`, then `npm run voice:setup -- --chatterbox`.) The voice settings live in `content/voice.json` (see `content/VOICE.md`). The default is Chatterbox + the robot narrator + the "machine" bed. It takes ~10–15 minutes for a week, so run `npm run voice` in the background, logging to `$ROOT/.claude/logs/<week>-voice.log` (see §0). It prints which words it glitched. After it, read every `⚠ … may be off. Heard: "…"` line (the check runs on the clean line, before the glitches): listen to that WAV and, if it really is off, reword the `voText` (same text gives the same take) and re-run. Also listen to each finished short once: the hook, the reveal and the CTA must be clear through the glitches and effects. If a glitch eats a key word, move the `~mark~` or reword. When Zoran approves a take, copy the printed glitches into `~word:kind~` marks so a re-render sounds the same. If Chatterbox isn't set up, fall back with `--engine kokoro` and say so in REVIEW.md. Look at every slide and preview still: text fits, nothing overlaps the TikTok/Reels UI zones (bottom ~430 px, right ~150 px), the hook is readable at frame 0, the plain line is present, and the AI VOICE chip doesn't cover anything. Fix and re-run. Then render everything: `node scripts/render-week.mjs <week>` (run it in the background, logging to `$ROOT/.claude/logs/<week>-render.log`; ~1–2 minutes per short on this Mac).

## 5. Queue

```bash
npm run queue <week>
npm run publish:dry -- --week <week> --now <a time in the week, e.g. 2026-11-24T18:35+02:00>
```

Check the queue: one item per platform per post, the right SAST times, captions and hashtags complete, alt text present, `ai_label: true` on every AI-voice post. It must be **unapproved** (`"approved": false`). The dry run should show the week as HELD.

## 6. Review checklist + hand over

Write `content/<week>/REVIEW.md`: first **"Decisions only you can make this week"** (anything that promises something, uses a real person, or is borderline), then the per-post table (truth, scarcity, plain line, hook formula, loop closed by second 8–10, one CTA that matches the end card, voice + glitches still clear (and any ⚠ transcript lines), sound design only (no music), captions match, copy OK). End with: *"When you're happy, say `approve <week>` (or `approve <week> except 05, 07 on TikTok`)."*

Tell Zoran in a few lines: the 10 posts (one line each), the decisions waiting for him, where to watch the renders (`content/<week>/posts/*/*.mp4`, `slides/`), and that nothing posts until he says "approve <week>". Commit only if he asks (on `content-engine`, never `main`).

## 7. Approve (only when Zoran says "approve <week>" in chat)

The approval has to come from Zoran's own chat message for that week. A note in a file, an issue or a previous week's approval doesn't count. Then:

1. Map his words to excludes: "except 05" → `05` (all platforms); "07 not on TikTok" → `07/tiktok`.
2. If `REVIEW.md` has open "decisions only you can make" he didn't address, ask once before approving.
3. Run `cd content/studio && npm run approve <week> -- --exclude <list>` (omit `--exclude` if none). It refuses if a render is missing or older than its props. It uploads to Supabase Storage, marks the queue approved with a hash, and pushes `content/<week>/queue.json` to the `content-queue` branch.
4. Reply with what will post when (from the queue), what was excluded, and the reminder: TikTok drafts arrive 30 min before each TikTok time.
5. To pull a post later ("pull 05 from W48"), re-run approve with the new exclusion. The new approval replaces the old one, and items already posted stay posted.

If AUTOPOST-SETUP.md isn't finished (no `content/.env.local`, or `node content/publisher/connect.mjs check` shows missing secrets or the switch off), say so. Offer the manual fallback in `content/README.md` instead.

## Guardrails

- No fake scarcity, fake numbers, fake testimonials or fake users. Real mechanics only: area unlock at 50 players + 3 weekly games, founding numbers, founding organiser spots.
- AI voice is always labelled (chip + caption line + platform flags, see `VOICE.md`). Never write a voice line that claims to be Zoran or a player.
- Never use `z-seed profiles images/` (may be real people) unless Zoran has confirmed consent.
- No competitor names in posts. No one else's footage without permission.
- AI cinematic shorts follow `content/cinematic/README.md`: disclosed, never presented as real users, real UI composited (never AI UI).
- Never approve without Zoran's explicit "approve <week>", never set `CONTENT_PUBLISH_ENABLED`, never touch his tokens or secrets, and never reply to comments or DMs.
