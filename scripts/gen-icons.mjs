// Generates branded PWA icons (no external deps) into public/icons/.
//   icon-192.png / icon-512.png  → ink background + pitch-green disc  (purpose: any)
//   maskable-512.png             → pitch-green field + ink disc       (purpose: maskable)
// Run: node scripts/gen-icons.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "icons");
mkdirSync(OUT, { recursive: true });

const INK = [7, 10, 9];
const PITCH = [10, 233, 138];

// CRC32 (PNG chunk checksums)
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typed = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed), 0);
  return Buffer.concat([len, typed, crc]);
}
function png(size, rgba) {
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// Draw a disc with light anti-aliasing over a solid background.
function draw(size, bg, fg, discRatio) {
  const buf = Buffer.alloc(size * size * 4);
  const c = (size - 1) / 2;
  const r = size * discRatio;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c);
      const t = Math.min(1, Math.max(0, r + 1 - d)); // 0 outside, 1 inside, soft edge
      const i = (y * size + x) * 4;
      buf[i] = Math.round(bg[0] + (fg[0] - bg[0]) * t);
      buf[i + 1] = Math.round(bg[1] + (fg[1] - bg[1]) * t);
      buf[i + 2] = Math.round(bg[2] + (fg[2] - bg[2]) * t);
      buf[i + 3] = 255;
    }
  }
  return buf;
}

writeFileSync(join(OUT, "icon-192x192.png"), png(192, draw(192, INK, PITCH, 0.36)));
writeFileSync(join(OUT, "icon-512x512.png"), png(512, draw(512, INK, PITCH, 0.36)));
writeFileSync(join(OUT, "icon-maskable-512x512.png"), png(512, draw(512, PITCH, INK, 0.26)));
console.log("✓ wrote icon-192x192.png, icon-512x512.png, icon-maskable-512x512.png to public/icons/");
