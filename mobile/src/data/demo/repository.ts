/* DEMO REPOSITORY — the local "backend" for V6.
   A direct port of the V5 prototype's store (js/store.js + js/events.js): selectors and
   mutations over the local state. Services (src/services) are the only callers; in V7
   each service swaps these calls for Supabase queries / RPCs / Realtime channels. */
import { commit, hop, setFactory } from '@/store/hopStore';
import * as seed from './seed';
import { EVENT_CATS } from '@/data/eventCategories';
import { now } from '@/utils/clock';
import { metres, distLabel, uid } from '@/utils/format';
import type {
  ChatPhase, ChatPref, FriendPresence, HopEvent, LatLng, Message, Outing, OutingIcon, OutingMember, OutingStatus, OutingStop, Photo,
  Place, PublicPhoto, ReportKind, ReportSummary, Rsvp, SavedCollection, SavedRef, User, Venue, VenueActivity, Visibility,
} from '@/types/models';

const S = () => hop.state;

// ---------------------------------------------------------------- reference data
export const venues: Venue[] = seed.venues;
export const venueById: Record<string, Venue> = Object.fromEntries(venues.map((v) => [v.id, v]));
export const users: User[] = seed.users;
export const userById: Record<string, User> = Object.fromEntries(users.map((u) => [u.id, u]));
export const POP = seed.POP;
export const IMAGE_POOLS = seed.P;
export const poolFor = seed.poolFor;

// ---------------------------------------------------------------- identity
let meId = 'u_ollie';
export const getMeId = () => meId;
export function setMe(id: string) { meId = id; commit('me', { id }); }
export const me = () => userById[meId];

/** People who aren't in the demo friend list (e.g. whoever sent you an invite link).
    Kept in state so they survive reloads. */
export function addGuest(u: User) {
  if (userById[u.id]) return userById[u.id];
  users.push(u); userById[u.id] = u;
  const g = (S().guests ||= []);
  if (!g.some((x) => x.id === u.id)) g.push(u);
  return u;
}
export function hydrateGuests() { (S().guests || []).forEach((u) => { if (!userById[u.id]) { users.push(u); userById[u.id] = u; } }); }

// ---------------------------------------------------------------- events (normalised, pluggable sources)
function normalize(raw: any, source: { id: string; name: string }): HopEvent {
  return {
    id: raw.id, title: raw.title, cat: raw.cat,
    venueId: raw.venueId || null, place: raw.place || null,
    startsAt: raw.startsAt, endsAt: raw.endsAt || raw.startsAt + 3 * 36e5,
    price: raw.price || 0, priceLabel: raw.priceLabel || (raw.price ? `$${raw.price}` : 'Free'),
    genre: raw.genre || EVENT_CATS[raw.cat as keyof typeof EVENT_CATS]?.label || '', blurb: raw.blurb || '', img: raw.img ? { id: raw.img } : null,
    interested: raw.interested || 0, friendIds: raw.friendIds || [],
    publisher: raw.publisher || { type: 'feed', name: source.name, verified: false },
    deal: raw.deal || null, promoted: false, recurs: raw.recurs || null, ticketUrl: raw.ticketUrl || null, source: source.id,
  };
}
const EVENT_SOURCES = [{ id: 'seed', name: 'HOP picks', load: (t: number) => seed.events(t) }];
const loadAllEvents = (t: number) => EVENT_SOURCES.flatMap((src) => (src.load(t) || []).map((r) => normalize(r, src)));

export const allEvents = () => S().events;
export const eventById = (id?: string | null) => (id ? S().events.find((e) => e.id === id) : undefined);
export const eventPlace = (e?: HopEvent | null): (Venue | Place) | undefined => (e ? (e.venueId ? venueById[e.venueId] : e.place || undefined) : undefined);
export const eventLive = (e: HopEvent, t = now()) => e.startsAt <= t && e.endsAt > t;
export const upcomingEvents = (t = now()) => S().events.filter((e) => e.endsAt > t).sort((a, b) => a.startsAt - b.startsAt);
export function dayKey(ts: number) { const d = new Date(ts - 5 * 36e5); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); }
export type EventWhen = 'tonight' | 'tomorrow' | 'weekend' | 'any';
export function filterEvents({ when = 'tonight', group = null }: { when?: EventWhen; group?: string | null } = {}, t = now()) {
  const today = dayKey(t);
  return upcomingEvents(t).filter((e) => {
    const k = dayKey(e.startsAt), days = Math.round((k - today) / 864e5);
    if (when === 'tonight' && days !== 0) return false;
    if (when === 'tomorrow' && days !== 1) return false;
    if (when === 'weekend') { const dow = new Date(k).getDay(); if (days > 6 || ![5, 6, 0].includes(dow)) return false; }
    if (group === 'free') return !e.price;
    if (group) return EVENT_CATS[e.cat]?.groups.includes(group);
    return true;
  });
}
export const eventsAtVenue = (venueId: string, t = now()) => upcomingEvents(t).filter((e) => e.venueId === venueId);
export const eventsTonightAt = (venueId: string, t = now()) => eventsAtVenue(venueId, t).filter((e) => dayKey(e.startsAt) === dayKey(t));
export function toggleInterest(id: string) {
  const e = eventById(id)!;
  const on = e.friendIds.includes(meId);
  e.friendIds = on ? e.friendIds.filter((x) => x !== meId) : [meId, ...e.friendIds];
  e.interested += on ? -1 : 1;
  commit('event:interest', { id });
  return !on;
}

