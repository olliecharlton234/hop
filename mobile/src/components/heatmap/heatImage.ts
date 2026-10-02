/* Turns ActivityCells into one semi-transparent image laid over the map (a ground overlay).
   Rendering only: the activity model itself lives behind activityService.
   Colour ramp: blue/cyan quiet → green → yellow → orange → red packed. Forecasts are softer. */
import { Platform } from 'react-native';
import type { ActivityGrid } from '@/types/models';

const RAMP: [number, [number, number, number]][] = [[0, [63, 150, 232]], [0.25, [63, 182, 232]], [0.43, [62, 207, 142]], [0.6, [242, 210, 75]], [0.76, [255, 143, 46]], [0.92, [255, 68, 56]]];
export function ramp(v: number): [number, number, number] {
  for (let n = 1; n < RAMP.length; n++) {
    if (v <= RAMP[n][0]) { const [a, ca] = RAMP[n - 1], [b, cb] = RAMP[n]; const t = (v - a) / (b - a); return [0, 1, 2].map((q) => ca[q] + (cb[q] - ca[q]) * t) as [number, number, number]; }
  }
  return RAMP[RAMP.length - 1][1];
}

// ---- minimal PNG encoder (stored deflate blocks; small images, no dependency) ----------
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b: Uint8Array, s = 0, e = b.length) { let c = 0xffffffff; for (let i = s; i < e; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function encodePNG(w: number, h: number, rgba: Uint8Array) {
  const raw = new Uint8Array(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; raw.set(rgba.subarray(y * w * 4, (y + 1) * w * 4), y * (w * 4 + 1) + 1); }
  const blocks = Math.ceil(raw.length / 65535);
  const z = new Uint8Array(2 + raw.length + blocks * 5 + 4);
  let o = 0; z[o++] = 0x78; z[o++] = 0x01;
  for (let i = 0; i < blocks; i++) {
    const s = i * 65535, len = Math.min(65535, raw.length - s);
    z[o++] = i === blocks - 1 ? 1 : 0; z[o++] = len & 255; z[o++] = len >>> 8; z[o++] = ~len & 255; z[o++] = (~len >>> 8) & 255;
    z.set(raw.subarray(s, s + len), o); o += len;
  }
  let a = 1, b2 = 0; for (let i = 0; i < raw.length; i++) { a = (a + raw[i]) % 65521; b2 = (b2 + a) % 65521; }
  const ad = ((b2 << 16) | a) >>> 0; z[o++] = ad >>> 24; z[o++] = (ad >>> 16) & 255; z[o++] = (ad >>> 8) & 255; z[o++] = ad & 255;
  const chunk = (type: string, data: Uint8Array) => {
    const c = new Uint8Array(12 + data.length); const dv = new DataView(c.buffer);
    dv.setUint32(0, data.length); for (let i = 0; i < 4; i++) c[4 + i] = type.charCodeAt(i);
    c.set(data, 8); dv.setUint32(8 + data.length, crc32(c, 4, 8 + data.length)); return c;
  };
  const ihdr = new Uint8Array(13); const dv = new DataView(ihdr.buffer); dv.setUint32(0, w); dv.setUint32(4, h); ihdr[8] = 8; ihdr[9] = 6;
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', z), chunk('IEND', new Uint8Array(0))];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let k = 0; parts.forEach((p) => { out.set(p, k); k += p.length; });
  return out;
}
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function base64(b: Uint8Array) {
  let s = '';
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i] << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    s += B64[(n >>> 18) & 63] + B64[(n >>> 12) & 63] + (i + 1 < b.length ? B64[(n >>> 6) & 63] : '=') + (i + 2 < b.length ? B64[n & 63] : '=');
  }
  return s;
}

/** Render the grid (bilinear, upsampled ×K) to RGBA. North is the first row. */
export function renderHeat(grid: ActivityGrid, K = 4) {
  const { nx, ny } = grid;
  const by = new Float32Array((nx + 1) * (ny + 1));
  grid.cells.forEach((c) => { const [j, i] = c.id.split(':').map(Number); by[j * (nx + 1) + i] = c.intensity; });
  const val = (j: number, i: number) => (j < 0 || i < 0 || j > ny || i > nx ? 0 : by[j * (nx + 1) + i]);
  const w = nx * K, h = ny * K;
  const px = new Uint8Array(w * h * 4);
  const soft = grid.isForecast ? 0.72 : 1;
  for (let y = 0; y < h; y++) {
    const fj = ny - (y + 0.5) / K; // row 0 = north edge
    const j = Math.floor(fj), dj = fj - j;
    for (let x = 0; x < w; x++) {
      const fi = (x + 0.5) / K; const i = Math.floor(fi), di = fi - i;
      const v = (val(j, i) * (1 - di) + val(j, i + 1) * di) * (1 - dj) + (val(j + 1, i) * (1 - di) + val(j + 1, i + 1) * di) * dj;
      if (v < 0.08) continue;
      const [r, g, b] = ramp(v);
      const o = (y * w + x) * 4;
      px[o] = r; px[o + 1] = g; px[o + 2] = b;
      // quiet is a faint wash; packed is clearly there but never opaque
      px[o + 3] = Math.min(1, (v - 0.08) / 0.12) * (0.05 + 0.4 * Math.min(1, v) ** 1.5) * soft * 255;
    }
  }
  return { w, h, px, bounds: { north: grid.lat0 + ny * grid.step, south: grid.lat0, west: grid.lng0, east: grid.lng0 + nx * grid.step } };
}

let seq = 0;
/** PNG for the overlay: a file on the phone (cached), a data URI on web */
export async function heatImageUri(grid: ActivityGrid): Promise<{ uri: string; bounds: { north: number; south: number; east: number; west: number } }> {
  const { w, h, px, bounds } = renderHeat(grid);
  const b64 = base64(encodePNG(w, h, px));
  if (Platform.OS === 'web') return { uri: 'data:image/png;base64,' + b64, bounds };
  const { File, Paths } = await import('expo-file-system');
  const f = new File(Paths.cache, `hop-heat-${grid.timeWindow}-${++seq}.png`);
  f.write(b64, { encoding: 'base64' });
  // keep the cache small: remove the previous image for this window
  try { const old = new File(Paths.cache, `hop-heat-${grid.timeWindow}-${seq - 2}.png`); if (old.exists) old.delete(); } catch { /* ignore */ }
  return { uri: f.uri, bounds };
}
