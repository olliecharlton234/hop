/* HOP — Memories, a single memory, Profile */
(() => {
  const { esc, avatar, avatarStack, photoTag, timeShort, plural, longDate, ago } = HOP.util;
  const I = HOP.icon;
  const S = HOP.store;
  const ui = HOP.ui;

  const statLine = (o) => {
    const p = S.photosOf(o.id).length, n = S.going(o.id).length, st = S.stopsOf(o.id).length;
    return [plural(p, 'photo'), plural(n, 'person', 'people'), st > 1 ? plural(st, 'stop') : null].filter(Boolean);
  };
  // spread picks across the night so the strip shows the whole story
  const spread = (list, n) => (list.length <= n ? list : Array.from({ length: n }, (_, k) => list[Math.floor(((k + 0.5) * list.length) / n)]));

  function memRow(o) {
    const film = spread(S.photosOf(o.id), 4);
    return `<button class="mem" data-act="openOuting" data-id="${o.id}">
      ${film.length ? `<div class="film">${film.map((p, i) => photoTag(p, i ? 200 : 400, 200)).join('')}</div>` : ''}
      <div class="t"><span>${HOP.oicon(o)}</span>${esc(o.title)}</div>
      <div class="s"><span>${longDate(o.startsAt)}</span></div>
      ${S.stopsOf(o.id).length > 1 ? `<div class="recap">${esc(S.stopsOf(o.id).map((s) => S.stopName(s)).join(' → '))}</div>` : ''}
      <div class="s">${statLine(o).join(' · ')}</div></button>`;
  }
  function byYear(list) {
    const years = {};
    list.forEach((o) => (years[new Date(o.startsAt).getFullYear()] ||= []).push(o));
    return Object.keys(years).sort((a, b) => b - a).map((y) => `<div class="year">${y}</div>${years[y].map(memRow).join('')}`).join('');
  }

  HOP.screens.memories = {
    nav: 'memories',
    render() {
      const { memories } = S.myOutings();
      const hero = memories.find((o) => HOP.now() - (o.endedAt || o.startsAt) > 2 * 864e5);
      const heroPhotos = hero ? S.photosOf(hero.id) : [];
      const best = heroPhotos[Math.floor(heroPhotos.length * 0.6)];
      return {
        top: '', sizes: ['full'],
        sheet: `<div data-drag style="padding-top:4px"><h1 class="h1">Memories</h1></div>
          ${hero ? `<button class="remember" data-act="openOuting" data-id="${hero.id}">
            ${best ? photoTag(best, 900, 420) : ''}
            <div class="cap"><p class="label">${ago(hero.startsAt)}</p><div class="h1">Remember ${esc(hero.title)}?</div><div class="meta">${longDate(hero.startsAt)} · ${statLine(hero).join(' · ')}</div></div></button>` : ''}
          ${memories.length ? byYear(memories) : `<p class="empty">When a night ends it lands here: the route, the people and every photo.</p>`}`,
        map() {
          HOP.map.setSelected(null); HOP.map.clearOutingPins();
          if (hero) HOP.map.showRoute(hero.id, 'memory');
        },
      };
    },
  };
  HOP.memRow = memRow;
  HOP.byYear = byYear;

  HOP.screens.memory = {
    nav: 'memories',
    render({ id }) {
      const o = S.outing(id);
      if (!o) return HOP.screens.memories.render();
      const stops = S.stopsOf(id);
      const people = S.going(id).map((a) => S.userById[a.userId]);
      const others = people.filter((u) => u.id !== S.meId);
      const photos = S.photosOf(id);
      const sheet = `
        <div data-drag>
          <p class="label">${ago(o.startsAt)}</p>
          <h1 class="h1" style="margin-top:6px">${esc(o.title)}</h1>
          <div class="meta" style="margin-top:6px">${longDate(o.startsAt)} · with ${esc(others.slice(0, 2).map((u) => u.first).join(', '))}${others.length > 2 ? ` and ${others.length - 2} others` : ''}</div>
          ${stops.length > 1 ? `<p class="recap big">${esc(stops.map((s) => S.stopName(s)).join(' → '))}</p>` : ''}
        </div>
        <div class="pstats"><div><b>${photos.length}</b><span>photos</span></div><div><b>${people.length}</b><span>people</span></div><div><b>${stops.length}</b><span>${stops.length === 1 ? 'stop' : 'stops'}</span></div>${S.messagesOf(id).filter((m) => m.kind !== 'system').length ? `<div><b>${S.messagesOf(id).filter((m) => m.kind !== 'system').length}</b><span>messages</span></div>` : ''}</div>
        <button class="who" data-act="attendees" data-id="${id}" style="border-bottom:1px solid var(--line)">${avatarStack(people, 8, 30)}<div class="grow"></div>${I('chev')}</button>
        <div class="section"><p class="label"><span>The night</span>${photos.length ? `<button class="linkbtn" data-act="album" data-id="${id}">All ${photos.length} photos</button>` : ''}</p>
          ${stops.map((s, i) => {
            const ps = S.photosOf(id, s.id);
            const p = S.placeOf(s);
            return `<div class="stopphotos"><header><span class="stop" style="padding:0;border:0;background:none"><span class="num">${i + 1}</span></span>
              <div class="grow"><b>${esc(S.stopName(s))}</b><div class="meta" style="font-size:12.5px">${esc(p.suburb)} · ${timeShort(s.at)}</div></div><span class="mono dim">${ps.length}</span></header>
              ${ps.length ? `<div class="strip">${spread(ps, 10).map((ph) => `<button data-act="viewPhoto" data-id="${id}" data-p="${ph.id}">${photoTag(ph, 200, 250)}</button>`).join('')}</div>` : ''}</div>`;
          }).join('')}
        </div>
        <div class="cta">
          <button class="btn" data-act="roll" data-id="${id}">${I('image', 18)} Add photos</button>
          <button class="btn primary" data-act="planAgain" data-id="${id}">${I('repeat', 18)} Do it again</button>
        </div>`;
      return {
        top: `<div class="floatbar"><button class="fbtn" data-act="back" aria-label="Back">${I('back')}</button>${photos.length ? `<button class="fbtn" data-act="album" data-id="${id}">${I('memories', 18)} Album</button>` : ''}</div>`,
        sheet, sizes: ['half', 'full'],
        map() { HOP.map.setSelected(null); HOP.map.clearOutingPins(); HOP.map.showRoute(id, 'memory'); },
        mapUpdate() { HOP.map.showRoute(id, 'memory', { fit: false }); },
      };
    },
  };
  HOP.actions.planAgain = (d) => {
    const src = S.outing(d.id);
    const sat = new Date(HOP.now()); sat.setHours(new Date(src.startsAt).getHours(), new Date(src.startsAt).getMinutes(), 0, 0);
    while (sat.getDay() !== new Date(src.startsAt).getDay() || sat.getTime() < HOP.now()) sat.setDate(sat.getDate() + 1);
    const o = S.duplicate(d.id, sat.getTime());
    S.updateOuting(o.id, { title: src.title.includes('again') ? src.title : `${src.title} again` });
    HOP.app.go('outing', { id: o.id }, { resetTo: 'outings' });
    ui.toast('Same route, new date. Change anything you like.');
  };

  // ---------------- PROFILE ----------------
  HOP.screens.profile = {
    nav: 'profile', mapMode: 'default',
    render() {
      const me = S.me();
      const { memories } = S.myOutings();
      const year = new Date(HOP.now()).getFullYear();
      const thisYear = memories.filter((o) => new Date(o.startsAt).getFullYear() === year);
      const photoCount = thisYear.reduce((n, o) => n + S.photosOf(o.id).length, 0);
      const people = new Set(); thisYear.forEach((o) => S.going(o.id).forEach((a) => a.userId !== S.meId && people.add(a.userId)));
      const friends = HOP.friendsByNights().filter((f) => f.n > 0).slice(0, 10);
      return {
        top: '', sizes: ['full'],
        sheet: `
          <div class="prof" data-drag>${avatar(me, 64)}<div class="grow"><h1 class="h1">${esc(me.name)}</h1><div class="meta" style="margin-top:4px">@${esc(me.handle)} · ${esc(me.suburb)}</div></div></div>
          <div class="pstats"><div><b>${thisYear.length}</b><span>nights in ${year}</span></div><div><b>${photoCount}</b><span>photos</span></div><div><b>${people.size}</b><span>people</span></div></div>
          ${friends.length ? `<div class="section"><p class="label">Who you go out with</p><div class="people">${friends.map(({ u, n }) => `<div>${avatar(u, 52)}<b>${esc(u.first)}</b><span>${plural(n, 'night')}</span></div>`).join('')}</div></div>` : ''}
          <div class="section"><p class="label">Your outings</p>${memories.length ? byYear(memories) : '<p class="empty">Nothing yet.</p>'}</div>
          <div class="demo"><p class="label">Prototype</p>
            <div style="width:100%"><p class="meta" style="margin:0 0 8px">Viewing as. Open a second tab as someone else to watch photos arrive live.</p>
            <div class="seg">${['u_ollie', 'u_jack', 'u_sarah'].map((id) => `<button data-act="viewAs" data-u="${id}" class="${S.meId === id ? 'on' : ''}">${esc(S.userById[id].first)}</button>`).join('')}</div></div>
            <button class="btn sm" data-act="openAs" data-u="u_jack">Open Jack in a new tab</button>
            <button class="btn sm" data-act="clearBirthday">Remove Ollie’s Birthday (to create it fresh)</button>
            <button class="btn sm" data-act="resetDemo">Reset demo data</button>
            <div style="width:100%"><p class="meta" style="margin:8px 0 8px">Preview how Home changes through the day.</p>
            <div class="seg">${[['', 'Now'], ['10', 'Morning'], ['15', 'Afternoon'], ['19', 'Evening'], ['24', 'Late']].map(([h, l]) => `<button data-act="previewPhase" data-h="${h}">${l}</button>`).join('')}</div></div>
            <button class="btn sm" data-act="toggleClock">${HOP.clock.realtime ? 'Use demo time (Friday 7 PM)' : 'Use real time'}</button>
          </div>`,
        map() { HOP.map.setSelected(null); HOP.map.showRoute(null); HOP.map.clearOutingPins(); },
      };
    },
  };
  HOP.actions.viewAs = (d) => { S.setMe(d.u); ui.toast(`Viewing as ${S.userById[d.u].first}`); };
  HOP.actions.previewPhase = (d) => { HOP.setPreviewHour(d.h === '' ? null : +d.h % 24 === 0 ? 0 : +d.h); HOP.app.go('home', { go: 'home' }); ui.toast(d.h === '' ? 'Back to now' : 'Previewing Home at that time of day'); };
  HOP.actions.toggleClock = () => S.setRealtime(!HOP.clock.realtime);
  HOP.actions.resetDemo = () => { S.reset(); HOP.app.go('home', {}, { resetTo: 'home' }); ui.toast('Demo data reset'); };
  HOP.actions.clearBirthday = () => {
    const o = S.state.outings.find((x) => x.title === "Ollie's Birthday" && x.status !== 'ended');
    if (o) S.deleteOuting(o.id);
    HOP.app.go('home', {}, { resetTo: 'home' });
    ui.toast('Gone. Tap + to plan it from scratch.');
  };
})();
