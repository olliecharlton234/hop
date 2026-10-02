/* HOP — City activity. Answers one question: where is it busy, now and later?

   Heat(area, time) = Σ weight × signal(area, time), saturated to 0..1, then put into words
   (Quiet · Moderate · Busy · Very busy · Packed). Each signal is a pluggable source, so the scoring
   model can improve without touching the map.

   Privacy rules, enforced here and nowhere else:
   - The map only ever receives AREA-level heat plus PUBLIC points (public events, venues).
     Private outings, their stops, routes and people never reach the heat layer.
   - User-generated signals (anonymous presence, private plans) only count once a bucket
     (area × time window) passes a minimum size. Small groups contribute nothing visible.
   - Seeing friends on the map stays a separate, explicit opt-in (store.friendsOut).

   PROTOTYPE: the anonymous city population (DEMO_*) is simulated. Real friends' outings and
   public events from the demo data also feed in, the same way production data would. */

HOP.activity = (() => {
  const S = () => HOP.store;
  const EV = () => HOP.events;
  const { metres } = HOP.util;

  // Neighbourhoods are the unit of aggregation
  const AREAS = [
    { id: 'cbd', name: 'CBD', lat: -33.8728, lng: 151.2048, r: 900, suburbs: ['CBD', 'Sydney', 'The Rocks'] },
    { id: 'surryhills', name: 'Surry Hills', lat: -33.8845, lng: 151.2108, r: 700, suburbs: ['Surry Hills'] },
    { id: 'darlinghurst', name: 'Darlinghurst', lat: -33.8790, lng: 151.2172, r: 560, suburbs: ['Darlinghurst'] },
    { id: 'newtown', name: 'Newtown', lat: -33.8962, lng: 151.1808, r: 760, suburbs: ['Newtown', 'Enmore'] },
    { id: 'pottspoint', name: 'Potts Point', lat: -33.8727, lng: 151.2238, r: 520, suburbs: ['Potts Point', 'Elizabeth Bay'] },
    { id: 'chippendale', name: 'Chippendale', lat: -33.8878, lng: 151.1980, r: 520, suburbs: ['Chippendale', 'Eveleigh'] },
    { id: 'redfern', name: 'Redfern', lat: -33.8925, lng: 151.2055, r: 520, suburbs: ['Redfern'] },
    { id: 'moorepark', name: 'Moore Park', lat: -33.8925, lng: 151.2250, r: 560, suburbs: ['Moore Park'] },
    { id: 'paddington', name: 'Paddington', lat: -33.8848, lng: 151.2292, r: 600, suburbs: ['Paddington'] },
    { id: 'glebe', name: 'Glebe', lat: -33.8800, lng: 151.1860, r: 520, suburbs: ['Glebe'] },
    { id: 'bondi', name: 'Bondi', lat: -33.8915, lng: 151.2745, r: 720, suburbs: ['Bondi'] },
  ];
  const byId = Object.fromEntries(AREAS.map((a) => [a.id, a]));
  const areaOfSuburb = (sub) => AREAS.find((a) => a.suburbs.includes(sub));
  const areaOfPoint = (p) => AREAS.map((a) => ({ a, d: metres(a, p) })).filter((x) => x.d < x.a.r * 1.6).sort((x, y) => x.d - y.d)[0]?.a || null;
  const areaOfVenue = (v) => areaOfSuburb(v.suburb) || areaOfPoint(v);

  // ---- PROTOTYPE: simulated anonymous population -----------------------------
  // [people at peak on a Friday/Saturday, peak hour (24+ = after midnight), spread in hours, daytime base]
  const DEMO_POP = {
    cbd: [520, 19.5, 2.6, 160], surryhills: [430, 21.5, 2.6, 60], darlinghurst: [380, 23.5, 2.4, 30], newtown: [470, 21.5, 2.8, 90],
    pottspoint: [260, 23, 2.4, 20], chippendale: [180, 20.5, 2.4, 30], redfern: [140, 20.5, 2.4, 25], moorepark: [90, 20, 2, 20],
    paddington: [110, 18, 3, 70], glebe: [120, 19, 3, 60], bondi: [300, 15, 4, 220],
  };
  // groups who've planned something here (anonymous counts, all outings on the platform)
  const DEMO_PLANS = { cbd: 34, surryhills: 41, darlinghurst: 29, newtown: 38, pottspoint: 14, chippendale: 12, redfern: 9, moorepark: 6, paddington: 7, glebe: 6, bondi: 18 };

  // Privacy thresholds: below these, user-generated signals are dropped for that bucket
  const K_PEOPLE = 15;   // anonymous active people in an area
  const K_GROUPS = 3;    // private outings planned in an area within the window

  const hourOf = (t) => { const d = new Date(t); let h = d.getHours() + d.getMinutes() / 60; if (h < 6) h += 24; return h; };
  const dayFactor = (t) => ({ 5: 1, 6: 1.08, 0: 0.72, 4: 0.62 }[new Date(t - 6 * 36e5).getDay()] ?? 0.45);
  const bell = (h, peak, spread) => Math.exp(-(((h - peak) / spread) ** 2));

  // ---- signal sources ----------------------------------------------------------
  // Each returns a value roughly 0..1 for (area, t). Add or swap sources freely.
  const SOURCES = [
    {
      id: 'presence', weight: 0.34, // opted-in people active in the area right now (anonymous count)
      value(a, t, ctx) {
        const [peak, ph, spread, base] = DEMO_POP[a.id] || [60, 21, 2.5, 20];
        let people = (base + (peak - base) * bell(hourOf(t), ph, spread)) * dayFactor(t);
        if (!ctx.isNow) people *= 0.9; // further out = estimate, not observation
        return people < K_PEOPLE ? 0 : Math.min(1, people / 520);
      },
    },
    {
      id: 'planned', weight: 0.22, // outings planned on the platform with a stop here around t
      value(a, t) {
        let groups = 0, people = 0, publicPeople = 0;
        S().state.outings.forEach((o) => {
          if (o.status === 'ended') return;
          const hit = S().stopsOf(o.id).some((s, i, st) => {
            const end = st[i + 1] ? st[i + 1].at : s.at + 2 * 36e5;
            const p = S().placeOf(s);
            return p && t >= s.at - 30 * 6e4 && t < end && areaOfPoint(p)?.id === a.id;
          });
          if (!hit) return;
          const n = S().going(o.id).length;
          if (o.visibility === 'public') publicPeople += n;
          else { groups += 1; people += n; }
        });
        // anonymous plans from everyone else on the platform (simulated)
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
        EV().all().forEach((e) => {
          if (t < e.startsAt - 45 * 6e4 || t > e.endsAt) return;
          const p = EV().placeOf(e);
          if (!p || areaOfPoint(p)?.id !== a.id) return;
          v += Math.log10(e.interested + 10) / 3.4; // trivia ≈ .5, 2,300-person gig ≈ 1
        });
        return Math.min(1, v / 2.2);
      },
    },
    {
      id: 'venues', weight: 0.16, // how busy the area's venues usually are at this hour
      value(a, t) {
        const vs = S().venues.filter((v) => areaOfVenue(v)?.id === a.id);
        if (!vs.length) return 0.08;
        const h = hourOf(t);
        const sum = vs.reduce((n, v) => { const [pop, peak] = HOP.seed.POP[v.id] || [0.3, 21]; return n + pop * bell(h, peak, 3.2); }, 0);
        return Math.min(1, (sum / 4) * dayFactor(t));
      },
    },
    {
      id: 'reports', weight: 0.1, // recent crowd reports from people at venues; decays, needs 2+ to count, capped
      value(a, t, ctx) {
        if (!ctx.isNow) return 0;
        const CROWD = { quiet: 0.15, moderate: 0.45, busy: 0.75, packed: 1 };
        const rs = (S().state.reports || []).filter((r) => r.kind === 'crowd' && t - r.at < 90 * 6e4 && t >= r.at)
          .filter((r) => { const v = S().venueById[r.venueId]; return v && areaOfVenue(v)?.id === a.id; });
        if (rs.length < 2) return 0;
        let w = 0, sum = 0;
        rs.forEach((r) => { const k = Math.exp(-(t - r.at) / (45 * 6e4)); w += k; sum += k * (CROWD[r.value] ?? 0.5); });
        return Math.min(1, (sum / w) * Math.min(1, rs.length / 6));
      },
    },
    {
      id: 'recent', weight: 0.08, // photos from outings in the last hour, capped so it can't dominate
      value(a, t, ctx) {
        if (!ctx.isNow) return 0;
        const n = S().state.photos.filter((p) => t - p.takenAt < 36e5 && t >= p.takenAt).filter((p) => {
          const st = S().state.stops.find((s) => s.id === p.stopId); const pl = st && S().placeOf(st);
          return pl && areaOfPoint(pl)?.id === a.id;
        }).length;
        return n < 5 ? 0 : Math.min(1, n / 40);
      },
    },
  ];

  // ---- scoring -------------------------------------------------------------------
  const cache = new Map();
  function score(areaId, t, ctx = {}) {
    const a = byId[areaId];
    const key = `${areaId}|${Math.round(t / 3e5)}|${ctx.isNow ? 1 : 0}|${S().state.photos.length}|${S().state.stops.length}`;
    if (cache.has(key)) return cache.get(key);
    const parts = {};
    let raw = 0;
    SOURCES.forEach((s) => { const v = s.value(a, t, ctx); parts[s.id] = v; raw += s.weight * v; });
    const heat = 1 - Math.exp(-raw * 2.2); // saturate: lots of signals → "very busy", never > 1
    const out = { heat, parts };
    cache.set(key, out);
    if (cache.size > 4000) cache.clear();
    return out;
  }
  // Five levels. The map turns these into colour: blue, green, yellow, orange, red.
  const LEVELS = [[0.25, 'Quiet', 'QUIET'], [0.43, 'Moderate', 'MODERATE'], [0.6, 'Busy', 'BUSY'], [0.76, 'Very busy', 'VERY_BUSY'], [1.01, 'Packed', 'PACKED']];
  const levelCode = (h) => LEVELS.find(([max]) => h < max)[2];
  const meter = (lv) => `<span class="lvm lv${lv}" aria-hidden="true">${[0, 1, 2, 3, 4].map((k) => `<i class="${k <= lv ? 'on' : ''}"></i>`).join('')}</span>`;
  const level = (h) => LEVELS.find(([max]) => h < max)[1];
  const levelIdx = (h) => LEVELS.findIndex(([max]) => h < max);

  // ---- time windows the user can pick ----------------------------------------
  function windowTime(when, now = HOP.now()) {
    const d = new Date(now);
    const at = (dayAdd, h, m = 0) => { const x = new Date(d); x.setDate(x.getDate() + dayAdd); x.setHours(h, m, 0, 0); return x.getTime(); };
    if (when === 'later') return hourOf(now) < 21.5 ? at(0, 22) : now + 90 * 6e4;
    if (when === 'tomorrow') return at(hourOf(now) >= 24 ? 0 : 1, 21, 30);
    if (when === 'weekend') { let k = 0; while (new Date(at(k, 12)).getDay() !== 6) k++; return at(k, 22); }
    return now;
  }
  const WINDOWS = [['now', 'Now'], ['later', 'Later tonight'], ['tomorrow', 'Tomorrow'], ['weekend', 'This weekend']];

  // What an area is like for a window, in words, with the trend and peak
  function areaInfo(areaId, when = 'now') {
    const now = HOP.now();
    const t = windowTime(when, now);
    const isNow = when === 'now';
    const { heat } = score(areaId, t, { isNow });
    // look across the evening containing t to find the peak and the trend
    const base = new Date(t); base.setHours(16, 0, 0, 0);
    if (hourOf(t) >= 24) base.setDate(base.getDate() - 1);
    let peak = { h: 0, heat: 0 };
    for (let k = 0; k <= 22; k++) { const tt = base.getTime() + k * 30 * 6e4; const s = score(areaId, tt).heat; if (s > peak.heat) peak = { t: tt, heat: s }; }
    const ahead = score(areaId, t + 90 * 6e4).heat;
    const late = score(areaId, base.getTime() + 9.5 * 36e5).heat; // 1:30 AM
    const trend = ahead - heat > 0.06 ? 'rising' : heat - ahead > 0.08 ? 'winding down' : 'steady';
    const peakLabel = HOP.util.hm(peak.t);
    let note;
    if (!isNow) note = `Expected ${level(heat).toLowerCase()}`;
    else if (trend === 'rising') note = `Rising · peak around ${peakLabel}`;
    else if (late > 0.6) note = 'Busy until late';
    else if (trend === 'winding down') note = 'Winding down';
    else note = `Peak around ${peakLabel}`;
    // "Expected busy · 8–11pm"
    let span = '';
    for (let k = 0, on = null; k <= 22; k++) {
      const tt = base.getTime() + k * 30 * 6e4; const b = score(areaId, tt).heat >= 0.6;
      if (b && on === null) on = tt;
      if ((!b || k === 22) && on !== null) { span = `${HOP.util.hm(on).replace(/(am|pm)$/, '')}–${HOP.util.hm(tt)}`; break; }
    }
    // peak level over the evening, for "Expected packed · 9–11pm"
    const peakLevel = level(peak.heat);
    return { area: byId[areaId], heat, level: level(heat), code: levelCode(heat), lv: levelIdx(heat), trend, peak: peakLabel, peakLevel, note, span, t, isNow };
  }

  // Why an area is busy, in words, from the strongest signals
  const WHY = { presence: 'lots of people out', planned: 'many nights out planned here', events: 'events on', venues: 'popular venues', reports: 'recent crowd reports', recent: 'photos being taken' };
  function why(areaId, when = 'now') {
    const t = windowTime(when);
    const { parts } = score(areaId, t, { isNow: when === 'now' });
    return SOURCES.map((s) => ({ id: s.id, v: parts[s.id] * s.weight })).filter((x) => x.v > 0.02).sort((a, b) => b.v - a.v).slice(0, 3).map((x) => WHY[x.id]);
  }

  // Things the user is allowed to see in an area for a window (friends: only for now)
  function areaPublic(areaId, when = 'now') {
    const t = windowTime(when);
    const a = byId[areaId];
    const k = EV().dayKey(t);
    const events = EV().upcoming(HOP.now()).filter((e) => { const p = EV().placeOf(e); return p && areaOfPoint(p)?.id === areaId && (when === 'weekend' ? Math.abs(EV().dayKey(e.startsAt) - k) <= 864e5 : EV().dayKey(e.startsAt) === k); });
    const friends = when === 'now' ? S().friendsOut().filter((f) => {
      const p = f.venueId ? S().venueById[f.venueId] : f.eventId && EV().placeOf(EV().byId(f.eventId));
      return p && areaOfPoint(p)?.id === areaId;
    }) : [];
    const venues = S().venues.filter((v) => areaOfVenue(v)?.id === areaId).map((v) => ({ v, act: S().activity(v.id) })).sort((x, y) => y.act.busy - x.act.busy);
    return { events, friends, venues, popular: venues.filter((x) => x.act.hot), area: a };
  }

  // ---- Cells: what the map consumes --------------------------------------------
  // A regular grid (~220 m). Each cell: { cell, lat, lng, intensity 0..1, level, confidence, timeWindow }.
  // Built from area scores (smoothed) + public points. Swap in H3 cells later without touching the map.
  const GRID = { lat0: -33.925, lat1: -33.845, lng0: 151.155, lng1: 151.300, step: 0.002 };
  const cellCache = new Map();
  function cells(when = 'now') {
    const t = windowTime(when);
    const key = `${when}|${Math.round(t / 3e5)}|${(S().state.reports || []).length}|${S().state.stops.length}|${S().state.photos.length}`;
    if (cellCache.has(key)) return cellCache.get(key);
    const isNow = when === 'now';
    const areas = AREAS.map((a) => ({ a, h: score(a.id, t, { isNow }).heat }));
    const pts = field(when).filter((p) => !p.area);
    const out = [];
    const ny = Math.round((GRID.lat1 - GRID.lat0) / GRID.step), nx = Math.round((GRID.lng1 - GRID.lng0) / GRID.step);
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
      const lat = GRID.lat0 + j * GRID.step, lng = GRID.lng0 + i * GRID.step;
      let v = 0, wsum = 0;
      areas.forEach(({ a, h }) => {
        const d = metres(a, { lat, lng }) / (a.r * 1.15);
        if (d > 2.6) return;
        const w = Math.exp(-d * d);
        v = Math.max(v, h * w); wsum += w;
      });
      pts.forEach((p) => { const d = metres(p, { lat, lng }) / p.r; if (d < 2.2) v = Math.min(1, v + p.w * 0.22 * Math.exp(-d * d)); });
      if (v < 0.06) continue;
      out.push({ cell: `${j}:${i}`, lat, lng, intensity: v, level: levelCode(v), confidence: Math.min(1, wsum) * (isNow ? 1 : 0.7), timeWindow: when });
    }
    const res = { grid: GRID, nx, ny, cells: out, byKey: Object.fromEntries(out.map((c) => [c.cell, c.intensity])), forecast: !isNow };
    cellCache.clear(); cellCache.set(key, res);
    return res;
  }
  // Which area did the user tap? Only areas with something going on.
  function areaAt(p, when = 'now') {
    const t = windowTime(when);
    return AREAS.map((a) => ({ a, d: metres(a, p) / a.r, h: score(a.id, t, { isNow: when === 'now' }).heat })).filter((x) => x.d < 1.4 && x.h >= 0.25).sort((x, y) => x.d - y.d)[0]?.a || null;
  }

  // The map's view of activity: smoothed, area-level heat plus public points only
  function field(when = 'now') {
    const t = windowTime(when);
    const isNow = when === 'now';
    const pts = [];
    AREAS.forEach((a) => {
      const { heat } = score(a.id, t, { isNow });
      if (heat < 0.22) return;
      pts.push({ lat: a.lat, lng: a.lng, r: a.r * 1.25, w: heat, area: a.id });
    });
    EV().all().forEach((e) => {
      if (t < e.startsAt - 45 * 6e4 || t > e.endsAt) return;
      const p = EV().placeOf(e);
      if (p) pts.push({ lat: p.lat, lng: p.lng, r: 160 + Math.log10(e.interested + 10) * 90, w: Math.min(0.85, Math.log10(e.interested + 10) / 3.6) });
    });
    S().venues.forEach((v) => {
      const [pop, peak] = HOP.seed.POP[v.id] || [0.3, 21];
      const b = pop * bell(hourOf(t), peak, 3.2) * dayFactor(t);
      if (b > 0.3) pts.push({ lat: v.lat, lng: v.lng, r: 150, w: b * 0.7 });
    });
    return pts;
  }

  // "Newtown expected busy around 9:30pm" — context while planning, never a recommendation
  function levelAt(areaId, t) { const h = score(areaId, t, { isNow: Math.abs(t - HOP.now()) < 15 * 6e4 }).heat; return { heat: h, level: level(h), code: levelCode(h), lv: levelIdx(h) }; }
  return { cells, areaAt, why, meter, LEVELS, levelCode, levelIdx, levelAt, AREAS, byId, WINDOWS, areaOfPoint, areaOfVenue, score, areaInfo, areaPublic, field, level, windowTime, SOURCES, K_PEOPLE, K_GROUPS };
})();
