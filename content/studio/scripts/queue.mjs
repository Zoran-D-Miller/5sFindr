#!/usr/bin/env node
// Build a week's publish queue from its posts.
//
//   node scripts/queue.mjs 2026-W47            # writes content/2026-W47/queue.json (unapproved)
//   node scripts/queue.mjs 2026-W47 --force    # overwrite even if the queue was already approved
//
// Reads each posts/NN-slug/post.md (Day, "Where and when (SAST)", captions, hashtags, alt text) and
// props.json (type, id, aiVoice). One queue item per platform per post. Times are SAST (+02:00, no DST).
// The queue is always written UNAPPROVED: only scripts/approve.mjs (run when Zoran says
// "approve <week>" in chat) sets approved + approval_hash, and the publisher refuses anything else.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const contentDir = path.resolve(here, "..", "..");
const args = process.argv.slice(2);
const week = args.find((a) => !a.startsWith("--"));
const force = args.includes("--force");
if (!week || !/^\d{4}-W\d{2}$/.test(week)) {
  console.error("Usage: node scripts/queue.mjs <YYYY-Www> [--force]");
  process.exit(1);
}
const weekDir = path.join(contentDir, week);
const queueFile = path.join(weekDir, "queue.json");
if (fs.existsSync(queueFile) && !force) {
  const old = JSON.parse(fs.readFileSync(queueFile, "utf8"));
  if (old.approved) {
    console.error(`${week}/queue.json is already approved. Re-run with --force to rebuild it (that drops the approval).`);
    process.exit(1);
  }
}

const TIKTOK_LEAD_MIN = 30; // TikTok drafts land 30 min before the post time, so Zoran can tap Post on time
const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
const year = Number(week.slice(0, 4));

// "## Heading" → body (until the next ## heading)
function sections(md) {
  const out = {};
  for (const p of md.split(/^## /m).slice(1)) {
    const nl = p.indexOf("\n");
    out[p.slice(0, nl).trim()] = p.slice(nl + 1).trim();
  }
  return out;
}
const field = (md, name) => md.match(new RegExp(`^- \\*\\*${name}:\\*\\*\\s*(.+)$`, "m"))?.[1]?.trim();

// "Caption body\n\nHashtags: #a #b" → { text, hashtags }. A body that is only "(…)" means "not on this platform".
function caption(body) {
  if (!body) return null;
  const tags = body.match(/^Hashtags[^:]*:\s*(.+)$/m)?.[1]?.trim().split(/\s+/).filter((t) => t.startsWith("#")) ?? [];
  const text = body.replace(/^Hashtags[^:]*:.*$/m, "").trim();
  if (!text || /^\([^)]*\)$/s.test(text)) return { text: null, hashtags: tags };
  return { text, hashtags: tags };
}

function altText(secs) {
  const key = Object.keys(secs).find((k) => k.startsWith("Alt text"));
  if (!key) return null;
  const body = secs[key];
  const items = [...body.matchAll(/^\d+\.\s+(.+)$/gm)].map((m) => m[1].trim());
  return items.length ? items : body.replace(/\s+/g, " ").trim();
}

// "TikTok 18:00 · IG Reel 18:30 · FB Reel (Business Suite)" → { tiktok: "18:00", instagram: "18:30", facebook: "18:30" }
function slots(where) {
  const out = {};
  for (const tok of where.split("·").map((t) => t.trim())) {
    const p = /^TikTok/i.test(tok) ? "tiktok" : /^(IG|Instagram)\b/i.test(tok) ? "instagram" : /^(FB|Facebook)\b/i.test(tok) ? "facebook" : null;
    if (!p) continue;
    out[p] = tok.match(/\b(\d{1,2}:\d{2})\b/)?.[1] ?? null;
  }
  if ("facebook" in out && !out.facebook) out.facebook = out.instagram ?? null; // FB follows IG
  return out;
}

// "Tue 17 Nov" + "18:00" → "2026-11-17T18:00:00+02:00"
function sastIso(day, hhmm, minusMin = 0) {
  const m = day.match(/(\d{1,2})\s+([A-Za-z]{3})/);
  if (!m || !(m[2] in MONTHS)) throw new Error(`Can't read day "${day}"`);
  const [h, mi] = hhmm.split(":").map(Number);
  const local = new Date(Date.UTC(year, MONTHS[m[2]], Number(m[1]), h, mi) - minusMin * 60000); // wall clock as UTC
  return local.toISOString().slice(0, 16) + ":00+02:00";
}

