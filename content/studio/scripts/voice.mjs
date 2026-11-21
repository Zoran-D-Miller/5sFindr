#!/usr/bin/env node
// AI voiceover for a week's shorts. Local, free, CPU only. Two engines (content/voice.json "engine"):
//   chatterbox  Chatterbox-Turbo (Resemble AI, MIT): natural rhythm and emphasis. It borrows the *sound* of a
//               Kokoro voice ("voice") from a reference clip it makes itself. ~10 min a week on this Mac.
//   kokoro      Kokoro (Apache-2.0): fast (~2 min a week) but flatter. The fallback.
//
//   node scripts/voice.mjs 2026-W48                 # every short in the week
//   node scripts/voice.mjs 2026-W48 --only 03       # posts whose folder starts with 03
//   node scripts/voice.mjs 2026-W48 --force         # regenerate even if the text didn't change
//   node scripts/voice.mjs 2026-W48 --engine kokoro # one-off override (also --voice bm_fable)
//   node scripts/voice.mjs --samples                # one test line in several Kokoro voices → content/voice-samples/
//
// Text comes from props.json: hook.voText, beats[].voText, end.voText (falls back to the
// "Voice lines" table in post.md, then writes the text back into props.json so it's the one source).
// Each line: engine → polish (audio_tools.py: shorter hesitations, optional speed-up, EQ + compression) →
// transcript check on the clean line (faster-whisper) → "robot" (voice.json "robot": the machine narrator that
// glitches and breaks down on a few words; ~word~ in voText forces a glitch on that word) →
// lib/audio.mjs (mono 48 kHz, ≈ -13 LUFS, silence trimmed) → content/<week>/vo/<name>.wav at the paths in props.json.
// Every short it voices gets "aiVoice": true (AI VOICE chip + platform AI labels) and "gapSec" (the pause between
// lines, read by Short.tsx). It also writes the week's sound-design files: sfx/<name>.wav (CRT, dial-up, IM alert,
// glitch bursts… that props.json cues per segment with "sfx") and, if voice.json has "bed": "machine", a room-tone
// bed under the voice. No music anywhere: sound design only.
//
// Settings: content/voice.json; a week can override any of them with <week>/voice.json.
// First run: npm run voice:setup (Kokoro), then npm run voice:setup -- --chatterbox (~1 GB more).
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
const valued = ["--only", "--voice", "--engine"];
const opt = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : null);
const target = args.find((a, i) => !a.startsWith("--") && !valued.includes(args[i - 1]));
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
    .replace(/~([^~:]+)(?::[a-z]+)?~/g, "$1") // ~word:stutter~ → word (glitch marks)
    .replace(/[*~]/g, "")
    .replace(/\n/g, " ")
    .replace(/5sfindr\.com/gi, "Fives Finder dot com")
    .replace(/5sFindr/gi, "Fives Finder")
    .replace(/\b5s\b/g, "fives")
    .replace(/\bR(\d+)\b/g, "$1 rand")
    .replace(/\s+/g, " ")
    .trim();
}

function py(script, argv, input) {
  const r = spawnSync(python, [path.join(here, script), ...argv], {
    input: JSON.stringify(input),
    encoding: "utf8",
    stdio: ["pipe", "pipe", "inherit"],
    maxBuffer: 1 << 24,
  });
  if (r.status !== 0) throw new Error(`${script} ${argv.join(" ")} failed (exit ${r.status})`);
  return r.stdout.split("\n").filter(Boolean).map((l) => JSON.parse(l));
}
const runKokoro = (jobs) => py("kokoro_tts.py", [], jobs);
const hasChatterbox = () => spawnSync(python, ["-c", "import tokenizers, huggingface_hub, pedalboard"]).status === 0;

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
  console.error("Usage: node scripts/voice.mjs <YYYY-Www> [--only NN] [--force] [--engine chatterbox|kokoro] [--voice bm_george] | --samples");
  process.exit(1);
}
const weekDir = path.resolve(contentDir, target);
const postsDir = path.join(weekDir, "posts");
if (!fs.existsSync(postsDir)) throw new Error(`No posts/ in ${weekDir}`);

const defaults = { engine: "kokoro", voice: "bm_george", speed: 1.05, stretch: 1.12, polish: true, gapSec: 0.35, robot: null, bed: null, sfx: true };
const cfg = { ...defaults, ...readJson(path.join(contentDir, "voice.json"), {}), ...readJson(path.join(weekDir, "voice.json"), {}) };
if (opt("--voice")) cfg.voice = opt("--voice");
if (opt("--engine")) cfg.engine = opt("--engine");
cfg.lang = opt("--voice") ? langFor(cfg.voice) : (cfg.lang ?? langFor(cfg.voice));
if (cfg.engine === "chatterbox" && !hasChatterbox()) {
  console.error("Chatterbox isn't set up yet. Run: npm run voice:setup -- --chatterbox (or use --engine kokoro)");
  process.exit(1);
}
const voiceLabel = cfg.engine === "chatterbox" ? `Chatterbox (${cfg.voice} timbre)` : `Kokoro ${cfg.voice}`;

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

