# Voice lines: AI voice by default

Zoran doesn't record. Each short's voice lines are generated on this Mac by **Kokoro** (82M-parameter TTS, model and
code under Apache-2.0, so commercial use is fine). It runs on the CPU through `kokoro-onnx`, costs nothing and needs no
account. A week's ~40 lines take about 2 minutes on the Intel i5.

Trade-off: Kokoro's English voices are American or British, not Cape Town. The default is **`bm_george`** (British
male, speed 1.05). Listen to the options and change `content/voice.json` if another one fits better:

```bash
cd content/studio && npm run voice -- --samples
```

That writes the same line in 9 voices to `content/voice-samples/` (bm_george, bm_lewis, bm_daniel, bm_fable, bf_emma,
bf_isabella, am_michael, am_puck, af_heart). A week can override the voice with its own `<week>/voice.json`.

## How it works

1. `/content-week` writes each spoken line into `props.json` as `voText` on the hook, each beat and the end card. The
   same lines appear in the post.md table "Voice lines" for review. **Write for the ear:** short sentences, "Fives
   Finder" for 5sFindr, "sixty rand" for R60, no emoji. The script also fixes the common ones (5sFindr, 5sfindr.com,
   5s, R60).
2. One-time setup:
   ```bash
   cd content/studio && npm run voice:setup
   ```
   (Python 3.10–3.13 venv in `studio/.kokoro-venv`, model files in `studio/.kokoro/`, checked by sha256.)
3. Generate, then render:
   ```bash
   npm run voice 2026-W48
   ```
   ```bash
   npm run render:week 2026-W48
   ```
   `voice` writes `vo/<name>.wav` (mono 48 kHz, about −16 LUFS, silence trimmed) at the paths in `props.json`. It skips
   lines whose text and voice haven't changed, and sets `"aiVoice": true` and `"voice": "Kokoro bm_george"`. The
   render stretches each beat to fit its line and shows a small **AI VOICE** chip (top right, hidden on the cover frame).
4. Fix a line by editing its `voText` (and the burned-in `caption` if it should match), then rerun both commands.
   Only the changed lines are regenerated.

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

Voice cloning (Chatterbox, OpenVoice) isn't set up: Chatterbox needs torch ≥ 2.6, which no longer installs on Intel
Macs. A free Colab GPU notebook could clone your voice from a 30-second sample (one click a week) if the generic
voices don't land. If that's ever used: clone only your own voice, and the AI label rules above still apply.
