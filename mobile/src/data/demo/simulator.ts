/* DEMO SIMULATOR — stands in for friends' phones so the prototype feels alive:
   friends post photos on live outings, reply in chat, vote, say they're keen, answer invites.
   Also batches the in-app notifications the way V5 did. In V7 this file is deleted:
   the same events arrive from Supabase Realtime. */
import { AppState } from 'react-native';
import { onEvent } from '@/store/hopStore';
import * as R from './repository';
import { now } from '@/utils/clock';
import { notificationService } from '@/services/notificationService';
import { plural } from '@/utils/format';

const rand = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
let chatOpenFor: string | null = null;
export const setChatOpen = (id: string | null) => { chatOpenFor = id; };
export const isChatOpen = (id: string) => chatOpenFor === id;
let albumOpenFor: string | null = null;
export const setAlbumOpen = (id: string | null) => { albumOpenFor = id; };

export const sim = {
  photoFor(outingId: string) {
    const o = R.outing(outingId)!;
    const st = R.stopsOf(outingId)[o.live ? o.live.current : 0];
    const v = st?.venueId ? R.venueById[st.venueId] : undefined;
    const pool = Math.random() < 0.4 ? R.IMAGE_POOLS.friends : Math.random() < 0.2 && o.icon === 'cake' ? R.IMAGE_POOLS.party : R.poolFor(v?.cat);
    return { u: { id: rand(pool), fx: (0.25 + Math.random() * 0.5).toFixed(2), fy: (0.3 + Math.random() * 0.4).toFixed(2), fz: (1 + Math.random() * 0.8).toFixed(2) } };
  },
  friendPost(outingId: string, opts: { userId?: string; n?: number } = {}) {
    const others = R.going(outingId).map((a) => a.userId).filter((id) => id !== R.getMeId());
    if (!others.length) return;
    const userId = opts.userId || rand(others);
    const n = opts.n || rand([1, 1, 2, 3, 3, 4]);
    R.addPhotos(outingId, Array.from({ length: n }, () => sim.photoFor(outingId)), { userId, source: Math.random() < 0.75 ? 'camera' : 'upload' });
  },
  burst(outingId: string) {
    const others = R.going(outingId).map((a) => a.userId).filter((id) => id !== R.getMeId()).sort(() => Math.random() - 0.5).slice(0, 5);
    [4, 3, 3, 2, 2].forEach((n, i) => others[i] && setTimeout(() => sim.friendPost(outingId, { userId: others[i], n }), 250 + i * 380));
  },
  replies(outingId: string, userIds: string[]) {
    userIds.forEach((id, i) => setTimeout(() => {
      const a = R.attendeesOf(outingId).find((x) => x.userId === id);
      if (!a || a.rsvp !== 'invited') return;
      const r = Math.random();
      R.rsvp(outingId, r < 0.7 ? 'going' : r < 0.9 ? 'maybe' : 'declined', id);
    }, 3500 + i * 2600 + Math.random() * 3000));
  },
  pickFriend(outingId: string, not?: string) {
    const ids = R.going(outingId).map((a) => a.userId).filter((id) => id !== R.getMeId() && id !== not);
    return ids.length ? rand(ids) : undefined;
  },
  chatReply(outingId: string, text: string) {
    const o = R.outing(outingId); if (!o) return;
    const phase = R.chatPhase(o);
    const st = R.stopsOf(outingId);
    const cur = o.live ? st[o.live.current] : st[0];
    const nx = o.live ? st[o.live.current + 1] : st[1];
    const who = sim.pickFriend(outingId);
    if (!who) return;
    const t = text.toLowerCase();
    const mine = R.messagesOf(outingId).filter((m) => m.userId === R.getMeId()).pop();
    let reply: string | null = null; let extra: any = {};
    if (/where (are|r) (you|u|ya)|where you|where's everyone|where is everyone/.test(t)) {
      if (phase === 'during' && cur && Math.random() < 0.5) {
        const v = R.placeOf(cur);
        extra = { kind: 'location', loc: { lat: v.lat + (Math.random() - 0.5) * 0.0012, lng: v.lng + (Math.random() - 0.5) * 0.0012, label: `Near ${v.name}`, until: now() + 30 * 6e4 } };
      } else reply = phase === 'during' && cur ? rand([`Upstairs at ${R.stopName(cur)}`, `Out the front of ${R.stopName(cur)}`, 'At the bar, come find us']) : rand(['Not out yet, leaving at 7', 'Getting ready, 20 min', 'On the bus']);
    } else if (/late|running/.test(t)) reply = rand(['No stress', 'All good, we’ll be here', 'Classic']);
    else if (/heading|going to|omw|on my way/.test(t)) reply = rand([`See you at ${nx ? R.stopName(nx) : 'the next one'}`, 'We’ll grab a table', 'Get me a drink']);
    else if (t.includes('?')) reply = phase === 'during' ? rand(['Yep', '2 min', 'Ask Jack', 'I’m keen']) : rand(['Works for me', 'Down', 'Yep', 'Sounds good']);
    setTimeout(() => {
      if (mine) R.react(mine.id, rand(['up', 'fire', 'haha']), who);
      if (reply || extra.kind) setTimeout(() => R.postMessage(outingId, { text: reply, replyTo: reply && Math.random() < 0.4 && mine ? mine.id : null, ...extra }, who), 1800 + Math.random() * 2500);
    }, 2500 + Math.random() * 2500);
  },
  chatKeen(outingId: string) {
    const m = R.messagesOf(outingId).filter((x) => x.kind === 'place').pop();
    if (!m) return;
    [0, 1, 2].slice(0, 1 + Math.floor(Math.random() * 3)).forEach((k) => setTimeout(() => { const u = sim.pickFriend(outingId); if (u && !(m.keen || []).includes(u)) R.keen(m.id, u); }, 3000 + k * 2600));
  },
  chatVotes(outingId: string, msgId: string) {
    const voters = R.going(outingId).map((a) => a.userId).filter((id) => id !== R.getMeId()).sort(() => Math.random() - 0.5).slice(0, 7);
    voters.forEach((u, k) => setTimeout(() => { const m = R.messageById(msgId); if (m?.poll && !m.poll.closed) R.vote(msgId, Math.random() < 0.6 ? 0 : Math.floor(Math.random() * m.poll.options.length), u); }, 2500 + k * 1700 + Math.random() * 1200));
  },
  chatter(outingId: string) {
    const o = R.outing(outingId); if (!o?.live) return;
    const st = R.stopsOf(o.id), cur = st[o.live.current], nx = st[o.live.current + 1];
    const who = sim.pickFriend(o.id);
    if (!who || !cur) return;
    const lines = ['Who wants a drink? I’m at the bar', 'We’re upstairs', 'Grabbed a table near the back', nx ? `What time are we heading to ${R.stopName(nx)}?` : 'Last stop, let’s go big', nx ? `Is the line long at ${R.stopName(nx)}?` : 'Kebab after?', 'Someone has my lighter', `Just got to ${R.stopName(cur)}, where are you?`, 'This DJ is going off', '@Ollie happy birthday!!'];
    const text = rand(lines);
    if (text.includes('@Ollie') && !o.title.includes('Birthday')) return;
    R.postMessage(o.id, { text }, who);
  },
};

