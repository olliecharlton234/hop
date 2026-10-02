/* HOP — Tonight: the home sheet. Three levels:
   1. Glance (collapsed): your plans, who's out, what's starting — readable in two seconds
   2. Explore (dragged up): friends tonight, starting soon, busy areas, recent photos, popular, saved
   3. Detail: tap anything → its own sheet
   What leads changes with the time of day: memories in the morning, plans in the afternoon,
   people and places in the evening, your group and getting around late at night. */
(() => {
  const { esc, avatar, avatarStack, photoTag, when, hm, plural, time, ago, distLabel, metres } = HOP.util;
  const I = HOP.icon;
  const S = HOP.store;
  const ui = HOP.ui;
  const A = HOP.activity;

  // time words that make things feel current
  const since = (ts) => { const m = Math.max(1, Math.round((HOP.now() - ts) / 6e4)); return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60 ? (m % 60) + 'm' : ''}`.trim(); };
  const until = (ts) => { const m = Math.round((ts - HOP.now()) / 6e4); return m <= 0 ? 'now' : m < 60 ? `in ${m}m` : m < 180 ? `in ${Math.floor(m / 60)}h ${m % 60 ? (m % 60) + 'm' : ''}`.trim() : `at ${hm(ts)}`; };
  HOP.since = since; HOP.until = until;

  let previewHour = null; // prototype: preview Home at another time of day
  HOP.setPreviewHour = (h) => { previewHour = h; };
  function phase() {
    let h = previewHour ?? new Date(HOP.now()).getHours();
    if (h >= 5 && h < 12) return 'morning';
    if (h >= 12 && h < 17) return 'afternoon';
    if (h >= 17 && h < 23) return 'evening';
    return 'late';
  }
  const PHASE_LABEL = { morning: 'This morning', afternoon: 'This afternoon', evening: 'Tonight', late: 'Late' };

  // ---------- rows ----------
  function myLiveRow(o) {
    const st = S.stopsOf(o.id), cur = st[o.live.current], nx = st[o.live.current + 1];
    const un = S.unread(o.id);
    return `<div class="tl"><button class="tlmain" data-act="openLive" data-id="${o.id}"><span class="lead emo">${HOP.oicon(o)}${un ? `<b class="ub">${un}</b>` : ''}</span>
      <div class="grow"><div class="t">${esc(o.title)}</div><div class="s">At ${esc(S.stopName(cur))} · ${since(o.live.arrivedAt)}${nx ? ` · ${esc(S.stopName(nx))} ${until(nx.at)}` : ''}</div></div></button>
      <button class="tlcam" data-act="camera" data-id="${o.id}" aria-label="Take a photo for ${esc(o.title)}">${I('camera', 22)}</button></div>`;
  }
  function otherOutingRow(o) {
    const host = S.userById[o.organiserId];
    const a = S.myAttendance(o.id);
    const st = S.stopsOf(o.id);
    const isLive = o.status === 'live';
    const at = isLive ? st[o.live.current] : st[0];
    const going = S.going(o.id).map((x) => S.userById[x.userId]);
    const photos = S.photosOf(o.id);
    const lastPh = photos[photos.length - 1];
    const sub = isLive ? `${esc(S.stopName(at))} · ${since(o.live.arrivedAt)}${lastPh && HOP.now() - lastPh.takenAt < 36e5 ? ` · new photo ${since(lastPh.takenAt)} ago` : ''}`
      : `${esc(S.stopName(at))} ${until(o.startsAt)}${a?.rsvp === 'maybe' ? ' · you’re a maybe' : ''}`;
    const cta = !a ? ['View', 'openOuting'] : a.rsvp === 'invited' ? ['Join', 'joinOuting'] : a.rsvp === 'maybe' ? ['I’m in', 'joinOuting'] : ['View', 'openOuting'];
    const un = S.canChat(o) ? S.unread(o.id) : 0;
    return `<div class="tl"><button class="tlmain" data-act="openOuting" data-id="${o.id}"><span class="lead ${isLive ? 'live' : ''}">${avatar(host, 38)}<i>${HOP.oicon(o)}</i>${un ? `<b class="ub">${un}</b>` : ''}</span>
      <div class="grow"><div class="t">${esc(host.first)}${going.length > 1 ? ` + ${going.length - 1}` : ''} <span class="tlsub">${esc(o.title.replace(/^.*?'s /, ''))}</span></div><div class="s">${sub}</div></div></button>
      <button class="btn sm ${cta[1] === 'joinOuting' ? 'primary' : ''}" data-act="${cta[1]}" data-id="${o.id}">${cta[0]}</button></div>`;
  }
  function planRow(o) {
    const un = S.unread(o.id), lm = un && S.lastMessage(o.id);
    const going = S.going(o.id).map((x) => S.userById[x.userId]);
    return `<button class="tl tlmain" data-act="${un ? 'openChat' : 'openOuting'}" data-id="${o.id}"><span class="lead emo">${HOP.oicon(o)}${un ? `<b class="ub">${un}</b>` : ''}</span>
      <div class="grow"><div class="t">${esc(o.title)} <span class="tlwhen">${when(o.startsAt)}</span></div>
      <div class="s">${lm ? `<span class="lm">${esc(HOP.chatPreview(lm))}</span> · ${since(lm.at)}` : `${avatarStack(going, 4, 18)} <span data-live="going-${o.id}">${going.length} going</span> · ${plural(S.stopsOf(o.id).length, 'stop')}`}</div></div>${I('chev')}</button>`;
  }
  function friendsRow(out) {
    const places = {};
    out.forEach((f) => { const k = f.venueId || f.eventId; (places[k] ||= []).push(f); });
    const top = Object.entries(places).sort((a, b) => b[1].length - a[1].length).slice(0, 2)
      .map(([k, fs]) => `${esc(fs[0].user.first)}${fs.length > 1 ? ` + ${fs.length - 1}` : ''} at ${esc(S.venueById[k]?.name || HOP.events.byId(k)?.title || '')}`);
    return `<button class="tl tlmain" data-act="friendsOut">${avatarStack(out.map((f) => f.user), 5, 28)}
      <div class="grow"><div class="t"><span data-live="friends-out">${out.length}</span> friends out</div><div class="s">${top.join(' · ')}</div></div>${I('chev')}</button>`;
  }

  // ---------- sections ----------
  function friendsSection(out) {
    if (!out.length) return '';
    const places = {};
    out.forEach((f) => { const k = f.venueId || 'e:' + f.eventId; (places[k] ||= []).push(f); });
    const rows = Object.entries(places).sort((a, b) => b[1].length - a[1].length).slice(0, 6).map(([k, fs]) => {
      const v = S.venueById[k], e = k.startsWith('e:') && HOP.events.byId(k.slice(2));
      const names = fs.map((f) => f.user.first);
      const o = fs[0].outingId && S.outing(fs[0].outingId);
      return `<button class="row" data-act="${v ? 'venueFromList' : 'openEvent'}" data-id="${v ? k : k.slice(2)}">${avatarStack(fs.map((f) => f.user), 3, 30)}
        <div class="grow"><div class="t">${esc(names.slice(0, 2).join(', '))}${names.length > 2 ? ` + ${names.length - 2}` : ''}</div>
        <div class="s">${esc(v ? v.name : e.title)}${o ? ` · ${esc(o.title)}` : ''} · ${since(Math.min(...fs.map((f) => f.since)))}</div></div>${I('chev')}</button>`;
    }).join('');
    return `<div class="section"><p class="label"><span>Friends tonight</span><button class="linkbtn" data-act="friendsOut">All ${out.length}</button></p><div class="rows">${rows}</div></div>`;
  }
  function startingSection(title = 'Starting soon', whenKey = 'tonight') {
    const now = HOP.now();
    const list = HOP.events.filter({ when: whenKey }).filter((e) => e.endsAt > now).sort((a, b) => Math.max(a.startsAt, now) - Math.max(b.startsAt, now));
    if (!list.length) return '';
    return `<div class="section"><p class="label"><span>${title}</span><button class="linkbtn" data-act="whatson" data-when="${whenKey}">See all ${list.length}</button></p>
      <div class="rows">${list.slice(0, 5).map((e) => HOP.eventRow(e)).join('')}</div></div>`;
  }
  function busySection(whenKey = 'now', title = 'Busy tonight') {
    const rows = A.AREAS.map((a) => ({ a, info: A.areaInfo(a.id, whenKey), pub: A.areaPublic(a.id, whenKey) }))
      .filter((x) => x.info.lv >= 2).sort((x, y) => y.info.heat - x.info.heat).slice(0, 5);
    if (!rows.length) return '';
    return `<div class="section"><p class="label"><span>${title}</span>${!HOP.map.heatOn ? '<button class="linkbtn" data-act="toggleHeat">Show on map</button>' : ''}</p><div class="rows">${rows.map(({ a, info, pub }) => `
      <button class="row" data-act="openArea" data-id="${a.id}"><span class="iconbtn lvbox lv${info.lv}">${A.meter(info.lv)}</span>
        <div class="grow"><div class="t">${esc(a.name)} <span class="lvw lv${info.lv}">${whenKey === 'now' ? info.level : 'Expected ' + info.level.toLowerCase()}</span></div>
        <div class="s">${whenKey === 'now' ? esc(info.note) : info.span ? `Busy ${esc(info.span)}` : esc(info.note)}${pub.events.length ? ` · ${pub.events.length} on` : ''}</div></div>
        ${pub.friends.length ? avatarStack(pub.friends.map((f) => f.user), 3, 22) : ''}</button>`).join('')}</div></div>`;
  }
  function photosSection(title = 'Recent photos', maxAge = 3 * 36e5) {
    const now = HOP.now();
    const ps = S.state.photos.filter((p) => p.visibility === 'outing' && now - p.takenAt < maxAge && now >= p.takenAt)
      .filter((p) => { const o = S.outing(p.outingId); return o && (S.myAttendance(o.id) || o.visibility === 'public'); })
      .sort((a, b) => b.takenAt - a.takenAt);
    if (!ps.length) return '';
    const byOuting = {};
    ps.forEach((p) => (byOuting[p.outingId] ||= []).push(p));
    const lines = Object.entries(byOuting).slice(0, 2).map(([oid, l]) => `${esc(S.outing(oid).title)} · ${plural(l.length, 'photo')} · last ${since(l[0].takenAt)} ago`);
    return `<div class="section"><p class="label"><span>${title}</span></p>
      <div class="strip">${ps.slice(0, 12).map((p) => `<button data-act="viewPhoto" data-id="${p.outingId}" data-p="${p.id}">${photoTag(p, 200, 250)}<span class="by">${avatar(S.userById[p.userId], 20)}</span>${HOP.fresh.has(p.id) ? '<span class="newdot"></span>' : ''}</button>`).join('')}</div>
      <p class="meta stripmeta">${lines.join('<br>')}</p></div>`;
  }
  function popularSection(title = 'Popular near you') {
    const list = S.venues.filter((v) => v.cat !== 'spot').map((v) => ({ v, a: S.activity(v.id), d: HOP.map.distanceFromMe(v) }))
      .filter((x) => x.a.hot && x.d < 2500).sort((a, b) => b.a.busy - a.a.busy).slice(0, 5);
    if (!list.length) return '';
    return `<div class="section"><p class="label">${title}</p><div class="rows">${list.map(({ v }) => HOP.venueRow(v)).join('')}</div></div>`;
  }
  function savedSection() {
    const cols = S.collections().filter((c) => c.items.length);
    if (!cols.length) return '';
    return `<div class="section"><p class="label"><span>Saved</span><button class="linkbtn" data-act="savedLists">All lists</button></p><div class="colchips">${cols.map((c) => `<button data-act="savedLists" data-c="${c.id}"><b>${esc(c.name)}</b><span>${plural(c.items.length, 'place')}</span></button>`).join('')}</div></div>`;
  }
  function plansSection(list, title = 'Your plans') {
    if (!list.length) return '';
    return `<div class="section"><p class="label">${title}</p><div class="rows tonrows">${list.map(planRow).join('')}</div></div>`;
  }

  // ---------- the sheet ----------
  // PEEK: three one-line rows, the whole sheet ~18% of the screen. EXPLORE (~50%) and FULL (~90%) add sections.
  const pk = (act, id, lead, main, sub, extra = '') => `<div class="pk"><button class="pkmain" data-act="${act}" ${id ? `data-id="${id}"` : ''}>${lead}<span class="pkt"><b>${main}</b>${sub ? ` <em>${sub}</em>` : ''}</span>${extra ? '' : I('chev', 16)}</button>${extra}</div>`;
  const icoLead = (svg) => `<span class="pklead">${svg}</span>`;
  HOP.tonightSheet = () => {
    const now = HOP.now();
    const ph = phase();
    const { live, upcoming, invites, memories } = S.myOutings();
    const mine = live.find((o) => S.myAttendance(o.id)?.rsvp === 'going');
    const myPlans = upcoming.filter((o) => S.myAttendance(o.id)?.rsvp === 'going');
    const others = S.tonightOutings().filter((o) => S.myAttendance(o.id)?.rsvp !== 'going');
    const out = S.friendsOut();
    const evTonight = HOP.events.filter({ when: 'tonight' });
    const soonNear = evTonight.filter((e) => e.endsAt > now && e.startsAt - now < 120 * 6e4 && metres(HOP.map.ME, HOP.events.placeOf(e)) < 2500).sort((x, y) => x.startsAt - y.startsAt);
    const hottest = A.AREAS.map((a) => A.areaInfo(a.id, 'now')).sort((a, b) => b.heat - a.heat)[0];
    const nearMe = out.filter((f) => { const p = f.venueId ? S.venueById[f.venueId] : HOP.events.placeOf(HOP.events.byId(f.eventId)); return p && metres(HOP.map.ME, p) < 1500; });
    const quietNearby = !nearMe.length && !evTonight.some((e) => metres(HOP.map.ME, HOP.events.placeOf(e)) < 1500);
    const d = new Date(now);

    // peek candidates, in time-of-day order
    const rows = {
      live: mine && (() => { const st = S.stopsOf(mine.id), cur = st[mine.live.current]; return pk('openLive', mine.id, icoLead(HOP.oicon(mine, 16)), esc(mine.title), `At ${esc(S.stopName(cur))} · ${since(mine.live.arrivedAt)}`, `<button class="pkcam" data-act="camera" data-id="${mine.id}" aria-label="Take a photo">${I('camera', 18)}</button>`); })(),
      plan: (() => { const o = myPlans.find((x) => !mine || x.id !== mine.id); if (!o) return ''; const un = S.unread(o.id); return pk(un ? 'openChat' : 'openOuting', o.id, icoLead(HOP.oicon(o, 16)), esc(o.title), `${esc(when(o.startsAt).replace(', ', ' · '))} · <span data-live="going-${o.id}">${S.going(o.id).length} going</span>${un ? ` · <span class="pkun">${un} new</span>` : ''}`); })(),
      friends: out.length ? pk('friendsOut', '', `<span class="pkstack">${avatarStack(out.map((f) => f.user), 3, 20)}</span>`, `<span data-live="friends-out">${out.length}</span> friends are out`, (() => { const g = {}; out.forEach((f) => { const k = f.venueId || f.eventId; (g[k] ||= []).push(f); }); const [k, fs] = Object.entries(g).sort((x, y) => y[1].length - x[1].length)[0]; return `${esc(fs[0].user.first)}${fs.length > 1 ? ` + ${fs.length - 1}` : ''} at ${esc(S.venueById[k]?.name || HOP.events.byId(k)?.title || '')}`; })()) : '',
      soon: soonNear.length ? (() => { const st = soonNear.filter((e) => e.startsAt > now); return st.length ? pk('whatson', '', icoLead(I('ticket', 16)), `${st.length} ${st.length === 1 ? 'thing' : 'things'} starting nearby`, esc(HOP.util.startsIn(st[0].startsAt).replace('Starts in', 'first in'))) : pk('whatson', '', icoLead(I('ticket', 16)), `${soonNear.length} ${soonNear.length === 1 ? 'thing' : 'things'} on nearby`, esc(soonNear[0].title)); })() : '',
      invite: (() => { const o = invites[0] || others.filter((x) => S.myAttendance(x.id)?.rsvp === 'invited')[0]; if (!o) return ''; const host = S.userById[o.organiserId]; return pk('openOuting', o.id, `<span class="pklead av">${avatar(host, 22)}</span>`, `${esc(host.first)} invited you`, `${esc(o.title)} · ${esc(when(o.startsAt))}`); })(),
      memory: memories[0] ? pk('openOuting', memories[0].id, icoLead(HOP.oicon(memories[0], 16)), esc(memories[0].title), `${plural(S.photosOf(memories[0].id).length, 'photo')} · ${ago(memories[0].startsAt)}`) : '',
      busy: hottest && hottest.lv >= 2 ? pk('openArea', hottest.area.id, `<span class="pklead lvbox lv${hottest.lv}">${A.meter(hottest.lv)}</span>`, `${esc(hottest.area.name)} ${hottest.level.toLowerCase()} now`, esc(hottest.note)) : '',
    };
    const order = { morning: ['live', 'memory', 'plan', 'invite', 'soon'], afternoon: ['live', 'plan', 'invite', 'soon', 'friends'], evening: ['live', 'plan', 'friends', 'soon', 'invite', 'busy'], late: ['live', 'friends', 'busy', 'soon', 'plan'] }[ph];
    let peek = order.map((k) => rows[k]).filter(Boolean).slice(0, 3);
    if (!peek.length) peek.push(pk('create', '', icoLead(I('plus', 16)), 'Plan something', 'pick a few places, send the link').replace('data-act="create"', 'data-go="create"'));

    // glance line (explore): the most current facts, in words
    const glance = [];
    if (hottest && hottest.lv >= 2) glance.push(`${hottest.area.name} ${hottest.level.toLowerCase()} now${hottest.trend === 'rising' ? ', activity rising' : ''}`);
    if (ph === 'afternoon') { const later = A.AREAS.map((a) => A.areaInfo(a.id, 'later')).sort((a, b) => b.heat - a.heat)[0]; if (later) glance.push(`${later.area.name} expected ${later.level.toLowerCase()} tonight`); }

    const plans = plansSection(mine ? [mine, ...myPlans.filter((o) => o.id !== mine.id)] : myPlans, 'Your plans');
    const sections = {
      morning: () => [plans, recentFromFriends('New photos', 36 * 36e5), startingSection('This weekend', 'weekend'), savedSection()],
      afternoon: () => [plans, busySection('later', 'Expected busy tonight'), startingSection('What’s happening later', 'tonight'), friendsSection(out), popularSection('Popular tonight'), savedSection()],
      evening: () => [quietNearby ? `<div class="section"><p class="empty quietnote">Nothing much near you yet. Here’s what’s happening across Sydney.</p></div>` : '',
        plans, friendsSection(out), startingSection('What’s happening'), popularSection('Popular tonight'), busySection('now', 'Busy areas'), recentFromFriends(), savedSection()],
      late: () => [mine ? whereNextSection(mine) : '', friendsSection(nearMe.length ? nearMe : out), busySection('now', 'Still busy'), popularSection('Still going'), recentFromFriends(), startingSection('Still on', 'tonight'), plans],
    }[ph]().join('');

    return `<div class="tonhead" data-drag><p class="label"><span class="amber">${PHASE_LABEL[ph]}</span> · ${HOP.util.DAYS_LONG[d.getDay()].slice(0, 3)} ${time(now)}${previewHour != null ? ' · preview' : ''}</p>
        <button class="linkbtn" data-act="whatson">${evTonight.length} on ${I('chev', 13)}</button></div>
      <div class="pkrows">${peek.join('')}</div><div class="peek-end"></div>
      ${glance.length ? `<p class="glance">${esc(glance.join(' · '))}</p>` : ''}
      ${sections}
      <p class="meta srcnote">Busy levels combine venue patterns, public events, crowd reports and anonymous activity. Crowd reports, public photos and the wider city population are demo data in this prototype.</p>`;
  };

  // Friends from your outings: recent photos (only outings you're on, or public ones)
  function recentFromFriends(title = 'Recent from friends', maxAge = 3 * 36e5) { return photosSection(title, maxAge); }

  // ---------- lens sheets (FRIENDS / PLACES) ----------
  HOP.lensSheet = (lens, sub) => {
    if (lens === 'friends') {
      const out = S.friendsOut();
      const outs = S.tonightOutings();
      const body = sub === 'outings'
        ? (outs.length ? `<div class="rows tonrows">${outs.map((o) => (S.myAttendance(o.id)?.rsvp === 'going' ? planRow(o) : otherOutingRow(o))).join('')}</div>` : '<p class="empty">No outings you can see tonight yet.</p>')
        : sub === 'recent' ? (recentFromFriends('Photos', 6 * 36e5) || '<p class="empty">No photos from friends in the last few hours.</p>')
        : (friendsSection(out).replace('<p class="label"><span>Friends tonight</span>', '<p class="label"><span>Where they are</span>') || '<p class="empty">None of your friends are sharing where they are right now.</p>');
      return `<div class="tonhead" data-drag><p class="label"><span class="amber">Friends</span> · ${out.length} out now</p></div><div class="peek-end"></div>${body}
        <p class="meta srcnote">Only friends who share where they are, or who are on an outing you can see. Sharing is always opt-in.</p>`;
    }
    // places
    const late = (v) => /till ([1-5])\s?am/i.test(v.hours) || (HOP.seed.POP[v.id]?.[1] || 0) >= 23 || v.cat === 'club';
    const list = S.venues.filter((v) => v.cat !== 'spot' && (sub === 'all' || !sub || v.cat === sub || (sub === 'bar' && v.cat === 'gig') || (sub === 'late' && late(v))))
      .map((v) => ({ v, a: S.activity(v.id), dd: HOP.map.distanceFromMe(v) })).sort((x, y) => (y.a.busy - y.dd / 4000) - (x.a.busy - x.dd / 4000));
    const hot = list.filter((x) => x.a.hot);
    return `<div class="tonhead" data-drag><p class="label"><span class="amber">Places</span> · ${hot.length} busy now</p></div><div class="peek-end"></div>
      <div class="section"><p class="label">Popular now</p><div class="rows">${list.slice(0, 6).map(({ v }) => HOP.venueRow(v)).join('')}</div></div>
      <div class="section"><p class="label">More nearby</p><div class="rows">${list.slice(6, 20).sort((x, y) => x.dd - y.dd).map(({ v }) => HOP.venueRow(v)).join('')}</div></div>`;
  };

  // ---------- WHERE NEXT? ----------
  // Ranked from distance, busy now and expected, events, friends, saved places, chat votes and the route.
  HOP.whereNext = (o, n = 3) => {
    const st = S.stopsOf(o.id);
    const cur = o.live ? st[o.live.current] : st[st.length - 1];
    const from = cur ? S.placeOf(cur) : HOP.map.ME;
    const nxt = o.live && st[o.live.current + 1];
    const taken = new Set(st.map((x) => x.venueId));
    const saved = new Set(S.saved());
    const keen = {};
    S.messagesOf(o.id).forEach((m) => { if (m.kind === 'place' && m.place?.venueId) keen[m.place.venueId] = (keen[m.place.venueId] || 0) + (m.keen?.length || 0) + 1; });
    const now = HOP.now();
    return S.venues.filter((v) => ['bar', 'pub', 'club', 'gig'].includes(v.cat) && !taken.has(v.id))
      .map((v) => {
        const d = metres(from, v);
        if (d > 2000) return null;
        const a = S.activity(v.id);
        const ar = A.areaOfVenue(v);
        const later = ar ? A.levelAt(ar.id, now + 60 * 6e4).heat : 0.3;
        const ev = HOP.events.tonightAt(v.id).find((e) => e.endsAt > now && e.startsAt - now < 120 * 6e4);
        const rep = S.reportsAt(v.id);
        const towardNext = nxt ? Math.max(0, 1 - metres(v, S.placeOf(nxt)) / 1500) * 0.1 : 0;
        const score = a.busy * 0.45 + later * 0.2 + a.friends.length * 0.12 + (ev ? 0.15 : 0) + (saved.has(v.id) ? 0.1 : 0) + (keen[v.id] || 0) * 0.08 + towardNext
          - d / 2600 - (a.lv === 0 ? 0.25 : 0) - (rep.queue?.value === 'long' ? 0.15 : 0) - (rep.crowd?.value === 'packed' ? 0.05 : 0);
        return { v, d, a, ev, rep, score, saved: saved.has(v.id) };
      }).filter(Boolean).sort((x, y) => y.score - x.score).slice(0, n);
  };
  function whereNextSection(o) {
    const list = HOP.whereNext(o);
    if (!list.length) return '';
    return `<div class="section"><p class="label"><span>Where next?</span></p><div class="wn">${list.map(({ v, d, a, ev, rep, saved }) => {
      const bits = [`${Math.max(1, Math.round(d / 80))} min walk`, `<span class="lvw lv${a.lv}">${a.label}</span>`, a.friends.length ? `${a.friends.length} ${a.friends.length === 1 ? 'friend' : 'friends'} there` : ''].filter(Boolean).join(' · ');
      const extra = [ev ? `${esc(ev.title)} · ${HOP.util.startsIn(ev.startsAt, ev.endsAt)}` : '', rep.queue ? `Queue ${rep.queue.label.toLowerCase()}` : '', saved ? 'Saved' : ''].filter(Boolean).join(' · ');
      return `<div class="wnrow"><button class="wnmain" data-act="venue" data-id="${v.id}">${photoTag({ id: v.id, u: v.img }, 120, 120, 'thumb')}<div class="grow"><div class="t">${esc(v.name)}</div><div class="s">${bits}</div>${extra ? `<div class="s dim">${extra}</div>` : ''}</div></button>
        <div class="wnact">${S.isOrganiser(o) ? `<button class="btn sm primary" data-act="wnAdd" data-o="${o.id}" data-v="${v.id}">Add stop</button>` : ''}<button class="btn sm" data-act="wnVote" data-o="${o.id}">Vote</button></div></div>`;
    }).join('')}</div></div>`;
  }
  HOP.whereNextSection = whereNextSection;
  HOP.actions.wnAdd = (d) => {
    const o = S.outing(d.o); const st = S.stopsOf(o.id);
    const cur = st[o.live ? o.live.current : st.length - 1], nx = o.live && st[o.live.current + 1];
    let at = HOP.now() + 45 * 6e4;
    if (nx) at = Math.max(cur.at + 6e4, Math.min(at, nx.at - 6e4));
    const s = S.addStop(o.id, d.v, at);
    if (s) ui.toast(`${esc(S.venueById[d.v].name)} is the next stop`);
    HOP.app.render({ keepScroll: true });
  };
  HOP.actions.wnVote = (d) => {
    const o = S.outing(d.o);
    const open = S.messagesOf(o.id).filter((m) => m.kind === 'poll' && !m.poll.closed).pop();
    if (open) { ui.toast('There’s already a vote going in the chat'); HOP.actions.openChat({ id: o.id }); return; }
    const opts = HOP.whereNext(o).map(({ v }) => ({ venueId: v.id, votes: [] }));
    const st = S.stopsOf(o.id), cur = st[o.live ? o.live.current : st.length - 1];
    const m = S.postMessage(o.id, { kind: 'poll', poll: { q: `Where after ${cur ? S.stopName(cur) : 'this'}?`, closed: false, options: opts } });
    HOP.sim.chatVotes(o.id, m.id);
    ui.toast('Vote sent to the chat');
    HOP.actions.openChat({ id: o.id });
  };

  // ---------- saved collections ----------
  HOP.actions.savedLists = (d = {}) => {
    const cols = S.collections();
    const pick = HOP.app.picking;
    const draw = (cid) => {
      const c = cid && cols.find((x) => x.id === cid);
      if (!c) return `<div class="mhead"><h2 class="h2">Saved</h2><button class="iconbtn bare" data-act="closeModal" aria-label="Close">${I('close')}</button></div>
        <div class="rows">${cols.map((x) => `<button class="row" data-act="savedOpen" data-c="${x.id}"><span class="colic">${I('bookmark', 16)}</span><div class="grow"><div class="t">${esc(x.name)}</div><div class="s">${esc(x.items.slice(0, 3).map((i) => (i.venueId ? S.venueById[i.venueId]?.name : HOP.events.byId(i.eventId)?.title)).filter(Boolean).join(', ')) || 'Empty'}</div></div><span class="mono dim">${x.items.length}</span>${I('chev', 16)}</button>`).join('')}</div>`;
      return `<div class="mhead"><button class="iconbtn bare" data-act="savedOpen" data-c="" aria-label="Back">${I('back')}</button><h2 class="h2 grow">${esc(c.name)}</h2><button class="iconbtn bare" data-act="closeModal" aria-label="Close">${I('close')}</button></div>
        ${pick ? `<p class="meta" style="margin:0 0 8px">Tap one to add it to ${esc(S.outing(pick).title)}.</p>` : ''}
        <div class="rows">${c.items.map((i) => {
          if (i.venueId) { const v = S.venueById[i.venueId]; return v ? HOP.venueRow(v).replace('data-act="venue"', 'data-act="savedVenue"') : ''; }
          const e = HOP.events.byId(i.eventId); return e ? HOP.eventRow(e).replace('data-act="openEvent"', 'data-act="savedEvent"') : '';
        }).join('') || '<p class="empty">Nothing saved here yet. Tap Save on any place or event.</p>'}</div>`;
    };
    ui.openModal(draw(d.c));
    HOP.actions.savedOpen = (x) => { document.querySelector('#modal .msheet').innerHTML = draw(x.c); };
    HOP.actions.savedVenue = (x) => { ui.closeModal(); HOP.app.openVenue(x.id); };
    HOP.actions.savedEvent = (x) => { ui.closeModal(); HOP.actions.openEvent({ id: x.id }); };
  };

  // ---------- area sheet (tap a neighbourhood, or an active part of the heat) ----------
  HOP.screens.area = {
    nav: 'home', mapMode: 'default',
    render({ id }) {
      const a = A.byId[id];
      const when = HOP.map.heatWhen;
      const info = A.areaInfo(id, when);
      const now = A.areaInfo(id, 'now');
      const pub = A.areaPublic(id, when);
      const pubNow = when === 'now' ? pub : A.areaPublic(id, 'now');
      const evs = (pub.events.length ? pub.events : A.areaPublic(id, 'tonight').events).filter((e) => e.endsAt > HOP.now());
      const soon = evs.slice().sort((x, y) => x.startsAt - y.startsAt).slice(0, 4);
      const why = A.why(id, when);
      const popular = pub.venues.filter((x) => x.act.busy >= 0.43).slice(0, 5);
      const photos = pub.venues.flatMap((x) => S.venuePhotos(x.v.id)).sort((p, q) => q.takenAt - p.takenAt);
      const fr = pubNow.friends;
      const isNow = when === 'now';
      const lvl = isNow ? info : info;
      const facts = [fr.length ? `${fr.length} ${fr.length === 1 ? 'friend' : 'friends'} around` : '', evs.length ? `${evs.length} ${evs.length === 1 ? 'event' : 'events'} ${when === 'now' || when === 'later' ? 'tonight' : ''}`.trim() : '', popular.length ? `${popular.length} popular ${popular.length === 1 ? 'venue' : 'venues'}` : ''].filter(Boolean);
      return {
        top: `<div class="floatbar"><button class="fbtn" data-act="back" aria-label="Back">${I('back')}</button></div>`,
        sizes: ['half', 'full'],
        sheet: `<div data-drag><p class="label">Area${isNow ? '' : ' · forecast'}</p><h1 class="h1 areah">${esc(a.name)}</h1>
          <div class="arealine lv${lvl.lv}">${A.meter(lvl.lv)}<b class="lvw lv${lvl.lv}" data-live="areah-${id}">${isNow ? `${lvl.level} now` : `Expected ${lvl.level.toLowerCase()}`}</b>${isNow && now.trend === 'rising' ? '<span>Activity rising</span>' : ''}</div>
          ${info.span ? `<p class="meta peakline">Peak expected ${esc(info.peakLevel.toLowerCase())} · ${esc(info.span)}</p>` : info.peak ? `<p class="meta peakline">${esc(info.peak)}</p>` : ''}
          ${why.length && lvl.lv >= 2 ? `<p class="why">Busy because of ${esc(why.join(', '))}.</p>` : ''}
          ${facts.length ? `<div class="afacts">${facts.map((f) => `<span>${f}</span>`).join('')}</div>` : ''}</div>
          ${popular.length ? `<div class="section"><p class="label">Popular now</p><div class="rows">${popular.map(({ v }) => HOP.venueRow(v)).join('')}</div></div>` : ''}
          ${soon.length ? `<div class="section"><p class="label">Starting soon</p><div class="rows">${soon.map((e) => HOP.eventRow(e)).join('')}</div></div>` : ''}
          ${fr.length ? `<div class="section"><p class="label">Friends around here</p><div class="herenow">${avatarStack(fr.map((f) => f.user), 6, 28)}<span><b>${esc(fr.slice(0, 2).map((f) => f.user.first).join(', '))}</b>${fr.length > 2 ? ` + ${fr.length - 2}` : ''}</span></div></div>` : ''}
          ${photos.length ? `<div class="section"><p class="label"><span>Recent · ${plural(photos.length, 'public photo')}</span><span class="dim">${ago(photos[0].takenAt)}</span></p><div class="strip">${photos.slice(0, 10).map((p) => `<button data-act="viewPhoto" data-vp="${p.venueId}" data-p="${p.id}">${photoTag(p, 200, 250)}</button>`).join('')}</div></div>` : ''}
          <div class="section"><p class="label">All places here</p><div class="rows">${pub.venues.filter((x) => !popular.includes(x)).slice(0, 8).map(({ v }) => HOP.venueRow(v)).join('') || '<p class="empty">No places listed here yet.</p>'}</div></div>
          <p class="meta srcnote">Area activity is anonymous and aggregated. It never shows private outings, who is where, or anyone’s route.</p>`,
        map() { HOP.map.setSelected(null); HOP.map.showRoute(null); HOP.map.fitTo([{ lat: a.lat - a.r / 111000, lng: a.lng - a.r / 92000 }, { lat: a.lat + a.r / 111000, lng: a.lng + a.r / 92000 }], { maxZoom: 15.6 }); },
      };
    },
  };
  HOP.actions.openArea = (d) => HOP.app.go('area', { id: d.id }, { replace: HOP.app.route.name === 'area' });
  HOP.actions.toggleHeat = () => { HOP.map.setHeat(!HOP.map.heatOn); HOP.app.syncHeatUi(); HOP.app.render({ keepScroll: true, sheetOnly: true }); };
})();
