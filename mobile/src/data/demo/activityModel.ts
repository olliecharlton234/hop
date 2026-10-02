/* DEMO ACTIVITY MODEL — "where is it busy, now and later?"
   This stands in for a server-side job. The app never calls it directly: it goes through
   services/activityService, which hands the UI ActivityCells and area summaries only.

   Heat(area, time) = Σ weight × signal(area, time), saturated to 0..1, then put into words
   (Quiet · Moderate · Busy · Very busy · Packed).

   Privacy rules (enforced here, and in the real backend later):
   - The map only receives AREA-level heat plus PUBLIC points (public events, venues).
     Private outings, their stops, routes and people never reach the heat layer.
   - User-generated signals (anonymous presence, private plans) only count once a bucket
     (area × time window) passes a minimum size (K thresholds).
   PROTOTYPE: the anonymous city population (DEMO_POP / DEMO_PLANS) is simulated. */
import { hop } from '@/store/hopStore';
import * as R from './repository';
import { now } from '@/utils/clock';
import { hm, metres } from '@/utils/format';
import type { ActivityCell, ActivityGrid, ActivityLevel, Area, AreaInfo, LatLng, TimeWindow, Venue } from '@/types/models';

export const AREAS: Area[] = [
  { id: 'cbd', name: 'CBD', lat: -33.8728, lng: 151.2048, r: 900, suburbs: ['CBD', 'Sydney', 'The Rocks'] },
  { id: 'surryhills', name: 'Surry Hills', lat: -33.8845, lng: 151.2108, r: 700, suburbs: ['Surry Hills'] },
  { id: 'darlinghurst', name: 'Darlinghurst', lat: -33.879, lng: 151.2172, r: 560, suburbs: ['Darlinghurst'] },
  { id: 'newtown', name: 'Newtown', lat: -33.8962, lng: 151.1808, r: 760, suburbs: ['Newtown', 'Enmore'] },
  { id: 'pottspoint', name: 'Potts Point', lat: -33.8727, lng: 151.2238, r: 520, suburbs: ['Potts Point', 'Elizabeth Bay'] },
  { id: 'chippendale', name: 'Chippendale', lat: -33.8878, lng: 151.198, r: 520, suburbs: ['Chippendale', 'Eveleigh'] },
  { id: 'redfern', name: 'Redfern', lat: -33.8925, lng: 151.2055, r: 520, suburbs: ['Redfern'] },
  { id: 'moorepark', name: 'Moore Park', lat: -33.8925, lng: 151.225, r: 560, suburbs: ['Moore Park'] },
  { id: 'paddington', name: 'Paddington', lat: -33.8848, lng: 151.2292, r: 600, suburbs: ['Paddington'] },
  { id: 'glebe', name: 'Glebe', lat: -33.88, lng: 151.186, r: 520, suburbs: ['Glebe'] },
  { id: 'bondi', name: 'Bondi', lat: -33.8915, lng: 151.2745, r: 720, suburbs: ['Bondi'] },
];
export const areaById: Record<string, Area> = Object.fromEntries(AREAS.map((a) => [a.id, a]));
const areaOfSuburb = (sub: string) => AREAS.find((a) => a.suburbs.includes(sub));
export const areaOfPoint = (p: LatLng) => AREAS.map((a) => ({ a, d: metres(a, p) })).filter((x) => x.d < x.a.r * 1.6).sort((x, y) => x.d - y.d)[0]?.a || null;
export const areaOfVenue = (v: Venue) => areaOfSuburb(v.suburb) || areaOfPoint(v);

