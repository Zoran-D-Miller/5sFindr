#!/usr/bin/env node
// Approve a week for auto-publishing. Claude runs this ONLY when Zoran says "approve <week>" in chat.
//
//   node scripts/approve.mjs 2026-W48                          # approve everything in the queue
//   node scripts/approve.mjs 2026-W48 --exclude 05,07/tiktok   # leave out post 05 (all platforms) and 07 on TikTok
//   node scripts/approve.mjs 2026-W48 --dry-run --out-root /tmp/q   # no upload, no git: writes an approved copy to test the publisher
//   node scripts/approve.mjs 2026-W48 --no-push                # upload + write queue.json, but don't push
//
// Steps: check every item's media is rendered and newer than its props.json → convert PNG slides/covers to
// JPEG (Instagram only takes JPEG) → upload to the public Supabase bucket "content-media" → write URLs,
// sha256s, exclusions, approved_at and approval_hash into queue.json → commit content/<week>/queue.json to the
// `content-queue` branch (git plumbing, no branch switch) and push. The GitHub Action publishes from there.
// Then it deletes the storage files of finished earlier weeks (free-tier housekeeping).
//
// Needs (in content/.env.local, never committed): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY. See content/AUTOPOST-SETUP.md.
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { approvalHash } from "../../publisher/approval.mjs";
import { deleteObjects, ensureBucket, publicUrl, upload } from "../../publisher/storage.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const contentDir = path.resolve(here, "..", "..");
const repo = path.resolve(contentDir, "..");
const args = process.argv.slice(2);
const opt = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : null);
const week = args.find((a, i) => !a.startsWith("--") && !["--exclude", "--out-root", "--by"].includes(args[i - 1]));
const dryRun = args.includes("--dry-run");
const push = !dryRun && !args.includes("--no-push");
const outRoot = opt("--out-root");
const approvedBy = opt("--by") ?? "Zoran (in chat)";
const excludes = (opt("--exclude") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
if (!week || !/^\d{4}-W\d{2}$/.test(week)) {
  console.error("Usage: node scripts/approve.mjs <YYYY-Www> [--exclude 05,07/tiktok] [--dry-run --out-root DIR] [--no-push]");
  process.exit(1);
}
if (dryRun && !outRoot) {
  console.error("--dry-run needs --out-root DIR (the approved copy goes there, never into the real queue).");
  process.exit(1);
}

// ---------- env (content/.env.local, then the app's .env.local for the URL) ----------
function loadEnv(file) {
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(file, "utf8")
      .split("\n")
      .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/))
      .filter(Boolean)
      .map((m) => [m[1], m[2]]),
  );
}
const envFile = { ...loadEnv(path.join(repo, ".env.local")), ...loadEnv(path.join(contentDir, ".env.local")) };
const supabaseUrl = process.env.SUPABASE_URL ?? envFile.SUPABASE_URL ?? envFile.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? envFile.SUPABASE_SERVICE_ROLE_KEY;
if (!dryRun && (!supabaseUrl || !key)) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Put them in content/.env.local (see content/AUTOPOST-SETUP.md).");
  process.exit(1);
}
const store = { supabaseUrl: supabaseUrl ?? "https://YOUR-PROJECT.supabase.co", key };

// ---------- load + check ----------
const weekDir = path.join(contentDir, week);
const queueFile = path.join(weekDir, "queue.json");
if (!fs.existsSync(queueFile)) {
  console.error(`No ${week}/queue.json. Run: npm run queue ${week}`);
  process.exit(1);
}
const queue = JSON.parse(fs.readFileSync(queueFile, "utf8"));
const matches = (it, x) => (x.includes("/") ? it.id.endsWith(`/${x}`) : it.id.split("/")[1] === x);
for (const x of excludes) {
  if (!queue.items.some((it) => matches(it, x))) {
    console.error(`--exclude ${x} matches nothing in ${week}/queue.json`);
    process.exit(1);
  }
}

const problems = [];
const mtime = (f) => fs.statSync(f).mtimeMs;
for (const it of queue.items) {
  it.excluded = excludes.some((x) => matches(it, x));
  if (it.excluded) continue;
  const props = path.join(weekDir, "posts", it.post, "props.json");
  for (const m of [...it.media, ...(it.cover ? [it.cover] : [])]) {
    const f = path.join(weekDir, m.path);
    if (!fs.existsSync(f)) problems.push(`${it.id}: ${m.path} isn't rendered`);
    else if (mtime(f) < mtime(props)) problems.push(`${it.id}: ${m.path} is older than props.json (re-render)`);
  }
}
if (problems.length) {
  console.error(`Not approved. Fix these first:\n  ${[...new Set(problems)].join("\n  ")}`);
  process.exit(1);
}

// ---------- stage media ----------
const sha = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
const staged = new Map(); // source path → { file, url, sha256 }
async function stage(m) {
  if (staged.has(m.path)) return staged.get(m.path);
  let src = path.join(weekDir, m.path);
  let type = "video/mp4";
  if (/\.png$/i.test(src)) {
    const out = path.join(path.dirname(src).replace(/[\\/]slides$/, ""), "publish", path.basename(src).replace(/\.png$/i, ".jpg"));
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const r = spawnSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "90", src, "--out", out], { encoding: "utf8" });
    if (r.status !== 0) throw new Error(`sips couldn't convert ${m.path}: ${r.stderr}`);
    src = out;
    type = "image/jpeg";
  }
  const buf = fs.readFileSync(src);
  const rel = path.relative(weekDir, src).split(path.sep).join("/");
  const objectPath = `${week}/${rel.replace(/^posts\//, "")}`;
  const url = dryRun ? publicUrl(store.supabaseUrl, objectPath) : await upload(store, objectPath, buf, type);
  const s = { file: rel, url, sha256: sha(buf) };
  staged.set(m.path, s);
  console.log(`  ${dryRun ? "(dry, not uploaded) " : "↑ "}${objectPath} (${(buf.length / 1048576).toFixed(1)} MB)`);
  return s;
}

