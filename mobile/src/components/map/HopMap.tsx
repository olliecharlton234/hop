/* The map canvas HOP is built around. One component for every screen that shows the map:
   home (Tonight / Friends / Places), What's on, an outing's route, live nights, memories,
   and picking stops. Reveals more as you zoom, like V5:
     far  (<13.2)  neighbourhood energy labels
     area (<14.5)  + friend groups ("Jack + 4"), major events, busy venues in Places
     mid  (<15.4)  + busy / friend venues
     near (≥16.3)  every venue with its name and what's happening there
   Marker descriptors are derived from the store with deep equality, so unrelated changes
   (a chat message) don't re-render the map. */
import { forwardRef, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions } from 'react-native';
import { MapCanvas, MapHeatOverlay, MapMarker, MapPolyline } from './MapCanvas';
import type { MapCanvasRef, Padding, Region } from './mapTypes';
import { AreaLabel, areaBox, Chevron, chipBox, EventPin, eventBox, FriendChip, FriendOutingPin, friendOutingBox, LocPin, locBox, MeDot, meBox, OutingPin, outingBox, StopPin, stopBox, VenuePin, venueBox, type PinBox, type StopState } from './markers';
import { deepEqual, useHop, onEvent } from '@/store/hopStore';
import { useUi } from '@/store/uiStore';
import { activityService } from '@/services/activityService';
import { eventService } from '@/services/eventService';
import { friendService } from '@/services/friendService';
import { outingService } from '@/services/outingService';
import { venueService } from '@/services/venueService';
import { photoService } from '@/services/photoService';
import { useLocation, here } from '@/hooks/useLocation';
import { heatImageUri } from '@/components/heatmap/heatImage';
import { C } from '@/theme';
import { View } from 'react-native';
import { Photo as PhotoTile } from '@/components/ui/Photo';
import { Avatar } from '@/components/ui/Avatar';
import { dayDate, hm, startsIn, timeShort } from '@/utils/format';
import { EVENT_CATS } from '@/data/eventCategories';
import type { LatLng } from '@/types/models';

export type MapMode = 'default' | 'events' | 'focus' | 'pick';
export type RouteSpec = { outingId: string; kind: 'home' | 'plan' | 'live' | 'memory' } | null;
type Props = {
  mode: MapMode;
  padding: Padding;
  selected?: string | null;
  eventIds?: string[] | null; // What's on: the listed events
  route?: RouteSpec;
  outingPins?: string[]; // other outings' first stops (home)
  onVenue?: (id: string) => void;
  onEvent?: (id: string) => void;
  onOuting?: (id: string) => void;
  onArea?: (id: string) => void;
  onBlank?: () => void;
  onZoom?: (z: number) => void;
  initialCenter?: LatLng;
  initialZoom?: number;
  testID?: string;
};

const tier = (z: number) => ({ far: z < 13.2, area: z >= 13.2 && z < 14.5, mid: z >= 14.5 && z < 15.4, labels: z >= 16.3, elabels: z >= 15.3 });
const W = () => Dimensions.get('window').width;
const textW = (s: string, px = 6.6) => Math.min(190, s.length * px);

type Desc = { key: string; kind: string; lat: number; lng: number; box: PinBox; z: number; press?: [string, string]; p: any; label?: { x0: number; y0: number; x1: number; y1: number; pri: number; whole?: boolean } };

// Gentle arc between two stops so a route reads as a journey, not a chart line
function arc(a: LatLng, b: LatLng, bend = 0.18) {
  const pts: LatLng[] = [];
  const mx = (a.lat + b.lat) / 2, my = (a.lng + b.lng) / 2;
  const dx = b.lat - a.lat, dy = b.lng - a.lng;
  const cx = mx - dy * bend, cy = my + dx * bend;
  for (let t = 0; t <= 1.0001; t += 1 / 24) { const u = 1 - t; pts.push({ lat: u * u * a.lat + 2 * u * t * cx + t * t * b.lat, lng: u * u * a.lng + 2 * u * t * cy + t * t * b.lng }); }
  return pts;
}

