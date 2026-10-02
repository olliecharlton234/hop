/* HOP — Live outing mode, camera + uploads, shared album, photo viewer, wrap-up */
(() => {
  const { esc, avatar, avatarStack, photoTag, photoSrc, time, timeShort, walkMins, plural, longDate } = HOP.util;
  const I = HOP.icon;
  const S = HOP.store;
  const ui = HOP.ui;

  // ---------------- photo helpers ----------------
  HOP.photos = {
    // downscale on device before storing/sending (a real backend would upload the original too)
    shrink(file, max = 1280, q = 0.82) {
      return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const im = new Image();
        im.onload = () => {
          const k = Math.min(1, max / Math.max(im.width, im.height));
          const c = document.createElement('canvas');
          c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
          c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
          URL.revokeObjectURL(url);
          resolve(c.toDataURL('image/jpeg', q));
        };
        im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that image')); };
        im.src = url;
      });
    },
    async saveToRoll(files) {
      // Phones: the share sheet has "Save image". Desktop: a normal download.
      try {
        if (navigator.canShare && navigator.canShare({ files })) { await navigator.share({ files }); return true; }
      } catch (e) { if (e.name === 'AbortError') return false; }
      files.forEach((f, i) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(f); a.download = f.name || `hop-${Date.now()}-${i}.jpg`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      });
      return true;
    },
  };

  const clockFor = (o) => {
    const st = S.stopsOf(o.id)[o.live.current];
    return st.at + (HOP.now() - o.live.arrivedAt);
  };
  HOP.liveClock = clockFor;

  // ---------------- LIVE ----------------
  HOP.screens.live = {
    nav: 'outings',
    render({ id }) {
      const o = S.outing(id);
      if (!o || o.status !== 'live') return HOP.screens.outing.render({ id });
      const org = S.isOrganiser(o);
      const goingMe = S.myAttendance(id)?.rsvp === 'going';
      const stops = S.stopsOf(id);
      const cur = stops[o.live.current], nx = stops[o.live.current + 1];
      const cp = S.placeOf(cur), np = nx && S.placeOf(nx);
      const photos = S.photosOf(id);
      const going = S.going(id).map((a) => S.userById[a.userId]);
      const recent = photos.slice(-14).reverse();
      const sheet = `
        <div class="nowcard" data-drag>
          <div><p class="label red">Now</p><div class="v">${esc(S.stopName(cur))}</div><div class="m">${I('clock', 13)} since ${timeShort(cur.at)}</div></div>
          <div>${np ? `<p class="label">Next stop</p><div class="v">${esc(S.stopName(nx))}</div><div class="m">${timeShort(nx.at)} · ${I('walk', 13)} ${walkMins(cp, np)} min</div>`
            : `<p class="label">Last stop</p><div class="v">Home time</div><div class="m">${o.live.current + 1} of ${stops.length} stops</div>`}</div>
        </div>
        ${!goingMe ? `<div class="shutter-row"><button class="btn roll primary" data-act="joinOuting" data-id="${id}">Join them at ${esc(S.stopName(cur))}</button><button class="btn roll" data-act="back">Not tonight</button></div>` : `<div class="shutter-row">
          <button class="btn roll" data-act="roll" data-id="${id}">${I('image', 18)} Camera roll</button>
          ${org ? (np ? `<button class="btn roll primary" data-act="advance" data-id="${id}">${I('walk', 18)} Go to ${esc(S.stopName(nx).split(' ')[0].replace(/'s$/, '’s'))}</button>`
            : `<button class="btn roll live" data-act="endNight" data-id="${id}">End the night</button>`) : ''}
        </div>`}
        <div class="section"><p class="label"><span>Album · ${plural(photos.length, 'photo')}</span>${photos.length ? `<button class="linkbtn" data-act="album" data-id="${id}">See all</button>` : ''}</p>
          ${photos.length ? `<div class="strip">${recent.map((p) => `<button data-act="viewPhoto" data-id="${id}" data-p="${p.id}">${photoTag(p, 200, 250)}<span class="by">${avatar(S.userById[p.userId], 20)}</span>${HOP.fresh.has(p.id) ? '<span class="newdot"></span>' : ''}</button>`).join('')}</div>`
            : `<p class="meta" style="margin:0">Nothing yet. Photos from everyone on the outing show up here as they’re taken.</p>`}
        </div>
        ${goingMe && HOP.whereNextSection ? HOP.whereNextSection(o) : ''}
        <button class="who" data-act="attendees" data-id="${id}" style="border-bottom:1px solid var(--line);margin-top:10px">${avatarStack(going, 7, 30)}<div class="grow"><b>${going.length} out tonight</b></div>${I('chev')}</button>
        ${S.canChat(o) ? `<div class="section"><p class="label"><span>Latest in the chat</span><button class="linkbtn" data-act="otab" data-t="chat">Open chat</button></p>
          <div class="activity">${S.messagesOf(id).slice(-4).map((m) => `<button class="act" data-act="otab" data-t="chat">${m.userId ? avatar(S.userById[m.userId], 28) : `<span class="ico" style="width:28px;height:28px">${I('check', 14)}</span>`}<div class="grow" style="text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(HOP.chatPreview(m))}</div><time>${HOP.util.ago(m.at)}</time></button>`).join('')}</div></div>` : ''}
        ${org && np ? `<div class="section"><button class="btn block" data-act="endNight" data-id="${id}">${I('flag', 18)} End the night early</button></div>` : ''}
        <div class="demo" ${goingMe ? '' : 'hidden'}><p class="label">Prototype · simulate the group</p>
          <button class="btn sm" data-act="simPhoto" data-id="${id}">A friend posts</button>
          <button class="btn sm" data-act="simBurst" data-id="${id}">Photo rush</button>
          <button class="btn sm" data-act="openAs" data-u="u_jack">Open as Jack</button></div>`;
      return {
        top: `<div class="livebar"><button class="iconbtn bare" data-act="back" aria-label="Back">${I('back')}</button>
          <div class="grow"><span class="livepill">LIVE</span><div class="t">${esc(o.title)}</div></div>
          <span class="clock" data-clock="${id}">${time(clockFor(o))}</span>
          <button class="iconbtn bare" data-act="album" data-id="${id}" aria-label="Album">${I('memories')}</button></div>`,
        sheet, sizes: ['half', 'full'],
        map() {
          HOP.map.setSelected(null); HOP.map.clearOutingPins();
          HOP.map.showRoute(id, 'live', { fit: false });
          HOP.map.fitTo([cp, np || (stops[o.live.current - 1] && S.placeOf(stops[o.live.current - 1]))].filter(Boolean));
        },
        mapUpdate() { HOP.map.showRoute(id, 'live', { fit: false }); },
      };
    },
  };

  HOP.actions.openLive = (d) => HOP.app.go('live', { id: d.id });
  HOP.actions.startNight = (d) => {
    const o = S.outing(d.id);
    ui.openModal(`<div class="mhead"><h2 class="h2">Start ${esc(o.title)}?</h2></div>
      <p class="meta" style="margin:0 0 16px">Everyone going gets a heads-up and the shared album opens. The map switches to tonight’s route.</p>
      <div class="btnrow"><button class="btn" data-act="closeModal">Not yet</button><button class="btn primary" data-act="confirmStart" data-id="${d.id}">Start the night</button></div>`);
  };
  HOP.actions.confirmStart = (d) => { ui.closeModal(); S.startOuting(d.id); HOP.app.go('live', { id: d.id }, { replace: true }); };
  HOP.actions.advance = (d) => {
    S.advance(d.id);
    const o = S.outing(d.id), st = S.stopsOf(d.id), p = S.placeOf(st[o.live.current]);
    ui.toast(`Moving on to ${esc(p.name)}`);
    const nx = st[o.live.current + 1];
    HOP.map.fitTo([p, nx ? S.placeOf(nx) : S.placeOf(st[o.live.current - 1])].filter(Boolean));
  };
  HOP.actions.endNight = (d) => {
    const o = S.outing(d.id);
    ui.openModal(`<div class="mhead"><h2 class="h2">Wrap up ${esc(o.title)}?</h2></div>
      <p class="meta" style="margin:0 0 16px">It moves to Memories with the route, the people and every photo. Anyone can still add the ones on their camera roll.</p>
      <div class="btnrow"><button class="btn" data-act="closeModal">Keep going</button><button class="btn live" data-act="confirmEnd" data-id="${d.id}">End the night</button></div>`);
  };
  HOP.actions.confirmEnd = (d) => { ui.closeModal(); S.endOuting(d.id); showWrap(d.id); };
  HOP.actions.simPhoto = (d) => HOP.sim.friendPost(d.id, { delay: 0 });
  HOP.actions.simBurst = (d) => { HOP.sim.burst(d.id); ui.toast('Five friends start posting…'); };
  HOP.actions.openAs = (d) => {
    const u = location.href.split('#')[0] + '#as=' + d.u;
    const w = window.open(u, '_blank');
    if (!w) ui.toast('Allow pop-ups, or open this page in a second tab');
  };

  // ---------------- capture + upload ----------------
  // ---------------- one-tap camera ----------------
  // In-app viewfinder where the browser allows it; otherwise the phone's own camera via a file input.
  // Every shot is posted straight away: tagged with the outing, the current stop, you and the time.
  let saveRoll = false;
  try { saveRoll = localStorage.getItem('hop.saveRoll') === '1'; } catch (e) {}
  let camVis = 'outing';
  HOP.actions.camera = (d) => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) openCamera(d.id);
    else nativeCapture(d.id);
  };
  function nativeCapture(outingId) {
    const inp = document.getElementById('camIn');
    inp.onchange = async () => {
      const f = inp.files[0]; inp.value = '';
      if (!f) return;
      const [src, thumb] = await Promise.all([HOP.photos.shrink(f, 1280), HOP.photos.shrink(f, 360, 0.7)]);
      const [p] = S.addPhotos(outingId, [{ src, thumb }], { source: 'camera', visibility: camVis });
      confirmShot(outingId, p);
    };
    inp.click();
  }
  function confirmShot(outingId, p) {
    const o = S.outing(outingId);
    const st = S.state.stops.find((x) => x.id === p.stopId);
    ui.toast(`${p.visibility === 'private' ? 'Saved privately' : `Added to ${esc(o.title)}`} · ${st ? esc(S.stopName(st)) + ' · ' : ''}${time(p.takenAt)}`);
  }
  async function openCamera(outingId) {
    const o = S.outing(outingId);
    let stream = null, facing = 'environment';
    const el = ui.openLayer('', 'camera', () => { if (stream) stream.getTracks().forEach((t) => t.stop()); HOP.app.render({ keepScroll: true }); });
    const ctx = () => {
      const st = S.stopsOf(outingId)[o.live ? o.live.current : 0];
      return `${st ? `at ${esc(S.stopName(st))} · ` : ''}${time(HOP.now())}`;
    };
    const shots = [];
    const draw = () => {
      const last = shots[shots.length - 1];
      el.innerHTML = `<video playsinline autoplay muted></video><div class="flash"></div>
        <div class="camtop"><button class="iconbtn bare" data-act="closeLayer" aria-label="Close camera">${I('close', 24)}</button>
          <div class="camctx"><b>${esc(o.title)}</b><span id="camctx">${ctx()}</span></div>
          <button class="iconbtn bare" data-act="camFlip" aria-label="Switch camera">${I('repeat', 22)}</button></div>
        <div class="camerr" hidden></div>
        <div class="cambottom">
          <div class="seg camvis"><button data-act="camVis" data-v="outing" class="${camVis === 'outing' ? 'on' : ''}">${I('users', 15)} Outing</button><button data-act="camVis" data-v="private" class="${camVis === 'private' ? 'on' : ''}">${I('lock', 15)} Just me</button></div>
          <div class="camrow">
            <button class="lastshot" data-act="${shots.length ? 'camAlbum' : 'camRoll'}" aria-label="${shots.length ? 'See photos' : 'Choose from library'}">${last ? HOP.util.photoTag(last, 120) + `<b>${shots.length}</b>` : I('image', 24)}</button>
            <button class="shutter big" data-act="snap" aria-label="Take photo"></button>
            <label class="saveroll"><input type="checkbox" id="saveRoll" ${saveRoll ? 'checked' : ''}><span>Save to camera roll</span></label>
          </div>
        </div>`;
      const v = el.querySelector('video');
      if (stream) v.srcObject = stream;
      el.querySelector('#saveRoll').onchange = (e) => { saveRoll = e.target.checked; try { localStorage.setItem('hop.saveRoll', saveRoll ? '1' : '0'); } catch (er) {} };
    };
    async function start() {
      try {
        if (stream) stream.getTracks().forEach((t) => t.stop());
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false });
        const v = el.querySelector('video'); if (v) v.srcObject = stream;
      } catch (e) {
        // No camera or permission refused: hand over to the phone's camera / file picker instead
        ui.closeLayer();
        nativeCapture(outingId);
      }
    }
    draw(); await start();
    const tick = setInterval(() => { const c = el.querySelector('#camctx'); if (!el.isConnected) return clearInterval(tick); if (c) c.innerHTML = ctx(); }, 15000);

    HOP.actions.camFlip = () => { facing = facing === 'environment' ? 'user' : 'environment'; start(); };
    HOP.actions.camVis = (d) => { camVis = d.v; el.querySelectorAll('.camvis button').forEach((b) => b.classList.toggle('on', b.dataset.v === camVis)); };
    HOP.actions.camRoll = () => { ui.closeLayer(); HOP.actions.roll({ id: outingId }); };
    HOP.actions.camAlbum = () => { ui.closeLayer(); HOP.openAlbum(outingId); };
    HOP.actions.snap = async () => {
      const v = el.querySelector('video');
      if (!v || !v.videoWidth) return;
      const k = Math.min(1, 1600 / Math.max(v.videoWidth, v.videoHeight));
      const c = document.createElement('canvas'); c.width = Math.round(v.videoWidth * k); c.height = Math.round(v.videoHeight * k);
      c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
      const src = c.toDataURL('image/jpeg', 0.85);
      const t = document.createElement('canvas'); const tk = 360 / Math.max(c.width, c.height); t.width = Math.round(c.width * tk); t.height = Math.round(c.height * tk);
      t.getContext('2d').drawImage(c, 0, 0, t.width, t.height);
      const [p] = S.addPhotos(outingId, [{ src, thumb: t.toDataURL('image/jpeg', 0.7) }], { source: 'camera', visibility: camVis });
      shots.push(p);
      const fl = el.querySelector('.flash'); fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go');
      const ls = el.querySelector('.lastshot'); ls.dataset.act = 'camAlbum'; ls.innerHTML = HOP.util.photoTag(p, 120) + `<b>${shots.length}</b>`;
      confirmShot(outingId, p);
      if (saveRoll) c.toBlob((b) => b && HOP.photos.saveToRoll([new File([b], `hop-${p.id}.jpg`, { type: 'image/jpeg' })]), 'image/jpeg', 0.9);
    };
  }
  HOP.actions.roll = (d) => pickFiles('rollIn', d.id, 'upload');
  function pickFiles(inputId, outingId, source) {
    const inp = document.getElementById(inputId);
    inp.onchange = () => { const files = [...inp.files]; inp.value = ''; if (files.length) compose(outingId, files, source); };
    inp.click();
  }

  let draft = null;
  function compose(outingId, files, source) {
    const o = S.outing(outingId);
    const st = S.stopsOf(outingId);
    const stop = o.live ? st[o.live.current] : st[st.length - 1];
    draft = { outingId, files, source, visibility: 'outing', save: source === 'camera', stopId: stop?.id, urls: files.map((f) => URL.createObjectURL(f)) };
    const el = ui.openLayer('', 'compose', () => { draft && draft.urls.forEach(URL.revokeObjectURL); draft = null; });
    renderCompose(el);
  }
  function renderCompose(el = ui.topLayer()) {
    const o = S.outing(draft.outingId);
    const stopName = draft.stopId ? S.placeOf(S.state.stops.find((s) => s.id === draft.stopId)).name : '';
    el.innerHTML = `
      <div class="layer-head"><button class="iconbtn bare" data-act="closeLayer" aria-label="Cancel">${I('close')}</button>
        <div class="grow"><div class="t">${draft.files.length > 1 ? plural(draft.files.length, 'photo') : 'New photo'}</div><div class="s">${esc(o.title)}${stopName ? ` · at ${esc(stopName)}` : ''}</div></div></div>
      <div class="preview ${draft.files.length === 1 ? 'single' : ''}">${draft.urls.map((u) => `<img src="${u}" alt="">`).join('')}</div>
      <div class="opts">
        <div class="seg" role="radiogroup" aria-label="Who sees this">
          <button data-act="composeVis" data-v="outing" class="${draft.visibility === 'outing' ? 'on' : ''}">${I('users', 16)} The outing</button>
          <button data-act="composeVis" data-v="private" class="${draft.visibility === 'private' ? 'on' : ''}">${I('lock', 16)} Just me</button>
        </div>
        ${draft.source === 'camera' ? `<label class="check"><input type="checkbox" id="saveRoll" ${draft.save ? 'checked' : ''}> Also save to my camera roll</label>` : ''}
        <button class="btn primary block" data-act="postPhotos">${draft.visibility === 'outing' ? `Add to ${esc(o.title)}` : 'Keep it private'}</button>
      </div>`;
    const cb = el.querySelector('#saveRoll');
    if (cb) cb.onchange = () => (draft.save = cb.checked);
  }
  HOP.actions.composeVis = (d) => { draft.visibility = d.v; renderCompose(); };
  HOP.actions.postPhotos = async (d, btn) => {
    btn.disabled = true; btn.textContent = 'Adding…';
    try {
      const items = [];
      for (const f of draft.files) {
        const [src, thumb] = await Promise.all([HOP.photos.shrink(f, 1280), HOP.photos.shrink(f, 360, 0.7)]);
        items.push({ src, thumb });
      }
      const { outingId, visibility, source, stopId, save, files } = draft;
      S.addPhotos(outingId, items, { visibility, source, stopId });
      ui.closeLayer();
      ui.toast(visibility === 'outing' ? `Added to the album · ${plural(items.length, 'photo')}` : 'Saved to your private photos');
      if (save) HOP.photos.saveToRoll(files);
      if (!S.storageOk) ui.toast('Phone storage is full. These photos stay until you close the app.');
    } catch (e) {
      btn.disabled = false; btn.textContent = 'Try again';
      ui.toast(esc(e.message));
    }
  };

  // ---------------- ALBUM ----------------
  let albumTab = 'all';
  HOP.actions.album = (d) => openAlbum(d.id);
  function openAlbum(id) {
    albumTab = 'all';
    const el = ui.openLayer('', 'album', () => (HOP.app.albumOpen = null));
    HOP.app.albumOpen = id;
    renderAlbum(id, el);
  }
  HOP.openAlbum = openAlbum;
  function renderAlbum(id, el) {
    const o = S.outing(id);
    const all = S.photosOf(id);
    const list = albumTab === 'mine' ? all.filter((p) => p.userId === S.meId) : all;
    const stops = S.stopsOf(id);
    const body = el.querySelector('.layer-body');
    const sc = body ? body.scrollTop : 0;
    const contributors = new Set(all.map((p) => p.userId)).size;
    el.innerHTML = `
      <div class="layer-head"><button class="iconbtn bare" data-act="closeLayer" aria-label="Back">${I('back')}</button>
        <div class="grow"><div class="t">${esc(o.title)}</div><div class="s">${plural(all.length, 'photo')} from ${plural(contributors, 'person', 'people')}</div></div></div>
      <div class="tabs"><button data-act="albumTab" data-t="all" data-id="${id}" class="${albumTab === 'all' ? 'on' : ''}">Everyone</button><button data-act="albumTab" data-t="mine" data-id="${id}" class="${albumTab === 'mine' ? 'on' : ''}">Mine</button></div>
      <div class="layer-body" style="padding-bottom:${o.status === 'ended' ? 20 : 90}px">
        ${stops.map((s, i) => {
          const ps = list.filter((p) => p.stopId === s.id);
          if (!ps.length) return '';
          return `<section class="album-group"><header><b>${i + 1}. ${esc(S.stopName(s))}</b><span class="mono dim">${timeShort(s.at)} · ${ps.length}</span></header>
            <div class="grid">${ps.map((p) => `<button data-act="viewPhoto" data-id="${id}" data-p="${p.id}" aria-label="Photo by ${esc(S.userById[p.userId].first)}">${photoTag(p, 300)}${p.visibility === 'private' ? `<span class="lock">${I('lock', 12)}</span>` : ''}${HOP.fresh.has(p.id) ? '<span class="fresh"></span>' : ''}</button>`).join('')}</div></section>`;
        }).join('') || `<p class="empty" style="padding:30px 16px">${albumTab === 'mine' ? 'You haven’t added any photos to this one.' : 'No photos yet.'}</p>`}
      </div>
      <div class="album-cta"><button class="btn" data-act="roll" data-id="${id}">${I('image', 18)} Add from camera roll</button>${o.status === 'live' ? `<button class="btn primary" data-act="camera" data-id="${id}">${I('camera', 18)} Take a photo</button>` : ''}</div>`;
    el.querySelector('.layer-body').scrollTop = sc;
  }
  HOP.renderAlbum = renderAlbum;
  HOP.actions.albumTab = (d) => { albumTab = d.t; renderAlbum(d.id, ui.topLayer()); };

  // ---------------- VIEWER ----------------
  HOP.actions.viewPhoto = (d) => {
    const list = d.vp ? S.venuePhotos(d.vp) : S.photosOf(d.id).filter((p) => albumTab !== 'mine' || p.userId === S.meId || !HOP.app.albumOpen);
    let i = Math.max(0, list.findIndex((p) => p.id === d.p));
    const el = ui.openLayer('', 'viewer', () => document.removeEventListener('keydown', key));
    const draw = () => {
      const p = list[i];
      const u = S.userById[p.userId];
      const st = d.vp ? { venueId: d.vp } : S.state.stops.find((s) => s.id === p.stopId);
      el.innerHTML = `
        <div class="layer-head" style="border-color:#222"><button class="iconbtn bare" data-act="closeLayer" aria-label="Close">${I('close')}</button>
          <div class="grow"><div class="t" style="font-size:15px">${i + 1} of ${list.length}</div><div class="s">${st ? esc(d.vp ? S.venueById[d.vp].name : S.placeOf(st).name) : ''} · ${d.vp ? HOP.util.ago(p.takenAt) : time(p.takenAt)}</div></div>
          <button class="iconbtn bare" data-act="savePhoto" data-p="${p.id}" aria-label="Save">${I('download')}</button></div>
        <div class="stage">${photoTag(p, 1400, 1800)}
          ${i > 0 ? `<button class="nav-arrow l" data-act="vPrev" aria-label="Previous">${I('back', 28)}</button>` : ''}
          ${i < list.length - 1 ? `<button class="nav-arrow r" data-act="vNext" aria-label="Next">${I('chev', 28)}</button>` : ''}</div>
        ${!u ? `<div class="vmeta"><div class="grow"><b>Shared publicly</b><div class="meta" style="font-size:12.5px">Posted at ${esc(S.venueById[p.venueId]?.name || '')} · ${HOP.util.ago(p.takenAt)}${p.demo ? ' · demo data' : ''}</div></div></div>` : `<div class="vmeta">${avatar(u, 34)}<div class="grow"><b>${p.userId === S.meId ? 'You' : esc(u.name)}</b><div class="meta" style="font-size:12.5px">${p.source === 'camera' ? 'Taken in HOP' : 'From camera roll'} · ${HOP.util.dayDate(p.takenAt)}</div></div>
          ${p.userId === S.meId ? `<button class="btn sm" data-act="photoVis" data-p="${p.id}">${p.visibility === 'private' ? `${I('lock', 15)} Just me` : `${I('users', 15)} Shared`}</button>` : ''}</div>`}`;
      const stage = el.querySelector('.stage');
      let x0 = null;
      stage.addEventListener('pointerdown', (e) => (x0 = e.clientX));
      stage.addEventListener('pointerup', (e) => { if (x0 == null) return; const dx = e.clientX - x0; x0 = null; if (dx < -50 && i < list.length - 1) { i++; draw(); } else if (dx > 50 && i > 0) { i--; draw(); } });
    };
    const key = (e) => { if (e.key === 'ArrowRight' && i < list.length - 1) { i++; draw(); } if (e.key === 'ArrowLeft' && i > 0) { i--; draw(); } };
    document.addEventListener('keydown', key);
    HOP.actions.vPrev = () => { i--; draw(); };
    HOP.actions.vNext = () => { i++; draw(); };
    HOP.actions.photoVis = (dd) => { const p = list[i]; S.setPhotoVisibility(p.id, p.visibility === 'private' ? 'outing' : 'private'); draw(); ui.toast(p.visibility === 'private' ? 'Only you can see this one' : 'Shared with the outing'); };
    draw();
  };
  HOP.actions.savePhoto = async (d) => {
    const p = S.state.photos.find((x) => x.id === d.p) || (S.state.venuePhotos || []).find((x) => x.id === d.p);
    try {
      const res = await fetch(photoSrc(p, 2000, 2000));
      const blob = await res.blob();
      await HOP.photos.saveToRoll([new File([blob], `hop-${p.id}.jpg`, { type: blob.type || 'image/jpeg' })]);
    } catch (e) { window.open(photoSrc(p, 2000, 2000), '_blank'); }
  };

  // ---------------- WRAP-UP ----------------
  function showWrap(id) {
    const o = S.outing(id);
    const photos = S.photosOf(id);
    const pick = photos.length > 6 ? Array.from({ length: 6 }, (_, k) => photos[Math.floor((k * photos.length) / 6)]) : photos;
    HOP.app.go('memory', { id }, { resetTo: 'memories', silent: true });
    ui.openLayer(`
      <div class="layer-head"><button class="iconbtn bare" data-act="closeLayer" aria-label="Close">${I('close')}</button><div class="grow"><div class="t">${esc(o.title)}</div><div class="s">${longDate(o.startsAt)}</div></div></div>
      <div class="layer-body">
        ${pick.length ? `<div class="mosaic">${pick.map((p) => photoTag(p, 500)).join('')}</div>` : ''}
        <div class="inner">
          <h1 class="big">That’s a wrap.</h1>
          <div class="stats"><div><b>${photos.length}</b><span>photos</span></div><div><b>${S.going(id).length}</b><span>people</span></div><div><b>${S.stopsOf(id).length}</b><span>stops</span></div></div>
          <p class="meta" style="margin:0">Saved to Memories. Everyone who came can open it, and add the photos still sitting on their phones.</p>
          <button class="btn primary block" data-act="closeLayer">Open the memory</button>
          <button class="btn block" data-act="planNext" data-id="${id}">${I('repeat', 18)} Plan the next one</button>
        </div>
      </div>`, 'wrap');
  }
  HOP.actions.planNext = () => { ui.closeAllLayers(); HOP.app.go('create', { fresh: 1 }); };
})();
