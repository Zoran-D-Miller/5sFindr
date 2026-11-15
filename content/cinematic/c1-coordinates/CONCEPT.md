# C1 · "Coordinates": someone's short a player

**Runtime:** 15 s + 2.8 s end card · **Shots:** 6 (4 AI, 1 real-UI insert, 1 AI with a real-UI corner pin) · **Ready:** now (no unbuilt features)

## The idea

A phone lights up face-down in a dark room. Someone, somewhere, is short a player tonight. We follow a stranger through Cape Town at dusk to a floodlit pitch behind a fence, where nine people turn to look and one raises a hand. Only then do we learn where: a set of coordinates.

- **Curiosity gap:** what lit up the phone? Where is she going? The answer (coordinates, then the plain line) comes at the end.
- **Belonging:** the raised hand. You walk up alone, and you're expected.
- **Scarcity:** none claimed. The tension is "one spot, tonight", which is literally how a short game works.
- **Honest claim:** an organiser can share one link and a stranger nearby can claim the spot. That's how the app works today (the invite page and claim flow exist).

## Copy

- Titles (on screen): "SOMEONE'S SHORT A PLAYER." → "33.902° S, 18.409° E · WED 19:00"
- Plain line (on screen throughout): "Free 5-a-side games in Cape Town · 5sfindr.com"
- Disclosure chip: "AI-generated scenes · real app screens"

**Voice-over (Zoran, one file: `vo/c1-vo.wav`, about 13 s, unhurried, almost a whisper at first):**
> "Somewhere in Cape Town, someone's short a player tonight.
> One link. One spot.
> You don't need a squad. You just need to show up.
> Fives Finder."

## Shot list

| # | Sec | Framing | Action | Overlay | Composite |
|---|---|---|---|---|---|
| S01 | 2.2 | ECU, locked off | A phone lies face-down on a wooden table in a dark flat. It buzzes and a pitch-green glow spills out from under it. | Title: SOMEONE'S SHORT A PLAYER. | none (screen hidden) |
| S02 | 3.0 | Macro insert | The real invite page: "Thabo needs players · Green Point Urban Park · Wednesday 19:00". "Claim your spot" is pressed → "You're in ✓". | Caption: "One link. One spot." | **Real UI insert** (Remotion) |
| S03 | 2.5 | Medium, low angle from behind | NIA sits on apartment steps lacing boots (the green lace) at blue hour; Lion's Head silhouette, streetlights flicker on. | | none |
| S04 | 2.6 | Tracking, behind her | NIA walks along a chain-link fence; floodlights bloom through the mesh ahead; her phone in hand, screen towards camera, steady for the last second. | | **Corner pin**: real `fill` screen onto her phone (last ~1 s); or swap for another insert if the screen isn't clean |
| S05 | 2.4 | Wide, through the fence | Under the floodlights, nine silhouetted players warming up turn as she arrives; THE CAPTAIN raises a hand in welcome. LUCA is among them, also new. | Title: 33.902° S, 18.409° E · WED 19:00 | none |
| S06 | 2.3 | ECU | A ball rolls into frame across artificial grass and stops at her green-laced boot. | | none |

## Prompt pack (paste the shot prompt + the global style block from `../CHARACTERS.md`)

**S01**
> Extreme close-up, locked-off camera: a smartphone lying face-down on a worn wooden table in a dark apartment at night. The phone vibrates twice and a soft pitch-green glow spills out from underneath it onto the wood grain. Dust in the air, a sliver of cool streetlight through blinds. The phone screen is never visible.

**S03** (start from NIA's reference still)
> Low-angle medium shot from behind and slightly to the side: a woman in her mid-20s with dark brown skin and short black twists tied back, wearing an oversized dark olive half-zip windbreaker, black shorts and white crew socks, sits on concrete apartment steps lacing black football boots, one lace bright green. Blue hour in Cape Town, Lion's Head silhouetted against a deep blue sky, streetlights flicker on one by one. Her face stays in shadow.

**S04** (start from NIA's reference still)
> Tracking shot from behind at walking pace: the same woman in the dark olive windbreaker walks along a tall chain-link fence at night towards a floodlit five-a-side pitch; the floodlights bloom through the mesh and haze ahead of her. She holds a smartphone in her right hand at chest height with the screen facing the camera, the screen a plain soft white glow with no interface. In the final second she slows and the phone is steady.

**S05** (use LUCA's and THE CAPTAIN's stills as references if the tool allows several)
> Wide shot through a chain-link fence: an artificial-grass five-a-side pitch under cool white floodlights with haze. Nine players in silhouette warm up, passing a ball. As a figure enters frame left, they turn. A stocky man in a black hoodie under a plain bright green training bib, with a whistle on a black cord, raises one hand in welcome. A man in a black beanie and navy-and-white hooped shirt with no crest stands near him. Faces mostly in shadow, rim-lit.

**S06**
> Extreme close-up at grass level: a white football rolls slowly across artificial grass under floodlights and stops against a black football boot with a single bright green lace. Rubber crumb bounces in the light; shallow depth of field, the pitch blurred behind.

**Tools:** S01, S03 and S06 in Google Flow (free daily credits). S04 and S05 are the hardest (people + motion): try Flow first, and spend Runway's free credits only if Flow's takes drift.

## Edit

`props.json` is ready: shots without `clips/sNN.mp4` render as labelled placeholders, so the edit can be reviewed before generating. The S04 corner pin has placeholder corners; replace them after generating (README §2.6). Render all three aspect ratios in `content/studio/`:

```bash
npm run render:week cinematic/c1-coordinates
```

## Posting copy (when approved)

- **TikTok / Reels caption:** "Someone in Cape Town is short a player tonight. 5sFindr (said Fives Finder) shares one link, and anyone nearby can claim the spot. Free. AI-generated scenes, real app. 5sfindr.com"
- **Labels:** TikTok "AI-generated content" on; IG/FB "AI info" on.
- **Hashtags:** #capetown #5aside #capetownfootball #5sfindr
