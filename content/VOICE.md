# Voice lines and sound: the machine narrator

**The house sound (since 21 Nov 2026): a deliberately robotic AI narrator that glitches and breaks down mid-sentence,
over early-2000s machine sound design.** Zoran's call: the free voices still sound robotic, so lean into it. It's
cryptic, it stops the scroll, and it can't be mistaken for a person. Zoran plans to record some posts in their own
voice later (see "Optional: your own voice" below); those skip all the robot processing.

**No music, ever:** no melodies, notes, beats or composed scores (Zoran's beliefs). Only sound design: synthesized
machine noise, field-recording-style textures, and the tones real hardware makes (a modem handshake, CRT whine, mains
hum). Don't add trending songs on TikTok/IG either; post with the original sound.

Each short's voice lines are generated on this Mac, free, with no account. There are two engines:

| `engine` | What it is | Sound | Time for a week (~40 lines, Intel i5) |
|---|---|---|---|
| **`chatterbox`** (default) | Chatterbox-Turbo, Resemble AI, 350M, **MIT** licence, run on the CPU with onnxruntime | Natural rhythm and emphasis | ~10–15 min (run it in the background) |
| `kokoro` (fallback) | Kokoro, 82M, **Apache-2.0**, via `kokoro-onnx` | Clean but flat | ~2 min |

Chatterbox copies the *sound* of a voice from a short reference clip. That clip is made with Kokoro's `voice`
(default **`bm_george`**, British male), so the timbre is a synthetic Apache-2.0 voice, never a real person's.

### Why the old voice sounded flat (21 Nov 2026)

1. **The model.** Kokoro reads every sentence with much the same falling tune. Punctuation (`!`, `?`, `…`) changes
   its pitch range by less than a semitone. Its `bm_george` voice is one of its weaker ones. Chatterbox moves about 40%
   more in pitch (≈17 vs 12 semitones) and pauses where a person would.
2. **Dead air.** Each line was its own clip, and the template added 0.35 s after it (plus the trimming pads), and
   `minSec` at 2.5 words/s often stretched beats further. About 14% of W47's running time was silence, so the read
   kept stopping and restarting. Now `gapSec` is 0.12 and `minSec` is only a floor (words ÷ 3).
3. **Speed and polish.** 1.05× is slow for a short. Chatterbox lines are sped up 1.12× without changing pitch, long
   hesitations are shortened, and a light EQ + compression chain adds presence.
4. **The script.** W47 lines were full sentences with a full stop after every fragment ("The maybe. The five o'clock
   drop-out."). The new rules in `PLAYBOOK.md` → Voice write for a quicker, conversational read.

The A/B samples (same script, 10 versions) are in `content/voice-samples/ab-2026-11-21/voice-ab.html`.

### Settings: `content/voice.json`

```json
{ "engine": "chatterbox", "voice": "bm_george", "lang": "en-gb", "speed": 1.12, "stretch": 1.12,
  "polish": true, "gapSec": 0.12, "robot": { "amount": 0.65, "glitch": 0.7 }, "bed": "machine", "sfx": true }
```

- `voice`: the Kokoro voice (Kokoro engine) or the timbre Chatterbox copies. Try `bm_fable` for a livelier British
  sound, `am_fenrir` for American.
- `speed` (Kokoro) / `stretch` (Chatterbox): how fast. 1.12 suits shorts.
- `polish`: shorter hesitations + EQ/compression. Leave it on.
- `gapSec`: pause after each line before the next beat.
- `robot`: the machine narrator (`null` = clean voice).
  - `amount` (0–1): how robotic. A light 50 Hz ring modulation (South Africa's mains frequency), a faint sub-octave
    double, a bit-crushed layer and a short metallic comb. 0.65 is clearly a machine but easy to follow. (The ring mod
    and sub-octave were turned down on 21 Nov after Zoran heard too much warble and rumble.)
  - `glitch` (0–1): how often it breaks down. About 1 glitch per line at 0.7, always at least one in the hook, none on
    the end card. Glitches: **stutter** (a word's first syllable repeats, crushed), **pitch** (one word jumps up or
    down 5–9 semitones), **wow** (a word slows and sags like a dying tape), **dropout** (the signal cuts out with a
    click), and **tapestop** (a word winds down about 13.5 semitones, held twice as long and ringing out, kept as loud as the rest of the line so it stays
    audible). At 1.1 key words got lost in testing, so don't go much above 0.8.
  - Picked automatically, glitches never land on the first word of a line, on "Fives Finder", "dot com" or "free", or
    on the end card.
  - **To control them, mark words in `voText` with tildes:** `~Again~` (glitch picked for you) or `~Again:tapestop~`
    (`stutter`, `pitch`, `wow`, `dropout`, `tapestop`). A line with any marks glitches **only** the marked words, so
    once Zoran likes a take it never changes on re-render. `npm run voice` prints the glitches it applied; copy them
    into marks to lock a take in. Keep the table in post.md the same as `voText`.
- `bed`: `"machine"` is a room tone under the voice, dipped while it talks: fan rumble, 50 Hz mains hum, CRT whine,
  and a hard drive, relay or data chirp now and then at random times. No rhythm, no notes. `null` = silence under the voice.
- `sfx`: writes the effect library to `<week>/sfx/` (see below). `false` = skip.
- A week can override any of these with its own `<week>/voice.json`. One-off: `npm run voice 2026-W48 -- --engine kokoro`.

### The effect library (`<week>/sfx/*.wav`, made from code, nothing to license)

| Name | What it is | Good for |
|---|---|---|
| `crt-on` | Relay thunk, degauss buzz, rising 15.7 kHz whine, crackle (1.3 s) | The cold open, frame 0 |
| `crt-off` | Pop and collapsing zap (0.5 s) | The very end (`"at": -0.45` on the end card); loops back into `crt-on` |
| `static-hit` | Crushed static burst (0.3 s) | A hard cut, a pattern break |
| `glitch-burst` | Chopped digital garbage (0.3 s) | Before a number or reveal |
| `dialup` | DTMF dialling, answer tone, handshake screech (3.4 s, phone band) | "Connecting" moments, at low `vol` (≈ 0.2) under a line |
| `im-alert` | An original early-2000s message pop with two rising glides (0.3 s) | A chat message arriving, a spot filling |
| `hdd-seek` | Hard-drive seek clicks (0.45 s) | "Searching…", empty results |
| `servo` | Motor whine and click (0.65 s) | Something mechanical moving into place |
| `relay` | Double relay click (0.1 s) | Small transitions, the end card appearing |
| `alien-sweep` | Ring-modulated FM sweep with phaser (1.3 s) | The strange / "what is this?" moment |
| `data-chirp` | Fast crushed data blips (0.5 s) | Data, links, numbers updating |
| `power-down` | Motor winding down, final click (1 s) | Something dying: the old way, the group chat |

Cue them per segment in `props.json` with `"sfx"` on the hook, any beat, or the end:
`"sfx": ["crt-on", { "src": "im-alert", "at": 0.5, "vol": 0.6 }, { "src": "crt-off", "at": -0.45 }]`. `at` is seconds
from the start of the segment (negative = from its end), and `vol` defaults to 0.7. Keep it to 1–2 cues per segment and
keep loud ones off the words that matter: the voice must stay clear.

To hear Kokoro's other voices: `npm run voice -- --samples` (9 voices → `content/voice-samples/`).

### Paid options (not used, need Zoran's OK)

- **ElevenLabs Starter**, about $5/month (≈ R90). Its free tier doesn't allow commercial use.
- **Azure Speech free tier (F0):** R0 for 500,000 characters a month and has real South African English voices
  (`en-ZA-LukeNeural`, `en-ZA-LeahNeural`), but needs an Azure account with a card check at signup.

## How it works

1. `/content-week` writes each spoken line into `props.json` as `voText` on the hook, each beat and the end card. The
   same lines appear in the post.md table "Voice lines" for review. **Write for the ear:** short sentences, "Fives
   Finder" for 5sFindr, "sixty rand" for R60, no emoji. The script also fixes the common ones (5sFindr, 5sfindr.com,
   5s, R60).
2. One-time setup:
   ```bash
   cd content/studio && npm run voice:setup
   ```
   ```bash
   npm run voice:setup -- --chatterbox
   ```
   (Python 3.10–3.13 venv in `studio/.kokoro-venv`, Kokoro files in `studio/.kokoro/` checked by sha256. Chatterbox
   (~1 GB) and the faster-whisper `small.en` checker (~480 MB) go to the Hugging Face cache, `~/.cache/huggingface`.)
3. Generate, then render:
   ```bash
   npm run voice 2026-W48
   ```
   ```bash
   npm run render:week 2026-W48
   ```
   `voice` writes `vo/<name>.wav` (mono 48 kHz, about −13 LUFS so the finished video lands near −16, silence trimmed) at the paths in `props.json`. It skips
   lines whose text and settings haven't changed, and sets `"aiVoice": true`, `"voice": "Chatterbox (bm_george timbre)"`
   and `"gapSec"`. Then it transcribes each new line (faster-whisper, local). **Any Chatterbox line that doesn't match
   its script is re-made with Kokoro in the same voice and effects, and the better take is kept** (in W47 this fixed a
   "Fife's Finder", an "EFTU" and a hook where Chatterbox produced almost nothing). It prints `⚠ … Heard: "…"` only
   for lines where neither take matched. The render stretches each beat to fit its line and shows a small
   **AI VOICE** chip (top right, hidden on the cover frame).
4. Fix a line by editing its `voText` (and the burned-in `caption` if it should match), then rerun both commands.
   Only the changed lines are regenerated. Chatterbox gives the same take for the same text, so to fix a fluffed word,
   reword the line slightly.

The WAVs aren't committed: they're rebuilt from `voText`, so they never drift from the text.

## The AI label (always on for AI-voice posts)

A realistic synthetic voice counts as AI-generated audio under both Meta's and TikTok's rules, so every post with
`"aiVoice": true` is labelled:

| Where | How |
|---|---|
| Instagram | `is_ai_generated=true` on the media container ("AI info" label), set by the publisher |
| Facebook Page | no API field: the caption ends with "AI voiceover." and the video shows the AI VOICE chip |
| TikTok | inbox drafts can't carry the flag: **turn on "AI-generated content" when you post** (the GitHub comment reminds you) |
| Every caption | "AI voiceover." line, added by `npm run queue` |

`queue.json` carries `ai_label: true` and `ai_reason` per item, and the publisher records what it applied in
`published.json`.

## Optional: your own voice

Your accent is still the strongest local signal. For a post where you'd rather use your own voice:

1. Record each line as its own file named like the table (`03-hook.m4a`, `03-b1.m4a` …) with your phone's voice memo
   app. iPhone: Settings → Apps → Voice Memos → Audio Quality → **Compressed** ("Lossless" won't convert).
2. Put them in `content/<week>/vo-raw/`, then run `npm run vo <week>`. It converts them into `vo/` with the same
   clean-up.
3. Set `"aiVoice": false` in that post's `props.json` so `npm run voice` leaves it alone, the chip disappears and no
   AI label is applied. Then run `npm run queue <week>` and re-render.

Chatterbox runs here through ONNX, so it doesn't need PyTorch. It could also copy **your own** voice from a
10-second clip (a phone memo of you reading something, saved as 24 kHz WAV, used as the reference instead of the Kokoro
clip). If that's ever used: clone only your own voice, and the AI label rules above still apply.
