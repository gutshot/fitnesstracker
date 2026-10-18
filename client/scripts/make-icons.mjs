// Renders the barbell logo (same geometry as BarbellLogo in src/ui.jsx) into
// the PNG app icons in public/. Dependency-free: rasterizes the rounded
// rectangles with 4×4 supersampling and writes PNGs with zlib.
//   node scripts/make-icons.mjs
import { writeFileSync } from 'fs';
import { deflateSync } from 'zlib';

const BG = [0x0f, 0x0f, 0x0f];
const FG = [0xf0, 0xa0, 0x30];
// [x, y, w, h, rx] in the logo's 24×24 viewBox
const RECTS = [[1, 7, 3, 10, 1.5], [4, 9.5, 2, 5, 0.75], [6, 11, 12, 2, 1], [18, 9.5, 2, 5, 0.75], [20, 7, 3, 10, 1.5]];

function inRoundRect(px, py, [x, y, w, h, r]) {
  if (px < x || px > x + w || py < y || py > y + h) return false;
  const cx = Math.min(Math.max(px, x + r), x + w - r);
  const cy = Math.min(Math.max(py, y + r), y + h - r);
  return (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
}

// `scale` = fraction of the icon the 24-unit logo box occupies.
function render(size, scale) {
  const S = 4, unit = (size * scale) / 24, off = (size - size * scale) / 2;
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3);
    for (let x = 0; x < size; x++) {
      let hit = 0;
      for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
        const lx = (x + (sx + 0.5) / S - off) / unit, ly = (y + (sy + 0.5) / S - off) / unit;
        if (RECTS.some(r => inRoundRect(lx, ly, r))) hit++;
      }
      const a = hit / (S * S);
      for (let c = 0; c < 3; c++) row[1 + x * 3 + c] = Math.round(BG[c] + (FG[c] - BG[c]) * a);
    }
    rows.push(row);
  }
  return png(size, size, Buffer.concat(rows));
}

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td  = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, raw) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

const out = new URL('../public/', import.meta.url);
writeFileSync(new URL('icon-192.png', out),          render(192, 0.78));
writeFileSync(new URL('icon-512.png', out),          render(512, 0.78));
writeFileSync(new URL('icon-maskable-512.png', out), render(512, 0.6));   // inside the 80% safe zone
writeFileSync(new URL('apple-touch-icon.png', out),  render(180, 0.7));
console.log('icons written to public/');
