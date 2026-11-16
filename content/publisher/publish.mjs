#!/usr/bin/env node
// 5sFindr publisher: posts due, APPROVED queue items. Run by .github/workflows/content-publish.yml every ~15 min.
//
//   node content/publisher/publish.mjs --dry-run                          # print what it would do now
//   node content/publisher/publish.mjs --dry-run --now 2026-11-17T18:35+02:00
//   node content/publisher/publish.mjs --queue-root queue/content --commit-dir queue   # what the workflow runs
//
// Options: --queue-root <dir with <week>/queue.json> (default: content/), --week 2026-W48, --max 4 (items per run),
//          --commit-dir <git checkout to commit published.json into after every step>.
//
// Fail-safe rules (in this order):
//   1. Live mode only if env PUBLISH_ENABLED === "true" (the repo variable CONTENT_PUBLISH_ENABLED). Otherwise: dry run.
//   2. A week posts only if queue.json is approved AND its approval_hash still matches (approval.mjs).
//   3. Excluded items never post. Items already in published.json never post again.
//   4. An item is "claimed" (and committed) BEFORE the API call. A claim left over from a crashed run is
//      never retried automatically: it becomes needs_check and Zoran gets an issue comment.
//   5. Items more than 3 h late are marked missed, not posted.
//   6. TikTok only ever uploads to the inbox (a draft Zoran finishes in the app). Never Direct Post.
//   Replies, comments and DMs: never touched.
//
// Env (GitHub Actions secrets): META_PAGE_TOKEN, META_PAGE_ID, META_IG_USER_ID, [META_GRAPH_VERSION],
//   TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, TIKTOK_REFRESH_TOKEN, [GH_ADMIN_TOKEN to save a rotated one],
//   GITHUB_TOKEN + GITHUB_REPOSITORY (issue log), [SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to delete media early].
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { approvalProblem } from "./approval.mjs";
import { deleteObjects } from "./storage.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (k, d = null) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const env = process.env;

let dryRun = args.includes("--dry-run");
if (!dryRun && env.PUBLISH_ENABLED !== "true") {
  console.log('PUBLISH_ENABLED is not "true" (repo variable CONTENT_PUBLISH_ENABLED): running as a dry run.');
  dryRun = true;
}
const queueRoot = path.resolve(opt("--queue-root", path.resolve(here, "..")));
const onlyWeek = opt("--week");
const maxPerRun = Number(opt("--max", "4"));
const commitDir = opt("--commit-dir");
const now = opt("--now") ? new Date(opt("--now")) : new Date();
if (Number.isNaN(now.getTime())) throw new Error(`Bad --now: ${opt("--now")}`);

const MAX_LATE_MIN = 180;
const GV = env.META_GRAPH_VERSION || "v25.0";
const TERMINAL = new Set(["published", "draft_sent", "missed", "failed", "needs_check"]);
const SECRETS = [env.META_PAGE_TOKEN, env.TIKTOK_CLIENT_SECRET, env.TIKTOK_REFRESH_TOKEN, env.GH_ADMIN_TOKEN, env.SUPABASE_SERVICE_ROLE_KEY];
const redact = (s) => SECRETS.filter((x) => x && x.length >= 8).reduce((t, x) => t.split(x).join("***"), String(s));
const sast = (d) => new Date(new Date(d).getTime() + 2 * 3600000).toISOString().slice(0, 16).replace("T", " ") + " SAST";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readJson = (f, d) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : d);

// ---------- git checkpoints (published.json) ----------
function checkpoint(message) {
  if (!commitDir || dryRun) return;
  const g = (...a) => spawnSync("git", ["-C", commitDir, ...a], { encoding: "utf8" });
  g("add", "-A", "--", ":(glob)**/published.json"); // the log only: never commit a queue change from here
  if (g("diff", "--cached", "--quiet").status === 0) return;
  const c = g("commit", "-q", "-m", message);
  if (c.status !== 0) throw new Error(`git commit failed: ${c.stderr}`);
  const p = g("push", "-q", "origin", "HEAD");
  if (p.status !== 0) throw new Error(`git push failed (nothing more will post this run): ${p.stderr}`);
}