// ---- PROTOTYPE: simulated anonymous population -----------------------------
// [people at peak on a Friday/Saturday, peak hour (24+ = after midnight), spread in hours, daytime base]
const DEMO_POP: Record<string, [number, number, number, number]> = {
  cbd: [520, 19.5, 2.6, 160], surryhills: [430, 21.5, 2.6, 60], darlinghurst: [380, 23.5, 2.4, 30], newtown: [470, 21.5, 2.8, 90],
  pottspoint: [260, 23, 2.4, 20], chippendale: [180, 20.5, 2.4, 30], redfern: [140, 20.5, 2.4, 25], moorepark: [90, 20, 2, 20],
  paddington: [110, 18, 3, 70], glebe: [120, 19, 3, 60], bondi: [300, 15, 4, 220],
};
const DEMO_PLANS: Record<string, number> = { cbd: 34, surryhills: 41, darlinghurst: 29, newtown: 38, pottspoint: 14, chippendale: 12, redfern: 9, moorepark: 6, paddington: 7, glebe: 6, bondi: 18 };

export const K_PEOPLE = 15; // anonymous active people in an area
export const K_GROUPS = 3; // private outings planned in an area within the window

const hourOf = (t: number) => { const d = new Date(t); let h = d.getHours() + d.getMinutes() / 60; if (h < 6) h += 24; return h; };
const dayFactor = (t: number) => ({ 5: 1, 6: 1.08, 0: 0.72, 4: 0.62 } as Record<number, number>)[new Date(t - 6 * 36e5).getDay()] ?? 0.45;
const bell = (h: number, peak: number, spread: number) => Math.exp(-(((h - peak) / spread) ** 2));
type Ctx = { isNow?: boolean };

// ---- signal sources ----------------------------------------------------------
export const SOURCES: { id: string; weight: number; value: (a: Area, t: number, ctx: Ctx) => number }[] = [
  {
    id: 'presence', weight: 0.34, // opted-in people active in the area (anonymous count)
    value(a, t, ctx) {
      const [peak, ph, spread, base] = DEMO_POP[a.id] || [60, 21, 2.5, 20];
      let people = (base + (peak - base) * bell(hourOf(t), ph, spread)) * dayFactor(t);
      if (!ctx.isNow) people *= 0.9; // further out = estimate, not observation
      return people < K_PEOPLE ? 0 : Math.min(1, people / 520);
    },
  },
  {
    id: 'planned', weight: 0.22, // outings planned with a stop here around t
    value(a, t) {
      let groups = 0, people = 0, publicPeople = 0;
      hop.state.outings.forEach((o) => {
        if (o.status === 'ended') return;
        const hit = R.stopsOf(o.id).some((s, i, st) => {
          const end = st[i + 1] ? st[i + 1].at : s.at + 2 * 36e5;
          const p = R.placeOf(s);
          return p && t >= s.at - 30 * 6e4 && t < end && areaOfPoint(p)?.id === a.id;
        });
        if (!hit) return;
        const n = R.going(o.id).length;
        if (o.visibility === 'public') publicPeople += n;
        else { groups += 1; people += n; }
      });
      const h = hourOf(t);
      const demoGroups = (DEMO_PLANS[a.id] || 4) * bell(h, (DEMO_POP[a.id] || [0, 21])[1], 2.4) * dayFactor(t);
      const totalGroups = groups + demoGroups;
      const privateCounted = totalGroups >= K_GROUPS ? people + demoGroups * 6 : 0;
      return Math.min(1, (privateCounted + publicPeople) / 260);
    },
  },
  {
    id: 'events', weight: 0.2, // public events by scale (interest), active around t
    value(a, t) {
      let v = 0;
      R.allEvents().forEach((e) => {
        if (t < e.startsAt - 45 * 6e4 || t > e.endsAt) return;
        const p = R.eventPlace(e);
        if (!p || areaOfPoint(p)?.id !== a.id) return;
        v += Math.log10(e.interested + 10) / 3.4;
      });
      return Math.min(1, v / 2.2);
    },
  },
  {
    id: 'venues', weight: 0.16, // how busy the area's venues usually are at this hour
    value(a, t) {
      const vs = R.venues.filter((v) => areaOfVenue(v)?.id === a.id);
      if (!vs.length) return 0.08;
      const h = hourOf(t);
      const sum = vs.reduce((n, v) => { const [pop, peak] = R.POP[v.id] || [0.3, 21]; return n + pop * bell(h, peak, 3.2); }, 0);
      return Math.min(1, (sum / 4) * dayFactor(t));
    },
  },
  {
    id: 'reports', weight: 0.1, // recent crowd reports; decays, needs 2+ to count, capped
    value(a, t, ctx) {
      if (!ctx.isNow) return 0;
      const CROWD: Record<string, number> = { quiet: 0.15, moderate: 0.45, busy: 0.75, packed: 1 };
      const rs = (hop.state.reports || []).filter((r) => r.kind === 'crowd' && t - r.at < 90 * 6e4 && t >= r.at)
        .filter((r) => { const v = R.venueById[r.venueId]; return v && areaOfVenue(v)?.id === a.id; });
      if (rs.length < 2) return 0;
      let w = 0, sum = 0;
      rs.forEach((r) => { const k = Math.exp(-(t - r.at) / (45 * 6e4)); w += k; sum += k * (CROWD[r.value] ?? 0.5); });
      return Math.min(1, (sum / w) * Math.min(1, rs.length / 6));
    },
  },
  {
    id: 'recent', weight: 0.08, // photos from outings in the last hour, capped
    value(a, t, ctx) {
      if (!ctx.isNow) return 0;
      const n = hop.state.photos.filter((p) => t - p.takenAt < 36e5 && t >= p.takenAt).filter((p) => {
        const st = hop.state.stops.find((s) => s.id === p.stopId); const pl = st && R.placeOf(st);
        return pl && areaOfPoint(pl)?.id === a.id;
      }).length;
      return n < 5 ? 0 : Math.min(1, n / 40);
    },
  },
];

