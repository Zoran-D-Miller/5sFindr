# Voice lines

Your own voice is the default, and your Cape Town accent is an asset with a local audience.

## Recording (about 10 minutes a week)

1. Open each short's `post.md` and find the **Voice lines to record** table.
2. Record **one line per file** with your phone's voice memo app. Use a quiet room, phone about 20 cm from your mouth, and the same spot every week.
3. Name the files exactly like the table (`03-hook`, `03-b1`, …). m4a, wav, mp3, aac and ogg all work.
   **iPhone:** Settings → Apps → Voice Memos → Audio Quality → **Compressed** (the default). "Lossless" files can't be converted by the bundled ffmpeg.
4. Put them in `content/<week>/vo-raw/`.
5. Run in `content/studio/`:

```bash
npm run vo 2026-W47
```

That converts every file to `content/<week>/vo/<name>.wav`. It trims silence at the start and end, makes it mono 48 kHz, and evens out loudness to about −16 LUFS (right for TikTok and Reels). It uses the ffmpeg that comes with Remotion, so nothing else needs installing.

6. Re-render. Each beat stretches to fit your line, so read naturally.

Tips: say "5sFindr" as **"Fives Finder"**. Smile on the hook line. Do two takes and keep the better one. A line can be a bit off-script as long as the meaning stays: the captions come from `props.json`, so update the `caption` there to match what you said.

## Optional: free local voice cloning (for weeks with no time to record)

Both options are free to use commercially and run on your Mac (CPU only, so slow but fine for 10 short lines):

| Model | Licence | Notes |
|---|---|---|
| **Chatterbox** (Resemble AI, github.com/resemble-ai/chatterbox) | **MIT**, commercial use allowed. Resemble now keeps it as an archived, unsupported repo. | Best quality. Zero-shot cloning from a ~10 s clean sample. Python 3.11, `pip install chatterbox-tts`. Runs on CPU. |
| **OpenVoice V2** (MyShell, github.com/myshell-ai/OpenVoice) | **MIT** since April 2024, commercial use allowed | Clones tone colour; accent transfer is weaker. |

Rules if you use a clone:
- Clone **only your own voice**.
- A realistic AI voice counts as AI audio for Meta and TikTok labelling. Turn on the platform's AI label (Meta: "AI info"; TikTok: "AI-generated content") on any post that uses it.
- Keep at least the hook line in your real voice where you can.
