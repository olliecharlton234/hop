/* HOP — the data layer.
   Five core entities: User, Outing, Attendee, Stop, Photo. Venues are reference data.
   State persists to localStorage and syncs between open tabs (BroadcastChannel), which is
   how "photos appear live" works in this prototype. Swap persist()/channel for a real
   backend (Supabase/Firebase/etc.) without touching the screens. */

HOP.store = (() => {
  const { uid } = HOP.util;
  const KEY = 'hop.state.v6';
  const TAB = uid('tab');
  const listeners = new Set();
  let state;
  let storageOk = true;

  const venues = HOP.seed.venues;
  const venueById = Object.fromEntries(venues.map((v) => [v.id, v]));
  const userById = Object.fromEntries(HOP.seed.users.map((u) => [u.id, u]));

  function fresh() {
    const offset = HOP.clock.realtime ? 0 : HOP.clock.demoOffset();
    HOP.clock.set(offset);
    const now = HOP.now();
    return { v: 6, clockOffset: offset, ...HOP.seed.build(now), ...HOP.seed.demoCity(now), collections: HOP.seed.collections(), events: HOP.events.loadAll(now), chatPrefs: {} };
  }
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { state = JSON.parse(raw); HOP.clock.set(state.clockOffset); return; }
    } catch (e) { /* storage blocked */ }
    state = fresh();
    persist();
  }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); storageOk = true; }
    catch (e) {
      // Usually quota: drop full-size uploaded images from storage, keep them in memory
      storageOk = false;
      try {
        const slim = { ...state, photos: state.photos.map((p) => (p.src && p.src.length > 60000 ? { ...p, src: p.thumb || null } : p)) };
        localStorage.setItem(KEY, JSON.stringify(slim));
      } catch (e2) { /* give up quietly — app keeps working in memory */ }
    }
  }

  // ---- identity (per tab, so two tabs can be two different friends) -------
  let meId = 'u_ollie';
  try { meId = sessionStorage.getItem('hop.me') || 'u_ollie'; } catch (e) {}
  const me = () => userById[meId];
  function setMe(id, silent) { meId = id; try { sessionStorage.setItem('hop.me', id); } catch (e) {} if (!silent) emit('me'); }

  // ---- events + cross-tab sync --------------------------------------------
  let channel = null;
  try { channel = new BroadcastChannel('hop'); } catch (e) {}
  if (channel) channel.onmessage = (ev) => {
    if (!ev.data || ev.data.tab === TAB) return;
    try { const raw = localStorage.getItem(KEY); if (raw) state = JSON.parse(raw); } catch (e) {}
    emit(ev.data.type, { ...ev.data.payload, remote: true });
  };
  const on = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
  function emit(type, payload = {}) { listeners.forEach((fn) => fn(type, payload)); }
  function commit(type, payload = {}) {
    persist();
    if (channel) { try { channel.postMessage({ tab: TAB, type, payload }); } catch (e) {} }
    emit(type, payload);
  }

  // ---- selectors ----------------------------------------------------------
  const outing = (id) => state.outings.find((o) => o.id === id);
  const stopsOf = (id) => state.stops.filter((s) => s.outingId === id).sort((a, b) => a.order - b.order);
  const attendeesOf = (id) => state.attendees.filter((a) => a.outingId === id);
  const going = (id) => attendeesOf(id).filter((a) => a.rsvp === 'going');
  const myAttendance = (id) => attendeesOf(id).find((a) => a.userId === meId);
  const isOrganiser = (o) => o && o.organiserId === meId;
  const eventOf = (stop) => (stop.eventId ? HOP.events.byId(stop.eventId) : null);
  const stopName = (stop) => { const e = eventOf(stop); return e ? e.title : placeOf(stop).name; };
  const placeOf = (stop) => venueById[stop.venueId] || (stop.eventId ? HOP.events.placeOf(eventOf(stop)) : stop.place);

  // Photos I can see: everything shared with the outing, plus my private ones
  const photosOf = (id, stopId) => state.photos
    .filter((p) => p.outingId === id && (p.visibility !== 'private' || p.userId === meId) && (!stopId || p.stopId === stopId))
    .sort((a, b) => a.takenAt - b.takenAt);

  function myOutings() {
    const mine = (o) => { const a = myAttendance(o.id); return a && a.rsvp !== 'declined'; };
    const list = state.outings.filter(mine);
    return {
      live: list.filter((o) => o.status === 'live' && myAttendance(o.id).rsvp === 'going'),
      invites: list.filter((o) => o.status !== 'ended' && myAttendance(o.id).rsvp === 'invited'),
      upcoming: list.filter((o) => o.status === 'planning' && myAttendance(o.id).rsvp !== 'invited').sort((a, b) => a.startsAt - b.startsAt),
      memories: list.filter((o) => o.status === 'ended' && myAttendance(o.id).rsvp === 'going').sort((a, b) => b.startsAt - a.startsAt),
    };
  }
  const publicOutings = () => state.outings.filter((o) => o.visibility === 'public' && o.status !== 'ended');

  // ---- tonight: who's out, where, and what it's like ----------------------
  const nightOf = (ts) => HOP.events.dayKey(ts);
  // Outings happening tonight that I can see: mine, ones I'm invited to, public ones
  function tonightOutings() {
    const k = nightOf(HOP.now());
    return state.outings.filter((o) => o.status !== 'ended' && nightOf(o.status === 'live' ? HOP.now() : o.startsAt) === k
      && (myAttendance(o.id) || o.visibility === 'public'))
      .sort((a, b) => (b.status === 'live') - (a.status === 'live') || a.startsAt - b.startsAt);
  }
  // Where each friend is right now: from live outings (current stop) and location sharing
  function friendsOut() {
    const out = new Map();
    state.outings.filter((o) => o.status === 'live' && (myAttendance(o.id) || o.visibility === 'public')).forEach((o) => {
      const st = stopsOf(o.id)[o.live.current];
      if (!st) return;
      going(o.id).forEach((a) => { if (a.userId !== meId) out.set(a.userId, { user: userById[a.userId], venueId: st.venueId, eventId: st.eventId || null, outingId: o.id, since: o.live.arrivedAt }); });
    });
    (state.presence || []).forEach((p) => { if (!out.has(p.userId) && p.userId !== meId) out.set(p.userId, { user: userById[p.userId], venueId: p.venueId, eventId: p.eventId, outingId: null, since: p.since }); });
    return [...out.values()].sort((a, b) => b.since - a.since);
  }
  const friendsAt = (venueId) => friendsOut().filter((f) => f.venueId === venueId);
  const friendsAtEvent = (eventId) => friendsOut().filter((f) => f.eventId === eventId);

  // How busy a place is right now (demo model: popularity × distance from its peak hour)
  function activity(venueId) {
    const [pop, peak] = HOP.seed.POP[venueId] || [0.32, 21];
    const d = new Date(HOP.now());
    let h = d.getHours() + d.getMinutes() / 60; if (h < 6) h += 24;
    const friends = friendsAt(venueId);
    const at = (hh) => Math.min(1, pop * Math.exp(-(((hh - peak) / 3.2) ** 2)) * 1.15 + friends.length * 0.03);
    const busy = at(h), soon = at(h + 0.75);
    const trend = soon - busy > 0.04 ? 'rising' : busy - soon > 0.04 ? 'easing' : 'steady';
    const label = HOP.activity ? HOP.activity.level(busy) : 'Quiet';
    const lv = HOP.activity ? HOP.activity.levelIdx(busy) : 0;
    const liveHere = state.outings.filter((o) => o.status === 'live' && (myAttendance(o.id) || o.visibility === 'public') && stopsOf(o.id)[o.live.current]?.venueId === venueId);
    const tonightPhotos = liveHere.flatMap((o) => photosOf(o.id, stopsOf(o.id)[o.live.current].id));
    return { busy, label, lv, trend, hot: busy >= 0.6, onHop: Math.round(busy * 64 + friends.length), friends, liveHere, tonightPhotos };
  }
  // My photos from past nights at this venue
  const memoryPhotosAt = (venueId) => state.stops.filter((s) => s.venueId === venueId && outing(s.outingId)?.status === 'ended' && myAttendance(s.outingId)?.rsvp === 'going')
    .flatMap((s) => photosOf(s.outingId, s.id));

  // ---- mutations ----------------------------------------------------------
  // Activity feeds the outing's updates list, and the meaningful parts also land in the chat as quiet lines
  const SYS_TYPES = new Set(['joined', 'stop', 'moved', 'started', 'ended']);
  function log(o, entry) {
    o.activity = [{ id: uid('ac'), at: HOP.now(), ...entry }, ...(o.activity || [])].slice(0, 80);
    if (SYS_TYPES.has(entry.type)) pushMsg(o.id, { kind: 'system', userId: null, sys: { ...entry } });
  }

  // ---- outing chat ---------------------------------------------------------
  // One temporary group chat per outing, for its attendees. Not a general messenger:
  // it opens with the plan, is busiest on the night, and closes 48 hours after it ends.
  const CHAT_OPEN_AFTER = 48 * 36e5;
  const messagesOf = (outingId) => (state.messages || []).filter((m) => m.outingId === outingId).sort((a, b) => a.at - b.at);
  const canChat = (o) => { const a = myAttendance(o.id); return !!a && a.rsvp !== 'declined'; };
  function chatPhase(o) {
    if (o.status === 'live') return 'during';
    if (o.status !== 'ended') return 'before';
    return HOP.now() - (o.endedAt || o.startsAt) < CHAT_OPEN_AFTER ? 'after' : 'closed';
  }
  const chatClosesAt = (o) => (o.endedAt || o.startsAt) + CHAT_OPEN_AFTER;
  function pushMsg(outingId, m) {
    state.messages ||= [];
    const msg = { id: uid('m'), outingId, at: HOP.now(), reactions: {}, ...m };
    state.messages.push(msg);
    return msg;
  }
  function postMessage(outingId, m, userId = meId) {
    const msg = pushMsg(outingId, { userId, kind: 'text', ...m });
    if (userId === meId) markRead(outingId, true);
    commit('chat:post', { outingId, id: msg.id, userId, kind: msg.kind });
    return msg;
  }
  function react(msgId, emoji, userId = meId) {
    const m = state.messages.find((x) => x.id === msgId);
    const list = (m.reactions[emoji] ||= []);
    const i = list.indexOf(userId);
    if (i >= 0) list.splice(i, 1); else list.push(userId);
    if (!list.length) delete m.reactions[emoji];
    commit('chat:react', { outingId: m.outingId, id: msgId });
  }
  // place cards: "I'm keen" is a lightweight vote; polls: one vote per person
  function keen(msgId, userId = meId) {
    const m = state.messages.find((x) => x.id === msgId);
    m.keen ||= [];
    const i = m.keen.indexOf(userId);
    if (i >= 0) m.keen.splice(i, 1); else m.keen.push(userId);
    commit('chat:react', { outingId: m.outingId, id: msgId });
  }
  function vote(msgId, idx, userId = meId) {
    const m = state.messages.find((x) => x.id === msgId);
    if (m.poll.closed) return;
    m.poll.options.forEach((op, k) => { op.votes = op.votes.filter((u) => u !== userId); if (k === idx) op.votes.push(userId); });
    commit('chat:react', { outingId: m.outingId, id: msgId });
  }
  function closePoll(msgId) {
    const m = state.messages.find((x) => x.id === msgId);
    m.poll.closed = true;
    const win = m.poll.options.slice().sort((a, b) => b.votes.length - a.votes.length)[0];
    pushMsg(m.outingId, { kind: 'system', userId: null, sys: { type: 'poll', count: win.votes.length, venueId: win.venueId } });
    commit('chat:post', { outingId: m.outingId, id: m.id, userId: null, kind: 'system' });
    return win;
  }
  function stopSharing(msgId) {
    const m = state.messages.find((x) => x.id === msgId);
    if (m && m.loc) { m.loc.until = HOP.now(); commit('chat:react', { outingId: m.outingId, id: msgId }); }
  }
  const activeLocations = () => (state.messages || []).filter((m) => m.kind === 'location' && m.loc.until > HOP.now() && m.userId !== meId && canChat(outing(m.outingId) || {}));

  // read state and notification settings are per person
  // ---- saved collections (per person): Want to go, Good pubs, Restaurants… -----------
  function collections() {
    state.collections ||= {};
    if (!state.collections[meId]) {
      const old = (state.saved && state.saved[meId]) || [];
      state.collections[meId] = meId === 'u_ollie' && !old.length ? HOP.seed.collections().u_ollie
        : [['want', 'Want to go'], ['pubs', 'Good pubs'], ['food', 'Restaurants'], ['late', 'Late night'], ['date', 'Date night']].map(([id, name]) => ({ id, name, items: id === 'want' ? old.map((venueId) => ({ venueId })) : [] }));
    }
    return state.collections[meId];
  }
  const refKey = (r) => (r.venueId ? 'v:' + r.venueId : 'e:' + r.eventId);
  const collectionsOf = (ref) => collections().filter((c) => c.items.some((i) => refKey(i) === refKey(ref)));
  const isSaved = (ref) => collectionsOf(ref).length > 0;
  // all saved venue ids, newest first (Saved sections, search)
  const saved = () => [...new Set(collections().flatMap((c) => c.items.filter((i) => i.venueId).map((i) => i.venueId)))];
  const savedEvents = () => [...new Set(collections().flatMap((c) => c.items.filter((i) => i.eventId).map((i) => i.eventId)))];
  function setSaved(ref, colId, on) {
    const c = collections().find((x) => x.id === colId); if (!c) return;
    const i = c.items.findIndex((x) => refKey(x) === refKey(ref));
    if (on && i < 0) c.items.unshift(ref); if (!on && i >= 0) c.items.splice(i, 1);
    commit('saved', ref);
  }
  function toggleSave(venueId) { const ref = { venueId }; const on = !isSaved(ref); if (on) setSaved(ref, 'want', true); else collectionsOf(ref).forEach((c) => setSaved(ref, c.id, false)); return on; }

  // ---- crowd reports (structured, anonymous, decaying) ----------------------------
  const REPORT_KINDS = {
    crowd: { label: 'Crowd', opts: [['quiet', 'Quiet'], ['moderate', 'Moderate'], ['busy', 'Busy'], ['packed', 'Packed']] },
    queue: { label: 'Queue', opts: [['none', 'None'], ['short', 'Short'], ['medium', 'Medium'], ['long', 'Long']] },
    entry: { label: 'Entry', opts: [['free', 'Free'], ['cover', 'Cover']] },
    vibe: { label: 'Music / vibe', opts: [['chatty', 'Chatty'], ['loud', 'Loud'], ['live', 'Live music'], ['dj', 'DJ'], ['dancing', 'Dancing']] },
  };
  // The current read per category: recency-weighted vote, so no single report swings it
  function reportsAt(venueId, t = HOP.now()) {
    const rs = (state.reports || []).filter((r) => r.venueId === venueId && t - r.at < 90 * 6e4 && t >= r.at);
    const out = {};
    Object.keys(REPORT_KINDS).forEach((k) => {
      const l = rs.filter((r) => r.kind === k); if (!l.length) return;
      const tally = {}; l.forEach((r) => { tally[r.value] = (tally[r.value] || 0) + Math.exp(-(t - r.at) / (45 * 6e4)); });
      const value = Object.entries(tally).sort((a, b) => b[1] - a[1])[0][0];
      out[k] = { value, label: REPORT_KINDS[k].opts.find((x) => x[0] === value)?.[1] || value, n: l.length, last: Math.max(...l.map((r) => r.at)) };
    });
    return out;
  }
  // You can only report where you are: near the venue, or at your outing's current stop
  function canReport(venueId) {
    const v = venueById[venueId]; if (!v) return { ok: false, why: '' };
    const atStop = state.outings.some((o) => o.status === 'live' && myAttendance(o.id)?.rsvp === 'going' && stopsOf(o.id)[o.live.current]?.venueId === venueId);
    const d = HOP.map ? HOP.util.metres(HOP.map.ME, v) : 1e9;
    if (atStop || d <= 600) return { ok: true };
    return { ok: false, why: `Reports come from people there. You’re ${HOP.util.distLabel ? HOP.util.distLabel(d) : Math.round(d) + ' m'} away.` };
  }
  function addReport(venueId, picks) {
    state.reports ||= [];
    const at = HOP.now();
    Object.entries(picks).forEach(([kind, value]) => state.reports.push({ id: uid('rp'), venueId, kind, value, at, userId: meId }));
    state.reports = state.reports.filter((r) => at - r.at < 6 * 36e5);
    commit('report', { venueId });
  }
  const myLastReport = (venueId) => (state.reports || []).filter((r) => r.venueId === venueId && r.userId === meId).sort((a, b) => b.at - a.at)[0];
  // Public photos at a venue tonight (shared publicly; no names attached)
  const venuePhotos = (venueId, t = HOP.now()) => (state.venuePhotos || []).filter((p) => p.venueId === venueId && t - p.takenAt < 8 * 36e5 && p.takenAt <= t).sort((a, b) => b.takenAt - a.takenAt);
  function markRead(outingId, silent) {
    state.reads ||= {};
    (state.reads[meId] ||= {})[outingId] = HOP.now();
    if (!silent) { persist(); emit('chat:read', { outingId }); }
  }
  const lastRead = (outingId) => state.reads?.[meId]?.[outingId] || 0;
  const unread = (outingId) => messagesOf(outingId).filter((m) => m.userId && m.userId !== meId && m.at > lastRead(outingId)).length;
  const lastMessage = (outingId) => messagesOf(outingId).filter((m) => m.kind !== 'system' || m.sys.type === 'photos').pop();
  const chatPref = (outingId) => state.chatPrefs?.[meId]?.[outingId] || (myAttendance(outingId)?.rsvp === 'going' ? 'all' : 'mentions');
  function setChatPref(outingId, v) { state.chatPrefs ||= {}; (state.chatPrefs[meId] ||= {})[outingId] = v; commit('chat:pref', { outingId }); }
  const mentionsMe = (m) => !!m.text && new RegExp('@' + me().first + '\\b', 'i').test(m.text);

  function createOuting({ title, emoji, startsAt, visibility, cover }) {
    const id = uid('o');
    const o = {
      id, title: title.trim() || 'Night out', emoji: emoji || 'party', cover: cover || null, kind: 'night', visibility: visibility || 'private',
      organiserId: meId, status: 'planning', startsAt, createdAt: HOP.now(), live: null, endedAt: null,
      inviteCode: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) + '-' + Math.random().toString(36).slice(2, 6),
      activity: [],
    };
    state.outings.push(o);
    state.attendees.push({ id: uid('a'), outingId: id, userId: meId, rsvp: 'going', role: 'organiser', invitedBy: meId, respondedAt: HOP.now(), shareLocation: false });
    commit('outing:create', { id });
    return o;
  }
  function updateOuting(id, patch) { Object.assign(outing(id), patch); commit('outing:update', { id }); }
  function deleteOuting(id) {
    state.outings = state.outings.filter((o) => o.id !== id);
    state.stops = state.stops.filter((s) => s.outingId !== id);
    state.attendees = state.attendees.filter((a) => a.outingId !== id);
    state.photos = state.photos.filter((p) => p.outingId !== id);
    state.messages = (state.messages || []).filter((m) => m.outingId !== id);
    commit('outing:delete', { id });
  }

  // at: optional explicit time; then the stop is slotted into the night in time order
  function addStop(outingId, venueId, atTime) {
    const o = outing(outingId);
    const list = stopsOf(outingId);
    if (list.some((s) => s.venueId === venueId && !s.eventId)) return null;
    const last = list[list.length - 1];
    const at = atTime || (last ? last.at + 90 * 6e4 : o.startsAt);
    const s = { id: uid('s'), outingId, venueId, order: list.length, at };
    state.stops.push(s);
    if (atTime) state.stops.filter((x) => x.outingId === outingId).sort((a, b) => a.at - b.at).forEach((x, i) => (x.order = i));
    log(o, { type: 'stop', userId: meId, venueId });
    commit('stop:add', { outingId, id: s.id });
    return s;
  }
  // An event becomes a stop at its own start time, slotted into the night in time order
  function addEventStop(outingId, eventId) {
    const e = HOP.events.byId(eventId);
    if (stopsOf(outingId).some((s) => s.eventId === eventId)) return null;
    const s = { id: uid('s'), outingId, venueId: e.venueId || null, eventId, order: 99, at: e.startsAt };
    state.stops.push(s);
    state.stops.filter((x) => x.outingId === outingId).sort((a, b) => a.at - b.at).forEach((x, i) => (x.order = i));
    const o = outing(outingId);
    if (s.order === 0) o.startsAt = s.at;
    log(o, { type: 'stop', userId: meId, venueId: e.venueId, eventId });
    commit('stop:add', { outingId, id: s.id });
    return s;
  }
  function touch(type, payload) { commit(type, payload); }
  function removeStop(stopId) {
    const s = state.stops.find((x) => x.id === stopId);
    if (!s) return;
    const times = stopsOf(s.outingId).map((x) => x.at);
    state.stops = state.stops.filter((x) => x.id !== stopId);
    stopsOf(s.outingId).forEach((x, i) => { x.order = i; x.at = times[i]; });
    commit('stop:remove', { outingId: s.outingId });
  }
  // Reorder keeps the time slots in place: stop #2 is still "9:30 PM" whichever venue it is
  function reorderStops(outingId, orderedIds) {
    const o0 = outing(outingId);
    const nextBefore = o0.live ? stopsOf(outingId)[o0.live.current + 1]?.id : null;
    const list = stopsOf(outingId);
    const times = list.map((x) => x.at);
    orderedIds.forEach((id, i) => { const s = list.find((x) => x.id === id); s.order = i; s.at = times[i]; });
    const nx = o0.live ? stopsOf(outingId)[o0.live.current + 1] : null;
    if (nx && nx.id !== nextBefore) pushMsg(outingId, { kind: 'system', userId: null, sys: { type: 'next', userId: meId, venueId: nx.venueId, eventId: nx.eventId || null, at: nx.at } });
    commit('stop:reorder', { outingId });
  }
  function setStopTime(stopId, at) {
    const s = state.stops.find((x) => x.id === stopId);
    s.at = at;
    if (s.order === 0) outing(s.outingId).startsAt = at;
    commit('stop:update', { outingId: s.outingId });
  }

  function rsvp(outingId, value, userId = meId) {
    const o = outing(outingId);
    let a = attendeesOf(outingId).find((x) => x.userId === userId);
    if (!a) { a = { id: uid('a'), outingId, userId, role: 'guest', invitedBy: o.organiserId, shareLocation: false }; state.attendees.push(a); }
    const was = a.rsvp;
    a.rsvp = value; a.respondedAt = HOP.now();
    if (was !== value) log(o, { type: value === 'going' ? 'joined' : value, userId });
    commit('rsvp', { outingId, userId, value });
  }
  function invite(outingId, userIds) {
    userIds.forEach((userId) => {
      if (attendeesOf(outingId).some((a) => a.userId === userId)) return;
      state.attendees.push({ id: uid('a'), outingId, userId, rsvp: 'invited', role: 'guest', invitedBy: meId, respondedAt: null, shareLocation: false });
    });
    commit('invite', { outingId, userIds });
  }

  // ---- live ---------------------------------------------------------------
  function startOuting(id) {
    const o = outing(id);
    o.status = 'live';
    o.live = { current: 0, startedAt: HOP.now(), arrivedAt: HOP.now() };
    log(o, { type: 'started', userId: meId });
    commit('live:start', { id });
  }
  function advance(id) {
    const o = outing(id);
    const list = stopsOf(id);
    if (o.live.current >= list.length - 1) return;
    o.live.current += 1; o.live.arrivedAt = HOP.now();
    log(o, { type: 'moved', userId: meId, venueId: list[o.live.current].venueId });
    commit('live:advance', { id });
  }
  function endOuting(id) {
    const o = outing(id);
    o.status = 'ended'; o.endedAt = HOP.now();
    log(o, { type: 'ended', userId: meId });
    commit('live:end', { id });
  }

  // ---- photos -------------------------------------------------------------
  function addPhotos(outingId, items, { userId = meId, visibility = 'outing', source = 'upload', stopId } = {}) {
    const o = outing(outingId);
    const list = stopsOf(outingId);
    const sid = stopId || (o.live ? list[o.live.current]?.id : list[0]?.id);
    const added = items.map((it, i) => ({
      id: uid('p'), outingId, stopId: sid, userId, takenAt: HOP.now() + i, visibility, source,
      ...(typeof it === 'string' ? { src: it } : it),
    }));
    state.photos.push(...added);
    if (visibility === 'outing') {
      log(o, { type: 'photos', userId, count: added.length });
      // one quiet line per burst: "Grace added 6 photos", with a preview that opens the album
      const last = messagesOf(outingId).pop();
      if (last && last.kind === 'system' && last.sys.type === 'photos' && last.sys.userId === userId && HOP.now() - last.at < 10 * 6e4) {
        last.sys.photoIds.push(...added.map((p) => p.id)); last.sys.count += added.length; last.at = HOP.now();
      } else pushMsg(outingId, { kind: 'system', userId: null, sys: { type: 'photos', userId, count: added.length, photoIds: added.map((p) => p.id) } });
    }
    commit('photos:add', { outingId, userId, count: added.length, visibility, ids: added.map((p) => p.id) });
    return added;
  }
  function setPhotoVisibility(photoId, visibility) {
    const p = state.photos.find((x) => x.id === photoId);
    if (p && p.userId === meId) { p.visibility = visibility; commit('photos:update', { outingId: p.outingId }); }
  }

  function duplicate(id, startsAt) {
    const src = outing(id);
    const o = createOuting({ title: src.title, emoji: src.emoji, startsAt, visibility: src.visibility });
    const delta = startsAt - src.startsAt;
    stopsOf(id).forEach((s, i) => state.stops.push({ id: uid('s'), outingId: o.id, venueId: s.venueId, eventId: s.eventId || null, order: i, at: s.at + delta }));
    commit('stop:add', { outingId: o.id });
    return o;
  }

  function reset() { state = fresh(); commit('reset'); }
  function setRealtime(on) { try { localStorage.setItem('hop.realtime', on ? '1' : '0'); localStorage.removeItem(KEY); } catch (e) {} location.reload(); }

  load();

  return {
    get state() { return state; }, get storageOk() { return storageOk; }, TAB,
    venues, venueById, users: HOP.seed.users, userById, me, setMe, get meId() { return meId; },
    on, emit,
    outing, stopsOf, attendeesOf, going, myAttendance, isOrganiser, placeOf, eventOf, stopName, photosOf, myOutings, publicOutings,
    tonightOutings, friendsOut, friendsAt, friendsAtEvent, activity, memoryPhotosAt, addEventStop, touch, setRealtime,
    messagesOf, canChat, chatPhase, chatClosesAt, postMessage, react, keen, vote, closePoll, stopSharing, activeLocations,
    saved, savedEvents, toggleSave, collections, collectionsOf, isSaved, setSaved, REPORT_KINDS, reportsAt, canReport, addReport, myLastReport, venuePhotos, markRead, lastRead, unread, lastMessage, chatPref, setChatPref, mentionsMe,
    createOuting, updateOuting, deleteOuting, addStop, removeStop, reorderStops, setStopTime, rsvp, invite,
    startOuting, advance, endOuting, addPhotos, setPhotoVisibility, duplicate, reset,
  };
})();
