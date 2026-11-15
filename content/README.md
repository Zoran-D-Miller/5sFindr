# 5sFindr content engine

Free organic social is the growth engine until there's budget for ads (GROWTH-STRATEGY.md §7a, §11).
Claude makes the posts, Zoran approves them and adds his voice, and scheduling uses free native tools.
**Nothing here posts, schedules or creates accounts.** Zoran does all of that by hand.

```
content/
  README.md          ← this file: the weekly workflow
  PLAYBOOK.md        ← pillars, cadence, brand rules, hooks, honesty rules
  VOICE.md           ← how Zoran records voice lines (and the optional voice-cloning note)
  studio/            ← Remotion project: carousel + short + cinematic templates
  2026-W47/          ← one folder per ISO week
    PLAN.md          ← the week at a glance: calendar, stories, reply routine
    REVIEW.md        ← Zoran's ~30-minute review checklist
    vo-raw/          ← Zoran drops phone recordings here (03-hook.m4a …)
    vo/              ← converted voice lines (npm run vo makes these)
    posts/NN-slug/
      post.md        ← script, voice lines, captions, hashtags, alt text, notes
      props.json     ← the template input (edit text here, then re-render)
      slides/*.png   ← carousels (1080×1350)
      <id>.mp4 + cover.png ← shorts (1080×1920)
  cinematic/         ← AI cinematic shorts: generator choice, pipeline, 3 concepts + prompt packs
```

## The week (about 30 min of Zoran's time, plus 15 min a day)

| When | Who | What |
|---|---|---|
| Fri or Sat | Claude | Run **`/content-week`** in Claude Code. It plans 7–10 posts, writes `content/<YYYY-Www>/` and renders drafts (silent, with captions). |
| Sat (~30 min) | Zoran | Open `REVIEW.md` and go through it: look at each render, fix or cut anything untrue, tick the boxes. Record the voice lines on your phone (one file per line, names are in each `post.md`) and put them in `vo-raw/`. |
| Sat | Claude (or Zoran) | `npm run vo 2026-W47`, then `npm run render:week 2026-W47`. The videos now carry your voice, and each beat stretches to fit your line. |
| Sun (~20 min) | Zoran | Schedule (below). |
| Every day (~15 min) | Zoran | Replies, DMs and one or two stories. **Never automate replies or DMs.** |

### Commands (run in `content/studio/`)

```bash
npm install
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
npm run vo 2026-W47
```

```bash
npm run studio
```

- `--only 03` renders the posts whose folder starts with `03`.
- `--preview` renders the carousels plus one still per beat of each short. It takes about 1 minute instead of 10+, so use it for checking.
- `npm run studio` opens Remotion Studio to tweak templates live. Start it with `-- --public-dir ../2026-W47` to hear the voice lines.
- Rendering runs locally and costs nothing. The first run downloads Chrome Headless Shell (~100 MB) into `studio/node_modules`.

### Scheduling (free, native)

- **Instagram + Facebook:** Meta Business Suite → Planner → Create post / Create reel. Pick both IG and FB, upload the MP4 or the slides in order, then paste the caption, hashtags and alt text from `post.md`. Under Advanced settings: alt text, plus "AI info" only if the post contains AI-generated realistic content (the cinematic shorts do, the templates don't).
- **TikTok:** on desktop, tiktok.com/tiktokstudio/upload → Schedule (up to 10 days ahead). TikTok won't publish automatically for us without an app review, so this is the free route.
  Add a **trending sound** in the TikTok app at 5–10% volume under the voice line if the post isn't scheduled. Sounds can't be added to scheduled desktop uploads, which is fine.
- Cover: use `cover.png` (frame 0 = the hook).
- Times are in each `post.md` (SAST). Default: TikTok 18:00, IG Reels 18:30, carousels 12:30 on weekdays and 10:00 at weekends.

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

## How to add a template

Templates are React in `studio/src`. The input shapes live in `studio/src/types.ts`:

- Carousel slides: `cover`, `point`, `stat`, `list`, `compare`, `cta`.
- Short visuals: `type`, `phone` (screens `feed`, `invite`, `fill`, `chat`), `stat`, `list`, `clip`, `map`.

Wrap a word in `*asterisks*` to make it pitch green. Add a new kind in `types.ts`, render it in `Carousel.tsx` / `Short.tsx`, and document it here.
