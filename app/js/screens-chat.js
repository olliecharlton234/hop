/* HOP — Outing chat. One small group chat per outing, for coordinating that night only.
   External apps get people into the outing; this chat runs the night once they're in.
   Photos stay in the outing album: chat lines only point at them. */
(() => {
  const { esc, avatar, avatarStack, photoTag, time, hm, plural, dayDate, longDate, ago, metres, distLabel, walkMins } = HOP.util;
  const I = HOP.icon;
  const S = HOP.store;
  const ui = HOP.ui;

  let replyTo = null, selected = null, attachOpen = false, draft = {}, stuckToBottom = true, chatFocused = false;
  const REACTIONS = ['up', 'heart', 'haha', 'fire', 'wow'];
  const nameOf = (id) => (id === S.meId ? 'You' : S.userById[id]?.first || 'Someone');
  const placeName = (sys) => (sys.eventId ? HOP.events.byId(sys.eventId)?.title : S.venueById[sys.venueId]?.name) || 'a new spot';

  function sysText(m) {
    const s = m.sys, who = s.userId ? nameOf(s.userId) : '';
    switch (s.type) {
      case 'joined': return `<b>${esc(who)}</b> ${s.userId === S.meId ? 'joined' : 'joined the outing'}`;
      case 'stop': return `<b>${esc(who)}</b> added ${esc(placeName(s))} to the route`;
      case 'moved': return `The group is now at <b>${esc(placeName(s))}</b>`;
      case 'next': return `Next stop changed to <b>${esc(placeName(s))}</b>${s.at ? ` · ${time(s.at)}` : ''}`;
      case 'started': return `<b>${esc(who)}</b> started the night`;
      case 'ended': return 'The night’s wrapped. It’s saved in Memories';
      case 'photos': return `<b>${esc(who)}</b> added ${plural(s.count, 'photo')}`;
      case 'poll': return `${s.count} ${s.count === 1 ? 'person' : 'people'} voted for <b>${esc(placeName(s))}</b>`;
      default: return '';
    }
  }
  const sysIcon = { joined: 'check', stop: 'pin', moved: 'walk', next: 'walk', started: 'flag', ended: 'flag', photos: 'image', poll: 'users' };
  HOP.chatPreview = (m) => {
    if (!m) return '';
    if (m.kind === 'system') return sysText(m).replace(/<[^>]+>/g, '');
    const who = m.userId === S.meId ? 'You' : S.userById[m.userId].first;
    const body = { text: m.text, place: `shared ${m.place?.eventId ? HOP.events.byId(m.place.eventId)?.title : S.venueById[m.place?.venueId]?.name}`, location: 'shared a location', poll: `asked: ${m.poll?.q}`, photo: 'sent a photo' }[m.kind] || '';
    return `${who}: ${m.kind === 'text' ? m.text : body}`;
  };

  // ---------------- tabs: Plan / Chat / Photos ----------------
  HOP.outingTabs = (o, tab) => {
    const n = S.canChat(o) ? S.unread(o.id) : 0;
    const photos = S.photosOf(o.id).length;
    return `<div class="otabs" data-drag role="tablist">
      ${[['plan', o.status === 'ended' ? 'The night' : 'Plan'], ['chat', 'Chat'], ['photos', 'Photos']].map(([k, l]) => `<button role="tab" aria-selected="${tab === k}" class="${tab === k ? 'on' : ''}" data-act="otab" data-t="${k}">${l}${k === 'chat' && n ? `<i class="ub">${n}</i>` : ''}${k === 'photos' && photos ? `<em>${photos}</em>` : ''}</button>`).join('')}
    </div>`;
  };
  HOP.actions.otab = (d) => {
    const r = HOP.app.route;
    if ((r.params.tab || 'plan') === d.t) return;
    r.params.tab = d.t; selected = null; attachOpen = false; stuckToBottom = true;
    HOP.app.render({ resize: true });
  };

  // ---------------- chat body ----------------
  function chatBody(o) {
    if (!S.canChat(o)) {
      return `<div class="chatgate"><p class="meta">The chat is for people on the outing.</p>${o.visibility === 'public' ? `<button class="btn primary" data-act="joinOuting" data-id="${o.id}">Join ${esc(o.title)}</button>` : ''}</div>`;
    }
    const phase = S.chatPhase(o);
    const msgs = S.messagesOf(o.id);
    const lr = S.lastRead(o.id);
    const pref = S.chatPref(o.id);
    const phaseLine = { before: `Planning chat · closes 48 hours after the night`, during: '<span class="livepill">LIVE</span> Coordinating tonight', after: `Open till ${dayDate(S.chatClosesAt(o))} ${hm(S.chatClosesAt(o))}, then saved with the memory`, closed: `Closed ${dayDate(S.chatClosesAt(o))} · kept with the memory` }[phase];
    let html = `<div class="chathead"><span>${phaseLine}</span>
      <button class="bell" data-act="chatPrefs" data-id="${o.id}" aria-label="Notifications: ${pref}">${pref === 'mute' ? I('bellOff', 16) : I('bell', 16)}<em>${{ all: 'All', mentions: 'Mentions', mute: 'Muted' }[pref]}</em></button></div>
      <div class="msgs" id="msgs">`;
    let lastDay = '', prev = null, unreadMarked = false;
    msgs.forEach((m, i) => {
      const day = new Date(m.at).toDateString();
      if (day !== lastDay) { const dd = Math.round((new Date(new Date(HOP.now()).toDateString()) - new Date(day)) / 864e5);
        html += `<div class="chatday">${dd === 0 ? 'Today' : dd === 1 ? 'Yesterday' : longDate(m.at)}</div>`; lastDay = day; prev = null; }
      if (!unreadMarked && lr && m.at > lr && m.userId && m.userId !== S.meId) { html += '<div class="newline"><span>New</span></div>'; unreadMarked = true; }
      if (m.kind === 'system') { html += sysLine(o, m); prev = null; return; }
      const next = msgs[i + 1];
      const first = !prev || prev.userId !== m.userId || m.at - prev.at > 5 * 6e4;
      const last = !next || next.userId !== m.userId || next.kind === 'system' || next.at - m.at > 5 * 6e4 || new Date(next.at).toDateString() !== day;
      html += msgHtml(o, m, first, last, phase);
      prev = m;
    });
    if (!msgs.length) html += `<p class="empty chatempty">${phase === 'before' ? 'Start with the basics: where, when, who’s keen.' : 'Nothing yet.'}</p>`;
    html += '</div>';
    html += phase === 'closed' ? `<div class="composer closed"><p>This chat closed ${dayDate(S.chatClosesAt(o))}. Plan the next one to start a new chat.</p></div>` : composer(o, phase);
    return html;
  }

  function sysLine(o, m) {
    const s = m.sys;
    const ph = s.type === 'photos' ? (s.photoIds || []).map((id) => S.state.photos.find((p) => p.id === id)).filter(Boolean).slice(0, 4) : [];
    return `<div class="msys">${I(sysIcon[s.type] || 'check', 13)}<span>${sysText(m)}</span><time>${hm(m.at)}</time></div>
      ${ph.length ? `<button class="sysph" data-act="album" data-id="${o.id}" aria-label="Open the album">${ph.map((p) => photoTag(p, 140)).join('')}${s.count > ph.length ? `<b>+${s.count - ph.length}</b>` : ''}</button>` : ''}`;
  }

  function msgHtml(o, m, first, last, phase) {
    const mine = m.userId === S.meId;
    const u = S.userById[m.userId];
    const reply = m.replyTo && S.state.messages.find((x) => x.id === m.replyTo);
    const rx = Object.entries(m.reactions || {}).filter(([, l]) => l.length);
    let body;
    if (m.kind === 'place') body = placeCard(o, m);
    else if (m.kind === 'location') body = locCard(o, m);
    else if (m.kind === 'poll') body = pollCard(o, m);
    else if (m.kind === 'photo') body = `<button class="photomsg n${Math.min(4, m.photoIds.length)}" data-act="viewPhoto" data-id="${o.id}" data-p="${m.photoIds[0]}">${m.photoIds.slice(0, 4).map((id) => S.state.photos.find((p) => p.id === id)).filter(Boolean).map((p) => photoTag(p, 300)).join('')}</button>${m.text ? `<div class="bubble">${fmt(m.text)}</div>` : ''}`;
    else body = `<div class="bubble">${fmt(m.text)}</div>`;
    if (m.kind === 'place' && m.text) body = `<div class="bubble">${fmt(m.text)}</div>` + body;
    return `<div class="m ${mine ? 'me' : 'them'} ${first ? 'first' : ''} ${last ? 'last' : ''} ${selected === m.id ? 'sel' : ''}" data-mid="${m.id}">
      ${!mine ? `<span class="mav">${last ? avatar(u, 28) : ''}</span>` : ''}
      <div class="mb">
        ${first && !mine ? `<b class="mname">${esc(u.first)}</b>` : ''}
        ${reply ? `<button class="quote" data-act="jumpMsg" data-m="${reply.id}"><b>${esc(nameOf(reply.userId))}</b> ${esc(HOP.chatPreview(reply).replace(/^[^:]+: /, '').slice(0, 70))}</button>` : ''}
        <div class="mtap" data-act="msgTap" data-m="${m.id}">${body}</div>
        ${rx.length ? `<div class="rx">${rx.map(([e, l]) => `<button class="${l.includes(S.meId) ? 'mine' : ''}" data-act="react" data-m="${m.id}" data-e="${e}">${HOP.react(e, 14)}${l.length > 1 ? `<em>${l.length}</em>` : ''}</button>`).join('')}</div>` : ''}
        ${selected === m.id && phase !== 'closed' ? `<div class="msgbar">${REACTIONS.map((e) => `<button data-act="react" data-m="${m.id}" data-e="${e}" aria-label="React ${e}">${HOP.react(e, 20)}</button>`).join('')}<button class="rp" data-act="replyMsg" data-m="${m.id}">${I('back', 14)} Reply</button></div>` : ''}
        ${last ? `<time class="mt">${hm(m.at)}</time>` : ''}
      </div></div>`;
  }
  // @mentions stand out; nothing else is formatted
  const fmt = (t) => esc(t).replace(/@(\w+)/g, (x, n) => `<span class="mention${n.toLowerCase() === S.me().first.toLowerCase() ? ' me' : ''}">@${n}</span>`);

  function placeCard(o, m) {
    if (m.place.eventId) {
      const e = HOP.events.byId(m.place.eventId);
      if (!e) return '';
      const p = HOP.events.placeOf(e);
      return `<div class="card place ev"><div class="ctop">${photoTag({ id: e.id, u: e.img }, 140)}<div class="grow"><b>${esc(e.title)}</b><span>${esc(p.name)} · ${dayDate(e.startsAt)} ${hm(e.startsAt)} · ${esc(e.priceLabel)}</span></div></div>
        <div class="cbtns"><button data-act="openEvent" data-id="${e.id}">View event</button>${S.isOrganiser(o) && o.status !== 'ended' ? `<button data-act="addEventTo" data-o="${o.id}" data-id="${e.id}">Add as stop</button>` : ''}</div></div>`;
    }
    const v = S.venueById[m.place.venueId];
    const act = S.activity(v.id);
    const onRoute = S.stopsOf(o.id).some((s) => s.venueId === v.id);
    const keen = m.keen || [];
    const canAdd = S.isOrganiser(o) && o.status !== 'ended' && !onRoute;
    return `<div class="card place"><div class="ctop">${photoTag({ id: v.id, u: v.img }, 140)}<div class="grow"><b>${esc(v.name)}</b>
        <span>${esc(v.suburb)} · ${distLabel(HOP.map.distanceFromMe(v))} away${act.hot || act.friends.length ? ` · ${act.label}` : ''}</span>
        ${keen.length ? `<span class="keen">${avatarStack(keen.map((id) => S.userById[id]), 4, 18)} ${keen.length} keen</span>` : ''}</div></div>
      <div class="cbtns"><button data-act="viewPlace" data-v="${v.id}">${I('map', 15)} View on map</button>
        ${onRoute ? `<button disabled>${I('check', 15)} On the route</button>` : canAdd ? `<button class="pri" data-act="placeStop" data-o="${o.id}" data-v="${v.id}" data-m="${m.id}">${I('plus', 15)} Add as stop</button>`
          : o.status !== 'ended' ? `<button class="${keen.includes(S.meId) ? 'pri' : ''}" data-act="keen" data-m="${m.id}">${keen.includes(S.meId) ? I('check', 15) + ' Keen' : 'I’m keen'}</button>` : ''}</div></div>`;
  }
  function locCard(o, m) {
    const live = m.loc.until > HOP.now();
    const d = metres(HOP.map.ME, m.loc);
    const mine = m.userId === S.meId;
    const u = S.userById[m.userId];
    return `<div class="card loc ${live ? '' : 'off'}"><div class="minimap"><span class="pinme">${avatar(u, 26)}</span></div>
      <div class="ctop"><div class="grow"><b>${mine ? 'You shared your location' : `${esc(u.first)} shared ${['u_sarah', 'u_mia', 'u_grace', 'u_hannah', 'u_kate', 'u_priya', 'u_chloe', 'u_zoe', 'u_emily', 'u_jess', 'u_ella', 'u_lucy'].includes(m.userId) ? 'her' : 'his'} location`}</b>
        <span>${esc(m.loc.label)} · ${distLabel(d)} away · ${live ? `live for ${Math.max(1, Math.round((m.loc.until - HOP.now()) / 6e4))} more min` : 'sharing ended'}</span></div></div>
      <div class="cbtns">${live ? `<button data-act="viewLoc" data-m="${m.id}">${I('map', 15)} View on map</button>` : ''}${mine && live ? `<button data-act="stopShare" data-m="${m.id}">Stop sharing</button>` : ''}</div></div>`;
  }
  function pollCard(o, m) {
    const total = m.poll.options.reduce((n, op) => n + op.votes.length, 0) || 1;
    const lead = m.poll.options.slice().sort((a, b) => b.votes.length - a.votes.length)[0];
    return `<div class="card poll"><b class="pq">${esc(m.poll.q)}</b>
      ${m.poll.options.map((op, k) => {
        const v = S.venueById[op.venueId];
        const mineV = op.votes.includes(S.meId);
        return `<button class="opt ${mineV ? 'mine' : ''}" data-act="vote" data-m="${m.id}" data-k="${k}" ${m.poll.closed ? 'disabled' : ''}>
          <i style="width:${Math.round((op.votes.length / total) * 100)}%"></i><span>${esc(v.name)}</span>${avatarStack(op.votes.map((id) => S.userById[id]), 3, 16)}<em>${op.votes.length}</em></button>`;
      }).join('')}
      ${!m.poll.closed && S.isOrganiser(o) && lead.votes.length ? `<div class="cbtns"><button class="pri" data-act="closePoll" data-m="${m.id}" data-o="${o.id}">Go with ${esc(S.venueById[lead.venueId].name)}</button></div>` : ''}
      ${m.poll.closed ? '<span class="pclosed">Voting closed</span>' : ''}</div>`;
  }

  function composer(o, phase) {
    const r = replyTo && S.state.messages.find((x) => x.id === replyTo);
    const hint = { before: `Where, when, who’s keen…`, during: 'Where are you? Heading where?', after: 'Last night was…' }[phase];
    return `<div class="composer">
      ${r ? `<div class="replying"><span>Replying to <b>${esc(nameOf(r.userId))}</b> ${esc(HOP.chatPreview(r).replace(/^[^:]+: /, '').slice(0, 50))}</span><button class="iconbtn bare" data-act="cancelReply" aria-label="Cancel reply">${I('close', 16)}</button></div>` : ''}
      ${attachOpen ? `<div class="tray">
        ${phase === 'during' ? `<button data-act="chatCamera" data-id="${o.id}">${I('camera', 20)}<span>Take a photo</span></button>` : ''}
        <button data-act="chatAlbumPick" data-id="${o.id}">${I('image', 20)}<span>Photo from album</span></button>
        <button data-act="chatPlace" data-id="${o.id}">${I('pin', 20)}<span>Share a place</span></button>
        <button data-act="chatLocation" data-id="${o.id}">${I('locate', 20)}<span>Share my location</span></button>
        ${phase !== 'after' ? `<button data-act="chatPoll" data-id="${o.id}">${I('users', 20)}<span>Vote: where next?</span></button>` : ''}
      </div>` : ''}
      <div class="crow"><button class="cplus ${attachOpen ? 'on' : ''}" data-act="chatAttach" aria-label="Share a photo, place or location">${I('plus', 20)}</button>
        <input id="chatIn" type="text" autocomplete="off" maxlength="300" placeholder="${esc(hint)}" aria-label="Message ${esc(o.title)}">
        <button class="csend" data-act="sendMsg" data-id="${o.id}" aria-label="Send">${I('send', 18)}</button></div>
    </div>`;
  }

  function bindChat(outingId) {
    const body = document.getElementById('sheetBody');
    const inp = document.getElementById('chatIn');
    const o = S.outing(outingId);
    if (!o || !S.canChat(o)) return;
    if (inp) {
      inp.value = draft[outingId] || '';
      inp.addEventListener('input', () => (draft[outingId] = inp.value));
      inp.addEventListener('focus', () => (chatFocused = true));
      inp.addEventListener('blur', () => setTimeout(() => (chatFocused = document.activeElement === inp), 0));
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(outingId); } });
      if (chatFocused) inp.focus({ preventScroll: true });
    }
    body.onscroll = () => { stuckToBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 140; };
    if (stuckToBottom) requestAnimationFrame(() => { body.scrollTop = body.scrollHeight; });
    if (S.unread(outingId)) setTimeout(() => S.markRead(outingId), 900);
  }
  HOP.chatOpenFor = () => { const r = HOP.app.route; return r.params?.tab === 'chat' ? r.params.id : null; };

  function send(outingId) {
    const inp = document.getElementById('chatIn');
    const text = (inp?.value || '').trim();
    if (!text) return;
    S.postMessage(outingId, { text, replyTo }, S.meId);
    draft[outingId] = ''; replyTo = null; stuckToBottom = true; attachOpen = false;
    HOP.sim.chatReply(outingId, text);
  }
  HOP.actions.sendMsg = (d) => send(d.id || HOP.app.route.params.id);
  HOP.actions.msgTap = (d, el, e) => {
    if (e.target.closest('button,a')) return;
    selected = selected === d.m ? null : d.m;
    HOP.app.render({ keepScroll: true });
  };
  HOP.actions.react = (d) => { S.react(d.m, d.e); selected = null; };
  HOP.actions.replyMsg = (d) => { replyTo = d.m; selected = null; chatFocused = true; HOP.app.render({ keepScroll: true }); };
  HOP.actions.cancelReply = () => { replyTo = null; HOP.app.render({ keepScroll: true }); };
  HOP.actions.jumpMsg = (d) => { const el = document.querySelector(`[data-mid="${d.m}"]`); if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.add('flashmsg'); setTimeout(() => el.classList.remove('flashmsg'), 1200); } };
  HOP.actions.chatAttach = () => { attachOpen = !attachOpen; stuckToBottom = true; HOP.app.render({ keepScroll: true }); };
  HOP.actions.keen = (d) => S.keen(d.m);
  HOP.actions.vote = (d) => S.vote(d.m, +d.k);
  HOP.actions.closePoll = (d) => {
    const win = S.closePoll(d.m);
    S.addStop(d.o, win.venueId);
    ui.toast(`${esc(S.venueById[win.venueId].name)} is on the route`);
  };
  HOP.actions.placeStop = (d) => { S.addStop(d.o, d.v); ui.toast(`${esc(S.venueById[d.v].name)} added to the route`); };
  HOP.actions.viewPlace = (d) => { ui.closeModal(); if (ui.currentSize() !== 'half' && HOP.app.route.params?.tab === 'chat') ui.resizeSheet('half'); setTimeout(() => { HOP.map.focus(S.venueById[d.v], 16.5); HOP.map.setSelected(d.v); }, 300); };
  HOP.actions.viewLoc = (d) => {
    const m = S.state.messages.find((x) => x.id === d.m);
    if (HOP.app.route.params?.tab === 'chat') ui.resizeSheet('half');
    setTimeout(() => { HOP.map.refreshLive(); HOP.map.focus(m.loc, 16.5); }, 300);
  };
  HOP.actions.stopShare = (d) => { S.stopSharing(d.m); ui.toast('Stopped sharing your location'); };

  // notifications: all / mentions only / mute
  HOP.actions.chatPrefs = (d) => {
    const o = S.outing(d.id), cur = S.chatPref(d.id);
    ui.openModal(`<div class="mhead"><h2 class="h2">Notifications</h2><button class="iconbtn bare" data-act="closeModal" aria-label="Close">${I('close')}</button></div>
      <p class="meta" style="margin:0 0 12px">For ${esc(o.title)}. Updates like “Grace added 6 photos” never send a notification on their own.</p>
      <div class="vis">${[['all', 'All messages', 'Every message from people on the outing'], ['mentions', 'Mentions only', `Only when someone writes @${esc(S.me().first)}`], ['mute', 'Mute', 'Nothing until you open the chat']].map(([k, l, s]) => `<button data-act="setPref" data-id="${d.id}" data-v="${k}" class="${cur === k ? 'on' : ''}">${I(k === 'mute' ? 'bellOff' : 'bell')}<div><b>${l}</b><span>${s}</span></div></button>`).join('')}</div>`);
  };
  HOP.actions.setPref = (d) => { S.setChatPref(d.id, d.v); ui.closeModal(); ui.toast({ all: 'All messages', mentions: 'Mentions only', mute: 'Muted' }[d.v]); };

  // ---------------- attachments ----------------
  HOP.actions.chatCamera = (d) => { attachOpen = false; HOP.actions.camera({ id: d.id }); };
  HOP.actions.chatAlbumPick = (d) => {
    const ps = S.photosOf(d.id).slice().reverse();
    const sel = new Set();
    const draw = () => ui.openModal(`<div class="mhead"><h2 class="h2">From the album</h2><button class="iconbtn bare" data-act="closeModal" aria-label="Close">${I('close')}</button></div>
      ${ps.length ? `<div class="pickgrid">${ps.slice(0, 60).map((p) => `<button data-act="pickPh" data-p="${p.id}" class="${sel.has(p.id) ? 'on' : ''}">${photoTag(p, 200)}<i>${sel.has(p.id) ? I('check', 14) : ''}</i></button>`).join('')}</div>
        <div class="cta" style="margin-bottom:-18px"><button class="btn primary" data-act="sendPhotos" ${sel.size ? '' : 'disabled'}>${sel.size ? `Send ${plural(sel.size, 'photo')}` : 'Pick photos to point people to'}</button></div>`
        : `<p class="meta">No photos in the album yet. Take one and it lands here for everyone.</p>`}`);
    HOP.actions.pickPh = (x) => { sel.has(x.p) ? sel.delete(x.p) : sel.add(x.p); const sc = document.querySelector('.msheet').scrollTop; draw(); document.querySelector('.msheet').scrollTop = sc; };
    HOP.actions.sendPhotos = () => { ui.closeModal(); attachOpen = false; S.postMessage(d.id, { kind: 'photo', photoIds: [...sel] }); };
    draw();
  };
  HOP.actions.chatPlace = (d) => sendPlacePicker(d.id);
  function sendPlacePicker(outingId) {
    const o = S.outing(outingId);
    const st = S.stopsOf(outingId);
    const from = (o.live ? S.placeOf(st[o.live.current]) : st[0] && S.placeOf(st[0])) || HOP.map.ME;
    const list = S.venues.filter((v) => v.cat !== 'spot').map((v) => ({ v, d: metres(from, v) })).sort((a, b) => a.d - b.d).slice(0, 10);
    ui.openModal(`<div class="mhead"><h2 class="h2">Share a place</h2><button class="iconbtn bare" data-act="closeModal" aria-label="Close">${I('close')}</button></div>
      <p class="meta" style="margin:0 0 8px">Close to ${esc(from.name || 'you')}. Or tap any venue on the map and choose <b>Send to outing</b>.</p>
      <div class="rows">${list.map(({ v, d }) => { const a = S.activity(v.id); return `<button class="row" data-act="sendPlace" data-o="${outingId}" data-v="${v.id}">${photoTag({ id: v.id, u: v.img }, 120, 120, 'thumb')}<div class="grow"><div class="t">${esc(v.name)}</div><div class="s">${distLabel(d)} · ${a.label}${a.friends.length ? ` · ${a.friends.length} friends` : ''}</div></div>${I('send', 16)}</button>`; }).join('')}</div>`);
  }
  HOP.actions.sendPlace = (d) => {
    ui.closeModal(); attachOpen = false;
    S.postMessage(d.o, { kind: 'place', place: { venueId: d.v } });
    HOP.sim.chatKeen(d.o);
    if (HOP.chatOpenFor() !== d.o) ui.toast(`Sent ${esc(S.venueById[d.v].name)} to ${esc(S.outing(d.o).title)}`);
  };
  HOP.actions.chatLocation = (d) => {
    attachOpen = false;
    const post = (lat, lng) => {
      const near = S.venues.map((v) => ({ v, d: metres({ lat, lng }, v) })).sort((a, b) => a.d - b.d)[0];
      const label = near && near.d < 250 ? `Near ${near.v.name}` : (near ? `${near.v.address.replace(/^[\d/-]+\s*/, '')}, ${near.v.suburb}` : 'Current location');
      S.postMessage(d.id, { kind: 'location', loc: { lat, lng, label, until: HOP.now() + 30 * 6e4 } });
      ui.toast('Sharing your location with this outing for 30 minutes');
    };
    // demo position by default; a real phone would use its GPS once, only when you tap this
    post(HOP.map.ME.lat, HOP.map.ME.lng);
  };
  HOP.actions.chatPoll = (d) => {
    attachOpen = false;
    const o = S.outing(d.id);
    const st = S.stopsOf(d.id);
    const from = (o.live ? S.placeOf(st[o.live.current]) : st[st.length - 1] && S.placeOf(st[st.length - 1])) || HOP.map.ME;
    const taken = new Set(st.map((s) => s.venueId));
    const opts = S.venues.filter((v) => ['bar', 'pub', 'club'].includes(v.cat) && !taken.has(v.id))
      .map((v) => ({ v, score: metres(from, v) - (HOP.seed.POP[v.id]?.[0] || 0.3) * 600 })).sort((a, b) => a.score - b.score).slice(0, 3);
    const m = S.postMessage(d.id, { kind: 'poll', poll: { q: `Where after ${from.name || 'this'}?`, closed: false, options: opts.map(({ v }) => ({ venueId: v.id, votes: [] })) } });
    HOP.sim.chatVotes(d.id, m.id);
  };

  // Send any venue or event to an outing chat (from the map)
  HOP.actions.sendToOuting = (d) => {
    const list = S.state.outings.filter((o) => S.canChat(o) && ['before', 'during'].includes(S.chatPhase(o)))
      .sort((a, b) => (b.status === 'live') - (a.status === 'live') || a.startsAt - b.startsAt);
    const what = d.v ? S.venueById[d.v].name : HOP.events.byId(d.e).title;
    ui.openModal(`<div class="mhead"><h2 class="h2">Share</h2><button class="iconbtn bare" data-act="closeModal" aria-label="Close">${I('close')}</button></div>
      <p class="meta" style="margin:0 0 8px">Send ${esc(what)} to an outing chat, or copy a link for anywhere else.</p>
      <div class="rows">${list.map((o) => `<button class="row" data-act="sendTo" data-o="${o.id}" ${d.v ? `data-v="${d.v}"` : `data-e="${d.e}"`}><span class="emo-sm">${HOP.oicon(o)}</span><div class="grow"><div class="t">${esc(o.title)}</div><div class="s">${o.status === 'live' ? 'Live now' : HOP.util.when(o.startsAt)} · ${S.going(o.id).length} going</div></div>${I('send', 16)}</button>`).join('') || '<p class="meta">You’re not on any upcoming outings.</p>'}</div>
      <button class="btn block" style="margin-top:10px" data-act="copyShare" data-t="${esc(what)}">${I('link', 17)} Copy link</button>`);
  };
  HOP.actions.copyShare = (d) => { ui.copy(`${d.t} · on HOP`); ui.closeModal(); };
  HOP.actions.sendTo = (d) => {
    ui.closeModal();
    S.postMessage(d.o, { kind: 'place', place: d.v ? { venueId: d.v } : { eventId: d.e } });
    if (d.v) HOP.sim.chatKeen(d.o);
    ui.banner({ lead: `<span class="emo-sm">${HOP.oicon(S.outing(d.o))}</span>`, title: `Sent to ${esc(S.outing(d.o).title)}`, text: 'Tap to open the chat', act: 'openChat', data: { id: d.o }, timeout: 3500 });
  };
  HOP.actions.openChat = (d) => {
    const o = S.outing(d.id);
    HOP.app.go(o.status === 'live' ? 'live' : o.status === 'ended' ? 'memory' : 'outing', { id: d.id, tab: 'chat' });
  };

  // ---------------- photos tab: the outing album, grouped by stop ----------------
  function photosBody(o) {
    const ps = S.photosOf(o.id);
    const stops = S.stopsOf(o.id);
    return `<div class="phhead"><span class="meta">${plural(ps.length, 'photo')} from ${plural(new Set(ps.map((p) => p.userId)).size, 'person', 'people')}</span>${ps.length ? `<button class="linkbtn" data-act="album" data-id="${o.id}">Full screen</button>` : ''}</div>
      ${stops.map((s, i) => { const l = ps.filter((p) => p.stopId === s.id); return l.length ? `<p class="label dayhead">${i + 1}. ${esc(S.stopName(s))} · ${l.length}</p><div class="grid inset">${l.map((p) => `<button data-act="viewPhoto" data-id="${o.id}" data-p="${p.id}">${photoTag(p, 260)}</button>`).join('')}</div>` : ''; }).join('')
      || `<p class="empty">${o.status === 'planning' ? 'The album opens when the night starts. Everyone’s photos land here automatically.' : 'No photos yet.'}</p>`}
      ${S.myAttendance(o.id)?.rsvp === 'going' && o.status !== 'planning' ? `<div class="cta"><button class="btn" data-act="roll" data-id="${o.id}">${I('image', 18)} Add from camera roll</button>${o.status === 'live' ? `<button class="btn primary" data-act="camera" data-id="${o.id}">${I('camera', 18)} Take a photo</button>` : ''}</div>` : ''}`;
  }

  // ---------------- wire tabs into the outing, live and memory screens ----------------
  ['outing', 'live', 'memory'].forEach((name) => {
    const sc = HOP.screens[name];
    const render = sc.render.bind(sc), mount = sc.mount;
    sc.render = (params) => {
      const out = render(params);
      const o = S.outing(params.id);
      if (!o) return out;
      const tab = params.tab || 'plan';
      const tabs = HOP.outingTabs(o, tab);
      if (tab === 'chat') { out.sheet = tabs + chatBody(o); out.sizes = ['half', 'tall', 'full']; out.sizeIdx = 1; }
      else if (tab === 'photos') { out.sheet = tabs + photosBody(o); out.sizes = ['half', 'full']; out.sizeIdx = 0; }
      else out.sheet = tabs + out.sheet;
      return out;
    };
    sc.mount = (params) => { if (mount) mount.call(sc, params); if (params.tab === 'chat') bindChat(params.id); };
  });
})();