export const HopMap = forwardRef<MapCanvasRef, Props>(function HopMap(props, ref) {
  const { mode, padding, selected = null, eventIds = null, route = null, outingPins = [], onVenue, onEvent, onOuting, onArea, onBlank, onZoom, testID } = props;
  const heatOn = useUi((u) => u.heatOn);
  const heatWindow = useUi((u) => u.heatWindow);
  const lens = useUi((u) => u.lens);
  const friendsSub = useUi((u) => u.lensSub.friends);
  const placesSub = useUi((u) => u.lensSub.places);
  useLocation();
  const [region, setRegion] = useState<{ r: Region | null; z: number }>({ r: null, z: props.initialZoom ?? 13.4 });
  const t = tier(region.z);
  const zKey = `${t.far ? 'f' : t.area ? 'a' : t.mid ? 'm' : 'n'}${t.labels ? 'L' : ''}${t.elabels ? 'E' : ''}`;

  // ---- everything the map shows, as plain descriptors -------------------------------
  const descs = useHop<Desc[]>(() => {
    const out: Desc[] = [];
    const tt = tier(region.z);
    const def = mode === 'default';
    const evMode = mode === 'events';
    const quietMode = mode === 'focus' || mode === 'pick';
    const now = Date.now();
    void now;

    // route + hidden venues
    const hidden = new Set<string>();
    if (route) {
      const o = outingService.get(route.outingId);
      if (o) {
        const stops = outingService.stops(o.id);
        const cur = o.live ? o.live.current : -1;
        stops.forEach((s, i) => {
          if (s.venueId) hidden.add(s.venueId);
          const p = outingService.placeOf(s);
          if (!p) return;
          let state: StopState = 'plan';
          if (route.kind === 'memory') state = 'memory';
          else if (route.kind === 'home') state = 'mini';
          else if (route.kind === 'live') state = i < cur ? 'done' : i === cur ? 'now' : i === cur + 1 ? 'next' : 'later';
          if (route.kind === 'home' && (tt.far || tt.area)) return;
          const showLabel = route.kind !== 'home' || i === 0 || i === stops.length - 1;
          const ph = route.kind === 'memory' ? photoService.album(o.id, s.id) : [];
          const name = outingService.stopName(s);
          const box = stopBox(state, showLabel && !tt.far);
          out.push({ key: 'stop:' + s.id, kind: 'stop', lat: p.lat, lng: p.lng, box, z: 100 - i, press: route.kind === 'home' ? ['outing', o.id] : s.venueId ? ['venue', s.venueId] : s.eventId ? ['event', s.eventId] : undefined,
            p: { n: i + 1, state, label: showLabel && !tt.far, name, sub: `${timeShort(s.at)}${s.eventId ? ` · ${p.name}` : ''}`, isEvent: !!s.eventId, photoId: ph[Math.floor(ph.length / 2)]?.id, photoCount: ph.length },
            label: showLabel ? { x0: box.anchorX + 15, y0: -16, x1: box.anchorX + 30 + textW(name), y1: 16, pri: 0 } : undefined });
        });
      }
    }

    // friends' outings (host faces)
    const friendVenues = new Set<string>();
    if (!quietMode && !evMode && lens !== 'places') {
      const mineIds = new Set([...outingService.mine().live, ...outingService.mine().upcoming].filter((o) => outingService.myMembership(o.id)?.rsvp === 'going').map((o) => o.id));
      outingService.tonight().filter((o) => !mineIds.has(o.id) && o.id !== route?.outingId).forEach((o) => {
        const st = outingService.stops(o.id);
        const s = o.status === 'live' ? st[o.live!.current] : st[0];
        if (!s) return;
        const p = outingService.placeOf(s);
        if (s.venueId) friendVenues.add(s.venueId);
        const host = friendService.user(o.organiserId)!;
        const n = outingService.going(o.id).length;
        const live = o.status === 'live';
        const label = !tt.far && !tt.mid;
        const title = `${host.first}’s ${o.title.replace(/^.*?'s /, '')}`;
        out.push({ key: 'fo:' + o.id, kind: 'friendOuting', lat: p.lat, lng: p.lng, box: friendOutingBox(label), z: 80, press: ['outing', o.id],
          p: { hostId: host.id, icon: o.icon, live, pub: o.visibility === 'public' && !outingService.myMembership(o.id), label, title, sub: live ? `LIVE · ${p.name} · ${n} there` : `${hm(o.startsAt)} · ${p.name} · ${n} going`, small: tt.far },
          label: label ? { x0: 24 + 20, y0: -18, x1: 24 + 40 + textW(title), y1: 18, pri: 3 } : undefined });
      });
    }
    // public outings / other plans on the home map
    if (!tt.far && !tt.area) outingPins.forEach((id) => {
      const o = outingService.get(id); const s = o && outingService.stops(o.id)[0];
      if (!o || !s) return;
      const p = outingService.placeOf(s);
      if (s.venueId) hidden.add(s.venueId);
      out.push({ key: 'op:' + o.id, kind: 'outingPin', lat: p.lat, lng: p.lng, box: outingBox(true), z: 50, press: ['outing', o.id], p: { icon: o.icon, pub: o.visibility === 'public', label: true, title: o.title, when: `${dayDate(o.startsAt).split(' ')[0]} ${timeShort(o.startsAt)}` } });
    });

    // venues
    venueService.all().forEach((v) => {
      if (hidden.has(v.id) || friendVenues.has(v.id)) return;
      const on = selected === v.id;
      const cat = lens === 'places' && def ? placesSub : 'all';
      if (!on) {
        if (cat !== 'all' && !(cat === 'late' ? venueService.isLate(v) : v.cat === cat || (cat === 'bar' && v.cat === 'gig'))) return;
      }
      const act = venueService.activity(v.id);
      const evs = eventService.tonightAt(v.id);
      const ph = act.tonightPhotos[act.tonightPhotos.length - 1];
      const f = act.friends;
      const stateful = act.hot || f.length > 0 || evs.length > 0 || !!ph;
      if (!on) {
        if (lens === 'friends' && def) { if (friendsSub === 'recent' ? !act.tonightPhotos.length : !f.length) return; }
        const placesArea = lens === 'places' && def && tt.area && stateful;
        if ((tt.far || tt.area) && !placesArea) return;
        if (tt.mid && !stateful) return;
      }
      const label = tt.labels || on;
      const status = [act.hot || f.length ? act.label : '', f.length ? `${f.length} ${f.length === 1 ? 'friend' : 'friends'}` : '', evs[0] ? `${evs[0].title.length > 22 ? EVENT_CATS[evs[0].cat].label : evs[0].title} ${hm(evs[0].startsAt)}` : ''].filter(Boolean).join(' · ');
      const showBadges = !quietMode && !evMode;
      out.push({ key: 'v:' + v.id, kind: 'venue', lat: v.lat, lng: v.lng, box: venueBox(label), z: on ? 90 : act.hot ? 20 : 10, press: ['venue', v.id],
        p: { cat: v.cat, lv: act.lv, hot: act.hot, on, label, name: v.name, status, friendId: showBadges ? f[0]?.user.id : undefined, friendMore: showBadges && f.length > 1 ? f.length - 1 : 0, hasEvent: evs.length > 0 && showBadges, photoId: showBadges ? ph?.id : undefined, dim: evMode && !on } });
    });

    // public events
    if (!(def && (lens === 'friends' || lens === 'places')) && mode !== 'focus') {
      const list = evMode && eventIds ? eventIds.map((id) => eventService.byId(id)).filter(Boolean) as ReturnType<typeof eventService.all> : mode === 'pick' ? [] : eventService.filter({ when: 'tonight' });
      const seen: Record<string, number> = {};
      list.forEach((e) => {
        const p = eventService.placeOf(e); if (!p) return;
        const major = e.interested >= 100;
        const atVenue = !!e.venueId && !evMode;
        if (selected !== e.id) {
          if (tt.far && !major && !evMode) return;
          if (tt.area && atVenue && !major) return;
          if (!tt.far && !tt.area && atVenue) return; // the venue pin shows a badge instead
        }
        const k = `${p.lat},${p.lng}`; const n = (seen[k] = (seen[k] || 0) + 1) - 1;
        const lat = p.lat + (evMode && e.venueId ? 0.00018 : 0) - n * 0.00028;
        const on = selected === e.id;
        const label = tt.elabels || evMode || on;
        const when = `${startsIn(e.startsAt, e.endsAt)} · ${e.priceLabel}`;
        out.push({ key: 'e:' + e.id, kind: 'event', lat, lng: p.lng, box: eventBox(label), z: on ? 95 : 40, press: ['event', e.id],
          p: { cat: e.cat, now: eventService.isLive(e), on, label, title: e.title, when },
          label: label && !on ? { x0: 30, y0: -15, x1: 34 + textW(e.title), y1: 15, pri: 6 } : undefined });
      });
    }

    // neighbourhood energy (zoomed out)
    if (def && (tt.far || tt.area) && !(lens === 'friends' && friendsSub === 'outings')) {
      activityService.areas().forEach((a) => {
        const info = activityService.areaInfo(a.id, heatWindow);
        const pub = activityService.areaPublic(a.id, heatWindow);
        const fr = pub.friends; const n = pub.events.length;
        const quiet = info.lv === 0 && !fr.length && !n;
        if (quiet && tt.area) return;
        const bits = [fr.length ? `${fr.length} ${fr.length === 1 ? 'friend' : 'friends'}` : '', n ? `${n} on` : ''].filter(Boolean).join(' · ');
        const words = `${info.isNow ? info.level : `Expected ${info.level.toLowerCase()}`}${info.isNow && info.trend === 'rising' ? ' · rising' : ''}`;
        out.push({ key: 'a:' + a.id, kind: 'area', lat: a.lat, lng: a.lng, box: areaBox, z: -10, press: ['area', a.id],
          p: { name: a.name, words, lv: info.lv, quiet, friendIds: fr.slice(0, 3).map((f) => f.user.id), bits },
          label: { x0: -75, y0: -20, x1: 75, y1: bits ? 40 : 22, pri: info.heat >= 0.5 ? 1 : 4, whole: true } });
      });
    }
    // friends grouped by place
    const chipsOn = def && ((lens === 'friends' && friendsSub !== 'outings') || (lens === 'tonight' && tt.area));
    if (chipsOn) {
      const groups: Record<string, ReturnType<typeof friendService.out>> = {};
      friendService.out().forEach((f) => { const k = f.venueId || 'e:' + f.eventId; (groups[k] ||= []).push(f); });
      Object.entries(groups).forEach(([k, fs]) => {
        if (friendVenues.has(k)) return;
        const p = k.startsWith('e:') ? eventService.placeOf(eventService.byId(k.slice(2))) : venueService.byId(k);
        if (!p) return;
        fs.sort((a, b) => a.since - b.since);
        const lead = fs[0].user;
        out.push({ key: 'fc:' + k, kind: 'chip', lat: p.lat, lng: p.lng, box: chipBox, z: 60, press: k.startsWith('e:') ? ['event', k.slice(2)] : ['venue', k],
          p: { userIds: fs.slice(0, 3).map((f) => f.user.id), lead: lead.first, more: fs.length - 1, place: p.name },
          label: { x0: -60, y0: -16, x1: 60, y1: 16, pri: 5, whole: true } });
      });
    }
    // temporary shared locations
    if (!evMode) friendService.sharedLocations().forEach((m) => {
      const u = friendService.user(m.userId)!; const mins = Math.max(1, Math.round((Date.now() - m.at) / 6e4));
      const label = !tt.far && !tt.area;
      out.push({ key: 'loc:' + m.id, kind: 'loc', lat: m.loc!.lat, lng: m.loc!.lng, box: locBox(label), z: 85, p: { userId: u.id, label, sub: `shared ${mins}m ago · ${outingService.get(m.outingId)?.title || ''}` } });
    });
    const me = here();
    out.push({ key: 'me', kind: 'me', lat: me.lat, lng: me.lng, box: meBox, z: 70, p: {} });
    return out;
  }, [mode, selected, eventIds?.join(','), route?.outingId, route?.kind, outingPins.join(','), lens, friendsSub, placesSub, heatWindow, zKey], deepEqual);

  // ---- declutter labels (screen-space overlap, by priority) ----------------------------
  const hiddenLabels = useMemo(() => {
    const out = new Set<string>();
    const r = region.r; if (!r) return out;
    const w = W(), h = Dimensions.get('window').height;
    const x = (lng: number) => ((lng - (r.longitude - r.longitudeDelta / 2)) / r.longitudeDelta) * w;
    const y = (lat: number) => (((r.latitude + r.latitudeDelta / 2) - lat) / r.latitudeDelta) * h;
    const kept: { x0: number; y0: number; x1: number; y1: number }[] = [];
    descs.filter((d) => d.label).sort((a, b) => a.label!.pri - b.label!.pri).forEach((d) => {
      const L = d.label!; const cx = x(d.lng), cy = y(d.lat);
      const R = { x0: cx + (L.whole ? L.x0 : L.x0 - d.box.anchorX), y0: cy + L.y0, x1: cx + (L.whole ? L.x1 : L.x1 - d.box.anchorX), y1: cy + L.y1 };
      if (kept.some((k) => R.x0 < k.x1 && R.x1 > k.x0 && R.y0 < k.y1 && R.y1 > k.y0)) out.add(d.key); else kept.push(R);
    });
    return out;
  }, [descs, region.r]);

  const press = useCallback((pr?: [string, string]) => {
    if (!pr) return;
    const [k, id] = pr;
    if (k === 'venue') onVenue?.(id); else if (k === 'event') onEvent?.(id); else if (k === 'outing') onOuting?.(id); else if (k === 'area') onArea?.(id);
  }, [onVenue, onEvent, onOuting, onArea]);

  const onRegion = useCallback((r: Region, z: number) => { setRegion({ r, z }); onZoom?.(z); }, [onZoom]);
  const onPress = useCallback((p: LatLng) => {
    if (heatOn && mode === 'default' && region.z < 16.3) {
      const a = activityService.areaAt(p, heatWindow);
      if (a) { onArea?.(a.id); return; }
    }
    onBlank?.();
  }, [heatOn, mode, region.z, heatWindow, onArea, onBlank]);

  return (
    <MapCanvas ref={ref} initialCenter={props.initialCenter ?? { lat: -33.8795, lng: 151.206 }} initialZoom={props.initialZoom ?? 13.4} padding={padding} onRegionChange={onRegion} onPress={onPress} testID={testID}>
      {heatOn && mode === 'default' ? <HeatLayer window={heatWindow} /> : null}
      {route ? <RouteLines outingId={route.outingId} kind={route.kind} /> : null}
      {mode !== 'pick' ? <PhotoPops /> : null}
      {descs.map((d) => {
        const hid = hiddenLabels.has(d.key);
        if (hid && d.label?.whole) return null;
        return <Pin key={d.key} d={d} hideLabel={hid} onPress={press} />;
      })}
    </MapCanvas>
  );
});

