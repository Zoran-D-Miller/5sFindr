// Approval fingerprint shared by studio/scripts/approve.mjs (writes it) and publisher/publish.mjs (checks it).
// It covers the week and every item field (captions, times, media URLs + sha256, AI label, exclusions),
// so any edit to queue.json after Zoran's approval makes the whole week unpublishable until re-approved.
import crypto from "node:crypto";

function stable(v) {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(",")}}`;
  return JSON.stringify(v ?? null);
}

export function approvalHash(queue) {
  return crypto.createHash("sha256").update(stable({ week: queue.week, items: queue.items })).digest("hex");
}

// Why a queue must not publish, or null if it's properly approved.
export function approvalProblem(queue) {
  if (!queue || typeof queue !== "object") return "not a queue";
  if (queue.approved !== true) return "not approved";
  if (!queue.approved_at || !queue.approval_hash) return "approval is incomplete";
  if (approvalHash(queue) !== queue.approval_hash) return "queue.json changed after approval (hash mismatch)";
  return null;
}