if (!dryRun) console.log(`Bucket content-media: ${await ensureBucket(store)}`);
for (const it of queue.items) {
  if (it.excluded) continue;
  for (const m of it.media) Object.assign(m, await stage(m));
  if (it.cover) Object.assign(it.cover, await stage(it.cover));
}

Object.assign(queue, { approved: true, approved_at: new Date().toISOString(), approved_by: dryRun ? "DRY RUN (not a real approval)" : approvedBy });
queue.approval_hash = approvalHash(queue);
const json = JSON.stringify(queue, null, 2) + "\n";
const target = dryRun ? path.join(outRoot, week, "queue.json") : queueFile;
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, json);
const live = queue.items.filter((i) => !i.excluded);
console.log(`✓ ${dryRun ? "dry-run copy" : "approved"}: ${target} · ${live.length} item(s), ${queue.items.length - live.length} excluded`);

// ---------- push to the content-queue branch (no checkout, no branch switch) ----------
function git(a, extraEnv = {}, input) {
  const r = spawnSync("git", ["-C", repo, ...a], { encoding: "utf8", env: { ...process.env, ...extraEnv }, input });
  if (r.status !== 0) throw new Error(`git ${a.join(" ")}: ${r.stderr.trim()}`);
  return r.stdout.trim();
}
function pushQueue() {
  const idx = path.join(os.tmpdir(), `5sfindr-queue-index-${process.pid}`);
  const E = { GIT_INDEX_FILE: idx };
  for (let attempt = 1; attempt <= 3; attempt++) {
    spawnSync("git", ["-C", repo, "fetch", "-q", "origin", "+refs/heads/content-queue:refs/remotes/origin/content-queue"], { encoding: "utf8" });
    const parent = spawnSync("git", ["-C", repo, "rev-parse", "--verify", "-q", "refs/remotes/origin/content-queue"], { encoding: "utf8" }).stdout.trim();
    fs.rmSync(idx, { force: true });
    git(parent ? ["read-tree", parent] : ["read-tree", "--empty"], E);
    const add = (p, content) => git(["update-index", "--add", "--cacheinfo", `100644,${git(["hash-object", "-w", "--stdin"], {}, content)},${p}`], E);
    add(`content/${week}/queue.json`, json);
    if (!parent) {
      add("vercel.json", JSON.stringify({ git: { deploymentEnabled: false } }, null, 2) + "\n"); // no Vercel builds for this branch
      add(
        "README.md",
        "# content-queue\n\nApproved publish queues (`content/<week>/queue.json`) and the publisher's log (`published.json`).\nWritten by `content/studio/scripts/approve.mjs` and `.github/workflows/content-publish.yml`. Not app code: never merge it into main.\n",
      );
    }
    const tree = git(["write-tree"], E);
    const msg = `Approve ${week}: ${live.length} item(s)${excludes.length ? `, excluding ${excludes.join(", ")}` : ""}`;
    const commit = git(["commit-tree", tree, ...(parent ? ["-p", parent] : []), "-m", msg]);
    const p = spawnSync("git", ["-C", repo, "push", "-q", "origin", `${commit}:refs/heads/content-queue`], { encoding: "utf8" });
    fs.rmSync(idx, { force: true });
    if (p.status === 0) return commit;
    console.log(`  push rejected (attempt ${attempt}): ${p.stderr.trim()}`);
  }
  throw new Error("couldn't push to content-queue");
}

if (push) {
  const c = pushQueue();
  console.log(`✓ pushed content/${week}/queue.json to content-queue (${c.slice(0, 7)}). The publisher picks each item up within ~15 min of its time.`);

  // Housekeeping: delete the storage files of earlier weeks that are completely finished.
  const TERMINAL = new Set(["published", "draft_sent", "missed", "failed", "needs_check"]);
  const ref = "refs/remotes/origin/content-queue";
  const show = (p) => spawnSync("git", ["-C", repo, "show", `${ref}:${p}`], { encoding: "utf8" });
  const weeks = spawnSync("git", ["-C", repo, "ls-tree", "--name-only", `${ref}:content`], { encoding: "utf8" })
    .stdout.split("\n")
    .filter((w) => /^\d{4}-W\d{2}$/.test(w) && w !== week);
  for (const w of weeks) {
    const q = show(`content/${w}/queue.json`);
    const l = show(`content/${w}/published.json`);
    if (q.status !== 0 || l.status !== 0) continue;
    const items = JSON.parse(q.stdout).items.filter((i) => !i.excluded);
    const log = JSON.parse(l.stdout);
    if (!items.every((i) => TERMINAL.has(log.items?.[i.id]?.status))) continue;
    const urls = [...new Set(items.flatMap((i) => [...i.media, ...(i.cover ? [i.cover] : [])].map((m) => m.url)))];
    const n = await deleteObjects(urls, store).catch((e) => (console.log(`  ! clean-up ${w}: ${e.message}`), 0));
    if (n) console.log(`  deleted ${n} finished file(s) of ${w} from storage`);
  }
} else if (!dryRun) {
  console.log("Not pushed (--no-push). Nothing publishes until content/<week>/queue.json is on the content-queue branch.");
}
