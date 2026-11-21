// Shared audio helpers for vo.mjs (phone recordings) and voice.mjs (Kokoro AI voice).
// Uses the ffmpeg that ships with Remotion (`npx remotion ffmpeg`). That build is minimal:
// it decodes AAC/MP3/WAV/Opus and has loudnorm, but no silence filters, so silence is trimmed in Node.
import { spawnSync } from "node:child_process";
import fs from "node:fs";

export const RATE = 48000;
const THRESH = Math.round(32768 * 10 ** (-42 / 20)); // -42 dBFS
const PAD_START = Math.round(RATE * 0.06);
const PAD_END = Math.round(RATE * 0.12);

// Trim leading/trailing silence of a 16-bit mono PCM WAV in place. Returns its length in seconds.
export function trimWav(file) {
  const buf = fs.readFileSync(file);
  let off = 12;
  let dataStart = -1;
  let dataLen = 0;
  while (off + 8 <= buf.length) {
    const id = buf.toString("ascii", off, off + 4);
    const len = buf.readUInt32LE(off + 4);
    if (id === "data") {
      dataStart = off + 8;
      dataLen = Math.min(len, buf.length - dataStart);
      break;
    }
    off += 8 + len + (len % 2);
  }
  if (dataStart < 0) return null;
  const n = Math.floor(dataLen / 2);
  const s = (i) => Math.abs(buf.readInt16LE(dataStart + i * 2));
  let a = 0;
  while (a < n && s(a) < THRESH) a++;
  let b = n - 1;
  while (b > a && s(b) < THRESH) b--;
  if (a >= b) return n / RATE; // silent file: leave it
  a = Math.max(0, a - PAD_START);
  b = Math.min(n - 1, b + PAD_END);
  const pcm = buf.subarray(dataStart + a * 2, dataStart + (b + 1) * 2);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  fs.writeFileSync(file, Buffer.concat([header, pcm]));
  return pcm.length / 2 / RATE;
}

// Any audio file → mono 48 kHz 16-bit WAV at about `lufs` (default -16), silence trimmed.
// voice.mjs uses -13 for AI lines: a mono line drops ~3 dB in Remotion's stereo mix, so the finished video lands
// near -16 LUFS overall instead of -19 (quiet next to everything else in the feed).
// Returns the length in seconds, or null if ffmpeg failed.
export function normalize(input, output, { cwd, lufs = -16 }) {
  const r = spawnSync(
    "npx",
    ["remotion", "ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", input,
     "-af", `loudnorm=I=${lufs}:TP=-1.5:LRA=11`, "-ac", "1", "-ar", String(RATE), "-c:a", "pcm_s16le", output],
    { cwd, stdio: "inherit" },
  );
  if (r.status !== 0) return null;
  return trimWav(output);
}
