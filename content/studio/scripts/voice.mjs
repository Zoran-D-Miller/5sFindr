#!/usr/bin/env node
// AI voiceover for a week's shorts with Kokoro (local, free, Apache-2.0, CPU only).
//
//   node scripts/voice.mjs 2026-W47                 # every short in the week
//   node scripts/voice.mjs 2026-W47 --only 03       # posts whose folder starts with 03
//   node scripts/voice.mjs 2026-W47 --force         # regenerate even if the text didn't change
//   node scripts/voice.mjs --samples                # one test line in several voices → content/voice-samples/
//
// Text comes from props.json: hook.voText, beats[].voText, end.voText (falls back to the
// "Voice lines" table in post.md, then writes the text back into props.json so it's the one source).
// Output: content/<week>/vo/<name>.wav (mono 48 kHz, ≈ -16 LUFS, silence trimmed) at the paths
// already in props.json ("vo": "vo/03-b1.wav"), so render-week.mjs sizes each beat to its line.
// Every short it voices gets "aiVoice": true, which shows the on-screen "AI voice" chip and makes
// queue.mjs set the platforms' AI label.
//
// Voice settings: content/voice.json ({"voice","speed","lang"}); a week can override with <week>/voice.json.
// First run: npm run voice:setup (Python venv + model download, ~350 MB).
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalize } from "./lib/audio.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const studio = path.resolve(here, "..");
const contentDir = path.resolve(studio, "..");
const python = path.join(studio, ".kokoro-venv", "bin", "python");

const args = process.argv.slice(2);
const opt = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : null);
const target = args.find((a, i) => !a.startsWith("--") && !["--only", "--voice"].includes(args[i - 1]));
const only = opt("--only");
const force = args.includes("--force");

if (!fs.existsSync(python) || !fs.existsSync(path.join(studio, ".kokoro", "kokoro-v1.0.onnx"))) {
  console.error("Kokoro isn't set up yet. Run: npm run voice:setup");
  process.exit(1);
}

const readJson = (f, d = null) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : d);
const langFor = (voice) => (voice.startsWith("b") ? "en-gb" : "en-us");

// Things the TTS would misread. Voice lines are written to be said, but captions sneak in.
function speakable(text) {
  return text
    .replace(/\*/g, "")
    .replace(/\n/g, " ")
    .replace(/5sfindr\.com/gi, "Fives Finder dot com")
    .replace(/5sFindr/gi, "Fives Finder")
    .replace(/\b5s\b/g, "fives")
    .replace(/\bR(\d+)\b/g, "$1 rand")
    .replace(/\s+/g, " ")
    .trim();
}

function runKokoro(jobs) {
  const r = spawnSync(python, [path.join(here, "kokoro_tts.py")], {
    input: JSON.stringify(jobs),
    encoding: "utf8",
    stdio: ["pipe", "pipe", "inherit"],
    maxBuffer: 1 << 24,
  });
  if (r.status !== 0) throw new Error(`Kokoro failed (exit ${r.status})`);
}

// ---------- samples mode ----------
if (args.includes("--samples")) {
  const out = path.join(contentDir, "voice-samples");
  fs.mkdirSync(out, { recursive: true });
  const line = "Two pull out at five o'clock. Old way: beg the group chat. New way: drop one link. Fives Finder.";
  const voices = ["bm_george", "bm_lewis", "bm_daniel", "bm_fable", "bf_emma", "bf_isabella", "am_michael", "am_puck", "af_heart"];
  const tmp = voices.map((v) => ({ text: line, out: path.join(out, `${v}.raw.wav`), voice: v, speed: 1.05, lang: langFor(v) }));
  runKokoro(tmp);
  for (const j of tmp) {
    normalize(j.out, j.out.replace(".raw.wav", ".wav"), { cwd: studio });
    fs.rmSync(j.out);
  }
  console.log(`✓ ${voices.length} samples in content/voice-samples/. Pick one and set "voice" in content/voice.json.`);
  process.exit(0);
}

