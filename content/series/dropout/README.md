# Series: The 17:00 Dropout

Funny, relatable shorts about the moment every organiser knows: it's 17:00, kickoff is 18:30, and the excuses start.
One episode a week, the **A** side of the weekly A/B test (the **B** side is a cinematic film in `../../cinematic/`).

- **Format:** machine-narrator short (`type: "short"`), 12–16 s, chat screens + real app screens + sound design. No AI people, so nothing for Zoran to generate.
- **Hook:** frame 1 is the episode title with a notification sound. The first excuse arrives inside 1.5 s.
- **Loop:** each episode ends on a teaser for the next ("Next week: …"), which pulls follows and replays.
- **Rules:** README §3 in `../../cinematic/` (Islamic principles, honesty, no music). The excuses are gentle and silly, never mean, and never about anyone real.
- **Build:** in `content/studio/`:

  ```bash
  npm run voice series/dropout -- --only 01
  ```

  ```bash
  npm run render:week series/dropout -- --only 01
  ```

  When an episode is approved for a week, copy its folder into that week's `posts/` with the right NN and Day line, then run `npm run queue <week>`.

## Episode ideas
1. **The Excuses** (built): four excuses in four minutes, one link, four strangers in.
2. **The Ringer:** "my cousin's coming, he played semi-pro" → he never shows. One link fills the spot anyway.
3. **The Cash Chase:** chasing R60 from four people for a week ("building now": who's-paid list).
4. **The 11th Man:** eleven say yes to a five-a-side. The waiting list moves up when someone drops out.
5. **The Rain Check:** a light drizzle, and suddenly everyone's "sick".
