/* Shareable links: /outing/:id, /event/:id, /venue/:id, /memory/:id.
   V6.1 has no backend, so an outing link also carries a compact copy of the plan (?i=…).
   Whoever opens it gets that plan on their device and can join. V7: the link carries only the
   id, and the plan comes from Supabase (with access checked by the invite code). */
import * as R from '@/data/demo/repository';
import { appLink, displayLink } from '@/config/env';

// ---- base64url over UTF-8 (no dependencies; works in Hermes and browsers)
const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
function toBytes(s: string): number[] {
  const out: number[] = [];
  const e = encodeURIComponent(s);
  for (let i = 0; i < e.length; i++) {
    if (e[i] === '%') { out.push(parseInt(e.slice(i + 1, i + 3), 16)); i += 2; } else out.push(e.charCodeAt(i));
  }
  return out;
}
function fromBytes(b: number[]): string {
  return decodeURIComponent(b.map((x) => '%' + x.toString(16).padStart(2, '0')).join(''));
}
export function b64urlEncode(s: string): string {
  const b = toBytes(s); let o = '';
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i] << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    o += A[(n >> 18) & 63] + A[(n >> 12) & 63] + (i + 1 < b.length ? A[(n >> 6) & 63] : '') + (i + 2 < b.length ? A[n & 63] : '');
  }
  return o;
}
export function b64urlDecode(s: string): string {
  const b: number[] = []; let buf = 0, bits = 0;
  for (const ch of s.replace(/=+$/, '')) {
    const v = A.indexOf(ch); if (v < 0) throw new Error('bad link');
    buf = (buf << 6) | v; bits += 6;
    if (bits >= 8) { bits -= 8; b.push((buf >> bits) & 255); }
  }
  return fromBytes(b);
}

export const linkService = {
  outingPath: (id: string) => `/outing/${id}`,
  /** Full invite link: works on any phone, even one that has never opened HOP */
  outingUrl(id: string) {
    const snap = R.snapshotOuting(id);
    return appLink(`/outing/${id}`) + (snap ? `?i=${b64urlEncode(JSON.stringify(snap))}` : '');
  },
  outingDisplay: (id: string) => displayLink(`/outing/${id}`),
  eventUrl: (id: string) => appLink(`/event/${id}`),
  venueUrl: (id: string) => appLink(`/venue/${id}`),
  memoryUrl: (id: string) => appLink(`/memory/${id}`),
  /** Open an outing link: use the local copy if this device has it, else import the shared plan */
  resolveOuting(id: string, payload?: string | null): { ok: true; imported: boolean } | { ok: false } {
    if (R.outing(id)) return { ok: true, imported: false };
    if (!payload) return { ok: false };
    try {
      const snap = JSON.parse(b64urlDecode(payload)) as R.OutingSnapshot;
      if (snap.id !== id) return { ok: false };
      return R.importOuting(snap) ? { ok: true, imported: true } : { ok: false };
    } catch {
      return { ok: false };
    }
  },
};