if (!target) {
  console.error("Usage: node scripts/voice.mjs <YYYY-Www> [--only NN] [--force] [--voice bm_george] | --samples");
  process.exit(1);
}
const weekDir = path.resolve(contentDir, target);
const postsDir = path.join(weekDir, "posts");
if (!fs.existsSync(postsDir)) throw new Error(`No posts/ in ${weekDir}`);

const cfg = { voice: "bm_george", speed: 1.05, ...readJson(path.join(contentDir, "voice.json"), {}), ...readJson(path.join(weekDir, "voice.json"), {}) };
const voiceOverride = opt("--voice");
if (voiceOverride) cfg.voice = voiceOverride;
cfg.lang = voiceOverride ? langFor(cfg.voice) : (cfg.lang ?? langFor(cfg.voice));

// The "| `vo/03-b1.wav` | line |" table in post.md
function postTable(dir) {
  const f = path.join(dir, "post.md");
  if (!fs.existsSync(f)) return {};
  const map = {};
  for (const m of fs.readFileSync(f, "utf8").matchAll(/^\|\s*`(vo\/[^`]+\.wav)`\s*\|\s*(.+?)\s*\|\s*$/gm)) map[m[1]] = m[2];
  return map;
}

const voDir = path.join(weekDir, "vo");
const tmpDir = path.join(voDir, ".tmp");
fs.mkdirSync(tmpDir, { recursive: true });
const manifestFile = path.join(voDir, ".voice-manifest.json");
const manifest = readJson(manifestFile, {});

const jobs = [];
const touched = [];
for (const d of fs.readdirSync(postsDir).sort()) {
  if (only && !d.startsWith(only)) continue;
  const dir = path.join(postsDir, d);
  const propsFile = path.join(dir, "props.json");
  const props = readJson(propsFile);
  if (!props || props.type !== "short") continue;
  if (props.aiVoice === false) {
    console.log(`· ${d}: aiVoice is false (real recording), skipped`);
    continue;
  }
  const table = postTable(dir);
  const segs = [props.hook, ...props.beats, props.end].filter((s) => s?.vo);
  let missing = 0;
  for (const s of segs) {
    s.voText ??= table[s.vo];
    if (!s.voText) {
      missing++;
      continue;
    }
    const text = speakable(s.voText);
    const key = crypto.createHash("sha256").update(JSON.stringify([text, cfg.voice, cfg.speed, cfg.lang])).digest("hex").slice(0, 16);
    const out = path.join(weekDir, s.vo);
    if (!force && manifest[s.vo] === key && fs.existsSync(out)) continue;
    jobs.push({ text, out: path.join(tmpDir, path.basename(s.vo)), final: out, key, vo: s.vo, voice: cfg.voice, speed: cfg.speed, lang: cfg.lang });
  }
  if (missing) console.log(`! ${d}: ${missing} voice line(s) have no voText and no post.md row, left silent`);
  props.aiVoice = true;
  props.voice = `Kokoro ${cfg.voice}`;
  fs.writeFileSync(propsFile, JSON.stringify(props, null, 2) + "\n");
  touched.push(d);
}

if (jobs.length) {
  console.log(`Kokoro ${cfg.voice} (speed ${cfg.speed}, ${cfg.lang}): ${jobs.length} line(s) …`);
  runKokoro(jobs.map(({ text, out, voice, speed, lang }) => ({ text, out, voice, speed, lang })));
  for (const j of jobs) {
    const sec = normalize(j.out, j.final, { cwd: studio });
    fs.rmSync(j.out, { force: true });
    if (sec === null) {
      console.log(`✗ ${j.vo} (ffmpeg failed)`);
      continue;
    }
    manifest[j.vo] = j.key;
    console.log(`✓ ${j.vo} (${sec.toFixed(2)} s)`);
  }
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + "\n");
} else {
  console.log("All voice lines are up to date.");
}
fs.rmSync(tmpDir, { recursive: true, force: true });
console.log(`Voiced ${touched.length} short(s). Next: npm run render:week ${target}`);
