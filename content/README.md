# 5sFindr content engine

Free organic social is the growth engine until there's budget for ads (GROWTH-STRATEGY.md §7a, §11).
**Claude makes → Zoran approves → auto-publish → Zoran taps Post on TikTok → Zoran replies by hand.**
Zoran never records: the shorts use a free local AI voice (Chatterbox, with Kokoro as the fallback: `VOICE.md`). Instagram and the Facebook Page post
from a free GitHub Action. TikTok gets drafts in the inbox, because unaudited apps can't post publicly.
**Nothing posts until Zoran has finished `AUTOPOST-SETUP.md` and says "approve <week>" in chat.**
Replies, comments and DMs are never automated.

```
content/
  README.md          ← this file: the weekly workflow
  AUTOPOST-SETUP.md  ← one-time setup: Supabase bucket, Meta app + Page token, TikTok app, GitHub secrets
  PLAYBOOK.md        ← pillars, cadence, brand rules, hooks, honesty rules
  VOICE.md           ← the AI voice (Chatterbox / Kokoro), the AI label rules, and recording your own lines (optional)
  voice.json         ← voice engine, voice, speed, pacing, robot narrator, sound bed, effects
  studio/            ← Remotion project: carousel + short + cinematic templates, voice/queue/approve scripts
  publisher/         ← publish.mjs (run by .github/workflows/content-publish.yml), connect.mjs (account set-up)
  2026-W47/          ← one folder per ISO week
    PLAN.md          ← the week at a glance: calendar, stories, reply routine
    REVIEW.md        ← Zoran's review checklist
    queue.json       ← what posts where and when (SAST); unapproved until Zoran approves
    vo/              ← voice lines (npm run voice makes these from props.json voText)
    posts/NN-slug/
      post.md        ← script, voice lines, captions, hashtags, alt text, notes
      props.json     ← the template input (edit text + voText here, then re-voice and re-render)
      slides/*.png   ← carousels (1080×1350)
      <id>.mp4 + cover.png ← shorts (1080×1920)
  cinematic/         ← AI cinematic shorts: generator choice, pipeline, 3 concepts + prompt packs
```

## The week (about 20 min of Zoran's time, plus ~1 min a day for TikTok and 15 min a day for replies)

| When | Who | What |
|---|---|---|
| Fri or Sat | Claude | **`/content-week`**: plans 10 posts, writes `content/<YYYY-Www>/`, voices the shorts (`npm run voice`), renders, writes `queue.json` (unapproved) and `REVIEW.md`. |
| Sat/Sun (~20 min) | Zoran | Watch the videos and slides (`REVIEW.md` lists the decisions only you can make). Then say **"approve W48"** in Claude Code, or "approve W48 except 05" / "except 07 on TikTok". |
| Right after | Claude | `npm run approve 2026-W48` (with `-- --exclude 05,07/tiktok` if needed): uploads the media, marks the queue approved, pushes it to the `content-queue` branch. |
| All week | GitHub Action | Every ~15 min: posts due Instagram + Facebook items, and drops each TikTok video in your TikTok inbox 30 min before its time, with the caption on the "Content publisher" GitHub issue. |
| Daily (~1 min) | Zoran | TikTok: open the draft, paste the caption, turn on "AI-generated content", optionally add a sound, then Post. |
| Daily (~15 min) | Zoran | Replies, DMs and one or two stories. **Never automated.** |

### Commands (run in `content/studio/`)

```bash
npm install
```

```bash
npm run voice:setup
```

```bash
npm run voice 2026-W47
```

```bash
npm run render:week 2026-W47
```

```bash
npm run render:week 2026-W47 -- --only 03
```

```bash
npm run render:week 2026-W47 -- --preview
```

```bash
npm run queue 2026-W47
```

```bash
npm run publish:dry -- --week 2026-W47 --now 2026-11-17T18:35+02:00
```

```bash
npm run approve 2026-W47 -- --exclude 05,07/tiktok
```

```bash
npm run studio
```

