#!/usr/bin/env node
// Convert phone recordings into clean voice lines (optional: the default is the AI voice, `npm run voice`).
//   node scripts/vo.mjs 2026-W47            (or cinematic/c1-coordinates)
// reads  content/<week>/vo-raw/<name>.(m4a|wav|mp3|aac|caf|ogg)
// writes content/<week>/vo/<name>.wav  (mono, 48 kHz, 16-bit, loudness ≈ -16 LUFS, silence trimmed)
//
// Uses the ffmpeg that ships with Remotion, so nothing to install. iPhone Voice Memos in the
// default "Compressed" quality are fine; the "Lossless"/ALAC setting is NOT supported.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalize } from "./lib/audio.mjs";

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

for (const f of files) {
  const name = f.replace(/\.[^.]+$/, "");
  const sec = normalize(path.join(rawDir, f), path.join(outDir, `${name}.wav`), { cwd: studio });
  if (sec === null) {
    console.log(`✗ ${f} (ffmpeg failed). If it's an iPhone memo, set Voice Memos → Audio Quality → Compressed.`);
    continue;
  }
  console.log(`✓ vo/${name}.wav (${sec.toFixed(2)} s)`);
}
console.log('These are real recordings: set "aiVoice": false in those shorts\' props.json before re-rendering.');