// ---------------------------------------------------------------- outings: selectors
export const outing = (id?: string | null) => (id ? S().outings.find((o) => o.id === id) : undefined);
export const stopsOf = (id: string) => S().stops.filter((s) => s.outingId === id).sort((a, b) => a.order - b.order);
export const attendeesOf = (id: string) => S().attendees.filter((a) => a.outingId === id);
export const going = (id: string) => attendeesOf(id).filter((a) => a.rsvp === 'going');
export const myAttendance = (id: string) => attendeesOf(id).find((a) => a.userId === meId);
export const isOrganiser = (o?: Outing | null) => !!o && o.organiserId === meId;
export const eventOf = (stop: OutingStop) => (stop.eventId ? eventById(stop.eventId) : undefined);
export const placeOf = (stop: OutingStop): Venue | Place => (stop.venueId && venueById[stop.venueId]) || (stop.eventId ? eventPlace(eventOf(stop))! : stop.place!);
export const stopName = (stop: OutingStop) => { const e = eventOf(stop); return e ? e.title : placeOf(stop)?.name || ''; };

/** Photos I can see: everything shared with the outing, plus my private ones */
export const photosOf = (id: string, stopId?: string | null) => S().photos
  .filter((p) => p.outingId === id && (p.visibility !== 'private' || p.userId === meId) && (!stopId || p.stopId === stopId))
  .sort((a, b) => a.takenAt - b.takenAt);
export const photoById = (id: string) => S().photos.find((p) => p.id === id);

export function myOutings() {
  const mine = (o: Outing) => { const a = myAttendance(o.id); return !!a && a.rsvp !== 'declined'; };
  const list = S().outings.filter(mine);
  return {
    live: list.filter((o) => o.status === 'live' && myAttendance(o.id)!.rsvp === 'going'),
    invites: list.filter((o) => o.status !== 'ended' && myAttendance(o.id)!.rsvp === 'invited'),
    upcoming: list.filter((o) => o.status === 'planning' && myAttendance(o.id)!.rsvp !== 'invited').sort((a, b) => a.startsAt - b.startsAt),
    memories: list.filter((o) => o.status === 'ended' && myAttendance(o.id)!.rsvp === 'going').sort((a, b) => b.startsAt - a.startsAt),
  };
}
export const publicOutings = () => S().outings.filter((o) => o.visibility === 'public' && o.status !== 'ended');
/** Outings happening tonight that I can see: mine, ones I'm invited to, public ones */
export function tonightOutings() {
  const k = dayKey(now());
  return S().outings.filter((o) => o.status !== 'ended' && dayKey(o.status === 'live' ? now() : o.startsAt) === k && (myAttendance(o.id) || o.visibility === 'public'))
    .sort((a, b) => Number(b.status === 'live') - Number(a.status === 'live') || a.startsAt - b.startsAt);
}
/** My live outing (the one the camera button posts to) */
export const myLiveOuting = () => myOutings().live[0];