const Pin = memo(function Pin({ d, hideLabel, onPress }: { d: Desc; hideLabel: boolean; onPress: (p?: [string, string]) => void }) {
  const p = d.p;
  let node: React.ReactNode = null;
  let box = d.box;
  switch (d.kind) {
    case 'venue': node = <VenuePin {...p} friend={p.friendId ? friendService.user(p.friendId) : undefined} photo={p.photoId ? photoService.get(p.photoId) : undefined} />; break;
    case 'event': { const label = p.label && !hideLabel; box = eventBox(label); node = <EventPin {...p} label={label} />; break; }
    case 'friendOuting': { const label = p.label && !hideLabel; box = friendOutingBox(label); node = <FriendOutingPin {...p} label={label} host={friendService.user(p.hostId)!} />; break; }
    case 'area': node = <AreaLabel {...p} friends={p.friendIds.map((id: string) => friendService.user(id)!)} />; break;
    case 'chip': node = <FriendChip users={p.userIds.map((id: string) => friendService.user(id)!)} lead={p.lead} more={p.more} place={p.place} />; break;
    case 'stop': { const label = p.label && !hideLabel; box = stopBox(p.state, label); node = <StopPin {...p} label={label} photo={p.photoId ? photoService.get(p.photoId) : undefined} />; break; }
    case 'outingPin': node = <OutingPin {...p} />; break;
    case 'loc': node = <LocPin user={friendService.user(p.userId)!} label={p.label} sub={p.sub} />; break;
    case 'me': node = <MeDot />; break;
  }
  return (
    <MapMarker id={d.key} testID={'pin-' + d.key} coordinate={{ lat: d.lat, lng: d.lng }} width={box.width} height={box.height} anchorX={box.anchorX} anchorY={box.anchorY} zIndex={d.z}
      onPress={d.press ? () => onPress(d.press) : undefined} redrawKey={JSON.stringify(p) + hideLabel}>
      {node}
    </MapMarker>
  );
}, (a, b) => a.hideLabel === b.hideLabel && a.onPress === b.onPress && deepEqual(a.d, b.d));

