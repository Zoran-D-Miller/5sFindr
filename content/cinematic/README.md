# AI cinematic shorts

Short, premium, almost secretive night-football films with characters using 5sFindr. They're "Open door, inner circle" in film form: mysterious about *where* and *who*, plain about *what* (the two-line rule). The best performer becomes the first Meta ad once there's budget and a live area (GROWTH-STRATEGY.md §11).

```
cinematic/
  README.md          ← this file: tool choice, pipeline, guardrails, labelling rules
  CHARACTERS.md      ← the 3 fictional characters (sheets + reference-image prompts)
  c1-coordinates/    ← concept 1: "Someone's short a player"   (curiosity gap, belonging)
  c2-numbered/       ← concept 2: "Numbered. Not for sale."   (founding numbers, after S5)
  c3-lights-on/      ← concept 3: "Lights on"                 (area unlocks; best ad candidate)
    CONCEPT.md       ← idea, psychology, storyboard + shot list, prompt pack, composite plan, VO
    props.json       ← the Remotion edit (shots, real-UI inserts/pins, titles, captions)
    clips/           ← generated clips go here: s01.mp4 … (git-ignored, back them up)
    vo-raw/ vo/      ← Zoran's voice lines (npm run vo cinematic/c1-coordinates)
    exports/         ← 9x16, 4x5, 1x1 MP4s
```

## 1. Which generator (checked 15 Nov 2026)

Posting to a brand account counts as **commercial use**, so a free tier that bans commercial use is out, however good it looks.

| Tool | Free tier now | Watermark on free | Commercial use on free | Character consistency | Verdict |
|---|---|---|---|---|---|
| **Google Flow (Veo 3.1)**, labs.google/flow | **50 Flow credits a day, no subscription** (Google Flow help: "Manage your Google Flow credits"). Reported as about 5 Veo 3.1 Lite clips a day | Yes, visible "Veo" watermark on free / Plus / Pro, plus invisible SynthID | Google doesn't claim ownership of outputs. Consumer terms allow commercial use (check Google's Generative AI terms when you sign up) | Reference images ("ingredients") and frames-to-video (start from your own character still) | **Primary.** Most free volume and best quality. The small watermark doubles as honest AI disclosure on organic posts. |
| **Runway**, runway.com | **125 credits, one-time** (help.runwayml.com "Free plan details") | Yes, on all free videos | **Yes**: "the content you create using Runway is yours to use without any non-commercial restrictions" (Runway help, Usage rights) | References / image-to-video | **Secondary.** Use the 125 credits on the 2–3 hardest shots. When budget allows, one month of Standard (~$12–15) re-renders the winning concept without watermarks for the Meta ad. |
| Adobe Firefly, firefly.adobe.com | "Limited free daily generations" for image and video (limit not published) | Content Credentials (metadata). Check the free export in your account for a visible mark | Adobe says Firefly-model outputs are commercially safe (partner models: your responsibility) | Image-to-video from a still | **Backup** for extra shots once Flow's daily credits are used. Stick to Adobe's own Firefly video model. |
| Kling | Small daily or monthly free credits | Yes | **No**, commercial rights are paid only | Strong | Not for us on the free tier |
| Pika | Free plan has 0 monthly credits | No | **No** commercial licence on Free/Starter | n/a | Not for us |
| Hailuo / PixVerse / Vidu | Free credits | Varies | Unclear or paid-only | n/a | Skip until terms are clear |

**None of these has a free API** that fits an R0 budget (Veo through the Gemini API is billed). **Zoran generates the clips in the web apps**, and Claude writes every prompt and does the rest. Your Intel MacBook can't run open video models such as Wan locally, so cloud tools only.

Recheck free tiers monthly: they change often. Save a screenshot of the plan or terms page on the day you generate each published clip.

## 2. Pipeline

```
concept → storyboard + shot list → character sheet → reference stills → per-shot prompts
→ generate (Flow / Runway) → pick takes → composite REAL UI → Remotion edit → exports
```

