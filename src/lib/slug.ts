import { randomBytes } from "crypto";

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

// URL-safe, lowercase, unambiguous share slug (e.g. /m/k3f9a8z2).
// Server-only (uses node crypto). Collisions are retried by the caller.
export function randomSlug(length = 8): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}