// ---------- GitHub issue log (TikTok draft captions, failures) ----------
let issueNo = null;
async function gh(method, url, body) {
  const r = await fetch(`https://api.github.com/repos/${env.GITHUB_REPOSITORY}${url}`, {
    method,
    headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`GitHub ${method} ${url}: ${r.status}`);
  return r.json();
}
async function notify(text) {
  if (dryRun || !env.GITHUB_TOKEN || !env.GITHUB_REPOSITORY) {
    console.log(`  [notify] ${text.split("\n")[0]}`);
    return;
  }
  try {
    if (!issueNo) {
      const open = await gh("GET", "/issues?state=open&labels=content-publisher&per_page=1");
      issueNo =
        open[0]?.number ??
        (
          await gh("POST", "/issues", {
            title: "Content publisher: TikTok drafts and alerts",
            labels: ["content-publisher"],
            body: "The content publisher comments here when a TikTok draft is in your inbox (with the caption to paste) and when something needs you. Subscribe to this issue and use the GitHub app to get a push for each one.",
          })
        ).number;
    }
    await gh("POST", `/issues/${issueNo}/comments`, { body: redact(text) });
  } catch (e) {
    console.log(`  ! couldn't write the issue comment: ${redact(e.message)}`);
  }
}

// ---------- Meta (Instagram + Facebook Page, one Page token via Facebook Login) ----------
async function graph(method, pathname, params = {}) {
  const url = new URL(`https://graph.facebook.com/${GV}/${pathname}`);
  const init = { method, headers: { Authorization: `Bearer ${env.META_PAGE_TOKEN}` } };
  if (method === "GET") for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  else init.body = new URLSearchParams(params);
  const r = await fetch(url, init);
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(`Graph ${method} ${pathname}: ${j.error?.message ?? r.status}`);
  return j;
}
const need = (...keys) => {
  const miss = keys.filter((k) => !env[k]);
  if (miss.length) throw new Error(`missing secret(s): ${miss.join(", ")}`);
};
const aiParams = (item) => (item.ai_label && env.META_AI_FLAG !== "off" ? { is_ai_generated: "true" } : {});

async function igWait(container, log) {
  for (let i = 0; i < 24; i++) {
    const s = await graph("GET", container, { fields: "status_code,status" });
    if (s.status_code === "FINISHED") return;
    if (s.status_code === "ERROR" || s.status_code === "EXPIRED") throw new Error(`Instagram processing ${s.status_code}: ${s.status ?? ""}`);
    log(`    waiting for Instagram to process (${s.status_code}) …`);
    await sleep(15000);
  }
  throw new Error("still processing after 6 min");
}

async function instagram(item, entry, save, log) {
  need("META_PAGE_TOKEN", "META_IG_USER_ID");
  const ig = env.META_IG_USER_ID;
  if (!entry.container_id) {
    let params;
    if (item.kind === "reel") {
      params = { media_type: "REELS", video_url: item.media[0].url, caption: item.caption, share_to_feed: "true", ...aiParams(item) };
      if (item.cover?.url) params.cover_url = item.cover.url;
    } else {
      const children = [];
      for (const [i, m] of item.media.entries()) {
        const p = { image_url: m.url, is_carousel_item: "true" };
        if (item.alt_text?.[i]) p.alt_text = item.alt_text[i].slice(0, 1000);
        children.push((await graph("POST", `${ig}/media`, p)).id);
      }
      params = { media_type: "CAROUSEL", children: children.join(","), caption: item.caption, ...aiParams(item) };
    }
    entry.container_id = (await graph("POST", `${ig}/media`, params)).id;
    save(); // nothing is public yet; a later run resumes from this container instead of re-uploading
  }
  await igWait(entry.container_id, log);
  const { id } = await graph("POST", `${ig}/media_publish`, { creation_id: entry.container_id });
  const { permalink } = await graph("GET", id, { fields: "permalink" }).catch(() => ({}));
  return { status: "published", platform_id: id, permalink, ai_label: item.ai_label ? (env.META_AI_FLAG === "off" ? "caption + on-screen chip" : "is_ai_generated") : null };
}

async function facebook(item) {
  need("META_PAGE_TOKEN", "META_PAGE_ID");
  const page = env.META_PAGE_ID;
  if (item.kind === "reel") {
    const { video_id, upload_url } = await graph("POST", `${page}/video_reels`, { upload_phase: "start" });
    const up = await fetch(upload_url, { method: "POST", headers: { Authorization: `OAuth ${env.META_PAGE_TOKEN}`, file_url: item.media[0].url } });
    const uj = await up.json().catch(() => ({}));
    if (!up.ok || uj.success === false) throw new Error(`Facebook reel upload: ${uj.debug_info?.message ?? up.status}`);
    await graph("POST", `${page}/video_reels`, { upload_phase: "finish", video_id, video_state: "PUBLISHED", description: item.caption });
    return { status: "published", platform_id: video_id, permalink: `https://www.facebook.com/reel/${video_id}`, ai_label: item.ai_label ? "caption + on-screen chip" : null };
  }
  const attached = {};
  for (const [i, m] of item.media.entries()) {
    const p = { url: m.url, published: "false" };
    if (item.alt_text?.[i]) p.alt_text_custom = item.alt_text[i];
    attached[`attached_media[${i}]`] = JSON.stringify({ media_fbid: (await graph("POST", `${page}/photos`, p)).id });
  }
  const { id } = await graph("POST", `${page}/feed`, { message: item.caption, ...attached });
  return { status: "published", platform_id: id, permalink: `https://www.facebook.com/${id}`, ai_label: item.ai_label ? "caption" : null };
}

// ---------- TikTok (Content Posting API, upload to inbox = draft) ----------
let tiktokAccess = null;
async function tiktokToken() {
  if (tiktokAccess) return tiktokAccess;
  need("TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET", "TIKTOK_REFRESH_TOKEN");
  const r = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_key: env.TIKTOK_CLIENT_KEY, client_secret: env.TIKTOK_CLIENT_SECRET, grant_type: "refresh_token", refresh_token: env.TIKTOK_REFRESH_TOKEN }),
  });
  const j = await r.json().catch(() => ({}));
  if (!j.access_token) throw new Error(`TikTok token refresh: ${j.error_description ?? j.error ?? r.status}`);
  SECRETS.push(j.access_token, j.refresh_token);
  if (j.refresh_token && j.refresh_token !== env.TIKTOK_REFRESH_TOKEN) {
    // TikTok rotated the refresh token: store the new one or the next run can't log in.
    const ok =
      env.GH_ADMIN_TOKEN &&
      spawnSync("gh", ["secret", "set", "TIKTOK_REFRESH_TOKEN", "--repo", env.GITHUB_REPOSITORY], {
        input: j.refresh_token,
        env: { ...env, GH_TOKEN: env.GH_ADMIN_TOKEN },
        encoding: "utf8",
      }).status === 0;
    if (!ok) await notify("⚠️ TikTok issued a new refresh token and I couldn't save it (no GH_ADMIN_TOKEN). Redo the TikTok token step in content/AUTOPOST-SETUP.md before the next TikTok draft.");
  }
  tiktokAccess = j.access_token;
  return tiktokAccess;
}