// ---------------------------------------------------------------- friends
/** Where each friend is right now: from live outings you can see, and opt-in location sharing */
export function friendsOut(): FriendPresence[] {
  const out = new Map<string, FriendPresence>();
  S().outings.filter((o) => o.status === 'live' && (myAttendance(o.id) || o.visibility === 'public')).forEach((o) => {
    const st = stopsOf(o.id)[o.live!.current];
    if (!st) return;
    going(o.id).forEach((a) => { if (a.userId !== meId) out.set(a.userId, { user: userById[a.userId], venueId: st.venueId, eventId: st.eventId || null, outingId: o.id, since: o.live!.arrivedAt }); });
  });
  (S().presence || []).forEach((p) => { if (!out.has(p.userId) && p.userId !== meId) out.set(p.userId, { user: userById[p.userId], venueId: p.venueId, eventId: p.eventId, outingId: null, since: p.since }); });
  return [...out.values()].sort((a, b) => b.since - a.since);
}
export const friendsAt = (venueId: string) => friendsOut().filter((f) => f.venueId === venueId);
export const friendsAtEvent = (eventId: string) => friendsOut().filter((f) => f.eventId === eventId);
export function friendsByNights() {
  const count: Record<string, number> = {};
  S().outings.filter((o) => o.status === 'ended' && myAttendance(o.id)?.rsvp === 'going')
    .forEach((o) => going(o.id).forEach((a) => { if (a.userId !== meId) count[a.userId] = (count[a.userId] || 0) + 1; }));
  return users.filter((u) => u.id !== meId).map((u) => ({ u, n: count[u.id] || 0 })).sort((a, b) => b.n - a.n || a.u.name.localeCompare(b.u.name));
}

// ---------------------------------------------------------------- venues: how busy, right now
// Level words + index come from the activity model (registered at boot to avoid an import cycle)
let levelOf: (h: number) => { label: string; lv: number } = () => ({ label: 'Quiet', lv: 0 });
export function registerLevels(f: typeof levelOf) { levelOf = f; }
export function venueActivity(venueId: string): VenueActivity {
  const [pop, peak] = POP[venueId] || [0.32, 21];
  const d = new Date(now());
  let h = d.getHours() + d.getMinutes() / 60; if (h < 6) h += 24;
  const friends = friendsAt(venueId);
  const at = (hh: number) => Math.min(1, pop * Math.exp(-(((hh - peak) / 3.2) ** 2)) * 1.15 + friends.length * 0.03);
  const busy = at(h), soon = at(h + 0.75);
  const trend = soon - busy > 0.04 ? 'rising' : busy - soon > 0.04 ? 'easing' : 'steady';
  const { label, lv } = levelOf(busy);
  const liveHere = S().outings.filter((o) => o.status === 'live' && (myAttendance(o.id) || o.visibility === 'public') && stopsOf(o.id)[o.live!.current]?.venueId === venueId);
  const tonightPhotos = liveHere.flatMap((o) => photosOf(o.id, stopsOf(o.id)[o.live!.current].id));
  return { busy, label, lv, trend, hot: busy >= 0.6, friends, liveHere, tonightPhotos };
}
/** My photos from past nights at this venue */
export const memoryPhotosAt = (venueId: string) => S().stops.filter((s) => s.venueId === venueId && outing(s.outingId)?.status === 'ended' && myAttendance(s.outingId)?.rsvp === 'going')
  .flatMap((s) => photosOf(s.outingId, s.id));
/** Public photos at a venue tonight (shared publicly; no names attached) */
export const venuePhotos = (venueId: string, t = now()) => (S().venuePhotos || []).filter((p) => p.venueId === venueId && t - p.takenAt < 8 * 36e5 && p.takenAt <= t).sort((a, b) => b.takenAt - a.takenAt);