- `npm run voice:setup` is one-time: a Python venv with kokoro-onnx plus ~350 MB of model files. `npm run voice -- --samples` writes the same line in 9 voices to `content/voice-samples/` so you can pick one for `voice.json`.
- `npm run voice <week>` turns each short's `voText` lines into `vo/*.wav`. It only redoes lines whose text or voice changed (`--force` redoes all), then sets `"aiVoice": true`. Re-render afterwards: each beat stretches to fit its line.
- `--only 03` (voice and render) works on the posts whose folder starts with `03`. `--preview` renders the carousels plus one still per beat of each short, about 1 minute instead of 10+.
- `npm run queue <week>` (re)writes `queue.json` from each `post.md` ("Where and when (SAST)", captions, hashtags, alt text). It's always unapproved.
- `npm run publish:dry` prints what the publisher would post at `--now` (default: now), with no network calls. Unapproved weeks show as HELD.
- `npm run approve` is **only run when Zoran says "approve <week>" in chat**. `--dry-run --out-root <dir>` writes an approved copy elsewhere to test with, with no upload and no git.
- `npm run studio` opens Remotion Studio to tweak templates live. Start it with `-- --public-dir ../2026-W47` to hear the voice lines.
- Rendering runs locally and costs nothing. The first run downloads Chrome Headless Shell (~100 MB) into `studio/node_modules`.

### Posting (automatic after `AUTOPOST-SETUP.md`)

- **Instagram + Facebook Page:** posted by the GitHub Action at the times in `queue.json`. Reels go to IG and FB, and carousels go out as an IG carousel plus a FB multi-photo post, both with alt text. AI-voice posts get Meta's "AI info" label on IG (API flag), and a caption line plus on-screen chip everywhere.
- **TikTok:** the Action uploads the video to your **TikTok inbox** 30 min before the post time. You get a TikTok notification, plus a comment on the "Content publisher" GitHub issue with the caption. In the app: paste the caption, turn on "AI-generated content", add a trending sound at 5–10% if you like, then Post. Carousels stay off TikTok (photo mode is optional and manual).
- Cover: `cover.png` (frame 0 = the hook) becomes the IG Reel cover.
- Times come from each `post.md` (SAST). Default: TikTok 18:00, IG Reels 18:30, carousels 12:30 on weekdays and 10:00 at weekends.
- Results: `content/<week>/published.json` on the `content-queue` branch (status and link per item).
- **Manual fallback** (before setup, or if an API is blocked): Meta Business Suite → Planner for IG + FB (paste caption, hashtags, alt text; "AI info" on for AI-voice posts). TikTok: tiktok.com/tiktokstudio/upload → Schedule.

### Replies and stories (Zoran, ~15 min a day)

- Answer every comment in the **first hour** after a post. That's when the algorithms decide reach.
- "LINK" / "how do I join" comments get a manual DM with 5sfindr.com (and the organiser path for organisers).
- Stories: one a day, from the ideas in `PLAN.md` (polls, behind the scenes, area questions). Use your own phone footage and voice. Stories are where the "inner circle" feeling lives.
- Copy good questions and objections into GROWTH-STRATEGY.md. They're product research.

## Footage sources (say which in every post.md)

- **Product screens:** for now these are **mocked screens** in `studio/src/components/Phone.tsx`. They copy the real `MatchCard`, `/m/<slug>` invite page and `Avatar` markup, with fictional names and public venues from `supabase/seed.sql`. They show planned S2/S3 copy where noted. Once S1 sets up the demo Supabase project, swap in real screen recordings (`clip` visuals).
- **Stock:** Pexels/Pixabay only (free licences). Download into `<week>/clips/` and use `{"kind":"clip","src":"clips/x.mp4"}`.
- **People:** never use `z-seed profiles images/` (they may be real people) unless Zoran confirms consent.
- **AI video:** only in the cinematic pipeline (`cinematic/README.md`), always disclosed, never shown as real users.

## Licences

- Remotion is free for individuals and companies of up to 3 people (remotion.dev/license). Fine for 5sFindr now; recheck if the team grows.
- Fonts (Anton, Big Shoulders Stencil, IBM Plex Mono, Inter) are Google Fonts under the OFL. Free for commercial use.
- Kokoro-82M (model weights) and kokoro-onnx are Apache-2.0, and Chatterbox-Turbo is MIT: free for commercial use, no
  attribution needed in posts. faster-whisper (the line checker) is MIT; pedalboard (the polish step) is GPL-3.0 and only
  used as a tool.
- Posting stays on free tiers: GitHub Actions (public repo), Supabase Free Storage, and the Meta and TikTok APIs.

## How to add a template

Templates are React in `studio/src`. The input shapes live in `studio/src/types.ts`:

- Carousel slides: `cover`, `point`, `stat`, `list`, `compare`, `cta`.
- Short visuals: `type`, `phone` (screens `feed`, `invite`, `fill`, `chat`), `stat`, `list`, `clip`, `map`.

Wrap a word in `*asterisks*` to make it pitch green. Add a new kind in `types.ts`, render it in `Carousel.tsx` / `Short.tsx`, and document it here.
