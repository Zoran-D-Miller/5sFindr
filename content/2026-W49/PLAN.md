# Week 2026-W49 (Thu 3 – Wed 9 Dec): plan stub

**Slot 01 is taken:** *The 17:00 Dropout* Ep 1 "The Excuses" (`posts/01-dropout-ep1-excuses`). Zoran approved its content on 22 Nov 2026. It goes out on **Thu 3 Dec**: TikTok 19:00, IG + FB Reel 19:30. This is the A side of the weekly A/B film test (see `../series/dropout/README.md`).

When `/content-week 2026-W49` runs:
- **Keep** this folder and its Day line. Plan the other posts around it (02–10), and don't reuse its hook.
- If Zoran's clips are in by then, put the **B side** (cinematic `../cinematic/c5-alone-to-crew`, 9x16 export) in a later slot, e.g. Sun 6 Dec. Otherwise leave it for W50.
- Rebuild this post's voice and video inside the week (the WAVs and MP4 are git-ignored):

  ```bash
  npm run voice 2026-W49 -- --only 01
  ```

  ```bash
  npm run render:week 2026-W49 -- --only 01
  ```

- Follow every rule in `../cinematic/README.md` §3 (Islamic principles), `../PLAYBOOK.md` and `../VOICE.md`.