// ---- route lines ------------------------------------------------------------------
const RouteLines = memo(function RouteLines({ outingId, kind }: { outingId: string; kind: 'home' | 'plan' | 'live' | 'memory' }) {
  const legs = useHop(() => {
    const o = outingService.get(outingId); if (!o) return [];
    const stops = outingService.stops(outingId);
    const cur = o.live ? o.live.current : -1;
    const pts = stops.map((s) => outingService.placeOf(s)).filter(Boolean);
    return pts.slice(0, -1).map((p, i) => ({ a: { lat: p.lat, lng: p.lng }, b: { lat: pts[i + 1].lat, lng: pts[i + 1].lng }, done: kind === 'live' && i < cur, ahead: kind === 'live' && i > cur }));
  }, [outingId, kind], deepEqual);
  return (
    <>
      {legs.map((l, i) => {
        const line = arc(l.a, l.b);
        const m = line[12], n = line[13];
        const ang = (Math.atan2(-(n.lat - m.lat), n.lng - m.lng) * 180) / Math.PI;
        return [
          <MapPolyline key={`c${i}`} coordinates={line} color="#050607" width={kind === 'home' ? 5 : 8} zIndex={1} />,
          <MapPolyline key={`l${i}`} coordinates={line} color={l.done ? '#4b515c' : C.accent} width={kind === 'home' ? 2.5 : 4} dashed={l.ahead || kind === 'home'} zIndex={2} />,
          kind !== 'home' ? <MapMarker key={`v${i}`} id={`chev${i}`} coordinate={m} width={14} height={14} anchorX={7} anchorY={7} zIndex={5} redrawKey={`${ang}${l.done}`}><Chevron angle={ang} done={l.done} /></MapMarker> : null,
        ];
      })}
    </>
  );
});