const AI_LINE = "AI voiceover.";
const postsDir = path.join(weekDir, "posts");
const items = [];
const warnings = [];
for (const slug of fs.readdirSync(postsDir).sort()) {
  const dir = path.join(postsDir, slug);
  if (!fs.existsSync(path.join(dir, "props.json")) || !fs.existsSync(path.join(dir, "post.md"))) continue;
  const props = JSON.parse(fs.readFileSync(path.join(dir, "props.json"), "utf8"));
  const num = slug.slice(0, 2);
  const md = fs.readFileSync(path.join(dir, "post.md"), "utf8");
  const secs = sections(md);
  const day = field(md, "Day");
  const where = field(md, "Where and when \\(SAST\\)");
  if (!day || !where) {
    warnings.push(`${slug}: no Day or "Where and when" line, skipped`);
    continue;
  }
  const rel = (f) => `posts/${slug}/${f}`;
  const kind = props.type === "carousel" ? "carousel" : "reel";
  const media =
    kind === "carousel"
      ? props.slides.map((_, i) => ({ path: rel(`slides/${String(i + 1).padStart(2, "0")}.png`), url: null, sha256: null }))
      : [{ path: rel(`${props.id ?? slug}.mp4`), url: null, sha256: null }];
  const cover = kind === "reel" ? { path: rel("cover.png"), url: null, sha256: null } : null;
  const ai = props.aiVoice === true || props.type === "cinematic";
  const aiReason = props.type === "cinematic" ? "AI-generated video" : ai ? `AI voiceover (${props.voice ?? "Kokoro"})` : null;
  const alt = altText(secs);
  const capTT = caption(secs["Caption: TikTok"]);
  const capIG = caption(secs["Caption: Instagram + Facebook"]);

  for (const [platform, time] of Object.entries(slots(where))) {
    if (!time) {
      warnings.push(`${slug}: ${platform} has no time, skipped`);
      continue;
    }
    if (platform === "tiktok" && kind === "carousel") continue; // TikTok photo mode stays manual and optional
    const cap = platform === "tiktok" ? capTT : capIG;
    if (!cap?.text) {
      warnings.push(`${slug}: no ${platform} caption, skipped`);
      continue;
    }
    const body = ai ? `${cap.text}\n\n${AI_LINE}` : cap.text;
    const at = sastIso(day, time);
    items.push({
      id: `${week}/${num}/${platform}`,
      post: slug,
      platform,
      kind,
      mode: platform === "tiktok" ? "draft" : "publish", // TikTok: upload to the inbox, Zoran taps Post
      at,
      run_at: platform === "tiktok" ? sastIso(day, time, TIKTOK_LEAD_MIN) : at,
      caption: cap.hashtags.length ? `${body}\n\n${cap.hashtags.join(" ")}` : body,
      hashtags: cap.hashtags,
      alt_text: kind === "carousel" ? (Array.isArray(alt) ? alt : null) : typeof alt === "string" ? alt : null,
      media: media.map((m) => ({ ...m })),
      cover: cover ? { ...cover } : null,
      ai_label: ai,
      ai_reason: aiReason,
      excluded: false,
    });
  }
}
items.sort((a, b) => a.run_at.localeCompare(b.run_at) || a.id.localeCompare(b.id));

const queue = {
  week,
  timezone: "Africa/Johannesburg",
  generated_at: new Date().toISOString(),
  approved: false,
  approved_at: null,
  approved_by: null,
  approval_hash: null,
  items,
};
fs.writeFileSync(queueFile, JSON.stringify(queue, null, 2) + "\n");
for (const w of warnings) console.log(`! ${w}`);
const by = items.reduce((a, i) => ((a[i.platform] = (a[i.platform] ?? 0) + 1), a), {});
console.log(`✓ ${week}/queue.json: ${items.length} items (${Object.entries(by).map(([k, v]) => `${k} ${v}`).join(", ")}), unapproved.`);