async function tiktok(item, entry, save, log) {
  const token = await tiktokToken();
  const res = await fetch(item.media[0].url);
  if (!res.ok) throw new Error(`couldn't download the video (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  const size = buf.length;
  const MB = 1024 * 1024;
  const chunk = size <= 64 * MB ? size : 10 * MB; // one chunk up to 64 MB; else 10 MB chunks, the last one takes the rest
  const total = size <= 64 * MB ? 1 : Math.floor(size / chunk);
  const init = await fetch("https://open.tiktokapis.com/v2/post/publish/inbox/video/init/", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify({ source_info: { source: "FILE_UPLOAD", video_size: size, chunk_size: chunk, total_chunk_count: total } }),
  });
  const ij = await init.json().catch(() => ({}));
  if (ij.error?.code !== "ok" || !ij.data?.upload_url) throw new Error(`TikTok init: ${ij.error?.code ?? init.status} ${ij.error?.message ?? ""}`);
  entry.publish_id = ij.data.publish_id;
  save();
  for (let i = 0; i < total; i++) {
    const start = i * chunk;
    const end = i === total - 1 ? size - 1 : start + chunk - 1;
    const put = await fetch(ij.data.upload_url, {
      method: "PUT",
      headers: { "Content-Type": "video/mp4", "Content-Length": String(end - start + 1), "Content-Range": `bytes ${start}-${end}/${size}` },
      body: buf.subarray(start, end + 1),
    });
    if (!put.ok) throw new Error(`TikTok upload chunk ${i + 1}/${total}: ${put.status}`);
  }
  let status = "PROCESSING_UPLOAD";
  for (let i = 0; i < 12 && status !== "SEND_TO_USER_INBOX"; i++) {
    await sleep(5000);
    const s = await fetch("https://open.tiktokapis.com/v2/post/publish/status/fetch/", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({ publish_id: entry.publish_id }),
    })
      .then((r) => r.json())
      .catch(() => ({}));
    status = s.data?.status ?? status;
    if (status === "FAILED") throw new Error(`TikTok processing failed: ${s.data?.fail_reason ?? "unknown"}`);
    log(`    TikTok: ${status}`);
  }
  await notify(
    [
      `📲 **TikTok draft in your inbox: ${item.post}**. Post it at **${sast(item.at)}**.`,
      "",
      "In the TikTok app: tap the notification (or your inbox) → open the draft → Next, then:",
      "1. Paste this caption:",
      "",
      "```",
      item.caption,
      "```",
      item.ai_label ? `2. **More options → turn on "AI-generated content"** (${item.ai_reason}).` : "2. AI label: not needed for this one.",
      "3. Optional: add a trending sound at 5–10% under the voice.",
      "4. Tap Post.",
    ].join("\n"),
  );
  return { status: "draft_sent", platform_id: entry.publish_id, tiktok_status: status, ai_label: item.ai_label ? "Zoran turns it on in the app" : null };
}

