#!/usr/bin/env node
// Convert Zoran's phone recordings into clean voice lines.
//   node scripts/vo.mjs 2026-W47            (or cinematic/c1-coordinates)
// reads  content/<week>/vo-raw/<name>.(m4a|wav|mp3|aac|caf|ogg)
// writes content/<week>/vo/<name>.wav  (mono, 48 kHz, 16-bit, loudness ≈ -16 LUFS, silence trimmed)
//
// Uses the ffmpeg that ships with Remotion (`npx remotion ffmpeg`), so nothing to install.
// That build is minimal: it decodes AAC/MP3/WAV/Opus (iPhone Voice Memos in the default
// "Compressed" quality are fine; the "Lossless"/ALAC setting is NOT supported) and has
// loudnorm but no silence filters, so silence is trimmed here in Node.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const studio = path.resolve(here, "..");
const week = process.argv[2];
if (!week) {
  console.error("Usage: node scripts/vo.mjs <YYYY-Www | cinematic/<concept>>");
  process.exit(1);
}
const root = path.resolve(studio, "..", week);
const rawDir = path.join(root, "vo-raw");
const outDir = path.join(root, "vo");
fs.mkdirSync(outDir, { recursive: true });
const files = fs.existsSync(rawDir) ? fs.readdirSync(rawDir).filter((f) => /\.(m4a|wav|mp3|aac|caf|ogg)$/i.test(f)) : [];
if (!files.length) {
  console.log(`No recordings in ${rawDir}. Name them like 03-hook.m4a.`);
  process.exit(0);
}

const RATE = 48000;
const THRESH = Math.round(32768 * 10 ** (-42 / 20)); // -42 dBFS
const PAD_START = Math.round(RATE * 0.06);
const PAD_END = Math.round(RATE * 0.12);

// Trim leading/trailing silence of a 16-bit mono PCM WAV in place.
function trimWav(file) {
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

for (const f of files) {
  const name = f.replace(/\.[^.]+$/, "");
  const out = path.join(outDir, `${name}.wav`);
  const r = spawnSync(
    "npx",
    ["remotion", "ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", path.join(rawDir, f),
     "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ac", "1", "-ar", String(RATE), "-c:a", "pcm_s16le", out],
    { cwd: studio, stdio: "inherit" },
  );
  if (r.status !== 0) {
    console.log(`✗ ${f} (ffmpeg exit ${r.status}). If it's an iPhone memo, set Voice Memos → Audio Quality → Compressed.`);
    continue;
  }
  const sec = trimWav(out);
  console.log(`✓ vo/${name}.wav${sec ? ` (${sec.toFixed(2)} s)` : ""}`);
}