// Sound design, made from scratch by audio_tools.py (no music): the effects library, and the optional room-tone bed.
const SFX_VERSION = "1";
if (cfg.sfx !== false && readJson(path.join(weekDir, "sfx", "version.json"), {}).v !== SFX_VERSION) {
  py("audio_tools.py", ["sfx"], { dir: path.join(weekDir, "sfx") });
  fs.writeFileSync(path.join(weekDir, "sfx", "version.json"), JSON.stringify({ v: SFX_VERSION }) + "\n");
}
let bedFile = null;
if (cfg.bed === "machine") {
  bedFile = "bed-machine.wav";
  if (!fs.existsSync(path.join(weekDir, bedFile))) py("audio_tools.py", ["bed"], { out: path.join(weekDir, bedFile), sec: 60 });
} else if (cfg.bed) {
  console.log(`! voice.json "bed": "${cfg.bed}" isn't a known bed (use "machine" or null), so no bed`);
}
const robot = cfg.robot ? { amount: 0.65, glitch: 0.7, ...cfg.robot } : null;

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
  const segs = [
    ["hook", props.hook],
    ...props.beats.map((b) => ["beat", b]),
    ["end", props.end],
  ].filter(([, s]) => s?.vo);
  let missing = 0;
  for (const [role, s] of segs) {
    s.voText ??= table[s.vo];
    if (!s.voText) {
      missing++;
      continue;
    }
    const text = speakable(s.voText);
    const marks = [...s.voText.matchAll(/~([^~]+)~/g)].flatMap((m) => m[1].split(/\s+/));
    const key = crypto
      .createHash("sha256")
      .update(JSON.stringify([text, cfg.engine, cfg.voice, cfg.speed, cfg.lang, cfg.polish, cfg.engine === "chatterbox" ? cfg.stretch : 1, cfg.lufs ?? -13, robot, marks, role]))
      .digest("hex")
      .slice(0, 16);
    const out = path.join(weekDir, s.vo);
    if (!force && manifest[s.vo] === key && fs.existsSync(out)) continue;
    jobs.push({ text, role, marks, out: path.join(tmpDir, path.basename(s.vo)), final: out, key, vo: s.vo });
  }
  if (missing) console.log(`! ${d}: ${missing} voice line(s) have no voText and no post.md row, left silent`);
  props.aiVoice = true;
  props.voice = voiceLabel;
  props.gapSec = cfg.gapSec;
  if (bedFile && props.bed === undefined) props.bed = bedFile;
  fs.writeFileSync(propsFile, JSON.stringify(props, null, 2) + "\n");
  touched.push(d);
}

if (jobs.length) {
  console.log(`${voiceLabel} (${cfg.engine === "kokoro" ? `speed ${cfg.speed}` : `stretch ${cfg.stretch}`}, ${cfg.lang}): ${jobs.length} line(s) …`);
  if (cfg.engine === "chatterbox") {
    // Reference clip = the sound of the voice. Made with Kokoro, so it's a synthetic Apache-2.0 voice, not a person.
    const ref = path.join(studio, ".kokoro", `ref-${cfg.voice}.wav`);
    if (!fs.existsSync(ref)) {
      runKokoro([{ text: "Right, here's the plan for tonight. Kick-off at seven, under the lights. Bring a dark shirt and a light one, and don't be late, because we start on time.", out: ref, voice: cfg.voice, speed: 1.05, lang: cfg.lang }]);
    }
    py("chatterbox_tts.py", [], jobs.map(({ text, out }) => ({ text, out, ref })));
  } else {
    runKokoro(jobs.map(({ text, out }) => ({ text, out, voice: cfg.voice, speed: cfg.speed, lang: cfg.lang })));
  }
  if (cfg.polish) {
    py("audio_tools.py", ["polish"], jobs.map((j) => ({ in: j.out, out: j.out, stretch: cfg.engine === "chatterbox" ? cfg.stretch : 1 })));
  }
  // The machine narrator: checks each clean line first, then glitches it.
  const robotChecks = robot
    ? py("audio_tools.py", ["robot"], jobs.map((j) => ({ in: j.out, out: j.out, text: j.text, role: j.role, marks: j.marks, ...robot })))
    : [];
  for (const [i, c] of robotChecks.entries()) {
    const g = c.glitches.map((e) => `${e.word} (${e.glitch})`).join(", ");
    if (g) console.log(`  ${jobs[i].vo}: glitched ${g}`);
  }
  const done = [];
  for (const j of jobs) {
    const sec = normalize(j.out, j.final, { cwd: studio, lufs: cfg.lufs ?? -13 });
    fs.rmSync(j.out, { force: true });
    if (sec === null) {
      console.log(`✗ ${j.vo} (ffmpeg failed)`);
      continue;
    }
    manifest[j.vo] = j.key;
    done.push(j);
    console.log(`✓ ${j.vo} (${sec.toFixed(2)} s)`);
  }
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + "\n");

  // Did the engine say what we wrote? (Needs faster-whisper, installed by voice:setup -- --chatterbox.)
  const checks = robot
    ? robotChecks.map((c, i) => ({ ...c, file: jobs[i].final })).filter((c) => c.score !== null && done.some((j) => j.final === c.file))
    : py("audio_tools.py", ["check"], done.map((j) => ({ file: j.final, text: j.text })));
  const bad = checks.filter((c) => !c.ok);
  for (const c of bad) console.log(`⚠ ${path.relative(weekDir, c.file)} may be off. Heard: "${c.heard}". Listen first; if it is off, reword the line (the same text always gives the same take).`);
  if (checks.length && !bad.length) console.log(`✓ transcript check: all ${checks.length} line(s) match their script`);
} else {
  console.log("All voice lines are up to date.");
}
fs.rmSync(tmpDir, { recursive: true, force: true });
console.log(`Voiced ${touched.length} short(s). Next: npm run render:week ${target}`);
