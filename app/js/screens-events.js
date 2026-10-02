/* HOP — Public events: What's on (from the map), the event sheet, and turning an event into a night out */
(() => {
  const { esc, avatar, avatarStack, photoTag, eventWhen, hm, plural, dayDate, longDate, timeShort } = HOP.util;
  const I = HOP.icon;
  const S = HOP.store;
  const EV = HOP.events;
  const ui = HOP.ui;

  const WHEN = [['tonight', 'Tonight'], ['tomorrow', 'Tomorrow'], ['weekend', 'This weekend']];
  const GROUP = [['music', 'Music'], ['comedy', 'Comedy'], ['sport', 'Sport'], ['nightlife', 'Nightlife'], ['food', 'Food'], ['free', 'Free']];
  const ICON = { club: 'disco', dj: 'disco', live: 'music', festival: 'party', pub: 'beer', trivia: 'star', happyhour: 'cocktail', market: 'food', run: 'run', comedy: 'mic', exhibition: 'star', sport: 'ball', food: 'bowl' };
  let when = 'tonight', group = null, q = '';
  HOP.eventIcon = (e) => ICON[e.cat] || 'party';

  const where = (e) => { const p = EV.placeOf(e); return `${esc(p.name)} · ${esc(p.suburb)}`; };
  const friendsOf = (e) => e.friendIds.filter((id) => id !== S.meId).map((id) => S.userById[id]).filter(Boolean);

  // one compact list row, shared by What's on, Tonight and venue sheets
  HOP.eventRow = (e, opts = {}) => {
    const fr = friendsOf(e);
    const on = EV.live(e);
    return `<button class="erow" data-act="openEvent" data-id="${e.id}">
      <span class="et ${on ? 'now' : ''}">${on ? 'NOW' : hm(e.startsAt)}</span>
      <div class="grow"><div class="t">${esc(e.title)}</div>
        <div class="s">${(() => { const si = HOP.util.startsIn(e.startsAt, e.endsAt); return si.startsWith('Starts') ? `<span class="soon">${si}</span> · ` : ''; })()}${opts.noPlace ? esc(e.genre) : where(e)} · ${esc(e.priceLabel)}</div>
        ${e.deal ? `<div class="deal">${esc(e.deal)}</div>` : ''}</div>
      ${fr.length ? avatarStack(fr, 3, 22) : `<span class="mono dim">${e.interested >= 1000 ? (e.interested / 1000).toFixed(1) + 'k' : e.interested}</span>`}</button>`;
  };

  function list() {
    // searching looks across everything coming up, not just the selected day
    let l = q ? EV.filter({ when: 'any', group }) : EV.filter({ when, group });
    if (q) l = l.filter((e) => (e.title + ' ' + e.genre + ' ' + EV.placeOf(e).name + ' ' + EV.placeOf(e).suburb).toLowerCase().includes(q.toLowerCase()));
    return l;
  }
  function eventsTop() {
    return `<div class="searchrow">
        <label class="search">${I('search')}<input id="eq" type="search" autocomplete="off" placeholder="Gigs, trivia, markets…" value="${esc(q)}" aria-label="Search events"></label>
        <button class="me-btn" data-go="profile" aria-label="Your profile">${HOP.util.avatar(S.me(), 34)}</button>
      </div>${HOP.lensBar('events', `<div class="filters subs">${WHEN.map(([k, l]) => `<button data-act="evWhen" data-v="${k}" class="${when === k ? 'on' : ''}">${l.replace('This weekend', 'Weekend')}</button>`).join('')}<span class="fsep"></span>${GROUP.map(([k, l]) => `<button data-act="evGroup" data-v="${k}" class="${group === k ? 'on' : ''}">${l}</button>`).join('')}</div>`)}`;
  }
  function eventsSheet() {
    const l = list();
    const head = { tonight: 'What’s on tonight', tomorrow: 'What’s on tomorrow', weekend: 'This weekend' }[when];
    let body = '';
    if (!l.length) body = `<p class="empty">Nothing ${group ? GROUP.find((g) => g[0] === group)[1].toLowerCase() + ' ' : ''}on ${when === 'weekend' ? 'this weekend' : when}. Try another filter.</p>`;
    else if (when === 'weekend') {
      const days = {};
      l.forEach((e) => (days[EV.dayKey(e.startsAt)] ||= []).push(e));
      body = Object.entries(days).map(([k, es]) => `<p class="label dayhead">${longDate(+k)}</p><div class="rows">${es.map((e) => HOP.eventRow(e)).join('')}</div>`).join('');
    } else body = `<div class="rows">${l.map((e) => HOP.eventRow(e)).join('')}</div>`;
    return `<div class="sheethead" data-drag><h2 class="h2">${head}</h2><span class="mono dim">${l.length} ${l.length === 1 ? 'event' : 'events'}</span></div>${body}
      <p class="meta srcnote">Listings come from venues and What’s On Sydney. Venues can post their own soon.</p>`;
  }

  HOP.screens.whatson = {
    nav: 'home', mapMode: 'events',
    render() {
      const l = list();
      return {
        top: eventsTop(), sheet: eventsSheet(), sizes: ['half', 'full'],
        map() { HOP.map.setSelected(null); HOP.map.showRoute(null); HOP.map.clearOutingPins(); HOP.map.setMode('events', l); const pts = near(l); if (pts.length) HOP.map.fitTo(pts, { maxZoom: 15.25 }); },
        mapUpdate() { HOP.map.setMode('events', l); },
      };
    },
    mount() {
      const inp = document.getElementById('eq');
      if (!inp) return;
      inp.addEventListener('input', () => { q = inp.value; refresh(false); });
    },
    refreshSheetOnly: true,
  };
  // frame the events close to you; the list has the rest
  const near = (l) => {
    const ps = l.map((e) => EV.placeOf(e)).filter(Boolean);
    const close = ps.filter((p) => HOP.map.distanceFromMe(p) < 1600);
    return close.length >= 2 ? close : ps.filter((p) => HOP.map.distanceFromMe(p) < 4000);
  };
  function refresh(fit = true) {
    const l = list();
    ui.setSheet(eventsSheet(), { keepScroll: false });
    HOP.map.setMode('events', l);
    const pts = near(l);
    if (fit && pts.length) HOP.map.fitTo(pts, { maxZoom: 15.25 });
    document.querySelectorAll('.filters [data-act="evWhen"]').forEach((b) => b.classList.toggle('on', b.dataset.v === when));
    document.querySelectorAll('.filters [data-act="evGroup"]').forEach((b) => b.classList.toggle('on', b.dataset.v === group));
  }
  HOP.actions.whatson = (d) => { if (d.when) when = d.when; group = null; q = ''; HOP.app.go('whatson', {}); };
  HOP.actions.evWhen = (d) => { when = d.v; refresh(); };
  HOP.actions.evGroup = (d) => { group = group === d.v ? null : d.v; refresh(); };
  HOP.actions.closeWhatson = () => HOP.app.back();
  HOP.actions.openEvent = (d) => HOP.app.go('event', { id: d.id }, { replace: HOP.app.route.name === 'event' });

  // ---------------- EVENT SHEET ----------------
  HOP.screens.event = {
    nav: 'home', mapMode: 'events',
    render({ id }) {
      const e = EV.byId(id);
      const p = EV.placeOf(e);
      const fr = friendsOf(e);
      const here = S.friendsAtEvent(id).concat(e.venueId && EV.live(e) ? S.friendsAt(e.venueId) : []);
      const mine = e.friendIds.includes(S.meId);
      const pub = e.publisher;
      const sheet = `
        <div class="evhead" data-drag>
          <p class="label evwhen">${EV.live(e) ? '<span class="onnow">ON NOW</span> ' : ''}${eventWhen(e.startsAt)}${!EV.live(e) && e.startsAt - HOP.now() < 150 * 6e4 && e.startsAt > HOP.now() ? ` · <span class="amber">${HOP.util.startsIn(e.startsAt, e.endsAt)}</span>` : ''}</p>
          <h1 class="h1">${esc(e.title)}</h1>
        </div>
        <div class="evfacts">
          <button data-act="${e.venueId ? 'venue' : 'focusPlace'}" data-id="${e.venueId || e.id}">${I('pin', 16)}<span>${esc(p.name)}, ${esc(p.suburb)}</span></button>
          <div>${EV.svg(e.cat, 16)}<span>${esc(EV.CATS[e.cat].label)}${e.genre && e.genre !== EV.CATS[e.cat].label ? ` · ${esc(e.genre)}` : ''}</span></div>
          <div>${I('ticket', 16)}<span>${esc(e.priceLabel)}${e.deal ? ` <em class="deal">· ${esc(e.deal)}</em>` : ''}</span></div>
          <button data-act="evPeople" data-id="${id}">${I('users', 16)}<span>${e.interested.toLocaleString('en-AU')} interested${fr.length ? ` · ${esc(fr.slice(0, 2).map((u) => u.first).join(', '))}${fr.length > 2 ? ` +${fr.length - 2}` : ''}` : ''}</span>${fr.length ? avatarStack(fr, 4, 22) : ''}</button>
          ${here.length ? `<div class="herenow">${avatarStack(here.map((h) => h.user), 4, 22)}<span>${esc(here[0].user.first)}${here.length > 1 ? ` and ${here.length - 1} more are` : ' is'} there now</span></div>` : ''}
        </div>
        <button class="btn primary block" data-act="eventToOuting" data-id="${id}">${I('plus', 18)} Add to outing</button>
        <div class="btnrow three" style="margin-top:8px">
          <button class="btn" data-act="viewEvent">View</button>
          ${(() => { const sv = S.isSaved({ eventId: id }); return `<button class="btn ${sv ? 'savedbtn' : ''}" data-act="saveTo" data-e="${id}">${sv ? I('check', 17) + ' Saved' : I('bookmark', 17) + ' Save'}</button>`; })()}
          <button class="btn" data-act="shareEvent" data-id="${id}">${I('share', 17)} Share</button>
        </div>
        <button class="addstop" data-act="eventNewOuting" data-id="${id}"><span class="num">${I('plus', 16)}</span> Plan a night around this</button>
        <div class="evdetail" id="evdetail">
          ${e.img ? `<div class="evhero">${photoTag({ id: e.id, u: e.img }, 900, 400)}</div>` : ''}
          ${e.blurb ? `<p class="evblurb">${esc(e.blurb)}</p>` : ''}
          <div class="rows">
            <div class="row"><span class="ico">${I('clock', 18)}</span><div class="grow"><div class="t">${dayDate(e.startsAt)}, ${timeShort(e.startsAt)} – ${timeShort(e.endsAt)}</div><div class="s">${e.recurs === 'weekly' ? `Every ${HOP.util.DAYS_LONG[new Date(e.startsAt).getDay()]}` : 'One night only'}</div></div></div>
            <div class="row"><span class="ico">${pub.type === 'venue' ? I('check', 18) : I('link', 18)}</span><div class="grow"><div class="t">${esc(pub.name)}</div><div class="s">${pub.type === 'venue' ? (pub.verified ? 'Posted by the venue · verified' : 'Posted by the venue') : pub.type === 'community' ? 'Community listing' : 'From an events listing'}</div></div></div>
          </div>
          <div class="section"><button class="btn block ${mine ? 'primary' : ''}" data-act="evInterest" data-id="${id}">${mine ? `${I('check', 18)} You’re interested` : 'I’m interested'}</button></div>
        </div>`;
      return {
        top: `<div class="floatbar"><button class="fbtn" data-act="back" aria-label="Back">${I('back')}</button><button class="fbtn" data-act="shareEvent" data-id="${id}">${I('link', 18)} Send to friends</button></div>`,
        sheet, sizes: ['auto', 'full'],
        map() { HOP.map.showRoute(null); HOP.map.clearOutingPins(); HOP.map.setMode('events', [e]); HOP.map.setSelected(e.id); HOP.map.focus(p, Math.max(HOP.map.leaflet.getZoom(), 15.5)); setTimeout(() => HOP.map.setSelected(e.id), 60); },
      };
    },
  };
  HOP.actions.viewEvent = () => { ui.resizeSheet('full'); setTimeout(() => document.getElementById('evdetail')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300); };
  HOP.actions.focusPlace = (d) => HOP.map.focus(EV.placeOf(EV.byId(d.id)), 16.5);
  HOP.actions.evInterest = (d) => { const on = EV.toggleInterest(d.id); ui.toast(on ? 'Saved. We’ll show you who else is keen.' : 'Removed'); };
  HOP.actions.evPeople = (d) => {
    const e = EV.byId(d.id);
    const fr = friendsOf(e);
    ui.openModal(`<div class="mhead"><h2 class="h2">${e.interested.toLocaleString('en-AU')} interested</h2><button class="iconbtn bare" data-act="closeModal" aria-label="Close">${I('close')}</button></div>
      ${fr.length ? `<p class="label">Friends</p><div class="rows">${fr.map((u) => `<div class="row">${avatar(u, 36)}<div class="grow"><div class="t">${esc(u.name)}</div><div class="s">${esc(u.suburb)}</div></div></div>`).join('')}</div>` : '<p class="meta">None of your friends yet. Send it to the group chat.</p>'}
      <button class="btn primary block" style="margin-top:16px" data-act="shareEvent" data-id="${d.id}">${I('share', 18)} Send to friends</button>`);
  };

  // share an event (complements the group chat, doesn't replace it)
  HOP.actions.shareEvent = (d) => {
    const e = EV.byId(d.id);
    const url = `https://hop.app/e/${e.id.replace('ev_', '')}`;
    const msg = encodeURIComponent(`${e.title} — ${dayDate(e.startsAt)} ${hm(e.startsAt)} at ${EV.placeOf(e).name}. Keen? ${url}`);
    ui.openModal(`<div class="mhead"><h2 class="h2">Send it to friends</h2><button class="iconbtn bare" data-act="closeModal" aria-label="Close">${I('close')}</button></div>
      <div class="sharecard"><span class="emo">${HOP.events.svg(e.cat, 22)}</span><div class="grow"><b>${esc(e.title)}</b><div class="meta">${dayDate(e.startsAt)} · ${hm(e.startsAt)} · ${esc(EV.placeOf(e).name)}</div><div class="u">hop.app/e/${esc(e.id.replace('ev_', ''))}</div></div></div>
      <div class="linkbox"><code>${esc(url)}</code><button class="btn primary" data-act="copyText" data-t="${esc(url)}">Copy</button></div>
      <div class="apps">
        <a href="sms:?&body=${msg}"><span class="ic" style="background:#2fbf4f">${I('share', 22)}</span>Messages</a>
        <a href="https://wa.me/?text=${msg}" target="_blank" rel="noopener"><span class="ic" style="background:#1fa855">WA</span>WhatsApp</a>
        <a href="fb-messenger://share/?link=${encodeURIComponent(url)}"><span class="ic" style="background:#2b7cff">M</span>Messenger</a>
        <button data-act="copyText" data-t="${esc(url)}"><span class="ic" style="background:var(--surface-3)">${I('link', 22)}</span>Instagram, more</button>
      </div>
      <div class="btnrow" style="margin-top:10px"><button class="btn" data-act="sendToOuting" data-e="${d.id}">${I('chat', 17)} Send to an outing</button><button class="btn" data-act="eventNewOuting" data-id="${d.id}">Make it a plan</button></div>`);
  };
  HOP.actions.copyText = async (d) => { const ok = await ui.copy(d.t); ui.toast(ok ? 'Link copied' : 'Select the link to copy it'); };

  // ---------------- event → outing ----------------
  HOP.actions.eventToOuting = (d) => {
    const e = EV.byId(d.id);
    const mine = S.state.outings.filter((o) => o.status === 'planning' && S.myAttendance(o.id)?.rsvp === 'going' && (S.isOrganiser(o) || true))
      .sort((a, b) => a.startsAt - b.startsAt);
    ui.openModal(`<div class="mhead"><h2 class="h2">Add to an outing</h2><button class="iconbtn bare" data-act="closeModal" aria-label="Close">${I('close')}</button></div>
      <div class="sharecard" style="margin-bottom:8px"><span class="emo">${HOP.events.svg(e.cat, 22)}</span><div class="grow"><b>${esc(e.title)}</b><div class="meta">${dayDate(e.startsAt)} · ${hm(e.startsAt)} · ${esc(EV.placeOf(e).name)}</div></div></div>
      <div class="rows">${mine.map((o) => {
        const ok = HOP.util.sameNight(o.startsAt, e.startsAt);
        const has = S.stopsOf(o.id).some((s) => s.eventId === e.id);
        return `<button class="row" data-act="addEventTo" data-o="${o.id}" data-id="${e.id}" ${ok && !has ? '' : 'disabled'} style="${ok && !has ? '' : 'opacity:.45'}">
          <span class="emo-sm">${HOP.oicon(o)}</span><div class="grow"><div class="t">${esc(o.title)}</div>
          <div class="s">${has ? 'Already on the plan' : ok ? `Adds as a stop at ${timeShort(e.startsAt)} · ${plural(S.stopsOf(o.id).length, 'stop')} so far` : `Different night · ${dayDate(o.startsAt)}`}</div></div>${ok && !has ? I('plus', 18) : ''}</button>`;
      }).join('')}
        <button class="row" data-act="eventNewOuting" data-id="${e.id}"><span class="emo-sm">${I('plus', 18)}</span><div class="grow"><div class="t">New outing around this</div><div class="s">Dinner and drinks around ${timeShort(e.startsAt)}, then invite people</div></div></button>
      </div>`);
  };
  HOP.actions.addEventTo = (d, el) => {
    if (el.disabled) return;
    ui.closeModal();
    const s = S.addEventStop(d.o, d.id);
    const o = S.outing(d.o);
    if (s) ui.toast(`${esc(EV.byId(d.id).title)} is stop ${s.order + 1} of ${esc(o.title)}`);
    HOP.app.go('outing', { id: d.o });
  };
  HOP.actions.eventNewOuting = (d) => { ui.closeModal(); HOP.app.go('create', { event: d.id, fresh: 1 }); };

  // Dinner before, drinks before or after: the shape of a night built around one thing
  HOP.planAround = (e) => {
    const p = EV.placeOf(e);
    const near = (cats, not) => S.venues.filter((v) => cats.includes(v.cat) && v.id !== not && v.id !== e.venueId)
      .map((v) => ({ v, d: HOP.util.metres(p, v) - (HOP.seed.POP[v.id]?.[0] || 0.3) * 300 })).sort((a, b) => a.d - b.d)[0]?.v;
    const h = new Date(e.startsAt).getHours();
    const late = h >= 21 || h < 5;
    const round = (t) => Math.round(t / 18e5) * 18e5;
    const dinner = near(['food']);
    const drinks = near(['bar', 'pub'], dinner?.id);
    const plan = [];
    if (dinner) plan.push({ venueId: dinner.id, at: round(e.startsAt - (late ? 3 : 2) * 36e5), role: 'Dinner' });
    if (late && drinks) plan.push({ venueId: drinks.id, at: round(e.startsAt - 1.5 * 36e5), role: 'Drinks' });
    plan.push({ eventId: e.id, at: e.startsAt, role: EV.CATS[e.cat].label });
    if (!late && drinks && new Date(e.endsAt).getHours() >= 5) plan.push({ venueId: drinks.id, at: round(e.endsAt), role: 'Drinks after' });
    return plan;
  };
})();