1. **Concept** (`CONCEPT.md`): one idea, one feeling, one honest claim. Check it against the guardrails below before generating anything.
2. **Storyboard + shot list:** 5–7 shots, 2–3 s each, 12–18 s total. Every concept has 1–2 **real-UI shots**.
3. **Character sheet** (`CHARACTERS.md`): fixed wardrobe "anchors" (the same jacket, laces and bib in every prompt) carry most of the consistency. Faces stay half-lit, from behind or in silhouette. That suits the secretive look and keeps faces off-centre, where AI drift shows most.
4. **Reference stills:** make one still per character (Flow's image tool, or Firefly image) from the sheet prompt. Then generate shots **from that still** (frames-to-video / reference / image-to-video), not text-only.
5. **Generate:** paste the shot prompt + the global style block. Make 2–3 takes per shot and keep the best. Name it `clips/s01.mp4` and so on. **Phones in AI shots never show UI:** the screen is face-down, turned away, or a plain glow.
6. **Composite real UI** (never AI-generated UI):
   - **Default: insert shot.** Cut to a macro of the real screen, rendered by Remotion from the app's real components (`"insert": {screen…}` in props.json) and graded to match the night look. It's the most honest and the most reliable.
   - **Corner pin** (when the phone screen is clearly visible and fairly steady in a clip): add `"pin": {"keys": [{"t": 0, "corners": [[x,y]×4]}, …], "screen": {…}}`. Get corners by exporting a frame (`npx remotion ffmpeg -ss 1 -i clips/s03.mp4 -frames:v 1 s03.png`) and asking Claude to read the four screen corners. Add a key every 0.5–1 s if the phone moves.
   - After S1, swap the mocked screens for **screen recordings from the demo Supabase project** (`clip` shots), and say so in the concept file.
7. **Remotion edit** (`props.json` → `Cinematic` composition): letterbox, film grain, teaser titles, burned-in captions, Zoran's VO, optional sound bed, the **plain line + AI disclosure chip on every frame**, and the brand end card.
8. **Exports:** in `content/studio/`, run:

   ```bash
   npm run render:week cinematic/c1-coordinates
   ```

   It writes `exports/<id>-9x16.mp4`, `-4x5.mp4` and `-1x1.mp4`. Pins and inserts are keyed once in 9:16 and reframe automatically.
9. **Keep the sources** for ads later: `clips/` (the original generations, not re-encoded), `props.json`, `vo/`, and a screenshot of each tool's terms on the day. Clips are git-ignored because they're large, so back them up to Google Drive (`5sfindr@gmail.com`).

## 3. Guardrails (all must hold before anything is posted)

- **AI characters are never presented as real users, members or testimonials.** No "Nia found her crew on 5sFindr". Characters are unnamed on screen, have no quotes, and captions talk about *you*, not *them*.
- **Disclosure on every AI short:** the on-screen chip "AI-generated scenes · real app screens" (built into the template), **plus** the platform label: Instagram/Facebook "AI info" (Advanced settings → AI label) and TikTok "AI-generated content".
- **Real UI only.** Product screens come from the app (mocked from real components, later screen recordings). If a generated clip shows any UI or text on a screen, don't use that take.
- **Real scarcity only:** area unlocks (50 players + 3 weekly games), founding numbers (once S5 makes them real), founding organiser spots. Never "only 3 spots left".
- **Two-line rule:** every teaser carries the plain line "Free 5-a-side games in Cape Town · 5sfindr.com". The template keeps it on screen the whole time.
- **No real people's likeness**, no celebrities, no club crests or kit brands, no recognisable private venues by name. Public places (Green Point, Sea Point) are fine as settings.
- **Don't use `z-seed profiles images/`** as references (they may be real people) unless Zoran confirms consent.
- **Voice:** Zoran's own voice by default. A cloned voice is AI audio and must be labelled (see `../VOICE.md`).

## 4. Meta's rule on photorealistic AI (checked 15 Nov 2026)

- **Ads (general, non-political):** Meta automatically applies an **"AI info"** label when an ad was made or edited with Meta's generative AI tools, or when it detects third-party AI signals (C2PA / IPTC metadata, invisible watermarks such as SynthID). The label usually sits under the ad's ⋯ → "About this ad". For **photorealistic AI-generated people** it can appear **next to the "Sponsored"/"Ad" label**. You'll see a notice during ad creation when a label will be applied. Self-disclosure is **mandatory** only for ads about social issues, elections or politics, which we're not.
  Sources: facebook.com/business/help/1010479435004531 ("About AI info on ads created or edited with generative AI tools"); Meta transparency update, Feb 2025; third-party AI detection rolled out June/July 2026.
- **Organic posts (Instagram/Facebook):** Meta asks people to label photorealistic video or realistic-sounding audio that was digitally created or altered, including with AI ("Label AI content on Instagram", help.instagram.com/761121959519495). Undisclosed realistic AI can get a more prominent label and reduced distribution.
- **TikTok:** creators must label AI-generated or significantly edited content showing realistic-looking scenes or people (Community Guidelines, integrity and authenticity). TikTok also auto-labels from C2PA. TikTok says the label doesn't reduce distribution for content that follows the guidelines.
- **What we do:** always label, on every platform, plus the on-screen chip. Expect the "AI info" label on the future ad. That's fine: the ad's honesty comes from the real UI and the plain line.
- **Before the first Meta ad** (separately): the Meta Pixel needs a POPIA cookie notice and a privacy-page update (GROWTH-STRATEGY.md §11).

## 5. Which concept first?

1. **c3 Lights on**: area-unlock teaser. It shows the product (the roster filling up) and the honest scarcity mechanic. It's the best Meta-ad candidate once an area is live.
2. **c1 Coordinates**: works today with no new product features. It's the most mysterious and the cheapest to generate (6 shots).
3. **c2 Numbered**: hold until S5 puts founding numbers in the product and Zoran confirms the 500 cap.

**Free-credit budget:** about 5 Flow clips a day plus 125 Runway credits once. A concept needs about 6 shots × 2–3 takes ≈ 15 clips, so about 3 days of Flow credits per concept. Generate in the evening, edit the next morning.
