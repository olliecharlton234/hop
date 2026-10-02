/* HOP — app shell: routing, re-rendering on data changes, notifications, and the
   prototype's group simulator (stands in for other people's phones). */
(() => {
  const { esc, plural, photoTag, avatar, time, pick, uid } = HOP.util;
  const I = HOP.icon;
  const S = HOP.store;
  const ui = HOP.ui;

  // ---------------- routing ----------------
  let route = { name: 'home', params: {} };
  let hist = [];
  const IMMERSIVE = new Set(['pick', 'create', 'live']);

  function go(name, params = {}, opts = {}) {
    if (name === 'create' && params.go === 'create') params = { fresh: 1 };
    if (params.go) { // a tab tap: start that tab fresh
      hist = []; HOP.app.picking = null; HOP.app.searching = false; HOP.clearQuery();
      ui.closeAllLayers(); ui.closeModal();
      if (name === 'create') params = { fresh: 1 };
    } else if (opts.resetTo) {
      hist = opts.resetTo === name ? [] : [{ name: opts.resetTo, params: {} }];
    } else if (!opts.replace) hist.push(route);
    route = { name, params };
    render({ fresh: true });
  }
  function back() {
    if (ui.modalOpen()) return ui.closeModal();
    if (ui.closeLayer()) return;
    if (HOP.app.searching && (route.name === 'home' || route.name === 'pick')) {
      HOP.app.searching = false; const q = document.getElementById('q'); if (q) { q.value = ''; q.blur(); }
      return render({ sheetOnly: true, sizes: route.name === 'home' ? ['peek', 'full'] : ['auto', 'half'] });
    }
    if (route.name === 'pick') return HOP.actions.donePicking();
    route = hist.pop() || { name: 'home', params: {} };
    if (route.name === 'venue' && !S.venueById[route.params.id]) route = { name: 'home', params: {} };
    render({ fresh: true });
  }

  function render(opts = {}) {
    const sc = HOP.screens[route.name];
    const out = sc.render(route.params);
    document.body.classList.toggle('hide-nav', IMMERSIVE.has(route.name));
    if (!opts.sheetOnly) ui.setTop(out.top);
    ui.setSheet(out.sheet, {
      sizes: opts.fresh || opts.resize ? out.sizes : opts.sizes,
      sizeIdx: opts.fresh || opts.resize ? out.sizeIdx || 0 : opts.sizes ? 0 : undefined,
      keepScroll: !opts.fresh,
      onSize: (size) => (document.body.dataset.sheet = size),
    });
    document.body.dataset.sheet = ui.currentSize();
    document.querySelectorAll('#nav [data-go]').forEach((b) => b.classList.toggle('on', b.dataset.go === sc.nav));
    // During your live outing the centre action becomes the camera
    const navC = document.querySelector('#nav .create');
    const myLive = S.myOutings().live.find((o) => S.myAttendance(o.id)?.rsvp === 'going');
    if (navC && myLive && navC.dataset.id !== myLive.id) { delete navC.dataset.go; navC.dataset.act = 'camera'; navC.dataset.id = myLive.id; navC.classList.add('cam'); navC.setAttribute('aria-label', 'Take a photo'); navC.innerHTML = I('camera', 24); }
    else if (navC && !myLive && navC.dataset.act) { delete navC.dataset.act; delete navC.dataset.id; navC.dataset.go = 'create'; navC.classList.remove('cam'); navC.setAttribute('aria-label', 'New outing'); navC.innerHTML = I('plus', 24); }
    // one-tap camera whenever you're on a live outing
    const fab = document.getElementById('camfab');
    const liveMine = route.name === 'live' && S.outing(route.params.id)?.status === 'live' && S.myAttendance(route.params.id)?.rsvp === 'going';
    fab.hidden = !liveMine;
    if (liveMine) fab.dataset.id = route.params.id;
    if (opts.fresh) HOP.map.setMode(route.name === 'venue' && HOP.app.picking ? 'pick' : sc.mapMode || 'focus');
    if (opts.fresh && out.map) out.map();
    else if (!opts.sheetOnly && out.mapUpdate) out.mapUpdate();
    if (sc.mount) sc.mount(route.params);
    document.body.classList.toggle('mapbrowse', ['home', 'venue', 'whatson', 'event', 'area', 'pick'].includes(route.name));
    bump();
  }

  // Movement only when something meaningful changed: any element marked data-live="key"
  // whose text differs from last time gets a brief nudge.
  const lastSeen = new Map();
  function bump() {
    document.querySelectorAll('[data-live]').forEach((el) => {
      const k = el.dataset.live, v = el.textContent;
      if (lastSeen.has(k) && lastSeen.get(k) !== v) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
      lastSeen.set(k, v);
    });
  }
  HOP.bump = bump;

  let mapQueued = null;
  function mapRefresh() { clearTimeout(mapQueued); mapQueued = setTimeout(() => { HOP.map.refreshLive(); bump(); }, 120); }
  let queued = false;
  function softRender() {
    if (queued) return; queued = true;
    requestAnimationFrame(() => {
      queued = false;
      if (route.name === 'create') return;
      const sc = HOP.screens[route.name];
      const typing = document.activeElement && document.activeElement.id === 'q';
      render({ keepScroll: true, sheetOnly: sc.refreshSheetOnly || typing });
    });
  }

  // ---------------- data changes ----------------
  const fresh = new Set();
  HOP.fresh = fresh;
  S.on((type, p) => {
    if (type === 'me') { hist = []; route = { name: route.name === 'live' || route.name === 'outing' || route.name === 'memory' ? route.name : 'home', params: route.params }; render({ fresh: true }); return; }
    if (type === 'reset') return;

    if (type === 'photos:add') {
      p.ids?.forEach((id) => { fresh.add(id); setTimeout(() => fresh.delete(id), 9000); });
      if (p.visibility === 'outing' && p.userId !== S.meId && S.myAttendance(p.outingId)?.rsvp === 'going') queuePhotoNote(p);
      // the photo floats up from wherever it was taken
      const o = S.outing(p.outingId), ph = S.state.photos.find((x) => x.id === p.ids?.[p.ids.length - 1]);
      const st = ph && S.state.stops.find((x) => x.id === ph.stopId);
      if (st && p.visibility === 'outing' && (S.myAttendance(o.id) || o.visibility === 'public')) HOP.map.pop(S.placeOf(st), ph, S.userById[p.userId]);
    }
    mapRefresh();
    // someone else started / ended a night you're on
    if (p.remote && type === 'live:start' && S.myAttendance(p.id)) {
      const o = S.outing(p.id);
      ui.banner({ lead: `<span class="livepill">LIVE</span>`, title: `${esc(o.title)} has started`, text: 'Tap to open the live map', act: 'openLive', data: { id: o.id } });
      if (route.name === 'outing' && route.params.id === p.id) { route = { name: 'live', params: { id: p.id } }; render({ fresh: true }); return; }
    }
    if (p.remote && type === 'live:end' && route.name === 'live' && route.params.id === p.id) { route = { name: 'memory', params: { id: p.id } }; render({ fresh: true }); return; }
    if (type === 'chat:post' && p.userId && p.userId !== S.meId) queueChatNote(p);
    if (type === 'rsvp' && p.userId !== S.meId) {
      const o = S.outing(p.outingId);
      if (o && S.isOrganiser(o) && p.value !== 'invited') {
        const u = S.userById[p.userId];
        ui.banner({ lead: avatar(u, 36), title: `${esc(u.first)} ${{ going: 'is going', maybe: 'might come', declined: 'can’t make it' }[p.value]}`, text: `${esc(o.title)} · ${S.going(o.id).length} going`, act: 'openOuting', data: { id: o.id } });
      }
    }
    if (type === 'invite' && !p.remote) HOP.sim.replies(p.outingId, p.userIds);

    if (HOP.app.albumEl && HOP.app.albumOpen && p.outingId === HOP.app.albumOpen && ui.topLayer() === HOP.app.albumEl) HOP.renderAlbum(HOP.app.albumOpen, HOP.app.albumEl);
    if (type === 'outing:delete' && route.params?.id === p.id) { route = { name: 'home', params: {} }; hist = []; render({ fresh: true }); return; }
    softRender();
  });

  // Batched photo notifications: "Jack added 3 photos…" or "14 new photos were added…"
  const pending = {};
  function queuePhotoNote(p) {
    const q = pending[p.outingId] ||= { users: {}, ids: [], first: Date.now(), t: null };
    q.users[p.userId] = (q.users[p.userId] || 0) + p.count;
    q.ids.push(...(p.ids || []));
    clearTimeout(q.t);
    if (Date.now() - q.first > 6000) flush(p.outingId);
    else q.t = setTimeout(() => flush(p.outingId), 2200);
  }
  function flush(outingId) {
    const q = pending[outingId]; if (!q) return;
    clearTimeout(q.t); delete pending[outingId];
    const o = S.outing(outingId); if (!o) return;
    const who = Object.keys(q.users);
    const total = Object.values(q.users).reduce((a, b) => a + b, 0);
    const thumbs = q.ids.slice(-3).map((id) => S.state.photos.find((x) => x.id === id)).filter(Boolean);
    const single = who.length === 1 && total < 10;
    ui.banner({
      lead: thumbs.length ? `<span class="thumbs">${thumbs.map((t) => photoTag(t, 80, 100)).join('')}</span>` : I('image', 20),
      title: single ? `${esc(S.userById[who[0]].first)} added ${plural(total, 'photo')} to ${esc(o.title)}` : `${total} new photos were added to ${esc(o.title)}`,
      text: single ? 'Tap to see them' : `From ${esc(who.slice(0, 3).map((id) => S.userById[id].first).join(', '))}${who.length > 3 ? ` and ${who.length - 3} more` : ''}`,
      act: 'notifAlbum', data: { id: outingId }, timeout: 5200,
    });
  }
  // Chat notifications respect All / Mentions only / Mute, never fire for system lines,
  // and stay quiet while you're looking at that chat
  const chatPending = {};
  function queueChatNote(p) {
    const o = S.outing(p.outingId);
    if (!o || !S.canChat(o)) return;
    const m = S.state.messages.find((x) => x.id === p.id);
    if (!m) return;
    if (HOP.chatOpenFor() === o.id && !document.hidden) return;
    const pref = S.chatPref(o.id);
    if (pref === 'mute' || (pref === 'mentions' && !S.mentionsMe(m))) return;
    const q = chatPending[o.id] ||= { msgs: [], t: null };
    q.msgs.push(m);
    clearTimeout(q.t);
    q.t = setTimeout(() => {
      delete chatPending[o.id];
      const last = q.msgs[q.msgs.length - 1];
      ui.banner({ lead: avatar(S.userById[last.userId], 36), title: `${esc(o.title)}`,
        text: q.msgs.length > 1 ? `${q.msgs.length} new messages · ${esc(HOP.chatPreview(last))}` : esc(HOP.chatPreview(last)),
        act: 'openChat', data: { id: o.id } });
    }, 1400);
  }
  HOP.actions.notifAlbum = (d) => { if (HOP.app.albumOpen !== d.id) { ui.closeModal(); HOP.openAlbum(d.id); HOP.app.albumEl = ui.topLayer(); } };
  const _open = HOP.openAlbum;
  HOP.openAlbum = (id) => { _open(id); HOP.app.albumEl = ui.topLayer(); };
  HOP.actions.album = (d) => HOP.openAlbum(d.id);

  // ---------------- group simulator (prototype only) ----------------
  const LEAD_KEY = 'hop.simLeader';
  const nextAt = {}, chatAt = {};
  HOP.sim = {
    isLeader() {
      try {
        const v = JSON.parse(localStorage.getItem(LEAD_KEY) || 'null');
        if (!v || v.tab === S.TAB || Date.now() - v.t > 4000) { localStorage.setItem(LEAD_KEY, JSON.stringify({ tab: S.TAB, t: Date.now() })); return true; }
        return false;
      } catch (e) { return true; }
    },
    photoFor(outingId) {
      const o = S.outing(outingId);
      const st = S.stopsOf(outingId)[o.live ? o.live.current : 0];
      const v = S.venueById[st.venueId];
      const pool = Math.random() < 0.4 ? HOP.seed.P.friends : Math.random() < 0.2 && o.emoji === 'cake' ? HOP.seed.P.party : HOP.seed.poolFor(v?.cat);
      return { u: { id: pool[Math.floor(Math.random() * pool.length)], fx: (0.25 + Math.random() * 0.5).toFixed(2), fy: (0.3 + Math.random() * 0.4).toFixed(2), fz: (1 + Math.random() * 0.8).toFixed(2) } };
    },
    friendPost(outingId, { userId, n } = {}) {
      const others = S.going(outingId).map((a) => a.userId).filter((id) => id !== S.meId);
      if (!others.length) return;
      userId = userId || others[Math.floor(Math.random() * others.length)];
      n = n || [1, 1, 2, 3, 3, 4][Math.floor(Math.random() * 6)];
      S.addPhotos(outingId, Array.from({ length: n }, () => HOP.sim.photoFor(outingId)), { userId, source: Math.random() < 0.75 ? 'camera' : 'upload' });
    },
    burst(outingId) {
      const others = S.going(outingId).map((a) => a.userId).filter((id) => id !== S.meId).sort(() => Math.random() - 0.5).slice(0, 5);
      [4, 3, 3, 2, 2].forEach((n, i) => others[i] && setTimeout(() => HOP.sim.friendPost(outingId, { userId: others[i], n }), 250 + i * 380));
    },
    replies(outingId, userIds) {
      userIds.forEach((id, i) => setTimeout(() => {
        const a = S.attendeesOf(outingId).find((x) => x.userId === id);
        if (!a || a.rsvp !== 'invited') return;
        const r = Math.random();
        S.rsvp(outingId, r < 0.7 ? 'going' : r < 0.9 ? 'maybe' : 'declined', id);
      }, 3500 + i * 2600 + Math.random() * 3000));
    },
    // ---- chat: friends answer, vote and chatter (stands in for their phones) ----
    pickFriend(outingId, not) {
      const ids = S.going(outingId).map((a) => a.userId).filter((id) => id !== S.meId && id !== not);
      return ids[Math.floor(Math.random() * ids.length)];
    },
    chatReply(outingId, text) {
      if (!HOP.sim.isLeader()) return;
      const o = S.outing(outingId);
      const phase = S.chatPhase(o);
      const st = S.stopsOf(outingId);
      const cur = o.live ? st[o.live.current] : st[0];
      const nx = o.live ? st[o.live.current + 1] : st[1];
      const who = HOP.sim.pickFriend(outingId);
      if (!who) return;
      const t = text.toLowerCase();
      const pick = (a) => a[Math.floor(Math.random() * a.length)];
      const mine = S.messagesOf(outingId).filter((m) => m.userId === S.meId).pop();
      let reply = null, extra = {};
      if (/where (are|r) (you|u|ya)|where you|where's everyone|where is everyone/.test(t)) {
        if (phase === 'during' && Math.random() < 0.5) {
          const v = S.placeOf(cur);
          extra = { kind: 'location', loc: { lat: v.lat + (Math.random() - 0.5) * 0.0012, lng: v.lng + (Math.random() - 0.5) * 0.0012, label: `Near ${v.name}`, until: HOP.now() + 30 * 6e4 } };
        } else reply = phase === 'during' ? pick([`Upstairs at ${S.stopName(cur)}`, `Out the front of ${S.stopName(cur)}`, 'At the bar, come find us']) : pick(['Not out yet, leaving at 7', 'Getting ready, 20 min', 'On the bus']);
      } else if (/late|running/.test(t)) reply = pick(['No stress', 'All good, we’ll be here', 'Classic']);
      else if (/heading|going to|omw|on my way/.test(t)) reply = pick([`See you at ${nx ? S.stopName(nx) : 'the next one'}`, 'We’ll grab a table', 'Get me a drink']);
      else if (t.includes('?')) reply = phase === 'during' ? pick(['Yep', '2 min', 'Ask Jack', 'I’m keen']) : pick(['Works for me', 'Down', 'Yep', 'Sounds good']);
      setTimeout(() => {
        if (mine) S.react(mine.id, pick(['up', 'fire', 'haha']), who);
        if (reply || extra.kind) setTimeout(() => S.postMessage(outingId, { text: reply, replyTo: reply && Math.random() < 0.4 && mine ? mine.id : null, ...extra }, who), 1800 + Math.random() * 2500);
      }, 2500 + Math.random() * 2500);
    },
    chatKeen(outingId) {
      const m = S.messagesOf(outingId).filter((x) => x.kind === 'place').pop();
      [0, 1, 2].slice(0, 1 + Math.floor(Math.random() * 3)).forEach((k) => setTimeout(() => { const u = HOP.sim.pickFriend(outingId); if (u && !(m.keen || []).includes(u)) S.keen(m.id, u); }, 3000 + k * 2600));
    },
    chatVotes(outingId, msgId) {
      const voters = S.going(outingId).map((a) => a.userId).filter((id) => id !== S.meId).sort(() => Math.random() - 0.5).slice(0, 7);
      voters.forEach((u, k) => setTimeout(() => { const m = S.state.messages.find((x) => x.id === msgId); if (m && !m.poll.closed) S.vote(msgId, Math.random() < 0.6 ? 0 : Math.floor(Math.random() * m.poll.options.length), u); }, 2500 + k * 1700 + Math.random() * 1200));
    },
    chatter(o) {
      const st = S.stopsOf(o.id), cur = st[o.live.current], nx = st[o.live.current + 1];
      const who = HOP.sim.pickFriend(o.id);
      if (!who) return;
      const lines = [`Who wants a drink? I’m at the bar`, `We’re upstairs`, `Grabbed a table near the back`, nx ? `What time are we heading to ${S.stopName(nx)}?` : 'Last stop, let’s go big', nx ? `Is the line long at ${S.stopName(nx)}?` : 'Kebab after?', 'Someone has my lighter', `Just got to ${S.stopName(cur)}, where are you?`, 'This DJ is going off', '@Ollie happy birthday!!'];
      const text = lines[Math.floor(Math.random() * lines.length)];
      if (text.includes('@Ollie') && o.id !== 'o_bday' && !o.title.includes('Birthday')) return;
      S.postMessage(o.id, { text }, who);
    },
    tick() {
      if (document.hidden || !HOP.sim.isLeader()) return;
      // a bit of chat on live outings you're on
      S.state.outings.filter((o) => o.status === 'live' && S.myAttendance(o.id)?.rsvp === 'going').forEach((o) => {
        const now = HOP.now();
        if (!chatAt[o.id]) chatAt[o.id] = now + 20000 + Math.random() * 15000;
        if (now >= chatAt[o.id]) { HOP.sim.chatter(o); chatAt[o.id] = now + 40000 + Math.random() * 40000; }
      });
      S.state.outings.filter((o) => o.status === 'live').forEach((o) => {
        const now = HOP.now();
        if (!nextAt[o.id]) nextAt[o.id] = Math.max(now + 2500 + Math.random() * 9000, o.live.startedAt + 5000);
        if (now >= nextAt[o.id]) {
          HOP.sim.friendPost(o.id);
          const mine = S.myAttendance(o.id)?.rsvp === 'going';
          nextAt[o.id] = now + (mine ? 16000 : 22000) + Math.random() * (mine ? 16000 : 26000);
        }
      });
    },
  };
  setInterval(HOP.sim.tick, 1000);

  // keep "Tonight · Friday 7:12 PM" and busy levels current
  setInterval(() => { if (route.name === 'home' && !HOP.app.searching) softRender(); mapRefresh(); }, 60000);

  // live clocks
  setInterval(() => {
    document.querySelectorAll('[data-clock]').forEach((el) => { const o = S.outing(el.dataset.clock); if (o && o.live) el.textContent = time(HOP.liveClock(o)); });
  }, 10000);

  // ---------------- boot ----------------
  const m = location.hash.match(/as=(u_\w+)/);
  if (m && S.userById[m[1]]) { S.setMe(m[1], true); history.replaceState(null, '', location.pathname + location.search); }

  document.getElementById('nav').innerHTML = `
    <button data-go="home">${I('map', 22)}<span>Map</span></button>
    <button data-go="outings">${I('list', 22)}<span>Outings</span></button>
    <button data-go="create" class="create" aria-label="New outing">${I('plus', 24)}</button>
    <button data-go="memories">${I('memories', 22)}<span>Memories</span></button>
    <button data-go="profile">${I('user', 22)}<span>Profile</span></button>`;
  const loc = document.createElement('button');
  loc.className = 'fbtn locate'; loc.dataset.act = 'locate'; loc.setAttribute('aria-label', 'Show where I am'); loc.innerHTML = I('locate');
  document.getElementById('app').appendChild(loc);
  const fab = document.createElement('button');
  fab.id = 'camfab'; fab.className = 'camfab'; fab.dataset.act = 'camera'; fab.hidden = true; fab.setAttribute('aria-label', 'Take a photo'); fab.innerHTML = I('camera', 28);
  document.getElementById('app').appendChild(fab);
  HOP.actions.locate = () => HOP.map.locate();

  // Activity layer: one toggle, one simple time control. Remembered per person.
  const layerBtn = document.createElement('button');
  layerBtn.className = 'fbtn layerbtn'; layerBtn.dataset.act = 'toggleHeat'; layerBtn.setAttribute('aria-label', 'Activity layer');
  layerBtn.innerHTML = `${I('waves', 20)}<span>Activity</span>`;
  const heatBar = document.createElement('div');
  heatBar.className = 'heatbar';
  document.getElementById('app').append(layerBtn, heatBar);
  function syncHeatUi() {
    const on = HOP.map.heatOn, w = HOP.map.heatWhen;
    layerBtn.classList.toggle('on', on);
    layerBtn.setAttribute('aria-pressed', on);
    heatBar.hidden = !on;
    let legend = true; try { legend = localStorage.getItem('hop.legend') !== '0'; } catch (e) {}
    const fc = w !== 'now';
    heatBar.innerHTML = `${legend ? `<div class="legend${fc ? ' fc' : ''}"><b>Activity</b><em>Quiet</em><i class="ramp"></i><em>Packed</em>${fc ? '<span>Forecast</span>' : ''}<button data-act="hideLegend" aria-label="Hide key">${I('close', 12)}</button></div>` : ''}<div class="seg" role="radiogroup" aria-label="When">${HOP.activity.WINDOWS.map(([k, l]) => `<button role="radio" aria-checked="${w === k}" class="${w === k ? 'on' : ''}" data-act="heatWhen" data-v="${k}">${l}</button>`).join('')}</div>`;
  }
  HOP.actions.hideLegend = () => { try { localStorage.setItem('hop.legend', '0'); } catch (e) {} syncHeatUi(); };
  HOP.actions.heatWhen = (d) => { HOP.map.setHeat(true, d.v); syncHeatUi(); if (route.name === 'home' || route.name === 'area') render({ keepScroll: true, sheetOnly: route.name === 'home' }); };

  HOP.map.init(document.getElementById('map'));
  HOP.map.onArea((id) => go('area', { id }, { replace: route.name === 'area' }));
  HOP.map.onVenue((id) => HOP.app.openVenue(id));
  HOP.map.onOuting((id) => HOP.actions.openOuting({ id }));
  HOP.map.onEvent((id) => go('event', { id }, { replace: route.name === 'event' }));
  HOP.map.onBlank(() => {
    if (route.name === 'venue' || route.name === 'event' || route.name === 'area') back();
    else if (HOP.app.searching) back();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !(e.target.id === 'q')) back(); });

  HOP.app = {
    go, back, render, syncHeatUi, picking: null, searching: false, albumOpen: null, albumEl: null,
    get route() { return route; },
    openVenue(id) { go('venue', { id }, { replace: route.name === 'venue' }); },
    startPicking(id, opts = {}) { HOP.app.picking = id; HOP.app.searching = false; go('pick', { id, fit: 1 }, opts); },
  };

  // first frame: home, framed around tonight's plan if there is one
  render({ fresh: true });
  // first frame: where you are, with the busy part of the inner city around you
  const first = S.myOutings().live[0];
  if (first) setTimeout(() => HOP.map.fitTo(S.stopsOf(first.id).map((s) => S.placeOf(s)), { instant: true }), 50);
  // glance view: the inner city at neighbourhood level, so the first two seconds answer
  // "where am I, who's out, what's on, where is it busy"
  else setTimeout(() => HOP.map.focus({ lat: -33.8795, lng: 151.2060 }, 13.4), 50);
  syncHeatUi();
  window.addEventListener('load', () => HOP.map.invalidate());
})();