// ---- the activity heat layer ---------------------------------------------------------
const HeatLayer = memo(function HeatLayer({ window: w }: { window: 'now' | 'later' | 'tomorrow' | 'weekend' }) {
  const grid = useHop(() => activityService.cells(w), [w], Object.is);
  const [img, setImg] = useState<{ uri: string; bounds: { north: number; south: number; east: number; west: number } } | null>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; heatImageUri(grid).then((r) => alive.current && setImg(r)).catch(() => {}); return () => { alive.current = false; }; }, [grid]);
  return img ? <MapHeatOverlay uri={img.uri} bounds={img.bounds} /> : null;
});

// ---- a photo someone just took floats up from where they are -----------------------------
const PhotoPops = memo(function PhotoPops() {
  const [pops, setPops] = useState<{ key: string; lat: number; lng: number; photoId: string; userId: string }[]>([]);
  useEffect(() => onEvent((type, p) => {
    if (type !== 'photos:add' || p.visibility !== 'outing') return;
    const o = outingService.get(p.outingId);
    if (!o || !(outingService.myMembership(o.id) || o.visibility === 'public')) return;
    const ph = photoService.get(p.ids?.[p.ids.length - 1]);
    const st = ph && outingService.stops(o.id).find((s) => s.id === ph.stopId);
    if (!ph || !st) return;
    const pl = outingService.placeOf(st);
    const key = ph.id;
    setPops((x) => [...x.slice(-2), { key, lat: pl.lat, lng: pl.lng, photoId: ph.id, userId: p.userId }]);
    setTimeout(() => setPops((x) => x.filter((q) => q.key !== key)), 4200);
  }), []);
  return (
    <>
      {pops.map((q) => (
        <MapMarker key={q.key} id={'pop-' + q.key} coordinate={{ lat: q.lat, lng: q.lng }} width={52} height={78} anchorX={26} anchorY={78} zIndex={200}>
          <View style={{ width: 48, height: 60, borderRadius: 8, borderWidth: 2, borderColor: C.text, overflow: 'hidden', backgroundColor: C.surface2 }}>
            <PhotoTile p={photoService.get(q.photoId)} w={120} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
            <View style={{ position: 'absolute', left: 3, bottom: 3 }}><Avatar user={friendService.user(q.userId)} size={18} /></View>
          </View>
        </MapMarker>
      ))}
    </>
  );
});
