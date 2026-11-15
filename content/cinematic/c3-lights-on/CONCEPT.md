# C3 · "Lights on": an area unlocks

**Runtime:** 16 s + 2.8 s end card · **Shots:** 6 (4 AI, 1 real-UI insert, 1 AI with a real-UI corner pin) · **Ready:** now as a teaser ("unlocks at 50"). It becomes the **first Meta ad** once an area is actually live.

## The idea

An empty pitch in the dark. One bank of floodlights clunks on. A couple of people arrive. Another bank. More people. On a phone, the roster fills. All the lights blaze and the game kicks off. **Every light that comes on is more players joining.** That's the area-unlock mechanic in one image.

- **Real scarcity:** an area opens at 50 players + 3 weekly games. That's the actual rule (PRODUCT-BRIEF.md), so the film can say it. It never shows progress numbers we don't have.
- **Belonging:** strangers arriving one by one, turning a dark field into a game.
- **Curiosity gap:** why are the lights coming on? The answer: "your area unlocks at 50".
- **Ad logic:** this shows the product (the roster filling, real UI) *and* the brand feeling, and ends on one clear action. Once an area is live, swap the end line to "Southern Suburbs is open" (or whichever area is real) and point the ad at that area page (GROWTH-STRATEGY.md §11: never at the waitlist).

## Copy

- Titles: "IT STARTS DARK." → "EVERY PLAYER TURNS ONE ON." → "[AREA] UNLOCKS AT 50."
  - Use the area the player campaign is actually pushing (one at a time). Default: SOUTHERN SUBURBS.
- Plain line throughout: "Free 5-a-side games in Cape Town · 5sfindr.com"
- Disclosure chip: "AI-generated scenes · real app screens"

**Voice-over (`vo/c3-vo.wav`, about 14 s, builds with the lights):**
> "Every area starts dark.
> One player. Then two. Then a game.
> Fifty players and the lights come on for good.
> Southern Suburbs unlocks at fifty. Fives Finder."

## Shot list

| # | Sec | Framing | Action | Overlay | Composite |
|---|---|---|---|---|---|
| S01 | 2.6 | Wide, locked off | An empty, dark artificial-grass five-a-side pitch at night, fenced, with the mountain in silhouette against a navy sky; only a faint city glow. | Title: IT STARTS DARK. | none |
| S02 | 2.4 | Wide, same framing | With a clunk, one floodlight bank switches on (left side), haze glows; two figures (NIA, LUCA) walk in from opposite sides. | | none |
| S03 | 3.0 | Macro insert | Real UI: the roster fills 6/10 → 10/10, "GAME ON". | Caption: "One player. Then two. Then a game." | **Real UI insert** |
| S04 | 2.4 | Medium, handheld | THE CAPTAIN tips a mesh bag of footballs onto the pitch as a second floodlight bank flicks on behind him; more players jog in. | Title: EVERY PLAYER TURNS ONE ON. | none |
| S05 | 2.8 | Close, phone in foreground | Over NIA's shoulder: her phone (screen towards camera, steady) as all floodlights blaze on behind; players gather. | | **Corner pin**: real `feed` screen |
| S06 | 2.8 | Wide, high angle | Full lights, haze, ten players mid-game; a goal-mouth scramble, then the camera rises slowly. | Title: SOUTHERN SUBURBS UNLOCKS AT 50. | none |

## Prompt pack (plus the global style block in `../CHARACTERS.md`)

**S01**
> Wide locked-off shot at night: an empty fenced artificial-grass five-a-side pitch in darkness, unlit floodlight masts at the corners, Table Mountain in silhouette against a deep navy sky, faint orange city glow on the horizon, light mist hanging over the grass. Completely still, quiet.

**S02** (NIA + LUCA references)
> The same wide locked-off shot of the dark fenced five-a-side pitch: with a visible jolt, one bank of floodlights on the left mast switches on, light blooming through mist. Two figures walk onto the pitch from opposite sides: a woman in an oversized dark olive windbreaker with short black twists, and a man in a black beanie and a navy-and-white hooped shirt with no crest. Silhouettes, rim light.

**S04** (THE CAPTAIN reference)
> Medium handheld shot on an artificial-grass pitch at night: a stocky man in a black hoodie under a plain bright green training bib, whistle on a black cord, tips a mesh bag of white footballs onto the grass; behind him a second bank of floodlights flicks on, haze glowing; three more players jog in from the dark.

**S05** (NIA reference)
> Over-the-shoulder close shot: a woman in an oversized dark olive windbreaker holds a smartphone steady at chest height, screen facing the camera, the screen a plain soft white glow with no interface; behind her, out of focus, every floodlight on the pitch blazes on in sequence and players gather in the haze.

**S06**
> High-angle wide shot rising slowly: a fully floodlit five-a-side pitch at night, heavy haze, ten players mid-game in black and plain green bibs, a scramble in front of a small goal, the ball hits the net; Table Mountain silhouette behind the lights.

**Generation note:** S01 and S02 must share the same framing. In Flow, use S01's last frame as S02's first frame (frames-to-video). Locked-off shots are the easiest place for a clean corner pin, so if S05 drifts, re-frame it as a locked-off shot.

## Edit

`props.json` is ready. The S05 corner pin has placeholder corners; set the real ones from a frame of the generated clip (README §2.6). Change the area in the S06 title to the area being pushed. Render in `content/studio/`:

```bash
npm run render:week cinematic/c3-lights-on
```

## Posting copy

- Organic (now): "Every Cape Town area starts dark. Southern Suburbs unlocks at 50 players. Join the list and bring your mates: 5sfindr.com. 5sFindr (said Fives Finder), free 5-a-side. AI-generated scenes, real app."
- Ad (later, only with a live area and budget): headline "Southern Suburbs is open. Free 5-a-side near you", CTA "Learn more" → the area page. Expect Meta's "AI info" label. Measure cost per "I'm in".
