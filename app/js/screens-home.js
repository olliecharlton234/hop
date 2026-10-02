/* HOP — Map home, search, venue sheet, Outings tab */
HOP.screens = HOP.screens || {};

(() => {
  const { esc, avatar, avatarStack, photoTag, when, timeShort, distLabel, plural, img } = HOP.util;
  const I = HOP.icon;
  const S = HOP.store;
  const ui = HOP.ui;
  const CAT = { pub: 'Pub', bar: 'Bar', club: 'Club', food: 'Food', gig: 'Live music', spot: 'Spot' };
  const FILTERS = [['all', 'All'], ['pub', 'Pubs'], ['bar', 'Bars'], ['club', 'Clubs'], ['food', 'Food']];
  let filter = 'all';
  let query = '';
  HOP.clearQuery = () => (query = '');
  const AREAS = [['Surry Hills', -33.8848, 151.2115], ['Darlinghurst', -33.8785, 151.2175], ['Newtown', -33.8962, 151.1810], ['CBD', -33.8675, 151.2075], ['Chippendale', -33.8875, 151.1990], ['Bondi', -33.8910, 151.2750]];

  // tiny route sketch used in lists, drawn from real stop coordinates
  HOP.routeMini = (outingId) => {
    const pts = S.stopsOf(outingId).map((s) => S.placeOf(s));
    if (!pts.length) return '';
    const lats = pts.map((p) => p.lat), lngs = pts.map((p) => p.lng);
    const [a, b, c, d] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
    const sx = (v) => 6 + ((v - c) / (d - c || 1)) * 42, sy = (v) => 6 + ((b - v) / (b - a || 1)) * 28;
    const path = pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.lng).toFixed(1)} ${sy(p.lat).toFixed(1)}`).join(' ');
    return `<svg class="route-mini" viewBox="0 0 54 40" aria-hidden="true"><path d="${path}"/>${pts.map((p) => `<circle cx="${sx(p.lng).toFixed(1)}" cy="${sy(p.lat).toFixed(1)}" r="2.6"/>`).join('')}</svg>`;
  };

  HOP.goingLine = (o) => {
    const g = S.going(o.id).length, m = S.attendeesOf(o.id).filter((a) => a.rsvp === 'maybe').length;
    return `${g} going${m ? ` · ${m} maybe` : ''}`;
  };

  // Map lenses, each with its own sub-filters. EVENTS opens What's on with the same bar.
  const LENSES = [['tonight', 'Tonight'], ['friends', 'Friends'], ['places', 'Places'], ['events', 'Events']];
  const SUBS = {
    friends: [['out', 'Out now'], ['outings', 'Outings'], ['recent', 'Recent']],
    places: [['all', 'All'], ['pub', 'Pubs'], ['bar', 'Bars'], ['club', 'Clubs'], ['food', 'Food'], ['late', 'Late night']],
  };
  let lens = 'tonight', lensSub = { friends: 'out', places: 'all' };
  HOP.lensBar = (active, subHtml = '') => `<div class="lenses" role="tablist">${LENSES.map(([k, l]) => `<button role="tab" aria-selected="${active === k}" class="${active === k ? 'on' : ''}" data-act="lens" data-l="${k}">${l}</button>`).join('')}</div>${subHtml}`;
  function lensSubs() {
    if (!SUBS[lens]) return '';
    return `<div class="filters subs">${SUBS[lens].map(([k, l]) => `<button data-act="lensSub" data-v="${k}" class="${lensSub[lens] === k ? 'on' : ''}">${lens === 'places' && !['all', 'late'].includes(k) ? HOP.map.catSvg(k) : ''}${l}</button>`).join('')}</div>`;
  }
  function searchTop(placeholder = 'Places, events, areas') {
    return `<div class="searchrow">
        <label class="search">${I('search')}<input id="q" type="search" autocomplete="off" placeholder="${placeholder}" value="${esc(query)}" aria-label="Search places, events, outings and areas"></label>
        <button class="me-btn" data-go="profile" aria-label="Your profile">${avatar(S.me(), 34)}</button>
      </div>${HOP.lensBar(lens, lensSubs())}`;
  }
  HOP.actions.lens = (d) => {
    if (d.l === 'events') { if (HOP.app.route.name !== 'whatson') HOP.actions.whatson({}); return; }
    if (HOP.app.route.name === 'whatson') HOP.app.back();
    lens = d.l;
    HOP.map.setLens(lens, lensSub[lens]);
    if (HOP.app.route.name !== 'home') HOP.app.go('home', {}, { resetTo: 'home' });
    else HOP.app.render({ resize: true });
  };
  HOP.actions.lensSub = (d) => { lensSub[lens] = d.v; HOP.map.setLens(lens, d.v); document.querySelectorAll('.subs button').forEach((b) => b.classList.toggle('on', b.dataset.v === d.v)); HOP.app.render({ sheetOnly: true, keepScroll: true }); };
  HOP.lens = () => ({ lens, sub: lensSub[lens] });
  HOP.searchTop = searchTop;

  // Search: before typing it's discovery; typing searches places, events, public outings and areas
  const RKEY = 'hop.recentSearches';
  const recentSearches = () => { try { return JSON.parse(localStorage.getItem(RKEY) || '[]'); } catch (e) { return []; } };
  function rememberSearch() {
    const q = query.trim(); if (q.length < 2) return;
    try { localStorage.setItem(RKEY, JSON.stringify([q, ...recentSearches().filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 5))); } catch (e) {}
  }
  HOP.actions.recentSearch = (d) => { query = d.q; const q = document.getElementById('q'); if (q) { q.value = d.q; } const r = document.getElementById('results'); if (r) r.innerHTML = results(); };
  const sec = (title, body, more = '') => (body ? `<p class="label sublabel"><span>${title}</span>${more}</p>${body}` : '');
  function discovery() {
    const now = HOP.now();
    const A = HOP.activity;
    const popular = S.venues.filter((v) => v.cat !== 'spot').map((v) => ({ v, a: S.activity(v.id) })).filter((x) => x.a.hot).sort((x, y) => y.a.busy - x.a.busy).slice(0, 4);
    const busy = A.AREAS.map((a) => A.areaInfo(a.id, 'now')).filter((x) => x.lv >= 2).sort((x, y) => y.heat - x.heat).slice(0, 3);
    const soon = HOP.events.filter({ when: 'tonight' }).filter((e) => e.endsAt > now).sort((x, y) => Math.max(x.startsAt, now) - Math.max(y.startsAt, now)).slice(0, 3);
    const withFriends = S.venues.map((v) => ({ v, n: S.activity(v.id).friends.length })).filter((x) => x.n).sort((x, y) => y.n - x.n).slice(0, 3);
    const saved = S.saved().slice(0, 4);
    const rec = recentSearches();
    return [
      rec.length ? `<div class="recents">${rec.map((r) => `<button data-act="recentSearch" data-q="${esc(r)}">${I('clock', 13)} ${esc(r)}</button>`).join('')}</div>` : '',
      sec('Popular tonight', popular.map(({ v }) => venueRow(v)).join('')),
      sec('Busy areas', busy.map((x) => `<button class="row" data-act="openArea" data-id="${x.area.id}"><span class="iconbtn lvbox lv${x.lv}">${A.meter(x.lv)}</span><div class="grow"><div class="t">${esc(x.area.name)}</div><div class="s"><span class="lvw lv${x.lv}">${x.level}</span> · ${esc(x.note)}</div></div>${I('chev')}</button>`).join('')),
      sec('Events starting soon', soon.map((e) => HOP.eventRow(e)).join(''), '<button class="linkbtn" data-act="whatson">All</button>'),
      sec('Popular with friends', withFriends.map(({ v }) => venueRow(v)).join('')),
      sec('Your saved places', saved.map((id) => venueRow(S.venueById[id])).join(''), '<button class="linkbtn" data-act="savedLists">Lists</button>'),
    ].join('');
  }
  function results(opts = {}) {
    const q = query.trim().toLowerCase();
    const near = (v) => HOP.map.distanceFromMe(v);
    const pickOnly = opts.pick || HOP.app.route?.name === 'pick';
    let list = S.venues.filter((v) => filter === 'all' || v.cat === filter || (filter === 'bar' && v.cat === 'gig'));
    if (!q) return pickOnly ? list.sort((a, b) => near(a) - near(b)).slice(0, 30).map(venueRow).join('') : discovery();
    list = list.filter((v) => (v.name + ' ' + v.suburb + ' ' + CAT[v.cat] + ' ' + v.address).toLowerCase().includes(q)).sort((a, b) => near(a) - near(b));
    if (pickOnly) return list.slice(0, 30).map(venueRow).join('') || `<p class="empty">Nothing called “${esc(query)}” nearby.</p>`;
    const areas = HOP.activity.AREAS.filter((a) => (a.name + ' ' + a.suburbs.join(' ')).toLowerCase().includes(q));
    const evs = HOP.events.upcoming().filter((e) => (e.title + ' ' + e.genre + ' ' + (HOP.events.placeOf(e)?.name || '')).toLowerCase().includes(q)).slice(0, 5);
    const outs = S.publicOutings().filter((o) => (o.title + ' ' + S.stopsOf(o.id).map((st) => S.stopName(st)).join(' ')).toLowerCase().includes(q)).slice(0, 3);
    const body = [
      sec('Places', list.slice(0, 8).map(venueRow).join('')),
      sec('Events', evs.map((e) => HOP.eventRow(e)).join('')),
      sec('Public outings', outs.map((o) => `<button class="row" data-act="openOuting" data-id="${o.id}"><span class="iconbtn">${HOP.oicon(o, 18)}</span><div class="grow"><div class="t">${esc(o.title)}</div><div class="s">${o.status === 'live' ? 'Live now' : when(o.startsAt)} · ${S.going(o.id).length} going</div></div>${I('chev')}</button>`).join('')),
      sec('Areas', areas.map((a) => { const x = HOP.activity.areaInfo(a.id, 'now'); return `<button class="row" data-act="openArea" data-id="${a.id}"><span class="iconbtn lvbox lv${x.lv}">${HOP.activity.meter(x.lv)}</span><div class="grow"><div class="t">${esc(a.name)}</div><div class="s"><span class="lvw lv${x.lv}">${x.level} now</span></div></div>${I('chev')}</button>`; }).join('')),
    ].join('');
    return body || `<p class="empty">Nothing matches “${esc(query)}”. Try a suburb, a venue or a kind of night, like trivia.</p>`;
  }
  HOP.venueRow = (v) => venueRow(v);
  function venueRow(v) {
    const act = S.activity(v.id);
    const ev = HOP.events.tonightAt(v.id)[0];
    const evBit = ev ? `${ev.title.length > 20 ? HOP.events.CATS[ev.cat].label : ev.title} · ${HOP.util.startsIn(ev.startsAt, ev.endsAt)}` : '';
    const bits = [act.friends.length ? `${act.friends.length} ${act.friends.length === 1 ? 'friend' : 'friends'}` : '', evBit, distLabel(HOP.map.distanceFromMe(v))].filter(Boolean);
    return `<button class="row" data-act="venue" data-id="${v.id}">
      ${photoTag({ id: v.id, u: v.img }, 120, 120, 'thumb')}
      <div class="grow"><div class="t">${esc(v.name)}</div><div class="s"><span class="lvw lv${act.lv}">${act.label}${act.trend === 'rising' && act.lv >= 2 ? ', rising' : ''}</span>${bits.length ? ' · ' + esc(bits.join(' · ')) : ''}</div></div>
      ${act.friends.length ? avatarStack(act.friends.map((f) => f.user), 3, 22) : `<span class="mono dim">${esc(v.price)}</span>`}</button>`;
  }

  // ---------------- HOME ----------------
  function homeSheet() {
    if (HOP.app.searching) {
      return `<div class="section" style="padding-top:4px"><div class="rows" id="results">${results()}</div></div>`;
    }
    return lens === 'tonight' ? HOP.tonightSheet() : HOP.lensSheet(lens, lensSub[lens]);
  }

  // The Tonight layer: what my night looks like and what my friends are doing, in a few rows
  HOP.tonightSheet = () => {
    const now = HOP.now();
    const { live, upcoming } = S.myOutings();
    const mine = live[0];
    const others = S.tonightOutings().filter((o) => S.myAttendance(o.id)?.rsvp !== 'going');
    const out = S.friendsOut();
    const evTonight = HOP.events.filter({ when: 'tonight' });
    const next = upcoming.find((o) => S.myAttendance(o.id)?.rsvp === 'going');
    const d = new Date(now);
    let rows = '';
    if (mine) {
      const st = S.stopsOf(mine.id), cur = st[mine.live.current], nx = st[mine.live.current + 1];
      const unm = S.unread(mine.id);
      rows += `<div class="tl"><button class="tlmain" data-act="openLive" data-id="${mine.id}"><span class="lead emo">${HOP.oicon(mine)}${unm ? `<b class="ub">${unm}</b>` : ''}</span>
        <div class="grow"><div class="t">${esc(mine.title)}</div><div class="s"><span class="livepill">LIVE</span> ${esc(S.stopName(cur))}${nx ? ` · next ${esc(S.stopName(nx))} ${HOP.util.hm(nx.at)}` : ''}</div></div></button>
        <button class="tlcam" data-act="camera" data-id="${mine.id}" aria-label="Take a photo for ${esc(mine.title)}">${I('camera', 22)}</button></div>`;
    }
    others.slice(0, mine ? 1 : 2).forEach((o) => {
      const host = S.userById[o.organiserId];
      const a = S.myAttendance(o.id);
      const st = S.stopsOf(o.id);
      const isLive = o.status === 'live';
      const at = isLive ? st[o.live.current] : st[0];
      const n = S.going(o.id).length;
      const photos = S.photosOf(o.id).length;
      const sub = isLive ? `<span class="livepill">LIVE</span> ${esc(S.stopName(at))} · ${n} there${photos ? ` · ${photos} photos` : ''}`
        : `${HOP.util.hm(o.startsAt)} ${esc(S.stopName(at))}${st[1] ? ` → ${esc(S.stopName(st[1]))}` : ''}${a?.rsvp === 'maybe' ? ' · you’re a maybe' : ` · ${n} going`}`;
      const cta = !a ? ['View', 'openOuting'] : a.rsvp === 'invited' ? ['Join', 'joinOuting'] : a.rsvp === 'maybe' ? ['I’m in', 'joinOuting'] : ['View', 'openOuting'];
      const un = S.canChat(o) ? S.unread(o.id) : 0;
      rows += `<div class="tl"><button class="tlmain" data-act="openOuting" data-id="${o.id}"><span class="lead ${isLive ? 'live' : ''}">${avatar(host, 38)}<i>${HOP.oicon(o)}</i>${un ? `<b class="ub">${un}</b>` : ''}</span>
        <div class="grow"><div class="t">${esc(host.first)}’s ${esc(o.title.replace(/^.*?'s /, ''))}</div><div class="s">${sub}</div></div></button>
        <button class="btn sm ${cta[1] === 'joinOuting' ? 'primary' : ''}" data-act="${cta[1]}" data-id="${o.id}">${cta[0]}</button></div>`;
    });
    if (out.length) {
      const named = out.slice(0, 2).map((f) => `${esc(f.user.first)} at ${esc(f.venueId ? S.venueById[f.venueId].name : HOP.events.byId(f.eventId)?.title || '')}`);
      rows += `<button class="tl tlmain" data-act="friendsOut">${avatarStack(out.map((f) => f.user), 5, 28)}
        <div class="grow"><div class="t">${out.length} friends are out</div><div class="s">${named.join(' · ')}</div></div>${I('chev')}</button>`;
    }
    if (next && (!mine || next.id !== mine.id)) {
      const un = S.unread(next.id), lm = un && S.lastMessage(next.id);
      rows += `<button class="tl tlmain" data-act="${un ? 'openChat' : 'openOuting'}" data-id="${next.id}"><span class="lead emo">${HOP.oicon(next)}${un ? `<b class="ub">${un}</b>` : ''}</span>
        <div class="grow"><div class="t">${esc(next.title)} <span class="tlwhen">${when(next.startsAt)}</span></div><div class="s">${lm ? `<span class="lm">${esc(HOP.chatPreview(lm))}</span> · ${HOP.util.ago(lm.at)}` : `${S.going(next.id).length} going · ${HOP.util.plural(S.stopsOf(next.id).length, 'stop')}`}</div></div>${I('chev')}</button>`;
    }
    return `<div class="tonhead" data-drag><p class="label"><span class="amber">Tonight</span> · ${HOP.util.DAYS_LONG[d.getDay()]} ${HOP.util.time(now)}</p>
        <button class="linkbtn" data-act="whatson">${evTonight.length} things on ${I('chev', 14)}</button></div>
      <div class="tonrows">${rows}</div><div class="peek-end"></div>
      <div class="section"><p class="label"><span>What’s on tonight</span><button class="linkbtn" data-act="whatson">See all</button></p>
        <div class="rows">${evTonight.slice(0, 5).map((e) => HOP.eventRow(e)).join('')}</div></div>
      <div class="section"><p class="label">Near you</p><div class="rows">${S.venues.filter((v) => v.cat !== 'spot').sort((a, b) => HOP.map.distanceFromMe(a) - HOP.map.distanceFromMe(b)).slice(0, 12).map(venueRow).join('')}</div></div>`;
  };

  HOP.actions.joinOuting = (d) => {
    S.rsvp(d.id, 'going');
    const o = S.outing(d.id);
    ui.toast(`You’re in. ${esc(S.userById[o.organiserId].first)} can see you’re coming.`);
    HOP.actions.openOuting({ id: d.id });
  };
  HOP.actions.friendsOut = () => {
    const out = S.friendsOut();
    const groups = {};
    out.forEach((f) => { const k = f.venueId || f.eventId; (groups[k] ||= []).push(f); });
    ui.openModal(`<div class="mhead"><h2 class="h2">${out.length} friends are out</h2><button class="iconbtn bare" data-act="closeModal" aria-label="Close">${I('close')}</button></div>
      <div class="rows">${Object.entries(groups).sort((a, b) => b[1].length - a[1].length).map(([k, fs]) => {
        const v = S.venueById[k]; const e = !v && HOP.events.byId(k);
        const o = fs[0].outingId && S.outing(fs[0].outingId);
        return `<button class="row" data-act="${v ? 'venueFromList' : 'openEvent'}" data-id="${k}">${avatarStack(fs.map((f) => f.user), 3, 30)}
          <div class="grow"><div class="t">${esc(v ? v.name : e.title)}</div><div class="s">${esc(fs.map((f) => f.user.first).join(', '))}${o ? ` · ${esc(o.title)}` : ''} · since ${HOP.util.hm(Math.min(...fs.map((f) => f.since)))}</div></div>${I('chev')}</button>`;
      }).join('')}</div>
      <p class="meta" style="margin:12px 0 0">Only friends who share where they are, or who are on an outing you can see.</p>`);
  };
  HOP.actions.venueFromList = (d) => { ui.closeModal(); HOP.app.openVenue(d.id); };

  HOP.screens.home = {
    nav: 'home', mapMode: 'default',
    render() {
      return {
        top: searchTop(), sheet: homeSheet(),
        sizes: HOP.app.searching ? ['half', 'full'] : lens === 'tonight' ? ['peek', 'half', 'full'] : ['half', 'peek', 'full'],
        map() {
          HOP.map.setSelected(null);
          const { live, upcoming } = S.myOutings();
          const focus = live[0] || upcoming.find((o) => S.myAttendance(o.id)?.rsvp === 'going');
          HOP.map.showRoute(focus ? focus.id : null, 'home', { fit: false });
          const tonight = new Set(S.tonightOutings().map((o) => o.id));
          HOP.map.showOutingPins([...upcoming.slice(focus && !live[0] ? 1 : 0), ...S.publicOutings().filter((o) => !S.myAttendance(o.id))].filter((o) => o !== focus && !tonight.has(o.id)));
        },
      };
    },
    mount() { bindSearch(); },
    refreshSheetOnly: true,
  };

  function bindSearch() {
    const q = document.getElementById('q');
    if (!q) return;
    q.addEventListener('focus', () => { if (!HOP.app.searching) { HOP.app.searching = true; HOP.app.render({ sheetOnly: true, sizes: ['half', 'full'] }); } });
    q.addEventListener('input', () => {
      query = q.value;
      HOP.app.searching = true;
      const r = document.getElementById('results');
      if (r) r.innerHTML = results(); else HOP.app.render({ sheetOnly: true, sizes: ['half', 'full'] });
    });
    q.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { query = ''; q.value = ''; q.blur(); HOP.app.searching = false; HOP.app.render({ sheetOnly: true, sizes: ['peek', 'full'] }); }
      if (e.key === 'Enter') { const first = document.querySelector('#results [data-act]'); if (first) first.click(); }
    });
  }
  HOP.bindSearch = bindSearch;

  HOP.actions.filter = (d) => {
    filter = d.f;
    HOP.map.setFilter(filter);
    document.querySelectorAll('.filters button').forEach((b) => b.classList.toggle('on', b.dataset.f === filter));
    const r = document.getElementById('results'); if (r) r.innerHTML = results();
  };
  HOP.actions.area = (d) => { HOP.map.focus({ lat: +d.lat, lng: +d.lng }, 15.75); HOP.app.searching = false; HOP.app.render({ sheetOnly: true, sizes: ['peek', 'full'] }); document.getElementById('q')?.blur(); };
  document.addEventListener('click', (e) => { if (HOP.app?.searching && e.target.closest('#results [data-act]') && !e.target.closest('[data-act="recentSearch"]')) rememberSearch(); }, true);
  HOP.actions.venue = (d) => { HOP.app.searching = false; document.getElementById('q')?.blur(); HOP.app.openVenue(d.id); };

  // ---------------- VENUE ----------------
  function friendsBeen(v) {
    const ids = new Set();
    S.state.stops.filter((s) => s.venueId === v.id).forEach((s) => {
      const o = S.outing(s.outingId);
      if (o && o.status === 'ended') S.going(o.id).forEach((a) => a.userId !== S.meId && ids.add(a.userId));
    });
    return [...ids].map((id) => S.userById[id]);
  }

  const peakWords = (v) => { const [, pk] = HOP.seed.POP[v.id] || [0.3, 21]; const h = Math.round(pk) % 24; return `peaks around ${h % 12 || 12}${h >= 12 && h < 24 ? 'pm' : 'am'}`; };
  // Save into a collection (Want to go, Good pubs, …)
  HOP.actions.saveVenue = (d) => HOP.actions.saveTo({ v: d.v });
  HOP.actions.saveTo = (d) => {
    const ref = d.v ? { venueId: d.v } : { eventId: d.e };
    const name = d.v ? S.venueById[d.v].name : HOP.events.byId(d.e).title;
    const draw = () => `<div class="mhead"><h2 class="h2">Save ${esc(name)}</h2><button class="iconbtn bare" data-act="closeModal" aria-label="Close">${I('close')}</button></div>
      <div class="rows">${S.collections().map((c) => { const on = c.items.some((i) => (d.v ? i.venueId === d.v : i.eventId === d.e)); return `<button class="row colrow ${on ? 'on' : ''}" data-act="saveToggle" data-c="${c.id}" ${d.v ? `data-v="${d.v}"` : `data-e="${d.e}"`}><span class="colic">${I(on ? 'check' : 'bookmark', 16)}</span><div class="grow"><div class="t">${esc(c.name)}</div><div class="s">${HOP.util.plural(c.items.length, 'place')}</div></div></button>`; }).join('')}</div>
      <button class="btn primary block" data-act="closeModal" style="margin-top:10px">Done</button>`;
    ui.openModal(draw(), () => HOP.app.render({ sheetOnly: true }));
    HOP.actions.saveToggle = (x) => {
      const r = x.v ? { venueId: x.v } : { eventId: x.e };
      const on = !S.collectionsOf(r).some((c) => c.id === x.c);
      S.setSaved(r, x.c, on);
      document.querySelector('#modal .msheet').innerHTML = draw();
    };
  };

  // Crowd report: structured, quick, only from people who are there
  HOP.actions.report = (d) => {
    const v = S.venueById[d.v];
    const ok = S.canReport(v.id);
    if (!ok.ok) { ui.toast(ok.why); return; }
    const picks = {};
    const draw = () => `<div class="mhead"><h2 class="h2">How’s ${esc(v.name)}?</h2><button class="iconbtn bare" data-act="closeModal" aria-label="Close">${I('close')}</button></div>
      <p class="meta" style="margin:0 0 10px">Anonymous. Helps everyone nearby. Pick what you can see.</p>
      ${Object.entries(S.REPORT_KINDS).map(([k, def]) => `<div class="rgroup"><p class="label">${def.label}</p><div class="rchips">${def.opts.map(([val, l]) => `<button class="${picks[k] === val ? 'on' : ''}" data-act="rpick" data-k="${k}" data-val="${val}">${l}</button>`).join('')}</div></div>`).join('')}
      <button class="btn primary block" data-act="rsend" ${Object.keys(picks).length ? '' : 'disabled'}>Send report</button>`;
    ui.openModal(draw());
    HOP.actions.rpick = (x) => { picks[x.k] = picks[x.k] === x.val ? undefined : x.val; if (!picks[x.k]) delete picks[x.k]; document.querySelector('#modal .msheet').innerHTML = draw(); };
    HOP.actions.rsend = () => { S.addReport(v.id, picks); ui.closeModal(); ui.toast('Thanks. Your report is in.'); HOP.app.render({ sheetOnly: true }); };
  };

  // "BUSY · Activity rising", reports, what's on, who's there, public photos
  function reportBlock(v) {
    const r = S.reportsAt(v.id);
    const ks = Object.keys(r);
    const can = S.canReport(v.id);
    if (!ks.length) return `<div class="reports empty"><span class="meta">No crowd reports in the last 90 minutes.</span>${can.ok ? `<button class="linkbtn" data-act="report" data-v="${v.id}">Report</button>` : ''}</div>`;
    const n = Math.max(...ks.map((k) => r[k].n)), last = Math.max(...ks.map((k) => r[k].last));
    return `<div class="reports">
      <div class="rgrid">${['crowd', 'queue', 'entry', 'vibe'].filter((k) => r[k]).map((k) => `<div><span>${k === 'vibe' ? 'Music' : S.REPORT_KINDS[k].label}</span><b>${esc(r[k].label)}</b></div>`).join('')}</div>
      <div class="rfoot"><span data-live="rep-${v.id}">${HOP.util.plural(n, 'report')} · Updated ${HOP.util.ago(last)}</span>${can.ok ? `<button class="linkbtn" data-act="report" data-v="${v.id}">Report</button>` : ''}</div></div>`;
  }
  function venueBody(v, been, act) {
    const now = HOP.now();
    const evs = HOP.events.atVenue(v.id).slice(0, 3);
    const live = act.liveHere;
    const fr = act.friends.filter((f) => !live.some((o) => o.id === f.outingId));
    const pub = S.venuePhotos(v.id);
    const tonight = [...act.tonightPhotos.slice().reverse().map((p) => ({ p, own: true })), ...pub.map((p) => ({ p, own: false }))];
    const mem = S.memoryPhotosAt(v.id);
    const hours = v.hours.replace('Open till', 'till');
    const area = HOP.activity.areaOfVenue(v);
    const areaNow = area && HOP.activity.areaInfo(area.id, 'now');
    const status = `${act.label.toUpperCase()}${act.trend === 'rising' ? ' · Activity rising' : act.trend === 'easing' ? ' · Easing off' : ''}`;
    const onNow = evs.find((e) => HOP.events.live(e));
    return `
      <div class="vhead2" data-drag>
        <div class="grow"><span class="cat">${HOP.map.catSvg(v.cat)} ${CAT[v.cat]} · ${esc(v.suburb)}${v.price ? ` · <span class="mono">${v.price}</span>` : ''}</span>
          <h2 class="h1">${esc(v.name)}</h2>
          <div class="busyline lv${act.lv}">${HOP.activity.meter(act.lv)}<b data-live="vs-${v.id}">${status}</b></div>
          <div class="vsub">${onNow ? `<b>${esc(onNow.title)} · On now</b> · ` : ''}${peakWords(v)} · ${esc(hours)} · ${HOP.util.walkMins(HOP.map.ME, v)} min walk</div>
          ${area ? `<button class="arealink" data-act="openArea" data-id="${area.id}">${esc(area.name)} · ${areaNow.level.toLowerCase()} now ${I('chev', 13)}</button>` : ''}</div>
        <span class="vthumb">${photoTag({ id: v.id, u: v.img }, 200)}</span>
      </div>
      ${live.map((o) => { const host = S.userById[o.organiserId]; const n = S.going(o.id).length; return `<button class="tl tlmain vlive" data-act="openOuting" data-id="${o.id}"><span class="lead live">${avatar(host, 34)}<i>${HOP.oicon(o)}</i></span>
        <div class="grow"><div class="t">${esc(host.first)}’s ${esc(o.title.replace(/^.*?'s /, ''))} is here</div><div class="s">${n} there · ${S.photosOf(o.id).length} photos</div></div>${I('chev')}</button>`; }).join('')}
      ${fr.length ? `<div class="herenow">${avatarStack(fr.map((f) => f.user), 4, 26)}<span><b>${esc(fr.slice(0, 2).map((f) => f.user.first).join(', '))}</b>${fr.length > 2 ? ` + ${fr.length - 2}` : ''} here · since ${HOP.util.hm(Math.min(...fr.map((f) => f.since)))}</span></div>` : ''}
      ${reportBlock(v)}
      ${tonight.length ? `<div class="section"><p class="label"><span>Recent · ${HOP.util.plural(tonight.length, 'photo')} tonight</span><span class="dim">${HOP.util.ago(Math.max(...tonight.map((x) => x.p.takenAt)))}</span></p>
        <div class="strip">${tonight.slice(0, 12).map(({ p, own }) => own
          ? `<button data-act="viewPhoto" data-id="${p.outingId}" data-p="${p.id}">${photoTag(p, 200, 250)}<span class="by">${avatar(S.userById[p.userId], 20)}</span></button>`
          : `<button data-act="viewPhoto" data-vp="${v.id}" data-p="${p.id}">${photoTag(p, 200, 250)}</button>`).join('')}</div></div>`
        : mem.length ? `<div class="section"><p class="label"><span>Your nights here · ${mem.length} photos</span></p>
        <div class="strip">${mem.slice(0, 12).map((p) => `<button data-act="viewPhoto" data-id="${p.outingId}" data-p="${p.id}">${photoTag(p, 200, 250)}</button>`).join('')}</div></div>` : ''}
      ${evs.length ? `<div class="section"><p class="label">On here</p><div class="rows">${evs.map((e) => HOP.eventRow(e, { noPlace: true })).join('')}</div></div>` : ''}
      ${been.length ? `<div class="friends-been">${avatarStack(been, 4, 26)} <span>${esc(been.slice(0, 2).map((u) => u.first).join(', '))}${been.length > 2 ? ` and ${been.length - 2} others` : ''} have been here with you recently</span></div>` : ''}
      <div style="height:12px"></div>`;
  }

  HOP.screens.venue = {
    nav: 'home', mapMode: 'default',
    render({ id }) {
      const v = S.venueById[id];
      const picking = HOP.app.picking && S.outing(HOP.app.picking);
      const been = friendsBeen(v);
      const act = S.activity(v.id);
      let actions = '';
      if (picking) {
        const stops = S.stopsOf(picking.id);
        const existing = stops.find((s) => s.venueId === v.id);
        const at = stops.length ? stops[stops.length - 1].at + 90 * 6e4 : picking.startsAt;
        actions = existing
          ? `<button class="btn block" data-act="removeStop" data-id="${existing.id}">${I('trash', 18)} Remove from ${esc(picking.title)}</button>`
          : `${(() => { const ar = HOP.activity.areaOfVenue(v); if (!ar) return ''; const l = HOP.activity.levelAt(ar.id, at); return `<p class="ctxline">${HOP.activity.meter(l.lv)}${esc(ar.name)} expected ${l.level.toLowerCase()} around ${HOP.util.hm(at)}</p>`; })()}
            <button class="btn primary block" data-act="addStop" data-venue="${v.id}">${I('plus', 18)} Add as stop ${stops.length + 1} · ${timeShort(at)}</button>`;
        actions += `<button class="btn quiet block" data-act="donePicking">Back to ${esc(picking.title)}</button>`;
      } else {
        const mine = S.state.outings.filter((o) => o.organiserId === S.meId && o.status === 'planning');
        actions = mine.map((o) => {
          const has = S.stopsOf(o.id).some((s) => s.venueId === v.id);
          return has
            ? `<button class="btn block" data-act="openOuting" data-id="${o.id}">${I('check', 18)} Stop on ${esc(o.title)}</button>`
            : `<button class="btn primary block" data-act="addToOuting" data-outing="${o.id}" data-venue="${v.id}">${I('plus', 18)} Add to ${esc(o.title)}</button>`;
        }).join('');
        const isSaved = S.isSaved({ venueId: v.id });
        const can = S.canReport(v.id);
        if (!mine.length) actions += `<button class="btn primary block" data-act="startHere" data-venue="${v.id}">${I('plus', 18)} Add to an outing</button>`;
        actions += `<div class="btnrow three"><button class="btn ${isSaved ? 'savedbtn' : ''}" data-act="saveTo" data-v="${v.id}">${isSaved ? I('check', 17) + ' Saved' : I('bookmark', 17) + ' Save'}</button>
          <button class="btn" data-act="sendToOuting" data-v="${v.id}">${I('send', 17)} Share</button>
          <button class="btn ${can.ok ? '' : 'off'}" data-act="report" data-v="${v.id}" ${can.ok ? '' : `aria-disabled="true" title="${esc(can.why)}"`}>${I('flag', 17)} Report</button></div>
          ${mine.length ? `<button class="linkbtn startlink" data-act="startHere" data-venue="${v.id}">${I('plus', 15)} Start a new outing here</button>` : ''}`;
      }
      return {
        top: picking ? pickTop(picking) : searchTop(),
        sizes: ['auto', 'full'],
        sheet: venueBody(v, been, act) + `<div class="addto">${actions}</div><p class="meta vaddr">${esc(v.address)}, ${esc(v.suburb)} · ${esc(v.blurb)}</p>`,

        map() {
          HOP.map.setSelected(v.id);
          HOP.map.focus(v, picking ? HOP.map.leaflet.getZoom() : Math.max(HOP.map.leaflet.getZoom(), 16));
          if (picking) HOP.map.showRoute(picking.id, 'plan', { fit: false });
        },
      };
    },
    mount() { bindSearch(); },
  };

  // ---------------- PICK MODE (adding stops on the map) ----------------
  function pickTop(o) {
    return `<div class="searchrow">
      <label class="search">${I('search')}<input id="q" type="search" autocomplete="off" placeholder="Search a venue to add" value="${esc(query)}"></label>
      <button class="me-btn" data-act="donePicking" aria-label="Done">${I('check', 22)}</button></div>
      <div class="filters"><button class="wo" data-act="savedLists">${I('bookmark', 13)}Saved</button><span class="fsep"></span>${FILTERS.map(([k, l]) => `<button data-act="filter" data-f="${k}" class="${filter === k ? 'on' : ''}">${k !== 'all' ? HOP.map.catSvg(k) : ''}${l}</button>`).join('')}</div>`;
  }
  HOP.screens.pick = {
    nav: null, mapMode: 'pick',
    render({ id, fit }) {
      const o = S.outing(id);
      const stops = S.stopsOf(id);
      const sheet = HOP.app.searching
        ? `<div class="section" style="padding-top:4px"><p class="label">Tap one to add it</p><div class="rows" id="results">${results()}</div></div>`
        : `<div class="pickbar" data-drag>
            <div class="grow"><p class="label">Adding stops · ${esc(o.title)}</p>
            <div class="h2" style="margin-top:4px">${stops.length ? 'Tap another venue, or you’re done' : 'Tap a venue on the map'}</div></div>
            <button class="btn primary sm" data-act="donePicking">Done</button></div>
            ${stops.length ? `<div class="pickchips">${stops.map((s, i) => `<span><b>${i + 1}</b>${esc(S.stopName(s))}</span>`).join('')}</div>` : ''}`;
      return {
        top: pickTop(o), sheet, sizes: HOP.app.searching ? ['half', 'full'] : ['auto', 'half'],
        map() {
          HOP.map.setSelected(null); HOP.map.clearOutingPins();
          HOP.map.showRoute(id, 'plan', { fit: false });
          // keep the whole route in view as it grows, with room around it to spot the next stop
          if (stops.length > 1) HOP.map.fitTo(stops.map((s) => S.placeOf(s)), { maxZoom: 15.75 });
          else HOP.map.focus(stops[0] ? S.placeOf(stops[0]) : HOP.map.ME, Math.min(HOP.map.leaflet.getZoom(), 15.5));
        },
      };
    },
    mount() { bindSearch(); },
    refreshSheetOnly: true,
  };

  // ---------------- OUTINGS TAB ----------------
  function orow(o) {
    const st = S.stopsOf(o.id).map((s) => S.stopName(s));
    return `<button class="orow" data-act="${o.status === 'live' ? 'openLive' : 'openOuting'}" data-id="${o.id}">
      <span class="emo">${o.cover ? photoTag({ id: o.id, src: o.cover }, 120) : HOP.oicon(o, 26)}</span>
      <div class="grow"><div class="t">${esc(o.title)}</div>
        <div class="when">${o.status === 'live' ? '<span class="livepill">LIVE NOW</span>' : when(o.startsAt)}</div>
        <div class="s">${st.length ? esc(st.join(' → ')) : 'No stops yet'}</div>
        <div class="s">${HOP.goingLine(o)} · ${HOP.util.plural(S.stopsOf(o.id).length, 'stop')}${o.visibility === 'public' ? ' · Public' : ''}</div>
        ${HOP.lastLine(o)}</div>
      ${S.canChat(o) && S.unread(o.id) ? `<span class="unread">${S.unread(o.id)}<em>unread</em></span>` : HOP.routeMini(o.id)}</button>`;
  }
  HOP.orow = orow;
  // "Jack: Where are you guys? · 2m" under an outing, so a glance shows what's moving
  HOP.lastLine = (o) => {
    if (!S.canChat(o)) return '';
    const m = S.lastMessage(o.id);
    if (!m) return '';
    const fresh = S.unread(o.id) > 0;
    return `<div class="lastmsg ${fresh ? 'fresh' : ''}" data-act="openChat" data-id="${o.id}"><span>${esc(HOP.chatPreview(m))}</span><time>${HOP.util.ago(m.at)}</time></div>`;
  };

  HOP.screens.outings = {
    nav: 'outings', mapMode: 'default',
    render() {
      const { live, invites, upcoming } = S.myOutings();
      const pub = S.publicOutings().filter((o) => !S.myAttendance(o.id));
      const sheet = `
        <div style="display:flex;align-items:center;justify-content:space-between;padding-top:4px" data-drag><h1 class="h1">Outings</h1><button class="btn primary sm" data-go="create">${I('plus', 16)} New</button></div>
        ${live.length ? `<div class="section"><p class="label">Happening now</p>${live.map(orow).join('')}</div>` : ''}
        ${invites.length ? `<div class="section"><p class="label">Waiting on you</p>${invites.map((o) => {
          const org = S.userById[o.organiserId];
          return `<div class="invite"><div class="from">${avatar(org, 22)} ${esc(org.first)} invited you</div>${orow(o).replace('class="orow"', 'class="orow" style="border:0;padding-top:0"')}
            ${rsvpSeg(o)}</div>`;
        }).join('')}</div>` : ''}
        <div class="section"><p class="label">Coming up</p>${upcoming.length ? upcoming.map(orow).join('') : `<p class="empty">Nothing planned. Start one from the map.</p>`}</div>
        ${pub.length ? `<div class="section"><p class="label">Public near you</p>${pub.map(orow).join('')}</div>` : ''}`;
      return {
        top: '', sheet, sizes: ['full'],
        map() { HOP.map.setSelected(null); HOP.map.showRoute(null); HOP.map.showOutingPins([...live, ...upcoming, ...invites]); },
      };
    },
  };

  function rsvpSeg(o) {
    const a = S.myAttendance(o.id);
    const v = a ? a.rsvp : 'invited';
    return `<div class="seg" role="radiogroup" aria-label="Are you going?">${[['going', 'Going'], ['maybe', 'Maybe'], ['declined', 'Can’t go']].map(([k, l]) => `<button role="radio" aria-checked="${v === k}" data-act="rsvp" data-id="${o.id}" data-v="${k}" class="${v === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  }
  HOP.rsvpSeg = rsvpSeg;
})();
