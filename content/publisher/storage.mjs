// Supabase Storage helpers for the public "content-media" bucket (Meta's API needs public media URLs).
// Used by studio/scripts/approve.mjs (upload, clean-up) and publisher/publish.mjs (optional early clean-up).
// Needs the project URL and a service-role (secret) key. The key never goes in git or in a URL.
export const BUCKET = "content-media";
const MAX_BYTES = 50 * 1024 * 1024; // Supabase Free plan: 50 MB per file

const base = (u) => u.replace(/\/+$/, "");
const headers = (key, extra = {}) => ({ Authorization: `Bearer ${key}`, apikey: key, ...extra });

export const publicUrl = (supabaseUrl, objectPath) => `${base(supabaseUrl)}/storage/v1/object/public/${BUCKET}/${objectPath}`;

export async function ensureBucket({ supabaseUrl, key }) {
  const r = await fetch(`${base(supabaseUrl)}/storage/v1/bucket/${BUCKET}`, { headers: headers(key) });
  if (r.ok) return "exists";
  const c = await fetch(`${base(supabaseUrl)}/storage/v1/bucket`, {
    method: "POST",
    headers: headers(key, { "Content-Type": "application/json" }),
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true, file_size_limit: MAX_BYTES, allowed_mime_types: ["video/mp4", "image/jpeg"] }),
  });
  if (!c.ok) throw new Error(`couldn't create bucket ${BUCKET}: ${c.status} ${await c.text()}`);
  return "created";
}

export async function upload({ supabaseUrl, key }, objectPath, body, contentType) {
  if (body.length > MAX_BYTES) throw new Error(`${objectPath} is ${(body.length / 1048576).toFixed(1)} MB; the free plan allows 50 MB per file`);
  const r = await fetch(`${base(supabaseUrl)}/storage/v1/object/${BUCKET}/${objectPath}`, {
    method: "POST",
    headers: headers(key, { "Content-Type": contentType, "x-upsert": "true", "cache-control": "max-age=3600" }),
    body,
  });
  if (!r.ok) throw new Error(`upload ${objectPath}: ${r.status} ${await r.text()}`);
  return publicUrl(supabaseUrl, objectPath);
}

// Delete objects by their public URLs (only ones inside our bucket).
export async function deleteObjects(urls, { supabaseUrl, key }) {
  const prefix = `${base(supabaseUrl)}/storage/v1/object/public/${BUCKET}/`;
  const prefixes = urls.filter((u) => u?.startsWith(prefix)).map((u) => decodeURIComponent(u.slice(prefix.length)));
  if (!prefixes.length) return 0;
  const r = await fetch(`${base(supabaseUrl)}/storage/v1/object/${BUCKET}`, {
    method: "DELETE",
    headers: headers(key, { "Content-Type": "application/json" }),
    body: JSON.stringify({ prefixes }),
  });
  if (!r.ok) throw new Error(`delete: ${r.status} ${await r.text()}`);
  return prefixes.length;
}
