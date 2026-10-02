/* HOP — Create an outing, outing plan view, stops, invites, RSVP, attendees */
(() => {
  const { esc, avatar, avatarStack, photoTag, when, time, timeShort, walkMins, metres, distLabel, plural, longDate } = HOP.util;
  const I = HOP.icon;
  const S = HOP.store;
  const ui = HOP.ui;

  // ---------------- activity lines (shared with live + memories) ----------------
  HOP.actLine = (a) => {
    const u = S.userById[a.userId];
    const who = a.userId === S.meId ? 'You' : esc(u?.first || 'Someone');
    const v = a.venueId ? esc(S.venueById[a.venueId]?.name) : '';
    const text = {
      joined: `<b>${who}</b> ${a.userId === S.meId ? 'are' : 'is'} going`,
      going: `<b>${who}</b> ${a.userId === S.meId ? 'are' : 'is'} going`,
      maybe: `<b>${who}</b> might come`,
      declined: `<b>${who}</b> can’t make it`,
      invited: `<b>${who}</b> ${a.userId === S.meId ? 'were' : 'was'} invited`,
      stop: `<b>${who}</b> added ${v}`,
      photos: `<b>${who}</b> added ${plural(a.count, 'photo')}`,
      started: `<b>${who}</b> started the night`,
      moved: `Moved on to <b>${v}</b>`,
      ended: `<b>${who}</b> wrapped up the night`,
    }[a.type] || '';
    const lead = ['moved', 'ended'].includes(a.type) ? `<span class="ico">${a.type === 'moved' ? I('walk', 15) : I('flag', 15)}</span>` : avatar(u, 28);
    return `<div class="act">${lead}<div class="grow">${text}</div><time>${HOP.util.ago(a.at)}</time></div>`;
  };

  // ---------------- CREATE ----------------
  let draft = null;
  const EMOJI = ['cake', 'beer', 'cocktail', 'glass', 'disco', 'music', 'bowl', 'food', 'beach', 'party'];
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  function nextDow(dow) { const d = new Date(HOP.now()); d.setHours(0, 0, 0, 0); while (d.getDay() !== dow) d.setDate(d.getDate() + 1); return d; }

  function newDraft(params = {}) {
    const src = params.edit ? S.outing(params.edit) : null;
    if (params.event) {
      const e = HOP.events.byId(params.event);
      const plan = HOP.planAround(e);
      const st = new Date(plan[0].at);
      return { edit: null, venue: null, event: e.id, plan, wrap: true, title: e.title.replace(/ — .*/, ''), emoji: HOP.eventIcon(e), cover: null,
        date: ymd(st), time: `${pad(st.getHours())}:${pad(st.getMinutes())}`, visibility: 'private' };
    }
    const d = src ? new Date(src.startsAt) : nextDow(6);
    return {
      edit: src ? src.id : null, venue: params.venue || null,
      title: src ? src.title : '', emoji: src ? HOP.oiconKey(src) : 'cake', cover: src ? src.cover : null,
      date: ymd(d), time: src ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : '19:30', visibility: src ? src.visibility : 'private',
    };
  }

  HOP.screens.create = {
    nav: 'create', mapMode: 'default',
    render(params) {
      if (!draft || params.fresh) draft = newDraft(params);
      const placeholder = `${S.me().first}'s Birthday`;
      const v = draft.venue && S.venueById[draft.venue];
      const quick = [['Tonight', ymd(new Date(HOP.now()))], ['Fri', ymd(nextDow(5))], ['Sat', ymd(nextDow(6))]];
      return {
        top: '', sizes: ['full'],
        sheet: `<div class="form">
          <div style="display:flex;align-items:center;justify-content:space-between" data-drag>
            <h1 class="h1">${draft.edit ? 'Edit outing' : 'New outing'}</h1>
            <button class="iconbtn bare" data-act="cancelCreate" aria-label="Cancel">${I('close')}</button></div>
          <div class="field"><label class="label" for="oname">What’s the occasion?</label>
            <input id="oname" class="bigname" maxlength="48" placeholder="${esc(placeholder)}" value="${esc(draft.title)}" autocomplete="off"></div>
          <div class="field"><p class="label">Icon</p><div class="emojis" role="radiogroup">
            ${EMOJI.map((e) => `<button role="radio" data-act="pickEmoji" data-e="${e}" class="${!draft.cover && draft.emoji === e ? 'on' : ''}" aria-label="${e}">${HOP.oicon(e, 22)}</button>`).join('')}
            <button data-act="pickCover" class="${draft.cover ? 'on' : ''}" aria-label="Use a photo">${draft.cover ? photoTag({ id: 'cover', src: draft.cover }, 100) : I('image')}</button></div></div>
          <div class="field"><p class="label">When</p>
            <div class="quick">${quick.map(([l, d]) => `<button data-act="quickDate" data-d="${d}" class="${draft.date === d ? 'on' : ''}">${l}</button>`).join('')}</div>
            <div class="datetime"><input class="input" type="date" id="odate" value="${draft.date}" aria-label="Date"><input class="input" type="time" id="otime" value="${draft.time}" aria-label="Start time"></div></div>
          <div class="field"><p class="label">Who can see it</p><div class="vis">
            <button data-act="pickVis" data-v="private" class="${draft.visibility === 'private' ? 'on' : ''}">${I('lock')}<div><b>Private</b><span>Only people with the link</span></div></button>
            <button data-act="pickVis" data-v="public" class="${draft.visibility === 'public' ? 'on' : ''}">${I('globe')}<div><b>Public</b><span>Shows on the map so anyone nearby can join</span></div></button></div></div>
          ${draft.event ? `<div class="field"><p class="label">The plan</p><div class="planprev">${draft.plan.filter((x) => draft.wrap || x.eventId).map((x, i) => {
              const name = x.eventId ? HOP.events.byId(x.eventId).title : S.venueById[x.venueId].name;
              const where = x.eventId ? HOP.events.placeOf(HOP.events.byId(x.eventId)).name : S.venueById[x.venueId].suburb;
              return `<div class="pp ${x.eventId ? 'ev' : ''}"><span class="num">${i + 1}</span><div class="grow"><b>${esc(name)}</b><span>${esc(x.role)} · ${esc(where)}</span></div><span class="mono amber">${timeShort(x.at)}</span></div>`;
            }).join('')}</div>
            <label class="check"><input type="checkbox" id="wrapIn" ${draft.wrap ? 'checked' : ''}> Add dinner and drinks around it</label></div>` : ''}
          ${v ? `<p class="meta">First stop: <b style="color:var(--text)">${esc(v.name)}</b>, ${esc(v.suburb)}</p>` : ''}
          <div class="cta"><button class="btn primary" data-act="createGo">${draft.edit ? 'Save' : draft.event ? 'Create the plan' : v ? 'Create and add more stops' : 'Next: pick the stops'}</button></div>
        </div>`,
        map() { HOP.map.showRoute(null); HOP.map.clearOutingPins(); },
      };
    },
    mount() {
      const n = document.getElementById('oname'), d = document.getElementById('odate'), t = document.getElementById('otime');
      n.addEventListener('input', () => (draft.title = n.value));
      d.addEventListener('change', () => { draft.date = d.value; document.querySelectorAll('.quick button').forEach((b) => b.classList.toggle('on', b.dataset.d === d.value)); });
      t.addEventListener('change', () => (draft.time = t.value));
      const w = document.getElementById('wrapIn');
      if (w) w.addEventListener('change', () => { draft.wrap = w.checked; HOP.app.render({ keepScroll: true }); });
      if (!draft.edit && !ui.wide()) setTimeout(() => n.focus({ preventScroll: true }), 300);
    },
  };
  HOP.resetDraft = () => (draft = null);

  HOP.actions.pickEmoji = (d) => { draft.emoji = d.e; draft.cover = null; HOP.app.render({ keepScroll: true }); };
  HOP.actions.pickVis = (d) => { draft.visibility = d.v; HOP.app.render({ keepScroll: true }); };
  HOP.actions.quickDate = (d) => { draft.date = d.d; HOP.app.render({ keepScroll: true }); };
  HOP.actions.pickCover = () => {
    const inp = document.getElementById('coverIn');
    inp.onchange = async () => { const f = inp.files[0]; inp.value = ''; if (!f) return; draft.cover = await HOP.photos.shrink(f, 600); HOP.app.render({ keepScroll: true }); };
    inp.click();
  };
  HOP.actions.cancelCreate = () => { draft = null; HOP.app.back(); };
  HOP.actions.createGo = () => {
    const [y, m, dd] = draft.date.split('-').map(Number), [h, mi] = draft.time.split(':').map(Number);
    const startsAt = new Date(y, m - 1, dd, h, mi).getTime();
    const title = draft.title.trim() || `${S.me().first}'s Birthday`;
    if (draft.edit) {
      const o = S.outing(draft.edit);
      const delta = startsAt - o.startsAt;
      S.stopsOf(o.id).forEach((s) => (s.at += delta));
      S.updateOuting(o.id, { title, emoji: draft.emoji, cover: draft.cover, startsAt, visibility: draft.visibility });
      draft = null; HOP.app.back(); ui.toast('Saved'); return;
    }
    if (draft.event) {
      const plan = draft.plan.filter((x) => draft.wrap || x.eventId);
      const delta = startsAt - plan[0].at; // the user may have moved the start time
      const o = S.createOuting({ title, emoji: draft.emoji, cover: draft.cover, startsAt, visibility: draft.visibility });
      plan.forEach((x) => (x.eventId ? S.addEventStop(o.id, x.eventId) : S.addStop(o.id, x.venueId, x.at + delta)));
      draft = null;
      HOP.app.go('outing', { id: o.id }, { replace: true, resetTo: 'outings' });
      ui.toast(plan.length > 1 ? `${plan.map((x) => x.role.split(' ')[0]).join(' → ')}. Swap any stop, then invite people.` : 'Created. Add stops or invite people.');
      return;
    }
    const o = S.createOuting({ title, emoji: draft.emoji, cover: draft.cover, startsAt, visibility: draft.visibility });
    if (draft.venue) S.addStop(o.id, draft.venue);
    draft = null;
    HOP.app.startPicking(o.id, { replace: true });
  };

  // ---------------- picking stops ----------------
  HOP.actions.addStop = (d) => {
    const s = S.addStop(HOP.app.picking, d.venue);
    if (s) ui.toast(`Added ${esc(S.venueById[d.venue].name)} · ${timeShort(s.at)}`);
    HOP.app.go('pick', { id: HOP.app.picking }, { replace: true });
  };
  HOP.actions.addToOuting = (d) => {
    const s = S.addStop(d.outing, d.venue);
    if (s) ui.toast(`Added to ${esc(S.outing(d.outing).title)} as stop ${s.order + 1}`);
    HOP.app.go('outing', { id: d.outing });
  };
  HOP.actions.startHere = (d) => HOP.app.go('create', { venue: d.venue, fresh: 1 });
  HOP.actions.removeStop = (d) => {
    const s = S.state.stops.find((x) => x.id === d.id);
    const name = S.placeOf(s).name;
    S.removeStop(d.id);
    ui.toast(`Removed ${esc(name)}`);
    if (HOP.app.route.name === 'venue') HOP.app.go('pick', { id: HOP.app.picking }, { replace: true });
  };
  HOP.actions.donePicking = () => {
    const id = HOP.app.picking;
    HOP.app.picking = null; HOP.app.searching = false; HOP.clearQuery();
    HOP.app.go('outing', { id }, { resetTo: 'outings' });
  };
  HOP.actions.openOuting = (d) => {
    const o = S.outing(d.id);
    if (o.status === 'live') return HOP.app.go('live', { id: d.id });
    if (o.status === 'ended') return HOP.app.go('memory', { id: d.id });
    HOP.app.go('outing', { id: d.id });
  };

  // ---------------- OUTING (plan view) ----------------
  function stopsList(o, editable) {
    const stops = S.stopsOf(o.id);
    let html = '<div class="stops" id="stops">';
    stops.forEach((s, i) => {
      const p = S.placeOf(s);
      if (i > 0) {
        const prev = S.placeOf(stops[i - 1]);
        html += `<div class="walk">${I('walk', 14)} ${walkMins(prev, p)} min walk · ${distLabel(metres(prev, p) * 1.3)}</div>`;
      }
      const hhmm = `${String(new Date(s.at).getHours()).padStart(2, '0')}:${String(new Date(s.at).getMinutes()).padStart(2, '0')}`;
      html += `<div class="stop" data-stop="${s.id}">
        <span class="num">${i + 1}</span>
        ${s.eventId ? (() => { const e = S.eventOf(s); return `<button class="grow" style="text-align:left" data-act="openEvent" data-id="${e.id}"><div class="t"><i class="evdot"></i>${esc(e.title)}</div><div class="s">${esc(p.name)} · ${esc(e.priceLabel)}</div></button>`; })()
          : `<button class="grow" style="text-align:left" data-act="venueFromStop" data-id="${p.id}"><div class="t">${esc(p.name)}</div><div class="s">${esc(p.suburb)} · ${(() => { const ar = HOP.activity.areaOfVenue(p); if (!ar || o.status !== 'planning') return esc(p.hours || ''); const l = HOP.activity.levelAt(ar.id, s.at); return `<span class="lvw lv${l.lv}">expected ${l.level.toLowerCase()}</span> then`; })()}</div></button>`}
        ${editable ? `<input type="time" value="${hhmm}" data-time="${s.id}" aria-label="Time at ${esc(p.name)}">
          <button class="handle" data-handle="${s.id}" aria-label="Reorder ${esc(p.name)}. Use arrow keys.">${I('grip', 18)}</button>`
          : `<span class="mono amber">${timeShort(s.at)}</span>`}
      </div>`;
    });
    html += '</div>';
    if (editable) html += `<button class="addstop" data-act="addStops" data-id="${o.id}"><span class="num">${I('plus', 16)}</span> Add a stop</button>`;
    return html;
  }

  HOP.screens.outing = {
    nav: 'outings',
    render({ id }) {
      const o = S.outing(id);
      if (!o) return HOP.screens.outings.render();
      const org = S.isOrganiser(o);
      const att = S.attendeesOf(id);
      const going = att.filter((a) => a.rsvp === 'going').map((a) => S.userById[a.userId]);
      const maybe = att.filter((a) => a.rsvp === 'maybe').length;
      const waiting = att.filter((a) => a.rsvp === 'invited').length;
      const stops = S.stopsOf(id);
      const area = stops[0] ? S.placeOf(stops[0]).suburb : 'No stops yet';
      const host = S.userById[o.organiserId];
      const mine = S.myAttendance(id);
      const sheet = `
        <div class="ohead" data-drag>
          <span class="emo">${o.cover ? photoTag({ id: o.id, src: o.cover }, 140) : HOP.oicon(o, 26)}</span>
          <div class="grow" style="min-width:0"><h1 class="h1">${esc(o.title)}</h1>
            <div class="when">${when(o.startsAt)}</div>
            <div class="sub">${esc(area)}<span class="sep"></span>${o.visibility === 'public' ? I('globe', 14) + ' Public' : I('lock', 14) + ' Private'}<span class="sep"></span>${org ? 'You’re hosting' : `Hosted by ${esc(host.first)}`}</div></div>
        </div>
        ${!org ? `<div style="margin-top:14px">${HOP.rsvpSeg(o)}</div>` : ''}
        <button class="who" data-act="attendees" data-id="${id}" style="border-bottom:1px solid var(--line)">
          ${avatarStack(going, 6, 30)}
          <div class="grow"><b>${going.length} ${going.length === 1 ? 'person is' : 'people are'} going</b><div class="meta">${[maybe && `${maybe} maybe`, waiting && `${waiting} haven’t replied`].filter(Boolean).join(' · ') || 'Everyone’s replied'}</div></div>${I('chev')}
        </button>
        <div class="section"><p class="label"><span>The plan</span>${stops.length ? `<span class="mono">${plural(stops.length, 'stop')}</span>` : ''}</p>
          ${stops.length ? stopsList(o, org) : `<p class="empty" style="padding:6px 0 10px">No stops yet.</p>${org ? `<button class="addstop" data-act="addStops" data-id="${id}"><span class="num">${I('plus', 16)}</span> Add a stop</button>` : ''}`}
        </div>
        <div class="section"><p class="label">Album</p><p class="meta" style="margin:0">Photos anyone takes on the night land here, sorted by stop. Starts when the night does.</p></div>
        ${o.activity?.length ? `<div class="section"><p class="label">Updates</p><div class="activity">${o.activity.slice(0, 6).map(HOP.actLine).join('')}</div></div>` : ''}
        ${org ? `<div class="section" style="display:flex;gap:16px"><button class="linkbtn" data-act="editOuting" data-id="${id}">${I('edit', 15)} Edit details</button><button class="linkbtn" style="color:var(--text-3)" data-act="deleteOuting" data-id="${id}">${I('trash', 15)} Delete</button></div>` : ''}
        <div class="cta">
          ${org ? `<button class="btn" data-act="invite" data-id="${id}">${I('share', 18)} Invite</button>
                   <button class="btn primary" data-act="startNight" data-id="${id}" ${stops.length ? '' : 'disabled'}>Start the night</button>`
            : `<button class="btn" data-act="invite" data-id="${id}">${I('share', 18)} Share outing</button>`}
        </div>`;
      return {
        top: `<div class="floatbar"><button class="fbtn" data-act="back" aria-label="Back">${I('back')}</button>
          <button class="fbtn" data-act="invite" data-id="${id}">${I('link', 18)} ${org ? 'Invite' : 'Share'}</button></div>`,
        sheet, sizes: ['half', 'full'],
        map() { HOP.map.setSelected(null); HOP.map.clearOutingPins(); HOP.map.showRoute(id, 'plan'); },
        mapUpdate() { HOP.map.showRoute(id, 'plan', { fit: false }); },
      };
    },
    mount({ id }) { bindStops(id); },
  };

  HOP.actions.venueFromStop = (d) => HOP.app.openVenue(d.id);
  HOP.actions.addStops = (d) => HOP.app.startPicking(d.id);
  HOP.actions.editOuting = (d) => HOP.app.go('create', { edit: d.id, fresh: 1 });
  HOP.actions.deleteOuting = (d) => {
    const o = S.outing(d.id);
    ui.openModal(`<div class="mhead"><h2 class="h2">Delete ${esc(o.title)}?</h2></div>
      <p class="meta" style="margin:0 0 16px">Everyone you invited will lose the plan. This can’t be undone.</p>
      <div class="btnrow"><button class="btn" data-act="closeModal">Keep it</button><button class="btn live" data-act="confirmDelete" data-id="${d.id}">Delete</button></div>`);
  };
  HOP.actions.confirmDelete = (d) => { ui.closeModal(); S.deleteOuting(d.id); HOP.app.go('outings', {}, { resetTo: 'outings' }); ui.toast('Outing deleted'); };
  HOP.actions.rsvp = (d) => {
    S.rsvp(d.id, d.v);
    ui.toast({ going: 'You’re going', maybe: 'Marked as maybe', declined: 'Let them know you can’t make it' }[d.v]);
  };

  // time edits + drag reorder
  function bindStops(id) {
    const wrap = document.getElementById('stops');
    if (!wrap) return;
    const o = S.outing(id);
    wrap.querySelectorAll('input[data-time]').forEach((inp) => inp.addEventListener('change', () => {
      if (!inp.value) return;
      const [h, m] = inp.value.split(':').map(Number);
      const base = new Date(o.startsAt);
      let at = new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m).getTime();
      if (at < o.startsAt - 3 * 36e5) at += 864e5; // 1:00 AM belongs to the same night
      S.setStopTime(inp.dataset.time, at);
    }));
    wrap.querySelectorAll('[data-handle]').forEach((h) => {
      h.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        e.preventDefault();
        const ids = S.stopsOf(id).map((s) => s.id);
        const i = ids.indexOf(h.dataset.handle), j = i + (e.key === 'ArrowUp' ? -1 : 1);
        if (j < 0 || j >= ids.length) return;
        [ids[i], ids[j]] = [ids[j], ids[i]];
        S.reorderStops(id, ids);
        setTimeout(() => document.querySelector(`[data-handle="${ids[j]}"]`)?.focus(), 30);
      });
      h.addEventListener('pointerdown', (e) => startDrag(e, h, wrap, id));
    });
  }
  function startDrag(e, handle, wrap, id) {
    e.preventDefault();
    const row = handle.closest('.stop');
    const rows = [...wrap.querySelectorAll('.stop')];
    wrap.querySelectorAll('.walk').forEach((w) => (w.style.display = 'none'));
    const startY = e.clientY;
    const startTop = row.offsetTop;
    row.classList.add('lifted');
    handle.setPointerCapture(e.pointerId);
    let order = rows.slice();
    const move = (ev) => {
      const dy = ev.clientY - startY;
      row.style.transform = `translateY(${dy}px)`;
      const y = startTop + dy + row.offsetHeight / 2;
      const others = order.filter((r) => r !== row);
      let idx = others.findIndex((r) => y < r.offsetTop + r.offsetHeight / 2 + (r.offsetTop > startTop ? 0 : 0));
      if (idx === -1) idx = others.length;
      const next = [...others.slice(0, idx), row, ...others.slice(idx)];
      if (next.some((r, i) => r !== order[i])) {
        order = next;
        const before = row.offsetTop;
        order.forEach((r) => wrap.appendChild(r));
        const shift = row.offsetTop - before;
        row.style.transform = `translateY(${dy - (row.offsetTop - startTop) + 0}px)`;
        void shift;
        order.forEach((r, i) => { const n = r.querySelector('.num'); if (n) n.textContent = i + 1; });
      }
    };
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
      row.classList.remove('lifted'); row.style.transform = '';
      S.reorderStops(id, order.map((r) => r.dataset.stop));
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  }

  // ---------------- attendees ----------------
  HOP.actions.attendees = (d) => {
    const o = S.outing(d.id);
    const att = S.attendeesOf(d.id);
    const groups = [['going', 'Going'], ['maybe', 'Maybe'], ['invited', 'Haven’t replied'], ['declined', 'Can’t go']];
    ui.openModal(`<div class="mhead"><h2 class="h2">Who’s coming</h2><button class="iconbtn bare" data-act="closeModal" aria-label="Close">${I('close')}</button></div>
      ${groups.map(([k, l]) => {
        const list = att.filter((a) => a.rsvp === k);
        if (!list.length) return '';
        return `<div class="section" style="padding-top:8px"><p class="label">${l} · ${list.length}</p><div class="rows">${list.map((a) => {
          const u = S.userById[a.userId];
          return `<div class="row">${avatar(u, 36)}<div class="grow"><div class="t">${esc(u.name)}${a.userId === S.meId ? ' (you)' : ''}</div><div class="s">${a.role === 'organiser' ? 'Organiser' : esc(u.suburb)}</div></div></div>`;
        }).join('')}</div></div>`;
      }).join('')}
      ${S.isOrganiser(o) ? `<button class="btn primary block" style="margin-top:16px" data-act="invite" data-id="${d.id}">${I('plus', 18)} Invite more people</button>` : ''}`);
  };

  // ---------------- invite / share ----------------
  const inviteSel = new Set();
  HOP.inviteUrl = (o) => `https://hop.app/i/${o.inviteCode}`;
  HOP.actions.invite = (d) => {
    inviteSel.clear();
    renderInvite(d.id);
  };
  function friendsByNights() {
    const count = {};
    S.state.outings.filter((o) => o.status === 'ended' && S.myAttendance(o.id)?.rsvp === 'going')
      .forEach((o) => S.going(o.id).forEach((a) => { if (a.userId !== S.meId) count[a.userId] = (count[a.userId] || 0) + 1; }));
    return S.users.filter((u) => u.id !== S.meId).map((u) => ({ u, n: count[u.id] || 0 })).sort((a, b) => b.n - a.n || a.u.name.localeCompare(b.u.name));
  }
  HOP.friendsByNights = friendsByNights;
  function renderInvite(id) {
    const o = S.outing(id);
    const url = HOP.inviteUrl(o);
    const stops = S.stopsOf(id).map((s) => S.stopName(s));
    const msg = `${o.title} — ${when(o.startsAt)}${stops.length ? ` · ${stops[0]}` : ''}. In or out? ${url}`;
    const enc = encodeURIComponent(msg);
    const already = new Set(S.attendeesOf(id).map((a) => a.userId));
    const sheet = ui.openModal(`
      <div class="mhead"><h2 class="h2">Get people in</h2><button class="iconbtn bare" data-act="closeModal" aria-label="Close">${I('close')}</button></div>
      <div class="sharecard"><span class="emo">${HOP.oicon(o)}</span><div class="grow"><b>${esc(o.title)}</b><div class="meta">${when(o.startsAt)} · ${S.going(id).length} going</div><div class="u">hop.app/i/${esc(o.inviteCode)}</div></div></div>
      <div class="linkbox"><code id="inviteUrl">${esc(url)}</code><button class="btn primary" data-act="copyInvite" data-id="${id}">Copy</button></div>
      <div class="apps">
        <a href="sms:?&body=${enc}"><span class="ic" style="background:#2fbf4f">${I('share', 22)}</span>Messages</a>
        <a href="https://wa.me/?text=${enc}" target="_blank" rel="noopener"><span class="ic" style="background:#1fa855">WA</span>WhatsApp</a>
        <a href="fb-messenger://share/?link=${encodeURIComponent(url)}"><span class="ic" style="background:#2b7cff">M</span>Messenger</a>
        <button data-act="shareMore" data-id="${id}"><span class="ic" style="background:var(--surface-3)">${I('link', 22)}</span>Instagram, more</button>
      </div>
      <p class="meta" style="margin:4px 0 0">The link opens the plan and lets them reply Going, Maybe or Can’t go. No account needed to look.</p>
      <div class="section"><p class="label"><span>People you go out with</span><button class="linkbtn" data-act="previewInvite" data-id="${id}">See what they see</button></p>
        <div id="friendPick">${friendsByNights().sort((x, y) => already.has(x.u.id) - already.has(y.u.id)).slice(0, 16).map(({ u, n }) => {
          const a = S.attendeesOf(id).find((x) => x.userId === u.id);
          return `<button class="pickfriend ${inviteSel.has(u.id) ? 'on' : ''}" data-act="toggleFriend" data-u="${u.id}" data-id="${id}" ${already.has(u.id) ? 'disabled' : ''}>
            ${avatar(u, 36)}<div class="grow"><div style="font-weight:650">${esc(u.name)}</div><div class="meta" style="font-size:12px">${n ? `${plural(n, 'night')} out together` : esc(u.suburb)}</div></div>
            ${a ? `<span class="st">${{ going: 'Going', maybe: 'Maybe', invited: 'Invited', declined: 'Can’t go' }[a.rsvp]}</span>` : `<span class="tick">${inviteSel.has(u.id) ? I('check', 16) : ''}</span>`}</button>`;
        }).join('')}</div>
      </div>
      <div class="cta" style="margin-bottom:-18px"><button class="btn primary" data-act="sendInvites" data-id="${id}" ${inviteSel.size ? '' : 'disabled'}>${inviteSel.size ? `Invite ${plural(inviteSel.size, 'person', 'people')}` : 'Pick people to invite'}</button></div>`);
    return sheet;
  }
  HOP.actions.toggleFriend = (d, el) => {
    if (el.disabled) return;
    inviteSel.has(d.u) ? inviteSel.delete(d.u) : inviteSel.add(d.u);
    const sc = document.querySelector('.msheet').scrollTop;
    renderInvite(d.id);
    document.querySelector('.msheet').scrollTop = sc;
  };
  HOP.actions.sendInvites = (d) => {
    const ids = [...inviteSel];
    S.invite(d.id, ids);
    ui.closeModal();
    ui.toast(`Invited ${ids.map((i) => S.userById[i].first).slice(0, 3).join(', ')}${ids.length > 3 ? ` +${ids.length - 3}` : ''}`);
  };
  HOP.actions.copyInvite = async (d) => { const ok = await ui.copy(HOP.inviteUrl(S.outing(d.id))); ui.toast(ok ? 'Link copied. Paste it in the group chat.' : 'Select the link to copy it'); };
  HOP.actions.shareMore = async (d) => {
    const o = S.outing(d.id);
    const data = { title: o.title, text: `${o.title} — ${when(o.startsAt)}. In or out?`, url: HOP.inviteUrl(o) };
    if (navigator.share) { try { await navigator.share(data); return; } catch (e) { if (e.name === 'AbortError') return; } }
    const ok = await ui.copy(data.url);
    ui.toast(ok ? 'Link copied. Paste it into Instagram or anywhere.' : 'Select the link to copy it');
  };

  // What an invited friend sees when they open the link
  HOP.actions.previewInvite = (d) => {
    ui.closeModal();
    const o = S.outing(d.id);
    const stops = S.stopsOf(d.id);
    const host = S.userById[o.organiserId];
    const going = S.going(d.id).map((a) => S.userById[a.userId]);
    const firstStop = stops[0] && S.placeOf(stops[0]);
    const el = ui.openLayer(`
      <div class="layer-head"><button class="iconbtn bare" data-act="closeLayer" aria-label="Close">${I('close')}</button><div class="grow"><div class="t">hop.app/i/${esc(o.inviteCode)}</div><div class="s">Preview of the invite link</div></div></div>
      <div class="layer-body">
        <div style="position:relative;height:180px">${firstStop ? photoTag({ id: firstStop.id, u: firstStop.img }, 900, 360) : ''}<div style="position:absolute;inset:0;background:linear-gradient(to top,var(--ink),transparent 70%)"></div></div>
        <div style="padding:0 16px 30px;margin-top:-40px;position:relative;display:flex;flex-direction:column;gap:14px">
          <div style="display:flex;gap:10px;align-items:center">${avatar(host, 34)}<span class="meta"><b style="color:var(--text)">${esc(host.first)}</b> invited you</span></div>
          <h1 class="h1" style="font-size:36px">${esc(o.title)}</h1>
          <div class="when mono amber" style="font-size:14px">${when(o.startsAt)}</div>
          <div style="display:flex;align-items:center;gap:10px">${avatarStack(going, 7, 30)}<span class="meta">${going.length} going</span></div>
          <div class="rows">${stops.map((s, i) => `<div class="row"><span class="stop" style="padding:0;border:0;background:none"><span class="num">${i + 1}</span></span><div class="grow"><div class="t">${esc(S.stopName(s))}</div><div class="s">${esc(S.placeOf(s).suburb)}</div></div><span class="mono amber">${timeShort(s.at)}</span></div>`).join('')}</div>
          <div class="seg"><button data-act="previewTap" data-v="going">Going</button><button data-act="previewTap" data-v="maybe">Maybe</button><button data-act="previewTap" data-v="declined">Can’t go</button></div>
          <p class="meta" style="margin:0;text-align:center">Opens in the app if they have it. Otherwise this page works in any browser.</p>
        </div>
      </div>`);
    return el;
  };
  HOP.actions.previewTap = (d, el) => { el.parentNode.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === el)); el.dataset.v && (el.dataset.v = el.dataset.v); };

  HOP.actions.back = () => HOP.app.back();
})();