// ---------------------------------------------------------------- the clock that drives it
const nextAt: Record<string, number> = {}, chatAt: Record<string, number> = {};
function tick() {
  if (AppState.currentState !== 'active') return;
  const t = now();
  R.myOutings().live.forEach((o) => {
    if (!chatAt[o.id]) chatAt[o.id] = t + 20000 + Math.random() * 15000;
    if (t >= chatAt[o.id]) { sim.chatter(o.id); chatAt[o.id] = t + 40000 + Math.random() * 40000; }
  });
  R.tonightOutings().filter((o) => o.status === 'live').forEach((o) => {
    if (!nextAt[o.id]) nextAt[o.id] = Math.max(t + 2500 + Math.random() * 9000, o.live!.startedAt + 5000);
    if (t >= nextAt[o.id]) {
      sim.friendPost(o.id);
      const mine = R.myAttendance(o.id)?.rsvp === 'going';
      nextAt[o.id] = t + (mine ? 16000 : 22000) + Math.random() * (mine ? 16000 : 26000);
    }
  });
}

// ---------------------------------------------------------------- notifications (batched)
const pending: Record<string, { users: Record<string, number>; ids: string[]; first: number; t: any }> = {};
function queuePhotoNote(p: any) {
  const q = (pending[p.outingId] ||= { users: {}, ids: [], first: Date.now(), t: null });
  q.users[p.userId] = (q.users[p.userId] || 0) + p.count;
  q.ids.push(...(p.ids || []));
  clearTimeout(q.t);
  if (Date.now() - q.first > 6000) flush(p.outingId);
  else q.t = setTimeout(() => flush(p.outingId), 2200);
}
function flush(outingId: string) {
  const q = pending[outingId]; if (!q) return;
  clearTimeout(q.t); delete pending[outingId];
  const o = R.outing(outingId); if (!o || albumOpenFor === outingId) return;
  const who = Object.keys(q.users);
  const total = Object.values(q.users).reduce((a, b) => a + b, 0);
  const single = who.length === 1 && total < 10;
  notificationService.banner({
    kind: 'photos', outingId, photoIds: q.ids.slice(-3),
    lead: { kind: 'photos', photoIds: q.ids.slice(-3) },
    title: single ? `${R.userById[who[0]].first} added ${plural(total, 'photo')} to ${o.title}` : `${total} new photos were added to ${o.title}`,
    text: single ? 'Tap to see them' : `From ${who.slice(0, 3).map((id) => R.userById[id].first).join(', ')}${who.length > 3 ? ` and ${who.length - 3} more` : ''}`,
    action: { type: 'openAlbum', outingId },
  }, 5200);
}
const chatPending: Record<string, { msgs: any[]; t: any }> = {};
function queueChatNote(p: any) {
  const o = R.outing(p.outingId);
  if (!o || !R.canChat(o)) return;
  const m = R.messageById(p.id); if (!m || !m.userId) return;
  if (chatOpenFor === o.id) return;
  const pref = R.chatPref(o.id);
  if (pref === 'mute' || (pref === 'mentions' && !R.mentionsMe(m))) return;
  const q = (chatPending[o.id] ||= { msgs: [], t: null });
  q.msgs.push(m);
  clearTimeout(q.t);
  q.t = setTimeout(() => {
    delete chatPending[o.id];
    const last = q.msgs[q.msgs.length - 1];
    const preview = chatPreview(last);
    notificationService.banner({ kind: 'chat', outingId: o.id, userId: last.userId, lead: { kind: 'avatar', userId: last.userId }, title: o.title, text: q.msgs.length > 1 ? `${q.msgs.length} new messages · ${preview}` : preview, action: { type: 'openChat', outingId: o.id } });
  }, 1400);
}
/** "Jack: Where are you guys?" */
export function chatPreview(m: any): string {
  if (!m) return '';
  if (m.kind === 'system') return sysText(m);
  const who = m.userId === R.getMeId() ? 'You' : R.userById[m.userId]?.first;
  const place = m.place?.eventId ? R.eventById(m.place.eventId)?.title : R.venueById[m.place?.venueId]?.name;
  const body: Record<string, string> = { text: m.text, place: `shared ${place}`, location: 'shared a location', poll: `asked: ${m.poll?.q}`, photo: 'sent a photo' };
  return `${who}: ${body[m.kind] || ''}`;
}
export function sysText(m: any): string {
  const s = m.sys; const who = s.userId ? (s.userId === R.getMeId() ? 'You' : R.userById[s.userId]?.first || 'Someone') : '';
  const pn = (s.eventId ? R.eventById(s.eventId)?.title : R.venueById[s.venueId]?.name) || 'a new spot';
  switch (s.type) {
    case 'joined': return `${who} ${s.userId === R.getMeId() ? 'joined' : 'joined the outing'}`;
    case 'stop': return `${who} added ${pn} to the route`;
    case 'moved': return `The group is now at ${pn}`;
    case 'next': return `Next stop changed to ${pn}`;
    case 'started': return `${who} started the night`;
    case 'ended': return 'The night’s wrapped. It’s saved in Memories';
    case 'photos': return `${who} added ${plural(s.count, 'photo')}`;
    case 'poll': return `${s.count} ${s.count === 1 ? 'person' : 'people'} voted for ${pn}`;
    default: return '';
  }
}

let started = false;
export function startSimulator() {
  if (started) return; started = true;
  setInterval(tick, 1000);
  onEvent((type, p) => {
    if (type === 'photos:add' && p.visibility === 'outing' && p.userId !== R.getMeId() && R.myAttendance(p.outingId)?.rsvp === 'going') queuePhotoNote(p);
    if (type === 'chat:post' && p.userId && p.userId !== R.getMeId()) queueChatNote(p);
    if (type === 'invite') sim.replies(p.outingId, p.userIds);
    if (type === 'rsvp' && p.userId !== R.getMeId()) {
      const o = R.outing(p.outingId);
      if (o && R.isOrganiser(o) && p.value !== 'invited') {
        const u = R.userById[p.userId];
        notificationService.banner({ kind: 'rsvp', outingId: o.id, userId: u.id, lead: { kind: 'avatar', userId: u.id }, title: `${u.first} ${({ going: 'is going', maybe: 'might come', declined: 'can’t make it' } as any)[p.value]}`, text: `${o.title} · ${R.going(o.id).length} going`, action: { type: 'openOuting', outingId: o.id } });
      }
    }
  });
}