// ---------------------------------------------------------------- outing log + chat
const SYS_TYPES = new Set(['joined', 'stop', 'moved', 'started', 'ended']);
function log(o: Outing, entry: any) {
  o.activity = [{ id: uid('ac'), at: now(), ...entry }, ...(o.activity || [])].slice(0, 80);
  if (SYS_TYPES.has(entry.type)) pushMsg(o.id, { kind: 'system', userId: null, sys: { ...entry } });
}
const CHAT_OPEN_AFTER = 48 * 36e5;
export const messagesOf = (outingId: string) => (S().messages || []).filter((m) => m.outingId === outingId).sort((a, b) => a.at - b.at);
export const messageById = (id: string) => S().messages.find((m) => m.id === id);
export const canChat = (o?: Outing) => { if (!o) return false; const a = myAttendance(o.id); return !!a && a.rsvp !== 'declined'; };
export function chatPhase(o: Outing): ChatPhase {
  if (o.status === 'live') return 'during';
  if (o.status !== 'ended') return 'before';
  return now() - (o.endedAt || o.startsAt) < CHAT_OPEN_AFTER ? 'after' : 'closed';
}
export const chatClosesAt = (o: Outing) => (o.endedAt || o.startsAt) + CHAT_OPEN_AFTER;
function pushMsg(outingId: string, m: Partial<Message>): Message {
  const msg = { id: uid('m'), outingId, at: now(), reactions: {}, ...m } as Message;
  S().messages.push(msg);
  return msg;
}
export function postMessage(outingId: string, m: Partial<Message>, userId: string = meId) {
  const msg = pushMsg(outingId, { userId, kind: 'text', ...m });
  if (userId === meId) markRead(outingId, true);
  commit('chat:post', { outingId, id: msg.id, userId, kind: msg.kind });
  return msg;
}
export function react(msgId: string, key: string, userId: string = meId) {
  const m = messageById(msgId); if (!m) return;
  const list = (m.reactions[key] ||= []);
  const i = list.indexOf(userId);
  if (i >= 0) list.splice(i, 1); else list.push(userId);
  if (!list.length) delete m.reactions[key];
  commit('chat:react', { outingId: m.outingId, id: msgId });
}
export function keen(msgId: string, userId: string = meId) {
  const m = messageById(msgId); if (!m) return;
  m.keen ||= [];
  const i = m.keen.indexOf(userId);
  if (i >= 0) m.keen.splice(i, 1); else m.keen.push(userId);
  commit('chat:react', { outingId: m.outingId, id: msgId });
}
export function vote(msgId: string, idx: number, userId: string = meId) {
  const m = messageById(msgId);
  if (!m?.poll || m.poll.closed) return;
  m.poll.options.forEach((op, k) => { op.votes = op.votes.filter((u) => u !== userId); if (k === idx) op.votes.push(userId); });
  commit('chat:react', { outingId: m.outingId, id: msgId });
}
export function closePoll(msgId: string) {
  const m = messageById(msgId)!;
  m.poll!.closed = true;
  const win = m.poll!.options.slice().sort((a, b) => b.votes.length - a.votes.length)[0];
  pushMsg(m.outingId, { kind: 'system', userId: null, sys: { type: 'poll', count: win.votes.length, venueId: win.venueId } });
  commit('chat:post', { outingId: m.outingId, id: m.id, userId: null, kind: 'system' });
  return win;
}
export function stopSharing(msgId: string) {
  const m = messageById(msgId);
  if (m && m.loc) { m.loc.until = now(); commit('chat:react', { outingId: m.outingId, id: msgId }); }
}
export const activeLocations = () => (S().messages || []).filter((m) => m.kind === 'location' && m.loc!.until > now() && m.userId !== meId && canChat(outing(m.outingId)));
export function markRead(outingId: string, silent?: boolean) {
  (S().reads[meId] ||= {})[outingId] = now();
  if (!silent) commit('chat:read', { outingId });
}
export const lastRead = (outingId: string) => S().reads?.[meId]?.[outingId] || 0;
export const unread = (outingId: string) => messagesOf(outingId).filter((m) => m.userId && m.userId !== meId && m.at > lastRead(outingId)).length;
export const lastMessage = (outingId: string) => messagesOf(outingId).filter((m) => m.kind !== 'system' || m.sys?.type === 'photos').pop();
export const chatPref = (outingId: string): ChatPref => S().chatPrefs?.[meId]?.[outingId] || (myAttendance(outingId)?.rsvp === 'going' ? 'all' : 'mentions');
export function setChatPref(outingId: string, v: ChatPref) { (S().chatPrefs[meId] ||= {})[outingId] = v; commit('chat:pref', { outingId }); }
export const mentionsMe = (m: Message) => !!m.text && new RegExp('@' + me().first + '\\b', 'i').test(m.text);

// ---------------------------------------------------------------- saved collections
export function collections(): SavedCollection[] {
  const c = S().collections;
  if (!c[meId]) {
    c[meId] = [['want', 'Want to go'], ['pubs', 'Good pubs'], ['food', 'Restaurants'], ['late', 'Late night'], ['date', 'Date night']].map(([id, name]) => ({ id, name, items: [] }));
  }
  return c[meId];
}
const refKey = (r: SavedRef) => (r.venueId ? 'v:' + r.venueId : 'e:' + r.eventId);
export const collectionsOf = (ref: SavedRef) => collections().filter((c) => c.items.some((i) => refKey(i) === refKey(ref)));
export const isSaved = (ref: SavedRef) => collectionsOf(ref).length > 0;
export const savedVenueIds = () => [...new Set(collections().flatMap((c) => c.items.filter((i) => i.venueId).map((i) => i.venueId!)))];
export const savedEventIds = () => [...new Set(collections().flatMap((c) => c.items.filter((i) => i.eventId).map((i) => i.eventId!)))];
export function setSaved(ref: SavedRef, colId: string, on: boolean) {
  const c = collections().find((x) => x.id === colId); if (!c) return;
  const i = c.items.findIndex((x) => refKey(x) === refKey(ref));
  if (on && i < 0) c.items.unshift(ref);
  if (!on && i >= 0) c.items.splice(i, 1);
  commit('saved', { ...ref, colId, on });
}

