#!/usr/bin/env node
// Render every post in a week folder.
//
//   node scripts/render-week.mjs 2026-W47                 # all posts
//   node scripts/render-week.mjs 2026-W47 --only 03       # posts whose folder starts with 03
//   node scripts/render-week.mjs 2026-W47 --preview       # shorts: stills of each beat only (fast check)
//   node scripts/render-week.mjs cinematic/c1-the-drop     # one cinematic concept folder (exports 9:16, 4:5, 1:1)
//
// Each post folder holds props.json with "type": "carousel" | "short" | "cinematic".
// The week (or concept) folder is the public dir, so props refer to files inside it,
// e.g. "vo": "vo/03-b1.wav" or "src": "clips/s01.mp4".
//
// Outputs (next to props.json):
//   carousel  → slides/01.png … (1080x1350)
//   short     → <id>.mp4 (1080x1920, H.264) + cover.png (frame 0, the hook)
//   cinematic → exports/<id>-9x16.mp4, -4x5.mp4, -1x1.mp4
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const studio = path.resolve(here, "..");
const contentDir = path.resolve(studio, "..");

const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith("--"));
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
const preview = args.includes("--preview");
if (!target) {
  console.error("Usage: node scripts/render-week.mjs <YYYY-Www | cinematic/<concept>> [--only NN] [--preview]");
  process.exit(1);
}
const rootDir = path.resolve(contentDir, target);
if (!fs.existsSync(rootDir)) throw new Error(`Not found: ${rootDir}`);

// A week has posts/<NN-slug>/props.json; a cinematic concept has props.json at its root.
const postDirs = fs.existsSync(path.join(rootDir, "posts"))
  ? fs
      .readdirSync(path.join(rootDir, "posts"))
      .filter((d) => fs.existsSync(path.join(rootDir, "posts", d, "props.json")))
      .filter((d) => !only || d.startsWith(only))
      .sort()
      .map((d) => path.join(rootDir, "posts", d))
  : [rootDir];

console.log(`Bundling studio (public dir: ${path.relative(contentDir, rootDir)}) …`);
const serveUrl = await bundle({ entryPoint: path.join(studio, "src/index.ts"), publicDir: rootDir });

const log = (msg) => process.stdout.write(`${msg}\n`);
const T = { timeoutInMilliseconds: 120000 }; // the Intel Mac needs ~7s+ to load the root (fonts)

for (const dir of postDirs) {
  const props = JSON.parse(fs.readFileSync(path.join(dir, "props.json"), "utf8"));
  const id = props.id ?? path.basename(dir);
  const name = path.relative(contentDir, dir);

  if (props.type === "carousel") {
    fs.mkdirSync(path.join(dir, "slides"), { recursive: true });
    for (let i = 0; i < props.slides.length; i++) {
      const inputProps = { ...props, index: i };
      const composition = await selectComposition({ ...T, serveUrl, id: "Carousel", inputProps });
      const out = path.join(dir, "slides", `${String(i + 1).padStart(2, "0")}.png`);
      await renderStill({ ...T, composition, serveUrl, output: out, inputProps });
    }
    log(`✓ ${name}: ${props.slides.length} slides`);
  } else if (props.type === "short") {
    const composition = await selectComposition({ ...T, serveUrl, id: "Short", inputProps: props });
    const frames = composition.props._frames;
    await renderStill({ ...T, composition, serveUrl, output: path.join(dir, "cover.png"), inputProps: props, frame: 0 });
    if (preview) {
      fs.mkdirSync(path.join(dir, "preview"), { recursive: true });
      let at = 0;
      for (let i = 0; i < frames.length; i++) {
        const f = at + Math.floor(frames[i] * 0.75);
        await renderStill({ ...T, composition, serveUrl, output: path.join(dir, "preview", `seg${i}.png`), inputProps: props, frame: f });
        at += frames[i];
      }
      log(`✓ ${name}: preview stills (${(composition.durationInFrames / composition.fps).toFixed(1)}s)`);
      continue;
    }
    const out = path.join(dir, `${id}.mp4`);
    let last = -1;
    await renderMedia({
      ...T,
      composition,
      serveUrl,
      codec: "h264",
      crf: 20, // platforms re-encode anyway; keeps a short well under Supabase Free's 50 MB per file
      outputLocation: out,
      inputProps: props,
      onProgress: ({ progress }) => {
        const pct = Math.floor(progress * 10) * 10;
        if (pct !== last) {
          last = pct;
          process.stdout.write(`  ${name} ${pct}%\r`);
        }
      },
    });
    log(`✓ ${name}: ${path.basename(out)} (${(composition.durationInFrames / composition.fps).toFixed(1)}s)`);
  } else if (props.type === "cinematic") {
    fs.mkdirSync(path.join(dir, "exports"), { recursive: true });
    for (const aspect of props.aspects ?? ["9:16", "4:5", "1:1"]) {
      const inputProps = { ...props, aspect };
      const composition = await selectComposition({ ...T, serveUrl, id: "Cinematic", inputProps });
      const tag = aspect.replace(":", "x");
      if (preview) {
        await renderStill({ ...T, composition, serveUrl, output: path.join(dir, "exports", `${id}-${tag}.png`), inputProps, frame: Math.floor(composition.durationInFrames * 0.3) });
        continue;
      }
      await renderMedia({ ...T, composition, serveUrl, codec: "h264", crf: 16, outputLocation: path.join(dir, "exports", `${id}-${tag}.mp4`), inputProps });
      log(`✓ ${name}: ${id}-${tag}.mp4`);
    }
  } else {
    log(`· skipped ${name} (type "${props.type}")`);
  }
}
log("Done.");