// ---- levels ---------------------------------------------------------------------
export const LEVELS: [number, string, ActivityLevel][] = [[0.25, 'Quiet', 'QUIET'], [0.43, 'Moderate', 'MODERATE'], [0.6, 'Busy', 'BUSY'], [0.76, 'Very busy', 'VERY_BUSY'], [1.01, 'Packed', 'PACKED']];
export const levelCode = (h: number) => LEVELS.find(([max]) => h < max)![2];
export const level = (h: number) => LEVELS.find(([max]) => h < max)![1];
export const levelIdx = (h: number) => LEVELS.findIndex(([max]) => h < max);
R.registerLevels((h) => ({ label: level(h), lv: levelIdx(h) }));

// ---- scoring ------------------------------------------------------------------------
const cache = new Map<string, { heat: number; parts: Record<string, number> }>();
export function score(areaId: string, t: number, ctx: Ctx = {}) {
  const a = areaById[areaId];
  const s = hop.state;
  const key = `${areaId}|${Math.round(t / 3e5)}|${ctx.isNow ? 1 : 0}|${s.photos.length}|${s.stops.length}|${s.reports.length}|${s.outings.length}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const parts: Record<string, number> = {};
  let raw = 0;
  SOURCES.forEach((src) => { const v = src.value(a, t, ctx); parts[src.id] = v; raw += src.weight * v; });
  const heat = 1 - Math.exp(-raw * 2.2); // saturate: lots of signals → busy, never > 1
  const out = { heat, parts };
  cache.set(key, out);
  if (cache.size > 4000) cache.clear();
  return out;
}

export const WINDOWS: [TimeWindow, string][] = [['now', 'Now'], ['later', 'Later tonight'], ['tomorrow', 'Tomorrow'], ['weekend', 'This weekend']];
export function windowTime(w: TimeWindow, n = now()) {
  const d = new Date(n);
  const at = (dayAdd: number, h: number, m = 0) => { const x = new Date(d); x.setDate(x.getDate() + dayAdd); x.setHours(h, m, 0, 0); return x.getTime(); };
  if (w === 'later') return hourOf(n) < 21.5 ? at(0, 22) : n + 90 * 6e4;
  if (w === 'tomorrow') return at(1, 21, 30);
  if (w === 'weekend') { let k = 0; while (new Date(at(k, 12)).getDay() !== 6) k++; return at(k, 22); }
  return n;
}

/** What an area is like for a window, in words, with the trend and peak */
export function areaInfo(areaId: string, w: TimeWindow = 'now'): AreaInfo {
  const n = now();
  const t = windowTime(w, n);
  const isNow = w === 'now';
  const { heat } = score(areaId, t, { isNow });
  const base = new Date(t); base.setHours(16, 0, 0, 0);
  if (hourOf(t) >= 24) base.setDate(base.getDate() - 1);
  let peak = { t: base.getTime(), heat: 0 };
  for (let k = 0; k <= 22; k++) { const tt = base.getTime() + k * 30 * 6e4; const s = score(areaId, tt).heat; if (s > peak.heat) peak = { t: tt, heat: s }; }
  const ahead = score(areaId, t + 90 * 6e4).heat;
  const late = score(areaId, base.getTime() + 9.5 * 36e5).heat;
  const trend = ahead - heat > 0.06 ? 'rising' : heat - ahead > 0.08 ? 'easing' : 'steady';
  const peakLabel = hm(peak.t);
  let note: string;
  if (!isNow) note = `Expected ${level(heat).toLowerCase()}`;
  else if (trend === 'rising') note = `Rising · peak around ${peakLabel}`;
  else if (late > 0.6) note = 'Busy until late';
  else if (trend === 'easing') note = 'Winding down';
  else note = `Peak around ${peakLabel}`;
  let span = '';
  for (let k = 0, on: number | null = null; k <= 22; k++) {
    const tt = base.getTime() + k * 30 * 6e4; const b = score(areaId, tt).heat >= 0.6;
    if (b && on === null) on = tt;
    if ((!b || k === 22) && on !== null) { span = `${hm(on).replace(/(am|pm)$/, '')}–${hm(tt)}`; break; }
  }
  return { area: areaById[areaId], heat, level: level(heat), code: levelCode(heat), lv: levelIdx(heat), trend, peak: `Peak around ${peakLabel}`, peakLevel: level(peak.heat), note, span, t, isNow };
}

const WHY: Record<string, string> = { presence: 'lots of people out', planned: 'many nights out planned here', events: 'events on', venues: 'popular venues', reports: 'recent crowd reports', recent: 'photos being taken' };
/** Why an area is busy, in words, from the strongest signals */
export function why(areaId: string, w: TimeWindow = 'now') {
  const t = windowTime(w);
  const { parts } = score(areaId, t, { isNow: w === 'now' });
  return SOURCES.map((s) => ({ id: s.id, v: parts[s.id] * s.weight })).filter((x) => x.v > 0.02).sort((a, b) => b.v - a.v).slice(0, 3).map((x) => WHY[x.id]);
}

/** Things the viewer may see in an area for a window (friends only for "now") */
export function areaPublic(areaId: string, w: TimeWindow = 'now') {
  const t = windowTime(w);
  const k = R.dayKey(t);
  const events = R.upcomingEvents(now()).filter((e) => { const p = R.eventPlace(e); return p && areaOfPoint(p)?.id === areaId && (w === 'weekend' ? Math.abs(R.dayKey(e.startsAt) - k) <= 864e5 : R.dayKey(e.startsAt) === k); });
  const friends = w === 'now' ? R.friendsOut().filter((f) => { const p = f.venueId ? R.venueById[f.venueId] : f.eventId ? R.eventPlace(R.eventById(f.eventId)) : null; return p && areaOfPoint(p)?.id === areaId; }) : [];
  const venues = R.venues.filter((v) => areaOfVenue(v)?.id === areaId).map((v) => ({ v, act: R.venueActivity(v.id) })).sort((x, y) => y.act.busy - x.act.busy);
  return { events, friends, venues, popular: venues.filter((x) => x.act.hot), area: areaById[areaId] };
}

/** Planning context: "Newtown expected busy around 9:30pm" (never a recommendation) */
export function levelAt(areaId: string, t: number) {
  const h = score(areaId, t, { isNow: Math.abs(t - now()) < 15 * 6e4 }).heat;
  return { heat: h, level: level(h), code: levelCode(h), lv: levelIdx(h) };
}

// ---- the grid the map consumes -------------------------------------------------------
// Public points (events, venue patterns) on top of smoothed area scores. ~220 m cells.
function field(w: TimeWindow) {
  const t = windowTime(w);
  const pts: { lat: number; lng: number; r: number; w: number }[] = [];
  R.allEvents().forEach((e) => {
    if (t < e.startsAt - 45 * 6e4 || t > e.endsAt) return;
    const p = R.eventPlace(e);
    if (p) pts.push({ lat: p.lat, lng: p.lng, r: 160 + Math.log10(e.interested + 10) * 90, w: Math.min(0.85, Math.log10(e.interested + 10) / 3.6) });
  });
  R.venues.forEach((v) => {
    const [pop, peak] = R.POP[v.id] || [0.3, 21];
    const b = pop * bell(hourOf(t), peak, 3.2) * dayFactor(t);
    if (b > 0.3) pts.push({ lat: v.lat, lng: v.lng, r: 150, w: b * 0.7 });
  });
  return pts;
}
export const GRID = { lat0: -33.925, lat1: -33.845, lng0: 151.155, lng1: 151.3, step: 0.002 };
const gridCache = new Map<string, ActivityGrid>();
export function cells(w: TimeWindow = 'now'): ActivityGrid {
  const t = windowTime(w);
  const s = hop.state;
  const key = `${w}|${Math.round(t / 3e5)}|${s.reports.length}|${s.stops.length}|${s.photos.length}|${s.outings.length}`;
  const hit = gridCache.get(key);
  if (hit) return hit;
  const isNow = w === 'now';
  const areas = AREAS.map((a) => ({ a, h: score(a.id, t, { isNow }).heat }));
  const pts = field(w);
  const out: ActivityCell[] = [];
  const ny = Math.round((GRID.lat1 - GRID.lat0) / GRID.step), nx = Math.round((GRID.lng1 - GRID.lng0) / GRID.step);
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    const lat = GRID.lat0 + j * GRID.step, lng = GRID.lng0 + i * GRID.step;
    let v = 0, wsum = 0;
    areas.forEach(({ a, h }) => {
      const d = metres(a, { lat, lng }) / (a.r * 1.15);
      if (d > 2.6) return;
      const wt = Math.exp(-d * d);
      v = Math.max(v, h * wt); wsum += wt;
    });
    pts.forEach((p) => { const d = metres(p, { lat, lng }) / p.r; if (d < 2.2) v = Math.min(1, v + p.w * 0.22 * Math.exp(-d * d)); });
    if (v < 0.06) continue;
    out.push({ id: `${j}:${i}`, latitude: lat, longitude: lng, intensity: v, activityLevel: levelCode(v), confidence: Math.min(1, wsum) * (isNow ? 1 : 0.7), timeWindow: w, isForecast: !isNow });
  }
  const res: ActivityGrid = { lat0: GRID.lat0, lng0: GRID.lng0, step: GRID.step, nx, ny, cells: out, isForecast: !isNow, timeWindow: w };
  gridCache.clear(); gridCache.set(key, res);
  return res;
}

/** Which area did the user tap? Only areas with something going on. */
export function areaAt(p: LatLng, w: TimeWindow = 'now') {
  const t = windowTime(w);
  return AREAS.map((a) => ({ a, d: metres(a, p) / a.r, h: score(a.id, t, { isNow: w === 'now' }).heat })).filter((x) => x.d < 1.4 && x.h >= 0.25).sort((x, y) => x.d - y.d)[0]?.a || null;
}