// ---------------------------------------------------------------- crowd reports
export const REPORT_KINDS: Record<ReportKind, { label: string; opts: [string, string][] }> = {
  crowd: { label: 'Crowd', opts: [['quiet', 'Quiet'], ['moderate', 'Moderate'], ['busy', 'Busy'], ['packed', 'Packed']] },
  queue: { label: 'Queue', opts: [['none', 'None'], ['short', 'Short'], ['medium', 'Medium'], ['long', 'Long']] },
  entry: { label: 'Entry', opts: [['free', 'Free'], ['cover', 'Cover']] },
  vibe: { label: 'Music / vibe', opts: [['chatty', 'Chatty'], ['loud', 'Loud'], ['live', 'Live music'], ['dj', 'DJ'], ['dancing', 'Dancing']] },
};
/** The current read per category: recency-weighted vote over 90 min, so no single report swings it */
export function reportsAt(venueId: string, t = now()) {
  const rs = (S().reports || []).filter((r) => r.venueId === venueId && t - r.at < 90 * 6e4 && t >= r.at);
  const out: Partial<Record<ReportKind, ReportSummary>> = {};
  (Object.keys(REPORT_KINDS) as ReportKind[]).forEach((k) => {
    const l = rs.filter((r) => r.kind === k); if (!l.length) return;
    const tally: Record<string, number> = {};
    l.forEach((r) => { tally[r.value] = (tally[r.value] || 0) + Math.exp(-(t - r.at) / (45 * 6e4)); });
    const value = Object.entries(tally).sort((a, b) => b[1] - a[1])[0][0];
    out[k] = { value, label: REPORT_KINDS[k].opts.find((x) => x[0] === value)?.[1] || value, n: l.length, last: Math.max(...l.map((r) => r.at)) };
  });
  return out;
}
/** Beta disclosure: are any of the recent reports here simulated (i.e. not yours)? */
export const hasDemoReports = (venueId: string, t = now()) => (S().reports || []).some((r) => r.venueId === venueId && r.userId !== meId && t - r.at < 90 * 6e4 && t >= r.at);
/** You can only report where you are: near the venue, or at your outing's current stop */
export function canReport(venueId: string, me: LatLng) {
  const v = venueById[venueId]; if (!v) return { ok: false, why: '' };
  const atStop = S().outings.some((o) => o.status === 'live' && myAttendance(o.id)?.rsvp === 'going' && stopsOf(o.id)[o.live!.current]?.venueId === venueId);
  const d = metres(me, v);
  if (atStop || d <= 600) return { ok: true, why: '' };
  return { ok: false, why: `Reports come from people there. You’re ${distLabel(d)} away.` };
}
export function addReport(venueId: string, picks: Partial<Record<ReportKind, string>>) {
  const at = now();
  Object.entries(picks).forEach(([kind, value]) => value && S().reports.push({ id: uid('rp'), venueId, kind: kind as ReportKind, value, at, userId: meId }));
  S().reports = S().reports.filter((r) => at - r.at < 6 * 36e5);
  commit('report', { venueId });
}

// ---------------------------------------------------------------- outing mutations
export function createOuting({ title, icon, startsAt, visibility, cover }: { title: string; icon: OutingIcon; startsAt: number; visibility: Visibility; cover?: string | null }) {
  const id = uid('o');
  const o: Outing = {
    id, title: title.trim() || 'Night out', icon: icon || 'party', cover: cover || null, kind: 'night', visibility: visibility || 'private',
    organiserId: meId, status: 'planning', startsAt, createdAt: now(), live: null, endedAt: null,
    inviteCode: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) + '-' + Math.random().toString(36).slice(2, 6),
    activity: [],
  };
  S().outings.push(o);
  S().attendees.push({ id: uid('a'), outingId: id, userId: meId, rsvp: 'going', role: 'organiser', invitedBy: meId, respondedAt: now(), shareLocation: false });
  commit('outing:create', { id });
  return o;
}
/** Shared plan from an invite link (no backend in V6): the outing as the sender saw it.
    Times are relative to the sender's clock so they land right on any device. */
