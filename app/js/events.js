/* HOP — Public Events.
   Events are things anyone can discover (club nights, gigs, markets, run clubs…), as opposed
   to Outings, which friends create. Every event is normalised to one shape so it can come from:
     1. 'seed'   — the demo data below (today)
     2. 'feed'   — an external listings feed (later: ticketing / what's-on APIs)
     3. 'venue'  — published directly by a verified venue (later: business accounts, deals, promotion)
   Add a source to HOP.events.sources and the map, What's on and outing planning all pick it up. */

HOP.events = (() => {
  const CATS = {
    club: { label: 'Club night', groups: ['nightlife', 'music'] },
    live: { label: 'Live music', groups: ['music'] },
    dj: { label: 'DJ set', groups: ['music', 'nightlife'] },
    pub: { label: 'Pub event', groups: ['nightlife'] },
    trivia: { label: 'Trivia', groups: ['nightlife'] },
    happyhour: { label: 'Happy hour', groups: ['nightlife', 'food'] },
    festival: { label: 'Festival', groups: ['music', 'food'] },
    market: { label: 'Market', groups: ['food'] },
    run: { label: 'Run club', groups: ['sport'] },
    comedy: { label: 'Comedy', groups: ['nightlife', 'comedy'] },
    exhibition: { label: 'Exhibition', groups: [] },
    sport: { label: 'Sports screening', groups: ['sport'] },
    food: { label: 'Food event', groups: ['food'] },
  };
  const GLYPH = {
    club: '<path d="M4 12h2M8 8v8M12 5v14M16 9v6M20 12h-.5"/>',
    dj: '<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="2"/>',
    live: '<path d="M9 18V6l10-2v12"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="16" r="2"/>',
    festival: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    pub: '<path d="M7 5h9v13a2 2 0 01-2 2H9a2 2 0 01-2-2zM16 8h1.5a2 2 0 012 2v3a2 2 0 01-2 2H16"/>',
    trivia: '<path d="M9 9a3 3 0 115 2.2c-1.2.8-2 1.5-2 2.8M12 17.5v.5"/>',
    happyhour: '<path d="M5 5h14l-7 8zM12 13v6M8.5 19.5h7"/>',
    market: '<path d="M5 8h14l-1 12H6zM9 8V6a3 3 0 016 0v2"/>',
    run: '<circle cx="13" cy="4.5" r="1.8"/><path d="M10 21l2-6.5 2.5 2.5V21M8 12l2-4.5 3.5 1 2.5 3.5M12 14.5L10.5 9"/>',
    comedy: '<rect x="9" y="3.5" width="6" height="10" rx="3"/><path d="M6 11a6 6 0 0012 0M12 17v3.5"/>',
    exhibition: '<rect x="4" y="5" width="16" height="14" rx="1"/><path d="M4 15l4.5-4 4 3.5 3-2.5L20 15"/>',
    sport: '<circle cx="12" cy="12" r="8"/><path d="M12 4v16M4 12h16"/>',
    food: '<path d="M7 4v7a2 2 0 002 2v7M11 4v7M9 4v5M16 20V4c-2 1.5-2.5 4-2.5 7H16"/>',
  };
  const svg = (cat, size = 12) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">${GLYPH[cat] || GLYPH.festival}</svg>`;

  function normalize(raw, source) {
    return {
      id: raw.id, title: raw.title, cat: raw.cat,
      venueId: raw.venueId || null, place: raw.place || null, // place = { name, suburb, lat, lng } for parks, streets, foreshores
      startsAt: raw.startsAt, endsAt: raw.endsAt || raw.startsAt + 3 * 36e5,
      price: raw.price || 0, priceLabel: raw.priceLabel || (raw.price ? `$${raw.price}` : 'Free'),
      genre: raw.genre || CATS[raw.cat]?.label || '', blurb: raw.blurb || '', img: raw.img ? { id: raw.img } : null,
      interested: raw.interested || 0, friendIds: raw.friendIds || [],
      publisher: raw.publisher || { type: source.id === 'seed' ? 'feed' : source.id, name: source.name, verified: false },
      deal: raw.deal || null, promoted: false, recurs: raw.recurs || null, ticketUrl: raw.ticketUrl || null,
      source: source.id,
    };
  }

  // ---- sources ---------------------------------------------------------------
  const sources = [
    { id: 'seed', name: 'HOP picks', load: (now) => HOP.seed.events(now) },
    // { id: 'feed', name: 'What’s On Sydney', load: async (now) => (await fetch('/api/events?near=sydney')).json() },
    // { id: 'venue', name: 'Verified venues', load: async () => … }  // venues publishing directly
  ];
  const loadAll = (now) => sources.flatMap((src) => (src.load(now) || []).map((r) => normalize(r, src)));

  // ---- queries ---------------------------------------------------------------
  const S = () => HOP.store;
  const all = () => S().state.events || [];
  const byId = (id) => all().find((e) => e.id === id);
  const placeOf = (e) => (e.venueId ? S().venueById[e.venueId] : e.place);
  const live = (e, now = HOP.now()) => e.startsAt <= now && e.endsAt > now;
  const upcoming = (now = HOP.now()) => all().filter((e) => e.endsAt > now).sort((a, b) => a.startsAt - b.startsAt);

  function dayKey(ts) { const d = new Date(ts - 5 * 36e5); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); }
  // when: tonight | tomorrow | weekend | any   ·   group: music | nightlife | food | sport | free | null
  function filter({ when = 'tonight', group = null } = {}, now = HOP.now()) {
    const today = dayKey(now);
    return upcoming(now).filter((e) => {
      const k = dayKey(e.startsAt), days = Math.round((k - today) / 864e5);
      if (when === 'tonight' && days !== 0) return false;
      if (when === 'tomorrow' && days !== 1) return false;
      if (when === 'weekend') { const dow = new Date(k).getDay(); if (days > 6 || ![5, 6, 0].includes(dow) || (days === 0 && false)) return false; }
      if (group === 'free') return !e.price;
      if (group) return CATS[e.cat]?.groups.includes(group);
      return true;
    });
  }
  const atVenue = (venueId, now = HOP.now()) => upcoming(now).filter((e) => e.venueId === venueId);
  const tonightAt = (venueId, now = HOP.now()) => atVenue(venueId, now).filter((e) => dayKey(e.startsAt) === dayKey(now));

  function toggleInterest(id) {
    const e = byId(id);
    const me = S().meId;
    const on = e.friendIds.includes(me);
    e.friendIds = on ? e.friendIds.filter((x) => x !== me) : [me, ...e.friendIds];
    e.interested += on ? -1 : 1;
    S().touch('event:interest', { id });
    return !on;
  }

  return { CATS, svg, normalize, sources, loadAll, all, byId, placeOf, live, upcoming, filter, atVenue, tonightAt, toggleInterest, dayKey };
})();
