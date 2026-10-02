/* HOP — the map. Leaflet + Esri Dark Gray tiles (no API key), with a hand-drawn vector fallback
   (main streets, parks, harbour) so the map still reads offline or when tiles are blocked. */

HOP.map = (() => {
  const { esc, metres, timeShort, photoTag, avatar, hm } = HOP.util;
  const S = () => HOP.store;
  const EV = () => HOP.events;
  let map, venueLayer, routeLayer, extraLayer, meMarker, eventLayer, friendLayer, clusterLayer, popLayer, mapEl;
  let onEvent = () => {};
  let mode = 'default';          // default | events | focus | pick
  let eventList = null;          // events shown in What's on mode
  let insets = { top: 120, bottom: 220, left: 0, right: 0 };
  let onVenue = () => {}, onOuting = () => {}, onBlank = () => {};
  let filter = 'all';
  let hiddenVenues = new Set();
  let pinnedVenues = new Set();
  let selected = null;
  const markers = {};
  const ME = { lat: -33.8846, lng: 151.2116 }; // demo location: Surry Hills

  const glyph = {
    pub: '<path d="M7 5h9v13a2 2 0 01-2 2H9a2 2 0 01-2-2zM16 8h1.5a2 2 0 012 2v3a2 2 0 01-2 2H16M7 9h9"/>',
    bar: '<path d="M5 5h14l-7 8zM12 13v6M8.5 19.5h7"/>',
    club: '<path d="M4 12h2M8 8v8M12 5v14M16 9v6M20 12h-.5"/>',
    food: '<path d="M7 4v7a2 2 0 002 2v7M11 4v7M9 4v5M16 20V4c-2 1.5-2.5 4-2.5 7H16"/>',
    gig: '<path d="M9 18V6l10-2v12"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="16" r="2"/>',
    spot: '<path d="M12 4l2.3 5 5.2.5-4 3.5 1.2 5.2L12 15.5 7.3 18.2l1.2-5.2-4-3.5 5.2-.5z"/>',
  };
  const catSvg = (cat) => `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${glyph[cat] || glyph.spot}</svg>`;

  function init(el) {
    map = L.map(el, { zoomControl: false, attributionControl: true, minZoom: 11, maxZoom: 19, zoomSnap: 0.25, tap: true, worldCopyJump: false })
      .setView([-33.8815, 151.2125], 15.25);
    map.attributionControl.setPrefix(false);
    map.createPane('base'); map.getPane('base').style.zIndex = 250;
    map.createPane('route'); map.getPane('route').style.zIndex = 640;

    // Esri Dark Gray Canvas: free to use without an API key (CARTO's basemaps now need one)
    const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/';
    const tiles = L.tileLayer(ESRI + 'World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      maxNativeZoom: 16, maxZoom: 19, attribution: 'Esri, HERE, Garmin, © OpenStreetMap contributors',
    }).addTo(map);
    map.createPane('labels'); map.getPane('labels').style.zIndex = 300; map.getPane('labels').style.pointerEvents = 'none';
    L.tileLayer(ESRI + 'World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', { pane: 'labels', maxNativeZoom: 16, maxZoom: 19 }).addTo(map);
    let loaded = 0, failed = 0;
    tiles.on('tileload', () => { loaded++; document.body.classList.remove('no-tiles'); });
    tiles.on('tileerror', () => { failed++; if (!loaded && failed > 3) fallback(); });
    setTimeout(() => { if (!loaded) fallback(); }, 3500);

    map.createPane('people'); map.getPane('people').style.zIndex = 630;
    map.createPane('heat'); map.getPane('heat').style.zIndex = 280; map.getPane('heat').style.pointerEvents = 'none';
    map.createPane('pops'); map.getPane('pops').style.zIndex = 660; map.getPane('pops').style.pointerEvents = 'none';
    clusterLayer = L.layerGroup().addTo(map);
    venueLayer = L.layerGroup().addTo(map);
    eventLayer = L.layerGroup().addTo(map);
    friendLayer = L.layerGroup().addTo(map);
    extraLayer = L.layerGroup().addTo(map);
    routeLayer = L.layerGroup().addTo(map);
    popLayer = L.layerGroup().addTo(map);
    mapEl = el;

    meMarker = L.marker([ME.lat, ME.lng], { icon: L.divIcon({ className: '', html: '<div class="me-dot"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }), interactive: false, keyboard: false }).addTo(map);

    drawVenues();
    setHeat(heatOn);
    refreshLive();
    let lastFar = null;
    map.on('zoomend', () => { zoomClasses(); declutter(); });
    // Tapping an active part of the heat opens that area's sheet (why it's busy)
    map.on('click', (e) => {
      if (heatOn && mode === 'default' && map.getZoom() < 16.3) { const a = HOP.activity.areaAt({ lat: e.latlng.lat, lng: e.latlng.lng }, heatWhen); if (a) { onArea(a.id); return; } }
      onBlank();
    });
    map.on('moveend', () => declutter());
    zoomClasses();
  }

  // Progressive reveal: suburbs when zoomed out → busy places, friends and events → every venue → names and status
  function zoomClasses() {
    const z = map.getZoom();
    // far: neighbourhoods · area: + friend groups, major events · mid: + busy/friend venues · near: every venue
    mapEl.classList.toggle('z-far', z < 13.2);
    mapEl.classList.toggle('z-area', z >= 13.2 && z < 14.5);
    mapEl.classList.toggle('z-mid', z >= 14.5 && z < 15.4);
    mapEl.classList.toggle('z-labels', z >= 16.3);
    mapEl.classList.toggle('z-elabels', z >= 15.3);
  }
  function setMode(m, list) {
    mode = m; eventList = list || null;
    ['default', 'events', 'focus', 'pick'].forEach((k) => mapEl.classList.toggle('mode-' + k, k === m));
    drawEvents();
  }

  // ---- Vector fallback base map --------------------------------------------
  let fellBack = false;
  function fallback() {
    if (fellBack) return; fellBack = true;
    document.body.classList.add('no-tiles');
    const water = [
      [[-33.845, 151.17], [-33.858, 151.198], [-33.870, 151.1985], [-33.876, 151.201], [-33.877, 151.202], [-33.871, 151.2015], [-33.864, 151.203], [-33.8605, 151.2065], [-33.8615, 151.2105], [-33.8575, 151.214], [-33.860, 151.217], [-33.865, 151.219], [-33.8605, 151.223], [-33.864, 151.2222], [-33.869, 151.2228], [-33.866, 151.226], [-33.870, 151.229], [-33.874, 151.231], [-33.871, 151.237], [-33.845, 151.245]],
      [[-33.86, 151.30], [-33.886, 151.282], [-33.8885, 151.2795], [-33.8908, 151.2762], [-33.8945, 151.2752], [-33.900, 151.277], [-33.93, 151.30]],
    ];
    const parks = [
      [[-33.8695, 151.2100], [-33.8695, 151.2125], [-33.8785, 151.2120], [-33.8785, 151.2095]],
      [[-33.8605, 151.2125], [-33.8600, 151.2210], [-33.8690, 151.2215], [-33.8705, 151.2140]],
      [[-33.8880, 151.2185], [-33.8885, 151.2250], [-33.9020, 151.2290], [-33.9030, 151.2180]],
      [[-33.8930, 151.2300], [-33.8930, 151.2420], [-33.9050, 151.2420], [-33.9050, 151.2310]],
      [[-33.8865, 151.2025], [-33.8865, 151.2060], [-33.8905, 151.2060], [-33.8905, 151.2025]],
      [[-33.8850, 151.1900], [-33.8850, 151.1940], [-33.8885, 151.1940], [-33.8885, 151.1900]],
      [[-33.8945, 151.1800], [-33.8945, 151.1835], [-33.8965, 151.1835], [-33.8965, 151.1800]],
    ];
    const major = [
      [[-33.8610, 151.2075], [-33.8680, 151.2070], [-33.8740, 151.2065], [-33.8790, 151.2058], [-33.8838, 151.2040], [-33.8840, 151.2010], [-33.8838, 151.1985], [-33.8845, 151.1950], [-33.8862, 151.1900], [-33.8875, 151.1830], [-33.8850, 151.1720]],
      [[-33.8650, 151.2110], [-33.8730, 151.2105], [-33.8800, 151.2098], [-33.8860, 151.2085], [-33.8930, 151.2070], [-33.9000, 151.2065]],
      [[-33.8775, 151.2110], [-33.8785, 151.2150], [-33.8800, 151.2180], [-33.8812, 151.2195], [-33.8830, 151.2240], [-33.8860, 151.2300], [-33.8890, 151.2380]],
      [[-33.8810, 151.2195], [-33.8860, 151.2215], [-33.8920, 151.2240], [-33.9000, 151.2265], [-33.9100, 151.2280]],
      [[-33.8875, 151.1930], [-33.8890, 151.2000], [-33.8900, 151.2060], [-33.8915, 151.2130], [-33.8925, 151.2190], [-33.8940, 151.2260]],
      [[-33.8745, 151.2120], [-33.8748, 151.2170], [-33.8750, 151.2225], [-33.8720, 151.2240], [-33.8700, 151.2248]],
      [[-33.8845, 151.1960], [-33.8880, 151.1935], [-33.8910, 151.1905], [-33.8935, 151.1855], [-33.8960, 151.1815], [-33.8980, 151.1782], [-33.9020, 151.1755], [-33.9070, 151.1730]],
      [[-33.8840, 151.2205], [-33.8920, 151.2195], [-33.9050, 151.2150]],
    ];
    const minor = [
      [[-33.8745, 151.2150], [-33.8790, 151.2148], [-33.8840, 151.2136], [-33.8900, 151.2128], [-33.8960, 151.2120]],
      [[-33.8740, 151.2190], [-33.8800, 151.2178], [-33.8850, 151.2168], [-33.8920, 151.2150], [-33.9000, 151.2135]],
      [[-33.8800, 151.2210], [-33.8760, 151.2220], [-33.8700, 151.2232]],
      [[-33.8770, 151.2040], [-33.8775, 151.2110]], [[-33.8730, 151.2060], [-33.8735, 151.2110]],
      [[-33.8600, 151.2135], [-33.8700, 151.2125]], [[-33.8975, 151.1792], [-33.8990, 151.1755], [-33.9000, 151.1720]],
      [[-33.8850, 151.2010], [-33.8920, 151.2030], [-33.9000, 151.2040]],
      [[-33.8810, 151.2060], [-33.8815, 151.2140]], [[-33.8865, 151.2085], [-33.8870, 151.2200]],
    ];
    const rail = [[-33.8830, 151.2062], [-33.8890, 151.2020], [-33.8920, 151.1985], [-33.8950, 151.1880], [-33.8975, 151.1795], [-33.9030, 151.1700]];
    const base = { pane: 'base', interactive: false };
    water.forEach((p) => L.polygon(p, { ...base, stroke: false, className: 'f-water', fillOpacity: 1 }).addTo(map));
    parks.forEach((p) => L.polygon(p, { ...base, stroke: false, className: 'f-park', fillOpacity: 1 }).addTo(map));
    minor.forEach((p) => L.polyline(p, { ...base, className: 'f-road', weight: 3, opacity: 1 }).addTo(map));
    major.forEach((p) => L.polyline(p, { ...base, className: 'f-major', weight: 5, opacity: 1 }).addTo(map));
    L.polyline(rail, { ...base, className: 'f-rail', weight: 1.5, dashArray: '4 4' }).addTo(map);
    [['Surry Hills', -33.8862, 151.2105], ['Darlinghurst', -33.8772, 151.2195], ['Sydney', -33.8700, 151.2058], ['Newtown', -33.8952, 151.1835], ['Redfern', -33.8935, 151.2025], ['Chippendale', -33.8870, 151.1985], ['Potts Point', -33.8700, 151.2265], ['Paddington', -33.8848, 151.2305], ['Moore Park', -33.8965, 151.2225], ['Bondi', -33.8915, 151.2690], ['Enmore', -33.9000, 151.1740]]
      .forEach(([t, la, ln]) => L.marker([la, ln], { pane: 'base', interactive: false, keyboard: false, icon: L.divIcon({ className: 'suburb', html: esc(t).toUpperCase(), iconSize: [120, 14], iconAnchor: [60, 7] }) }).addTo(map));
  }

  // ---- Venues --------------------------------------------------------------
  // One pin, several states: popular tonight (warm ring), friends here (avatar), event tonight
  // (diamond badge), photos tonight (thumbnail), plus a status line when zoomed in.
  function venueHtml(v) {
    const act = S().activity(v.id);
    const evs = EV().tonightAt(v.id);
    const ph = act.tonightPhotos[act.tonightPhotos.length - 1];
    const f = act.friends;
    const stateful = act.hot || f.length || evs.length || ph;
    const status = [
      act.hot || f.length ? act.label : '',
      f.length ? `${f.length} ${f.length === 1 ? 'friend' : 'friends'}` : '',
      evs[0] ? `${evs[0].title.length > 22 ? EV().CATS[evs[0].cat].label : evs[0].title} ${hm(evs[0].startsAt)}` : '',
    ].filter(Boolean).join(' · ');
    return `<div class="vpin c-${v.cat} lv${act.lv}${act.hot ? ' hot' : ''}${stateful ? ' st' : ' plain'}" data-v="${v.id}">
      <span class="core">${catSvg(v.cat)}</span>
      ${f.length ? `<span class="vf">${avatar(f[0].user, 20)}${f.length > 1 ? `<b>+${f.length - 1}</b>` : ''}</span>` : ''}
      ${evs.length ? '<i class="vev"></i>' : ''}
      ${ph ? `<i class="vph">${photoTag(ph, 60)}</i>` : ''}
      <span class="vlabel"><b>${esc(v.name)}</b>${status ? `<em>${esc(status)}</em>` : ''}</span></div>`;
  }
  function drawVenues() {
    venueLayer.clearLayers();
    S().venues.forEach((v) => {
      const m = L.marker([v.lat, v.lng], {
        icon: L.divIcon({ className: '', html: venueHtml(v), iconSize: [28, 28], iconAnchor: [14, 14] }),
        riseOnHover: true, keyboard: true, title: v.name,
      });
      m.on('click', (e) => { L.DomEvent.stopPropagation(e); onVenue(v.id); });
      markers[v.id] = m;
    });
    applyVenueFilter();
  }
  function refreshVenues() {
    S().venues.forEach((v) => {
      const m = markers[v.id];
      const html = venueHtml(v);
      if (m && m._html !== html) { m._html = html; m.setIcon(L.divIcon({ className: '', html, iconSize: [28, 28], iconAnchor: [14, 14] })); }
    });
    setSelected(selected);
  }
  // Map lens: TONIGHT (everything) / FRIENDS / PLACES / EVENTS (the What's on screen)
  let lens = 'tonight', lensSub = null;
  function setLens(l, sub) {
    lens = l; lensSub = sub || null;
    ['tonight', 'friends', 'places'].forEach((k) => mapEl.classList.toggle('lens-' + k, k === l));
    ['out', 'outings', 'recent'].forEach((k) => mapEl.classList.toggle('sub-' + k, l === 'friends' && k === lensSub));
    filter = l === 'places' ? lensSub || 'all' : 'all';
    applyVenueFilter(); setTimeout(declutter, 30);
  }
  const isLate = (v) => /till ([1-5])\s?am/i.test(v.hours) || (HOP.seed.POP[v.id]?.[1] || 0) >= 23 || v.cat === 'club';
  const catOk = (v) => filter === 'all' || v.cat === filter || (filter === 'bar' && v.cat === 'gig') || (filter === 'late' && isLate(v));
  function lensOk(v) {
    if (lens !== 'friends' || mode !== 'default') return true;
    const a = S().activity(v.id);
    return lensSub === 'recent' ? a.tonightPhotos.length > 0 : a.friends.length > 0;
  }
  function applyVenueFilter() {
    S().venues.forEach((v) => {
      const show = !hiddenVenues.has(v.id) && !pinnedVenues.has(v.id) && !friendVenues.has(v.id) && catOk(v) && lensOk(v);
      const m = markers[v.id];
      if (show && !venueLayer.hasLayer(m)) venueLayer.addLayer(m);
      if (!show && venueLayer.hasLayer(m)) venueLayer.removeLayer(m);
    });
    setSelected(selected);
  }
  function setFilter(f) { filter = f; applyVenueFilter(); }
  function setSelected(id) {
    selected = id;
    document.querySelectorAll('.vpin.on,.evpin.on').forEach((n) => n.classList.remove('on'));
    if (id) { const n = document.querySelector(`.vpin[data-v="${id}"],.evpin[data-e="${id}"]`); if (n) n.classList.add('on'); }
  }

  // ---- Public events --------------------------------------------------------
  // Events at a venue show as a badge on that venue; events in parks/streets get their own diamond.
  // In What's on mode every listed event gets a diamond and venues step back.
  function drawEvents() {
    if (!eventLayer) return;
    const next = L.layerGroup();
    const now = HOP.now();
    const list = mode === 'events' && eventList ? eventList
      : mode === 'focus' ? [] : EV().filter({ when: 'tonight' });
    const seen = {};
    list.forEach((e) => {
      const p = EV().placeOf(e);
      if (!p) return;
      const k = `${p.lat},${p.lng}`; const n = (seen[k] = (seen[k] || 0) + 1) - 1; // fan out events sharing a spot
      const lat = p.lat + (mode === 'events' && e.venueId ? 0.00018 : 0) - n * 0.00028;
      const on = EV().live(e, now);
      const mins = Math.round((e.startsAt - now) / 6e4);
      const when = on ? 'On now' : mins <= 90 ? `Starts in ${mins < 60 ? mins + 'm' : '1h ' + (mins - 60) + 'm'}` : hm(e.startsAt);
      const major = e.interested >= 100 ? ' major' : '';
      const atv = e.venueId && mode !== 'events' ? ' atvenue' : '';
      const html = `<div class="evpin${on ? ' now' : ''}${major}${atv}" data-e="${e.id}"><span class="d">${EV().svg(e.cat, 12)}</span>
        <span class="elabel"><b>${esc(e.title)}</b><em data-live="ev-${e.id}">${when} · ${esc(e.priceLabel)}</em></span></div>`;
      const m = L.marker([lat, p.lng], { pane: 'people', icon: L.divIcon({ className: '', html, iconSize: [24, 24], iconAnchor: [12, 12] }), title: e.title, zIndexOffset: 200 });
      m.on('click', (ev) => { L.DomEvent.stopPropagation(ev); onEvent(e.id); });
      m.addTo(next);
    });
    applyVenueFilter();
    setTimeout(declutter, 30);
    eventLayer = swapLayer(eventLayer, next);
  }


  // ---- Friends' outings + suburb clusters ------------------------------------
  function drawFriendOutings() {
    const next = L.layerGroup();
    const mine = new Set(S().myOutings().live.concat(S().myOutings().upcoming).filter((o) => S().myAttendance(o.id)?.rsvp === 'going').map((o) => o.id));
    const list = S().tonightOutings().filter((o) => !mine.has(o.id));
    const hidden = new Set();
    list.forEach((o) => {
      const st = S().stopsOf(o.id);
      const s = o.status === 'live' ? st[o.live.current] : st[0];
      if (!s) return;
      const p = S().placeOf(s);
      if (s.venueId) hidden.add(s.venueId);
      const host = S().userById[o.organiserId];
      const n = S().going(o.id).length;
      const live = o.status === 'live';
      const sub = live ? `LIVE · ${p.name} · ${n} there` : `${hm(o.startsAt)} · ${p.name} · ${n} going`;
      const html = `<div class="fpin${live ? ' live' : ''}${o.visibility === 'public' && !S().myAttendance(o.id) ? ' pub' : ''}">${avatar(host, 32)}<span class="oe">${HOP.oicon(o)}</span>
        <span class="flabel"><b>${esc(host.first)}’s ${esc(o.title.replace(/^.*?'s /, ''))}</b><em>${esc(sub)}</em></span></div>`;
      const m = L.marker([p.lat, p.lng], { pane: 'people', icon: L.divIcon({ className: '', html, iconSize: [36, 36], iconAnchor: [18, 18] }), title: o.title, zIndexOffset: 800 });
      m.on('click', (e) => { L.DomEvent.stopPropagation(e); onOuting(o.id); });
      m.addTo(next);
    });
    friendVenues = hidden;
    friendLayer = swapLayer(friendLayer, next);
  }

  let friendVenues = new Set();

  // Rebuild a layer only when what it shows actually changed, so taps never land on a
  // marker that's being replaced and nothing flickers while the night updates.
  function swapLayer(old, next) {
    const sig = (g) => g ? g.getLayers().map((l) => (l.options.icon?.options.html || '') + (l.getLatLng ? l.getLatLng().toString() : '')).join('|') : null;
    if (old && sig(old) === sig(next)) return old;
    if (old) map.removeLayer(old);
    return next.addTo(map);
  }

  // ---- Neighbourhood energy ---------------------------------------------------
  // Zoomed out, each area says how alive it is, in words, plus who/what you can see there.
  let heatWhen = 'now', onArea = () => {};
  function drawAreas() {
    const next = L.layerGroup();
    HOP.activity.AREAS.forEach((a) => {
      const info = HOP.activity.areaInfo(a.id, heatWhen);
      const pub = HOP.activity.areaPublic(a.id, heatWhen);
      const fr = pub.friends;
      const n = pub.events.length;
      const quiet = info.lv === 0 && !fr.length && !n;
      const bits = [fr.length ? `${fr.length} ${fr.length === 1 ? 'friend' : 'friends'}` : '', n ? `${n} on` : ''].filter(Boolean).join(' · ');
      const html = `<button class="area lv${info.lv}${quiet ? ' quiet' : ''}" data-area="${a.id}" data-heat="${info.heat.toFixed(3)}">
        <b>${esc(a.name)}</b><em data-live="area-${a.id}">${esc(info.isNow ? info.level : `Expected ${info.level.toLowerCase()}`)}${info.isNow && info.trend === 'rising' ? ' · rising' : ''}</em>
        ${bits ? `<span class="ai">${fr.length ? `<span class="stack">${fr.slice(0, 3).map((f) => avatar(f.user, 16)).join('')}</span>` : ''}<span data-live="areab-${a.id}">${bits}</span></span>` : ''}</button>`;
      const m = L.marker([a.lat, a.lng], { pane: 'people', icon: L.divIcon({ className: '', html, iconSize: [10, 10], iconAnchor: [5, 5] }), keyboard: true, title: a.name, zIndexOffset: -200 });
      m.on('click', (e) => { L.DomEvent.stopPropagation(e); onArea(a.id); });
      m.addTo(next);
    });
    clusterLayer = swapLayer(clusterLayer, next);
  }


  // Friends grouped by place: "Jack + 4" with faces. Only friends who share or are on an outing you can see.
  let chipLayer = null;
  function drawFriendChips() {
    if (!chipLayer) chipLayer = L.layerGroup().addTo(map);
    const next = L.layerGroup();
    const groups = {};
    S().friendsOut().forEach((f) => { const k = f.venueId || 'e:' + f.eventId; (groups[k] ||= []).push(f); });
    Object.entries(groups).forEach(([k, fs]) => {
      if (friendVenues.has(k)) return; // a friend's outing marker already shows this group
      const p = k.startsWith('e:') ? EV().placeOf(EV().byId(k.slice(2))) : S().venueById[k];
      if (!p) return;
      fs.sort((a, b) => a.since - b.since);
      const lead = fs[0].user;
      const html = `<button class="fchip" data-k="${k}" data-n="${fs.length}">${`<span class="stack">${fs.slice(0, 3).map((f) => avatar(f.user, 22)).join('')}</span>`}<span><b>${esc(lead.first)}${fs.length > 1 ? ` + ${fs.length - 1}` : ''}</b><em>${esc(p.name)}</em></span></button>`;
      const m = L.marker([p.lat, p.lng], { pane: 'people', icon: L.divIcon({ className: '', html, iconSize: [10, 10], iconAnchor: [5, 5] }), title: `${lead.first} and friends` , zIndexOffset: 300 });
      m.on('click', (e) => { L.DomEvent.stopPropagation(e); if (!k.startsWith('e:')) onVenue(k); else onEvent(k.slice(2)); });
      m.addTo(next);
    });
    chipLayer = swapLayer(chipLayer, next);
  }


  // ---- Activity heat --------------------------------------------------------------
  // Area-level heat + public points only (see activity.js for the privacy rules).
  // Drawn under the street labels so it reads as part of the map, not a layer on top of it.
  let heatOn = true;
  try { heatOn = localStorage.getItem('hop.heat') !== '0'; } catch (e) {}
  const Heat = L.Layer.extend({
    onAdd(m) {
      this._c = L.DomUtil.create('canvas', 'heatcanvas', m.getPane('heat'));
      this._off = document.createElement('canvas');
      m.on('moveend zoomend resize', this.draw, this);
      this.draw();
    },
    onRemove(m) { m.off('moveend zoomend resize', this.draw, this); this._c.remove(); },
    // Semantic ramp: blue/cyan quiet -> green -> yellow -> orange -> red packed.
    // Bilinear-sampled from HOP.activity.cells(); nothing is drawn where there's no data.
    draw() {
      const m = this._map; if (!m) return;
      const size = m.getSize(), k = 0.25;
      const w = Math.max(1, Math.round(size.x * k)), h = Math.max(1, Math.round(size.y * k));
      const off = this._off; off.width = w; off.height = h;
      const ctx = off.getContext('2d');
      const res = HOP.activity.cells(heatWhen), G = res.grid, by = res.byKey;
      const nw = m.containerPointToLatLng([0, 0]), se = m.containerPointToLatLng([size.x, size.y]);
      const img = ctx.createImageData(w, h), d = img.data;
      const soft = res.forecast ? 0.72 : 1;
      const val = (j, i) => by[j + ':' + i] || 0;
      for (let y = 0; y < h; y++) {
        const lat = nw.lat + (se.lat - nw.lat) * ((y + 0.5) / h);
        const fj = (lat - G.lat0) / G.step; if (fj < 0 || fj >= res.ny) continue;
        const j = Math.floor(fj), dj = fj - j;
        for (let x = 0; x < w; x++) {
          const lng = nw.lng + (se.lng - nw.lng) * ((x + 0.5) / w);
          const fi = (lng - G.lng0) / G.step; if (fi < 0 || fi >= res.nx) continue;
          const i = Math.floor(fi), di = fi - i;
          const v = (val(j, i) * (1 - di) + val(j, i + 1) * di) * (1 - dj) + (val(j + 1, i) * (1 - di) + val(j + 1, i + 1) * di) * dj;
          if (v < 0.08) continue;
          const [r, g, b] = ramp(v);
          const o = (y * w + x) * 4;
          d[o] = r; d[o + 1] = g; d[o + 2] = b;
          // quiet is a faint wash; packed is clearly there but never opaque
          d[o + 3] = Math.min(1, (v - 0.08) / 0.12) * (0.05 + 0.4 * Math.min(1, v) ** 1.5) * soft * 255;
        }
      }
      ctx.putImageData(img, 0, 0);
      const c = this._c; c.width = size.x; c.height = size.y;
      c.style.width = size.x + 'px'; c.style.height = size.y + 'px';
      L.DomUtil.setPosition(c, m.containerPointToLayerPoint([0, 0]));
      const cx = c.getContext('2d'); cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = 'high'; cx.drawImage(off, 0, 0, size.x, size.y);
    },
  });
  // Level colours (match --lv0..--lv4 in the CSS)
  const RAMP = [[0.0, [63, 150, 232]], [0.25, [63, 182, 232]], [0.43, [62, 207, 142]], [0.6, [242, 210, 75]], [0.76, [255, 143, 46]], [0.92, [255, 68, 56]]];
  function ramp(v) {
    for (let n = 1; n < RAMP.length; n++) {
      if (v <= RAMP[n][0]) { const [a, ca] = RAMP[n - 1], [b, cb] = RAMP[n]; const t = (v - a) / (b - a); return [0, 1, 2].map((q) => ca[q] + (cb[q] - ca[q]) * t); }
    }
    return RAMP[RAMP.length - 1][1];
  }
  let heat = null;
  function setHeat(on, when) {
    if (when) heatWhen = when;
    heatOn = on;
    try { localStorage.setItem('hop.heat', on ? '1' : '0'); } catch (e) {}
    mapEl.classList.toggle('heat-on', on);
    if (on && !heat) heat = new Heat().addTo(map);
    else if (!on && heat) { map.removeLayer(heat); heat = null; }
    else if (heat) heat.draw();
    drawAreas();
  }

  // Everything that changes as the night goes on
  // Locations people chose to share in an outing chat (temporary, they expire)
  let locLayer = null;
  function drawLocations() {
    if (!locLayer) locLayer = L.layerGroup().addTo(map);
    const next = L.layerGroup();
    S().activeLocations().forEach((m) => {
      const u = S().userById[m.userId];
      const mins = Math.max(1, Math.round((HOP.now() - m.at) / 6e4));
      const html = `<div class="locpin">${avatar(u, 30)}<span class="loclabel"><b>${esc(u.first)}</b><em>shared ${mins}m ago · ${esc(S().outing(m.outingId).title)}</em></span></div>`;
      L.marker([m.loc.lat, m.loc.lng], { pane: 'people', icon: L.divIcon({ className: '', html, iconSize: [34, 34], iconAnchor: [17, 17] }), zIndexOffset: 900, title: `${u.first}’s location` }).addTo(next);
    });
    locLayer = swapLayer(locLayer, next);
  }

  function refreshLive() {
    drawLocations();
    drawFriendOutings();
    refreshVenues();
    drawEvents();
    drawAreas();
    drawFriendChips();
    if (heat) heat.draw();
    setTimeout(declutter, 40);
  }

  // A photo someone just took floats up from where they are
  function pop(p, photo, user) {
    if (!map || !p) return;
    if (!map.getBounds().pad(-0.05).contains([p.lat, p.lng])) return;
    const m = L.marker([p.lat, p.lng], { pane: 'pops', interactive: false, keyboard: false,
      icon: L.divIcon({ className: '', html: `<div class="pop">${photoTag(photo, 120)}${avatar(user, 20)}</div>`, iconSize: [48, 60], iconAnchor: [24, 72] }) });
    m.addTo(popLayer);
    setTimeout(() => popLayer.removeLayer(m), 4200);
  }

  // ---- Routes --------------------------------------------------------------
  // Gentle arc between two stops so the route reads as a journey, not a chart line
  function arc(a, b, bend = 0.18) {
    const pts = [];
    const mx = (a.lat + b.lat) / 2, my = (a.lng + b.lng) / 2;
    const dx = b.lat - a.lat, dy = b.lng - a.lng;
    const cx = mx - dy * bend, cy = my + dx * bend;
    for (let t = 0; t <= 1.0001; t += 1 / 24) {
      const u = 1 - t;
      pts.push([u * u * a.lat + 2 * u * t * cx + t * t * b.lat, u * u * a.lng + 2 * u * t * cy + t * t * b.lng]);
    }
    return pts;
  }

  /* mode: 'home' (faint preview) | 'plan' | 'live' | 'memory' */
  function showRoute(outingId, mode = 'plan', opts = {}) {
    routeLayer.clearLayers();
    hiddenVenues = new Set();
    if (!outingId) { applyVenueFilter(); return; }
    const o = S().outing(outingId);
    const stops = S().stopsOf(outingId);
    const cur = o.live ? o.live.current : -1;
    stops.forEach((s) => s.venueId && hiddenVenues.add(s.venueId));
    applyVenueFilter();

    const pts = stops.map((s) => S().placeOf(s));
    for (let i = 0; i < pts.length - 1; i++) {
      const line = arc(pts[i], pts[i + 1]);
      const done = mode === 'live' && i < cur;
      const ahead = mode === 'live' && i > cur;
      L.polyline(line, { pane: 'route', className: 'r-casing', weight: mode === 'home' ? 5 : 8, opacity: 1, interactive: false, lineCap: 'round' }).addTo(routeLayer);
      L.polyline(line, {
        pane: 'route', interactive: false, lineCap: 'round',
        className: done ? 'r-done' : 'r-line', weight: mode === 'home' ? 2.5 : 4,
        opacity: mode === 'home' ? 0.75 : 1, dashArray: ahead || mode === 'home' ? '1 9' : null,
      }).addTo(routeLayer);
      // direction chevron at the arc midpoint
      if (mode !== 'home') {
        const m = line[12], n = line[13];
        const ang = (Math.atan2(-(n[0] - m[0]), n[1] - m[1]) * 180) / Math.PI;
        L.marker(m, { pane: 'route', interactive: false, keyboard: false, icon: L.divIcon({ className: '', html: `<div class="chev ${done ? 'done' : ''}" style="transform:rotate(${ang}deg)"></div>`, iconSize: [12, 12], iconAnchor: [6, 6] }) }).addTo(routeLayer);
      }
    }

    stops.forEach((s, i) => {
      const p = S().placeOf(s);
      let html, size = [30, 30], anchor = [15, 15];
      const label = `<span class="slabel${s.eventId ? ' ev' : ''}"><b>${esc(S().stopName(s))}</b><em>${timeShort(s.at)}${s.eventId ? ` · ${esc(p.name)}` : ''}</em></span>`;
      if (mode === 'memory') {
        const ph = S().photosOf(outingId, s.id);
        html = `<div class="spin photo">${ph.length ? photoTag(ph[Math.floor(ph.length / 2)], 120) : ''}<b class="n">${i + 1}</b>${ph.length ? `<span class="pc">${ph.length}</span>` : ''}${label}</div>`;
        size = [46, 46]; anchor = [23, 23];
      } else if (mode === 'live') {
        const state = i < cur ? 'done' : i === cur ? 'now' : i === cur + 1 ? 'next' : 'later';
        const tag = state === 'now' ? '<i class="tag">NOW</i>' : state === 'next' ? '<i class="tag">NEXT</i>' : '';
        html = `<div class="spin ${state}"><b class="n">${state === 'done' ? HOP.icon('check', 14) : i + 1}</b>${tag}${label}</div>`;
      } else {
        html = `<div class="spin ${mode === 'home' ? 'mini' : ''}"><b class="n">${i + 1}</b>${mode === 'home' && i > 0 && i < stops.length - 1 ? '' : label}</div>`;
        if (mode === 'home') { size = [22, 22]; anchor = [11, 11]; }
      }
      const mk = L.marker([p.lat, p.lng], { pane: 'route', icon: L.divIcon({ className: '', html, iconSize: size, iconAnchor: anchor }), keyboard: true, title: p.name, zIndexOffset: 1000 - i });
      mk.on('click', (e) => { L.DomEvent.stopPropagation(e); if (mode === 'home') onOuting(outingId); else if (s.venueId) onVenue(s.venueId, { stopId: s.id }); });
      mk.addTo(routeLayer);
    });

    if (opts.fit !== false && pts.length) fitTo(pts, opts);
    setTimeout(declutter, 50);
  }

  // Hide stop labels that would overlap an earlier one (stop order wins)
  function declutter() {
    const kept = [];
    // visual priority: your route → friends' outings → busiest neighbourhoods → friend groups → events
    const q = (sel) => [...document.querySelectorAll(sel)];
    const areas = q('.leaflet-pane .area').sort((a, b) => (+b.dataset.heat || 0) - (+a.dataset.heat || 0));
    const chips = q('.leaflet-pane .fchip').sort((a, b) => (+b.dataset.n || 0) - (+a.dataset.n || 0));
    [...q('.leaflet-pane .slabel'), ...areas.filter((x) => +x.dataset.heat >= 0.5), ...q('.leaflet-pane .fpin > .av'), ...q('.leaflet-pane .flabel'), ...areas.filter((x) => +x.dataset.heat < 0.5), ...chips, ...q('.leaflet-pane .elabel')].forEach((el) => {
      el.classList.remove('hid');
      if (el.offsetParent === null) return;
      const r = el.getBoundingClientRect();
      const hit = kept.some((k) => r.left < k.right && r.right > k.left && r.top < k.bottom && r.bottom > k.top);
      if (hit) el.classList.add('hid'); else kept.push(r);
    });
  }

  // Public outings + other outings' first stops on the home map
  function showOutingPins(list) {
    extraLayer.clearLayers();
    pinnedVenues = new Set(list.map((o) => S().stopsOf(o.id)[0]?.venueId).filter(Boolean));
    applyVenueFilter();
    list.forEach((o) => {
      const s = S().stopsOf(o.id)[0];
      if (!s) return;
      const p = S().placeOf(s);
      const html = `<div class="opin ${o.visibility}"><span class="e">${HOP.oicon(o)}</span><span class="t"><b>${esc(o.title)}</b><em>${HOP.util.dayDate(o.startsAt).split(' ')[0]} ${timeShort(o.startsAt)}</em></span></div>`;
      const m = L.marker([p.lat, p.lng], { pane: 'route', icon: L.divIcon({ className: '', html, iconSize: [34, 34], iconAnchor: [17, 40] }), zIndexOffset: 500 });
      m.on('click', (e) => { L.DomEvent.stopPropagation(e); onOuting(o.id); });
      m.addTo(extraLayer);
    });
  }
  const clearOutingPins = () => { extraLayer.clearLayers(); pinnedVenues = new Set(); applyVenueFilter(); };

  // ---- Camera --------------------------------------------------------------
  function setInsets(i) { insets = { ...insets, ...i }; }
  function pad() {
    return { paddingTopLeft: [insets.left + 40, insets.top + 30], paddingBottomRight: [insets.right + 120, insets.bottom + 30] };
  }
  function fitTo(points, opts = {}) {
    if (!points.length) return;
    if (points.length === 1) return focus(points[0], opts.zoom || 16);
    map.flyToBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), { ...pad(), maxZoom: opts.maxZoom || 16.5, duration: opts.instant ? 0.01 : 0.7 });
  }
  // Centre a point inside the visible area (between the top bar and the sheet)
  function focus(p, zoom) {
    const z = zoom || Math.max(map.getZoom(), 15.5);
    const size = map.getSize();
    const visibleCentreY = insets.top + (size.y - insets.top - insets.bottom) / 2;
    const visibleCentreX = insets.left + (size.x - insets.left - insets.right) / 2;
    const offset = L.point(size.x / 2 - visibleCentreX, size.y / 2 - visibleCentreY);
    const target = map.unproject(map.project([p.lat, p.lng], z).add(offset), z);
    map.flyTo(target, z, { duration: 0.6 });
  }
  function locate() { focus(ME, 15.5); }
  const invalidate = () => map && map.invalidateSize();

  return {
    init, setFilter, setLens, get lens() { return lens; }, get lensSub() { return lensSub; }, setSelected, setMode, refreshLive, pop, setHeat, get heatOn() { return heatOn; }, get heatWhen() { return heatWhen; }, onArea: (fn) => (onArea = fn), get mode() { return mode; }, onEvent: (fn) => (onEvent = fn), showRoute, showOutingPins, clearOutingPins, fitTo, focus, locate, setInsets, invalidate,
    get leaflet() { return map; }, ME,
    onVenue: (fn) => (onVenue = fn), onOuting: (fn) => (onOuting = fn), onBlank: (fn) => (onBlank = fn),
    distanceFromMe: (p) => metres(ME, p), catSvg,
  };
})();