const PUBLISHERS = { instagram, facebook, tiktok };

// ---------- main ----------
const weeks = fs
  .readdirSync(queueRoot)
  .filter((d) => /^\d{4}-W\d{2}$/.test(d) && (!onlyWeek || d === onlyWeek) && fs.existsSync(path.join(queueRoot, d, "queue.json")))
  .sort();
console.log(`${dryRun ? "DRY RUN" : "LIVE"} · now ${sast(now)} · ${weeks.length} queue(s) in ${path.relative(process.cwd(), queueRoot) || "."}`);

let done = 0;
for (const week of weeks) {
  const logFile = path.join(queueRoot, week, "published.json");
  const queue = readJson(path.join(queueRoot, week, "queue.json"), null);
  const log = readJson(logFile, { week, items: {}, notices: {} });
  log.notices ??= {};
  const save = () => fs.writeFileSync(logFile, JSON.stringify(log, null, 2) + "\n");
  const problem = approvalProblem(queue);
  const items = [...(queue?.items ?? [])].sort((a, b) => a.run_at.localeCompare(b.run_at));
  console.log(`\n${week}: ${problem ? `⛔ HELD (${problem}). Nothing from this week will post.` : `approved ${queue.approved_at} by ${queue.approved_by}`}`);

  if (problem) {
    for (const it of items) console.log(`  · held      ${sast(it.run_at)}  ${it.platform.padEnd(9)} ${it.post}`);
    const due = items.some((it) => !it.excluded && !log.items[it.id] && Date.parse(it.run_at) <= now.getTime());
    if (queue?.approved && due && log.notices.held !== queue.approval_hash) {
      // approved once but edited afterwards: tell Zoran once per approval
      await notify(`⛔ ${week} was approved but queue.json changed afterwards (${problem}). Nothing from ${week} will post until you approve it again in Claude Code.`);
      if (!dryRun) {
        log.notices.held = queue.approval_hash;
        save();
        checkpoint(`publisher: ${week} held (${problem})`);
      }
    }
    continue;
  }

  for (const it of items) {
    const tag = `${sast(it.run_at)}  ${it.platform.padEnd(9)} ${it.post}`;
    if (it.excluded) {
      console.log(`  · excluded  ${tag}`);
      continue;
    }
    const entry = log.items[it.id];
    if (entry && TERMINAL.has(entry.status)) {
      console.log(`  ✓ ${entry.status.padEnd(9)} ${tag}${entry.permalink ? `  ${entry.permalink}` : ""}`);
      continue;
    }
    const resumable = entry?.status === "claimed" && it.platform === "instagram" && entry.container_id;
    if (entry?.status === "claimed" && !resumable) {
      // A previous run claimed it and died mid-call: it may or may not be live. Never retry blindly.
      console.log(`  ? check     ${tag}  (claimed by an earlier run that didn't finish)`);
      if (!dryRun) {
        Object.assign(entry, { status: "needs_check", checked_at: now.toISOString() });
        save();
        checkpoint(`publisher: ${it.id} needs a manual check`);
        await notify(`❓ **${it.id}** was being posted when a run stopped. Check ${it.platform} by hand: if it isn't there, post it yourself (or delete this item from published.json on the content-queue branch to let the publisher retry).`);
      }
      continue;
    }
    const runAt = Date.parse(it.run_at);
    if (runAt > now.getTime()) {
      console.log(`  … upcoming  ${tag}`);
      continue;
    }
    if ((now.getTime() - runAt) / 60000 > MAX_LATE_MIN && !resumable) {
      console.log(`  ✗ missed    ${tag}  (more than ${MAX_LATE_MIN / 60} h late, not posted)`);
      if (!dryRun) {
        log.items[it.id] = { status: "missed", at: now.toISOString() };
        save();
        checkpoint(`publisher: ${it.id} missed`);
        await notify(`⏰ **${it.id}** was more than ${MAX_LATE_MIN / 60} h late, so it was skipped (not posted). Post it by hand if it still makes sense.`);
      }
      continue;
    }
    if (done >= maxPerRun) {
      console.log(`  … next run  ${tag}  (max ${maxPerRun} per run)`);
      continue;
    }
    const noUrl = it.media.some((m) => !/^https:\/\//.test(m.url ?? ""));
    if (dryRun) {
      const what = it.platform === "tiktok" ? "UPLOAD TO TIKTOK INBOX (draft)" : `PUBLISH ${it.kind.toUpperCase()}`;
      console.log(`  ▶ WOULD     ${tag}  → ${what}${it.ai_label ? ` · AI label (${it.ai_reason})` : ""}${noUrl ? "  ⚠ media has no public URL" : ""}`);
      console.log(`              media: ${it.media.map((m) => m.url ?? m.path).join(", ")}`);
      console.log(`              caption: ${JSON.stringify(it.caption.slice(0, 110))}${it.caption.length > 110 ? "…" : ""}`);
      done++;
      continue;
    }
    if (noUrl) {
      log.items[it.id] = { status: "failed", at: now.toISOString(), error: "media has no public URL (approve.mjs didn't stage it)" };
      save();
      checkpoint(`publisher: ${it.id} failed`);
      await notify(`✗ **${it.id}** wasn't posted: its media has no public URL. Approve ${week} again in Claude Code.`);
      continue;
    }

    // claim → commit → post → record → commit
    const e = (log.items[it.id] = { ...(entry ?? {}), status: "claimed", claimed_at: now.toISOString() });
    save();
    checkpoint(`publisher: claim ${it.id}`);
    console.log(`  ▶ posting   ${tag}`);
    try {
      const result = await PUBLISHERS[it.platform](it, e, save, (m) => console.log(m));
      Object.assign(e, result, { at: new Date().toISOString() });
      console.log(`  ✓ ${e.status} ${e.permalink ?? e.platform_id ?? ""}`);
    } catch (err) {
      Object.assign(e, { status: "failed", at: new Date().toISOString(), error: redact(err.message) });
      console.log(`  ✗ failed: ${e.error}`);
      await notify(`✗ **${it.id}** failed: ${e.error}\nNothing was retried. Fix the cause, then post it by hand, or delete its entry from ${week}/published.json on the content-queue branch to let the publisher retry.`);
    }
    save();
    checkpoint(`publisher: ${it.id} ${e.status}`);
    done++;

    // Optional early clean-up: once every platform for this post is finished, delete its media from storage.
    if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
      const sibs = items.filter((x) => x.post === it.post && !x.excluded);
      if (sibs.every((x) => TERMINAL.has(log.items[x.id]?.status))) {
        const urls = [...new Set(sibs.flatMap((x) => [...x.media, ...(x.cover ? [x.cover] : [])].map((m) => m.url)))];
        await deleteObjects(urls, { supabaseUrl: env.SUPABASE_URL, key: env.SUPABASE_SERVICE_ROLE_KEY }).catch((er) => console.log(`  ! clean-up: ${redact(er.message)}`));
      }
    }
  }
}
console.log(dryRun ? "\nDry run: nothing was posted." : `\nDone: ${done} item(s) handled.`);