export interface OutingSnapshot {
  v: 1; id: string; t: string; i: OutingIcon; vis: Visibility; st0: OutingStatus; s: number; cur?: number;
  host: { id?: string; name: string }; stops: [string, number][]; m: [string, Rsvp][]; code: string;
}
export function snapshotOuting(id: string): OutingSnapshot | null {
  const o = outing(id); if (!o) return null;
  const t = now();
  const hostIsMe = o.organiserId === meId;
  return {
    v: 1, id: o.id, t: o.title, i: o.icon, vis: o.visibility, st0: o.status, s: Math.round((o.startsAt - t) / 6e4), cur: o.live?.current,
    host: hostIsMe ? { name: me().name } : { id: o.organiserId, name: userById[o.organiserId]?.name || 'A friend' },
    stops: stopsOf(id).map((x) => [x.eventId ? `ev:${x.eventId}` : x.venueId || '', Math.round((x.at - o.startsAt) / 6e4)] as [string, number]).filter((x) => x[0]),
    m: attendeesOf(id).filter((a) => a.userId !== meId && a.userId !== o.organiserId && !a.userId.startsWith('g_')).map((a) => [a.userId, a.rsvp] as [string, Rsvp]).slice(0, 30),
    code: o.inviteCode,
  };
}
/** Add a shared outing to this device (once). The person who shared it becomes a guest host. */
export function importOuting(snap: OutingSnapshot): Outing | null {
  if (outing(snap.id)) return outing(snap.id)!;
  if (!snap || snap.v !== 1 || !snap.id || !Array.isArray(snap.stops)) return null;
  const t = now();
  const hostId = snap.host.id && userById[snap.host.id] && snap.host.id !== meId ? snap.host.id : addGuest({ id: `g_${snap.id}`, name: snap.host.name || 'A friend', first: (snap.host.name || 'A friend').split(' ')[0], handle: '', avatar: null, suburb: '' }).id;
  const startsAt = Math.round((t + snap.s * 6e4) / 3e5) * 3e5; // plans sit on 5-minute marks; devices' clocks differ by seconds
  const o: Outing = {
    id: snap.id, title: String(snap.t || 'Night out').slice(0, 60), icon: snap.i || 'party', cover: null, kind: 'night', visibility: snap.vis === 'public' ? 'public' : 'private',
    organiserId: hostId, status: snap.st0 === 'ended' ? 'ended' : snap.st0 === 'live' ? 'live' : 'planning', startsAt, createdAt: t, endedAt: snap.st0 === 'ended' ? t : null,
    live: snap.st0 === 'live' ? { current: snap.cur || 0, startedAt: startsAt, arrivedAt: t } : null, inviteCode: snap.code || snap.id, activity: [],
  };
  S().outings.push(o);
  let order = 0;
  snap.stops.forEach(([ref, off]) => {
    const at = startsAt + off * 6e4;
    if (ref.startsWith('ev:')) { const e = eventById(ref.slice(3)); if (e) S().stops.push({ id: uid('s'), outingId: o.id, venueId: e.venueId || null, eventId: e.id, order: order++, at }); }
    else if (venueById[ref]) S().stops.push({ id: uid('s'), outingId: o.id, venueId: ref, order: order++, at });
  });
  S().attendees.push({ id: uid('a'), outingId: o.id, userId: hostId, rsvp: 'going', role: 'organiser', invitedBy: hostId, respondedAt: t, shareLocation: false });
  (snap.m || []).forEach(([userId, rsvp]) => { if (userById[userId] && userId !== meId && userId !== hostId) S().attendees.push({ id: uid('a'), outingId: o.id, userId, rsvp, role: 'guest', invitedBy: hostId, respondedAt: t, shareLocation: false }); });
  S().attendees.push({ id: uid('a'), outingId: o.id, userId: meId, rsvp: 'invited', role: 'guest', invitedBy: hostId, respondedAt: null, shareLocation: false });
  commit('outing:import', { id: o.id });
  return o;
}
export function updateOuting(id: string, patch: Partial<Outing>) {
  const o = outing(id)!;
  if (patch.startsAt && patch.startsAt !== o.startsAt) { const delta = patch.startsAt - o.startsAt; stopsOf(id).forEach((s) => (s.at += delta)); }
  Object.assign(o, patch);
  commit('outing:update', { id });
}
export function deleteOuting(id: string) {
  const s = S();
  s.outings = s.outings.filter((o) => o.id !== id);
  s.stops = s.stops.filter((x) => x.outingId !== id);
  s.attendees = s.attendees.filter((a) => a.outingId !== id);
  s.photos = s.photos.filter((p) => p.outingId !== id);
  s.messages = s.messages.filter((m) => m.outingId !== id);
  commit('outing:delete', { id });
}
/** at: optional explicit time; then the stop is slotted into the night in time order */
export function addStop(outingId: string, venueId: string, atTime?: number) {
  const o = outing(outingId)!;
  const list = stopsOf(outingId);
  if (list.some((s) => s.venueId === venueId && !s.eventId)) return null;
  const last = list[list.length - 1];
  const at = atTime || (last ? last.at + 90 * 6e4 : o.startsAt);
  const s: OutingStop = { id: uid('s'), outingId, venueId, order: list.length, at };
  S().stops.push(s);
  if (atTime) S().stops.filter((x) => x.outingId === outingId).sort((a, b) => a.at - b.at).forEach((x, i) => (x.order = i));
  log(o, { type: 'stop', userId: meId, venueId });
  commit('stop:add', { outingId, id: s.id });
  return s;
}
/** An event becomes a stop at its own start time, slotted into the night in time order */
export function addEventStop(outingId: string, eventId: string) {
  const e = eventById(eventId)!;
  if (stopsOf(outingId).some((s) => s.eventId === eventId)) return null;
  const s: OutingStop = { id: uid('s'), outingId, venueId: e.venueId || null, eventId, order: 99, at: e.startsAt };
  S().stops.push(s);
  S().stops.filter((x) => x.outingId === outingId).sort((a, b) => a.at - b.at).forEach((x, i) => (x.order = i));
  const o = outing(outingId)!;
  if (s.order === 0) o.startsAt = s.at;
  log(o, { type: 'stop', userId: meId, venueId: e.venueId, eventId });
  commit('stop:add', { outingId, id: s.id });
  return s;
}
export function removeStop(stopId: string) {
  const s = S().stops.find((x) => x.id === stopId);
  if (!s) return;
  const times = stopsOf(s.outingId).map((x) => x.at);
  S().stops = S().stops.filter((x) => x.id !== stopId);
  stopsOf(s.outingId).forEach((x, i) => { x.order = i; x.at = times[i]; });
  commit('stop:remove', { outingId: s.outingId });
}
/** Reorder keeps the time slots in place: stop #2 is still "9:30 PM" whichever venue it is */
export function reorderStops(outingId: string, orderedIds: string[]) {
  const o0 = outing(outingId)!;
  const nextBefore = o0.live ? stopsOf(outingId)[o0.live.current + 1]?.id : null;
  const list = stopsOf(outingId);
  const times = list.map((x) => x.at);
  orderedIds.forEach((id, i) => { const s = list.find((x) => x.id === id)!; s.order = i; s.at = times[i]; });
  const nx = o0.live ? stopsOf(outingId)[o0.live.current + 1] : null;
  if (nx && nx.id !== nextBefore) pushMsg(outingId, { kind: 'system', userId: null, sys: { type: 'next', userId: meId, venueId: nx.venueId, eventId: nx.eventId || null, at: nx.at } });
  commit('stop:reorder', { outingId });
}
export function setStopTime(stopId: string, at: number) {
  const s = S().stops.find((x) => x.id === stopId)!;
  s.at = at;
  if (s.order === 0) outing(s.outingId)!.startsAt = at;
  commit('stop:update', { outingId: s.outingId });
}
export function rsvp(outingId: string, value: Rsvp, userId: string = meId) {
  const o = outing(outingId)!;
  let a = attendeesOf(outingId).find((x) => x.userId === userId);
  if (!a) { a = { id: uid('a'), outingId, userId, role: 'guest', invitedBy: o.organiserId, shareLocation: false, rsvp: 'invited', respondedAt: null } as OutingMember; S().attendees.push(a); }
  const was = a.rsvp;
  a.rsvp = value; a.respondedAt = now();
  if (was !== value) log(o, { type: value === 'going' ? 'joined' : value, userId });
  commit('rsvp', { outingId, userId, value });
}
export function invite(outingId: string, userIds: string[]) {
  userIds.forEach((userId) => {
    if (attendeesOf(outingId).some((a) => a.userId === userId)) return;
    S().attendees.push({ id: uid('a'), outingId, userId, rsvp: 'invited', role: 'guest', invitedBy: meId, respondedAt: null, shareLocation: false });
  });
  commit('invite', { outingId, userIds });
}
export function startOuting(id: string) {
  const o = outing(id)!;
  o.status = 'live';
  o.live = { current: 0, startedAt: now(), arrivedAt: now() };
  log(o, { type: 'started', userId: meId });
  commit('live:start', { id });
}
export function advance(id: string) {
  const o = outing(id)!;
  const list = stopsOf(id);
  if (!o.live || o.live.current >= list.length - 1) return;
  o.live.current += 1; o.live.arrivedAt = now();
  log(o, { type: 'moved', userId: meId, venueId: list[o.live.current].venueId });
  commit('live:advance', { id });
}
export function endOuting(id: string) {
  const o = outing(id)!;
  o.status = 'ended'; o.endedAt = now();
  log(o, { type: 'ended', userId: meId });
  commit('live:end', { id });
}
export function duplicate(id: string, startsAt: number) {
  const src = outing(id)!;
  const o = createOuting({ title: src.title, icon: src.icon, startsAt, visibility: src.visibility });
  const delta = startsAt - src.startsAt;
  stopsOf(id).forEach((s, i) => S().stops.push({ id: uid('s'), outingId: o.id, venueId: s.venueId, eventId: s.eventId || null, order: i, at: s.at + delta }));
  commit('stop:add', { outingId: o.id });
  return o;
}

