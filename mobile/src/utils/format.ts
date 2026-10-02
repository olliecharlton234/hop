import { now } from './clock';
import type { ImageRef, LatLng } from '@/types/models';

// ---- ids + randomness -------------------------------------------------------
/** Deterministic PRNG so seeded content is stable between launches */
export function rng(seed: string | number) {
  let s = 0;
  for (const ch of String(seed)) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const pick = <T,>(r: () => number, arr: T[]): T => arr[Math.floor(r() * arr.length)];
export const uid = (p = 'id') => p + '_' + Math.random().toString(36).slice(2, 9);

// ---- dates -------------------------------------------------------------------
export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "7:30 PM" */
export function time(d: number | Date) {
  const x = new Date(d);
  let h = x.getHours();
  const m = x.getMinutes();
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ap}`;
}
/** "7:30 pm" / "8 pm" */
export const timeShort = (d: number | Date) => time(d).replace(':00', '').toLowerCase();
/** "8pm" / "7:30pm" */
export const hm = (ts: number) => time(ts).replace(':00', '').replace(' ', '').toLowerCase();
export const dayDate = (d: number | Date) => { const x = new Date(d); return `${DAYS[x.getDay()]} ${x.getDate()} ${MONTHS[x.getMonth()]}`; };
export const longDate = (d: number | Date) => { const x = new Date(d); return `${DAYS_LONG[x.getDay()]} ${x.getDate()} ${MONTHS_LONG[x.getMonth()]}`; };
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** "Tonight, 7:30 PM" / "Tomorrow, 7:30 PM" / "Saturday, 7:30 PM" / "Sat 17 Oct · 7:30 PM" */
export function when(d: number, n = now()) {
  const dt = new Date(d);
  const days = Math.round((startOfDay(dt) - startOfDay(new Date(n))) / 864e5);
  if (days === 0) return `Tonight, ${time(dt)}`;
  if (days === 1) return `Tomorrow, ${time(dt)}`;
  if (days > 1 && days < 7) return `${DAYS_LONG[dt.getDay()]}, ${time(dt)}`;
  return `${dayDate(dt)} · ${time(dt)}`;
}
export function ago(ts: number, n = now()) {
  if (ts > n) return 'soon';
  const s = Math.max(0, Math.round((n - ts) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.round(d / 7);
  if (d < 45) return `${w} week${w > 1 ? 's' : ''} ago`;
  const mo = Math.round(d / 30);
  return `${mo} month${mo > 1 ? 's' : ''} ago`;
}
/** "12m" / "1h 20m" since a time */
export const since = (ts: number) => { const m = Math.max(1, Math.round((now() - ts) / 6e4)); return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60 ? (m % 60) + 'm' : ''}`.trim(); };
export const until = (ts: number) => { const m = Math.round((ts - now()) / 6e4); return m <= 0 ? 'now' : m < 60 ? `in ${m}m` : m < 180 ? `in ${Math.floor(m / 60)}h ${m % 60 ? (m % 60) + 'm' : ''}`.trim() : `at ${hm(ts)}`; };
/** "On now" / "Starts in 20m" / "Starts in 1h 10m" / "9pm" */
export function startsIn(start: number, end?: number, n = now()) {
  if (n >= start && (!end || n < end)) return 'On now';
  const m = Math.round((start - n) / 6e4);
  if (m > 0 && m <= 150) return `Starts in ${m < 60 ? m + 'm' : Math.floor(m / 60) + 'h' + (m % 60 ? ' ' + (m % 60) + 'm' : '')}`;
  return hm(start);
}
/** "FRIDAY 2 OCT · 8PM" */
export function eventWhen(ts: number) {
  const d = new Date(ts);
  const t = time(d).replace(':00', '').replace(' ', '');
  return `${DAYS_LONG[d.getDay()].toUpperCase()} ${d.getDate()} ${MONTHS[d.getMonth()].toUpperCase()} · ${t}`;
}
export const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

// ---- geo -------------------------------------------------------------------------
export function metres(a: LatLng, b: LatLng) {
  const R = 6371e3, toR = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
export const walkMins = (a: LatLng, b: LatLng) => Math.max(1, Math.round((metres(a, b) * 1.3) / 80)); // 1.3 = street grid fudge
export const distLabel = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`);

// ---- imagery -------------------------------------------------------------------
/** Seeded photos reference Unsplash with a focal-point crop; real photos carry a uri.
    Always request the size you display (never full resolution in lists). */
export function img(u: ImageRef | null | undefined, w = 400, h = w): string {
  if (!u) return '';
  if (typeof u === 'string') return u;
  const fp = u.fx != null ? `&crop=focalpoint&fp-x=${u.fx}&fp-y=${u.fy}&fp-z=${u.fz}` : '';
  return `https://images.unsplash.com/photo-${u.id}?w=${w}&h=${h}&fit=crop${fp}&q=70&auto=format`;
}
export const photoSrc = (p: { src?: string; thumb?: string; u?: ImageRef }, w: number, h = w) =>
  p.src ? (w <= 400 && p.thumb ? p.thumb : p.src) : img(p.u, w, h);
export const initials = (name: string) => name.split(/\s+/).map((x) => x[0]).slice(0, 2).join('').toUpperCase();