// ---------------------------------------------------------------- photos
export function addPhotos(outingId: string, items: Partial<Photo>[], { userId = meId, visibility = 'outing', source = 'upload', stopId }: { userId?: string; visibility?: Photo['visibility']; source?: Photo['source']; stopId?: string | null } = {}) {
  const o = outing(outingId)!;
  const list = stopsOf(outingId);
  const sid = stopId || (o.live ? list[o.live.current]?.id : list[0]?.id) || null;
  const added: Photo[] = items.map((it, i) => ({ id: uid('p'), outingId, stopId: sid, userId, takenAt: now() + i, visibility, source, ...it }));
  S().photos.push(...added);
  if (visibility === 'outing') {
    log(o, { type: 'photos', userId, count: added.length });
    // one quiet line per burst: "Grace added 6 photos"
    const last = messagesOf(outingId).pop();
    if (last && last.kind === 'system' && last.sys?.type === 'photos' && last.sys.userId === userId && now() - last.at < 10 * 6e4) {
      last.sys.photoIds = [...(last.sys.photoIds || []), ...added.map((p) => p.id)]; last.sys.count = (last.sys.count || 0) + added.length; last.at = now();
    } else pushMsg(outingId, { kind: 'system', userId: null, sys: { type: 'photos', userId, count: added.length, photoIds: added.map((p) => p.id) } });
  }
  commit('photos:add', { outingId, userId, count: added.length, visibility, ids: added.map((p) => p.id) });
  return added;
}
export function setPhotoVisibility(photoId: string, visibility: Photo['visibility']) {
  const p = photoById(photoId);
  if (p && p.userId === meId) { p.visibility = visibility; commit('photos:update', { outingId: p.outingId }); }
}
/** Opt-in: also show an outing photo publicly at its venue. The album keeps the original. */
export function sharePhotoPublicly(photoId: string) {
  const p = photoById(photoId);
  if (!p || p.userId !== meId) return null;
  const st = S().stops.find((s) => s.id === p.stopId);
  const venueId = st?.venueId;
  if (!venueId) return null;
  if (p.publicAt) return venueId;
  const pub: PublicPhoto = { id: uid('vp'), venueId, takenAt: p.takenAt, u: p.u, src: p.src, userId: meId, sourcePhotoId: p.id, visibility: 'public' };
  S().venuePhotos.push(pub);
  p.publicAt = venueId;
  commit('photos:public', { photoId, venueId });
  return venueId;
}
export function unsharePhotoPublicly(photoId: string) {
  const p = photoById(photoId);
  if (!p || p.userId !== meId) return;
  S().venuePhotos = S().venuePhotos.filter((x) => x.sourcePhotoId !== photoId);
  p.publicAt = null;
  commit('photos:public', { photoId });
}
export const photoVenue = (p: Photo) => { const st = S().stops.find((s) => s.id === p.stopId); return st?.venueId ? venueById[st.venueId] : undefined; };

// ---------------------------------------------------------------- recent searches
export function rememberSearch(q: string) {
  const t = q.trim(); if (t.length < 2) return;
  S().recentSearches = [t, ...S().recentSearches.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, 5);
  commit('search:recent');
}

// ---------------------------------------------------------------- building a fresh demo database
setFactory((t) => ({
  ...seed.build(t),
  ...seed.demoCity(t),
  events: loadAllEvents(t),
  collections: seed.collections(),
  chatPrefs: {},
  recentSearches: [],
}));
