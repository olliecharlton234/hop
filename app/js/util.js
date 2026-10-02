/* HOP — small shared helpers. Plain scripts (no modules) so the app runs from file:// */
window.HOP = window.HOP || {};

/* Demo clock. The prototype opens at "Friday, 7:04 PM" so the map shows a real Friday night.
   The offset is stored with the demo data, so time keeps moving forward across reloads. */
HOP.clock = (() => {
  let offset = 0;
  function demoOffset() {
    const real = new Date();
    const t = new Date(real); t.setHours(19, 4, 0, 0);
    while (t.getDay() !== 5) t.setDate(t.getDate() + 1);
    return t.getTime() - real.getTime();
  }
  let realtime = false;
  try { realtime = localStorage.getItem('hop.realtime') === '1'; } catch (e) {}
  return { set: (o) => (offset = o || 0), get offset() { return offset; }, demoOffset, get realtime() { return realtime; } };
})();
HOP.now = () => Date.now() + HOP.clock.offset;

HOP.util = (() => {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Deterministic PRNG so seeded content is stable between reloads
  function rng(seed) {
    let s = 0;
    for (const ch of String(seed)) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
    return () => {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
  const uid = (p = 'id') => p + '_' + Math.random().toString(36).slice(2, 9);

  // ---- Dates ---------------------------------------------------------------
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const time = (d) => {
    d = new Date(d);
    let h = d.getHours(), m = d.getMinutes();
    const ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${String(m).padStart(2, '0')} ${ap}`;
  };
  const timeShort = (d) => time(d).replace(':00', '').replace(' ', ' ').toLowerCase();
  const dayDate = (d) => { d = new Date(d); return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`; };
  const longDate = (d) => { d = new Date(d); return `${DAYS_LONG[d.getDay()]} ${d.getDate()} ${MONTHS_LONG[d.getMonth()]}`; };

  // "Saturday, 7:30 PM" when within the coming week, otherwise "Sat 17 Oct · 7:30 PM"
  function when(d, now = HOP.now()) {
    const dt = new Date(d);
    const days = Math.round((startOfDay(dt) - startOfDay(new Date(now))) / 864e5);
    if (days === 0) return `Tonight, ${time(dt)}`;
    if (days === 1) return `Tomorrow, ${time(dt)}`;
    if (days > 1 && days < 7) return `${DAYS_LONG[dt.getDay()]}, ${time(dt)}`;
    return `${dayDate(dt)} · ${time(dt)}`;
  }
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

  function ago(ts, now = HOP.now()) {
    if (ts > now) return 'soon';
    const s = Math.max(0, Math.round((now - ts) / 1000));
    if (s < 45) return 'just now';
    const m = Math.round(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.round(h / 24);
    if (d < 7) return `${d}d ago`;
    const w = Math.round(d / 7);
    if (d < 45) return `${w} week${w > 1 ? 's' : ''} ago`;
    const mo = Math.round(d / 30);
    return `${mo} month${mo > 1 ? 's' : ''} ago`;
  }

  // ---- Geo -----------------------------------------------------------------
  function metres(a, b) {
    const R = 6371e3, toR = Math.PI / 180;
    const dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  const walkMins = (a, b) => Math.max(1, Math.round((metres(a, b) * 1.3) / 80)); // 1.3 = street grid fudge
  const distLabel = (m) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`);

  // ---- Imagery -------------------------------------------------------------
  // Seeded photos reference Unsplash images with a focal-point crop, so one source
  // can produce several distinct-looking frames. Uploaded photos carry a data: URL.
  function img(u, w = 400, h = w) {
    if (!u) return '';
    if (typeof u === 'string') return u;
    const fp = u.fx != null ? `&crop=focalpoint&fp-x=${u.fx}&fp-y=${u.fy}&fp-z=${u.fz}` : '';
    return `https://images.unsplash.com/photo-${u.id}?w=${w}&h=${h}&fit=crop${fp}&q=70&auto=format`;
  }
  const photoSrc = (p, w, h) => (p.src ? p.src : img(p.u, w, h));

  const initials = (name) => name.split(/\s+/).map((x) => x[0]).slice(0, 2).join('').toUpperCase();
  const hue = (s) => { let h = 0; for (const c of String(s)) h = (h * 33 + c.charCodeAt(0)) % 360; return h; };

  function avatar(user, size = 32, extra = '') {
    if (!user) return '';
    return `<span class="av ${extra}" style="--s:${size}px;--h:${hue(user.id)}" title="${esc(user.name)}"><i>${esc(initials(user.name))}</i>${user.avatar ? `<img src="${esc(user.avatar)}" alt="" loading="lazy" onerror="this.remove()">` : ''}</span>`;
  }
  function avatarStack(users, max = 5, size = 28) {
    const shown = users.slice(0, max);
    const more = users.length - shown.length;
    return `<span class="stack">${shown.map((u) => avatar(u, size)).join('')}${more > 0 ? `<span class="av more" style="--s:${size}px"><i>+${more}</i></span>` : ''}</span>`;
  }
  // Photo tile with a tinted fallback if the network image can't load
  function photoTag(p, w = 300, h = w, cls = '') {
    return `<span class="ph ${cls}" style="--h:${hue(p.id)}"><img src="${esc(photoSrc(p, w, h))}" alt="" loading="lazy" onerror="this.remove()"></span>`;
  }

  // "FRIDAY 2 OCT · 8PM"
  function eventWhen(ts) {
    const d = new Date(ts);
    const t = time(d).replace(':00', '').replace(' ', '');
    return `${DAYS_LONG[d.getDay()].toUpperCase()} ${d.getDate()} ${MONTHS[d.getMonth()].toUpperCase()} · ${t}`;
  }
  // "8pm" / "7:30pm"
  const hm = (ts) => time(ts).replace(':00', '').replace(' ', '').toLowerCase();
  const sameNight = (a, b) => { const x = new Date(a - 5 * 36e5), y = new Date(b - 5 * 36e5); return x.toDateString() === y.toDateString(); };

  const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  // "On now" / "Starts in 20m" / "Starts in 1h 10m" / "9pm"
  function startsIn(start, end, now = HOP.now()) {
    if (now >= start && (!end || now < end)) return 'On now';
    const m = Math.round((start - now) / 6e4);
    if (m > 0 && m <= 150) return `Starts in ${m < 60 ? m + 'm' : Math.floor(m / 60) + 'h' + (m % 60 ? ' ' + (m % 60) + 'm' : '')}`;
    return hm(start);
  }
  return { startsIn, esc, rng, pick, uid, eventWhen, hm, sameNight, DAYS_LONG, time, timeShort, dayDate, longDate, when, ago, metres, walkMins, distLabel, img, photoSrc, initials, hue, avatar, avatarStack, photoTag, plural, clamp, DAYS, MONTHS };
})();

// Outing icons: vector, consistent, no emoji. Outing.emoji holds one of these keys
// (the field name stays for data compatibility; old emoji values are mapped below).
HOP.OICONS = {
  cake: '<path d="M4 20h16M5 20v-7h14v7M5 16c2.3 1.4 4.7 1.4 7 0s4.7-1.4 7 0M12 13V9.5M12 7a1.2 1.2 0 01-1.2-1.2C10.8 4.6 12 3 12 3s1.2 1.6 1.2 2.8A1.2 1.2 0 0112 7z"/>',
  beer: '<path d="M6 7h9v12a2 2 0 01-2 2H8a2 2 0 01-2-2zM15 10h2a2 2 0 012 2v3a2 2 0 01-2 2h-2M6 11h9M8 7c0-2 1-3 3-3s2.5 1 3.5 1S16 4.5 16 6"/>',
  cocktail: '<path d="M5 5h14l-7 8zM12 13v6M8.5 19.5h7M15 3l-2 4"/>',
  glass: '<path d="M8.5 3h7l-.8 7.5a2.7 2.7 0 01-5.4 0zM12 13v7M9 20.5h6"/>',
  disco: '<circle cx="12" cy="13" r="7"/><path d="M5 13h14M12 6v14M6.5 9.5h11M6.5 16.5h11M12 2.5V6"/>',
  music: '<path d="M9 18V6l10-2v12"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="16" r="2"/>',
  guitar: '<path d="M13.5 4.5l6 6M16.5 7.5l-5.6 5.6"/><path d="M10.5 12.5a4.5 4.5 0 10-1 6l1-1a2 2 0 012-2l1-1a4 4 0 00-3-2z"/>',
  food: '<path d="M7 4v7a2 2 0 002 2v7M11 4v7M9 4v5M16 20V4c-2 1.5-2.5 4-2.5 7H16"/>',
  bowl: '<path d="M4 11h16a8 8 0 01-16 0zM8 11V3.5M11 11V4.5M15 3.5L13 11"/>',
  beach: '<path d="M3 20h18M12 20V10M12 10c-1.5-3.5-5.5-4.5-8-2M12 10c1.5-3.5 5.5-4.5 8-2M12 10c-.5-3-2.5-5.5-5-6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  party: '<path d="M4 20l5-13 8 8z"/><path d="M14 5.5c1-1.5 2.5-2 4-1.5M16.5 9c1.5-.5 3 0 3.5 1.5M12 3.5l.5 1.5M20 13l1.5.5"/>',
  fireworks: '<path d="M12 12l-4-5M12 12l5-4M12 12l5 4M12 12l-5 4M12 12v7M8 7l-1-2M17 8l2-1M17 16l2 1M7 16l-2 1"/>',
  mic: '<rect x="9" y="3.5" width="6" height="10" rx="3"/><path d="M6 11a6 6 0 0012 0M12 17v3.5"/>',
  ball: '<circle cx="12" cy="12" r="8"/><path d="M12 4v16M4 12h16"/>',
  run: '<circle cx="13" cy="4.5" r="1.8"/><path d="M10 21l2-6.5 2.5 2.5V21M8 12l2-4.5 3.5 1 2.5 3.5M12 14.5L10.5 9"/>',
  star: '<path d="M12 4l2.3 5 5.2.5-4 3.5 1.2 5.2L12 15.5 7.3 18.2l1.2-5.2-4-3.5 5.2-.5z"/>',
};
const LEGACY = { '🎂': 'cake', '🍻': 'beer', '🍺': 'beer', '🍸': 'cocktail', '🪩': 'disco', '🎵': 'music', '🎸': 'guitar', '🍜': 'bowl', '🏖': 'beach', '☀️': 'sun', '🥂': 'glass', '🎉': 'party', '🌮': 'food', '🎆': 'fireworks', '🎧': 'disco', '🎤': 'mic', '🏉': 'ball', '🏃': 'run' };
HOP.oiconKey = (o) => (HOP.OICONS[o?.emoji] ? o.emoji : LEGACY[o?.emoji] || 'party');
HOP.oicon = (o, size = 20) => `<svg class="oico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${HOP.OICONS[typeof o === 'string' ? o : HOP.oiconKey(o)]}</svg>`;
// Chat reactions, as icons
HOP.REACTS = {
  up: '<path d="M7 11v9H4v-9zM7 11l4-7c1.5 0 2.5 1 2.2 2.6L12.8 10H19a2 2 0 012 2.3l-1.2 6A2.5 2.5 0 0117.3 20H7"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0112 7.3 4.3 4.3 0 0119.5 10c0 5.4-7.5 10-7.5 10z"/>',
  haha: '<circle cx="12" cy="12" r="8.5"/><path d="M8 13.5c1 2 2.4 3 4 3s3-1 4-3zM8.5 9.5l1.5 1M15.5 9.5l-1.5 1"/>',
  fire: '<path d="M12 21c-3.5 0-6-2.4-6-5.6 0-3.6 3-5.4 3.5-9.4 2.5 1.6 3.4 3.6 3.4 5.4 1-.6 1.7-1.6 1.9-2.9 2 1.7 3.2 4 3.2 6.9 0 3.2-2.5 5.6-6 5.6z"/>',
  wow: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="15" r="2"/><path d="M9 9.5h.01M15 9.5h.01"/>',
};
const LEGACY_R = { '👍': 'up', '❤️': 'heart', '😂': 'haha', '🔥': 'fire', '😮': 'wow', '😢': 'wow', '💀': 'haha' };
HOP.reactKey = (k) => (HOP.REACTS[k] ? k : LEGACY_R[k] || 'up');
HOP.react = (k, size = 16) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${HOP.REACTS[HOP.reactKey(k)]}</svg>`;

// Tiny inline icon set (stroke icons, 24px grid)
HOP.icon = (name, size = 20) => {
  const p = {
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
    map: '<path d="M9 4L3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4z"/><path d="M9 4v13M15 6.5v13"/>',
    list: '<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    memories: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M3.5 15l4.5-4 4 3.5 3-2.5 5.5 4.5"/><circle cx="15.5" cy="9" r="1.4"/>',
    user: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c1.2-3.8 4-5.5 7.5-5.5s6.3 1.7 7.5 5.5"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    share: '<path d="M12 3v12M7.5 7.5L12 3l4.5 4.5"/><path d="M5 12v7h14v-7"/>',
    link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
    camera: '<path d="M4 8h3.5L9 5.5h6L16.5 8H20v11H4z"/><circle cx="12" cy="13" r="3.6"/>',
    image: '<rect x="4" y="4" width="16" height="16" rx="2"/><circle cx="9.5" cy="9.5" r="1.6"/><path d="M4 16l4.5-4 3.5 3 3-2.5L20 17"/>',
    grip: '<circle cx="9" cy="7" r="1.2" fill="currentColor"/><circle cx="15" cy="7" r="1.2" fill="currentColor"/><circle cx="9" cy="12" r="1.2" fill="currentColor"/><circle cx="15" cy="12" r="1.2" fill="currentColor"/><circle cx="9" cy="17" r="1.2" fill="currentColor"/><circle cx="15" cy="17" r="1.2" fill="currentColor"/>',
    trash: '<path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13"/>',
    locate: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5V6M12 18v3.5M2.5 12H6M18 12h3.5"/><circle cx="12" cy="12" r="7"/>',
    lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="1.5"/><path d="M8 10.5V8a4 4 0 018 0v2.5"/>',
    globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 3.5 5.4 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.4-3.5-8.5s1-5.9 3.5-8.5z"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    walk: '<circle cx="13" cy="4.5" r="1.8"/><path d="M10 21l2-6.5 2.5 2.5V21M8 12l2-4.5 3.5 1 2.5 3.5M12 14.5L10.5 9"/>',
    pin: '<path d="M12 21s-6.5-6.2-6.5-11.5a6.5 6.5 0 0113 0C18.5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.3"/>',
    download: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5"/><path d="M5 19h14"/>',
    chev: '<path d="M9 5l7 7-7 7"/>',
    up: '<path d="M6 15l6-6 6 6"/>',
    down: '<path d="M6 9l6 6 6-6"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    users: '<circle cx="9" cy="8.5" r="3.3"/><path d="M3 19.5c.9-3.3 3.2-4.8 6-4.8s5.1 1.5 6 4.8"/><path d="M15.5 5.6a3.2 3.2 0 010 6M17.5 14.9c1.8.6 3 2 3.5 4.6"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    ticket: '<path d="M4 8a2 2 0 002-2h12a2 2 0 002 2v2a2 2 0 000 4v2a2 2 0 00-2 2H6a2 2 0 00-2-2v-2a2 2 0 000-4z"/><path d="M14 6v12" stroke-dasharray="2 2"/>',
    bolt: '<path d="M13 3L5 13.5h6L10 21l8-10.5h-6z"/>',
    bell: '<path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15zM10 20.5a2 2 0 004 0"/>',
    bellOff: '<path d="M6 16V11a6 6 0 0110-4.5M18 11v5l1.5 2H8M10 20.5a2 2 0 004 0M4 4l16 16"/>',
    send: '<path d="M4 12l16-8-6 16-2.5-6.5z"/><path d="M11.5 13.5L20 4"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/>',
    bookmark: '<path d="M7 4h10v16l-5-4-5 4z"/>',
    waves: '<path d="M3 9c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>',
    repeat: '<path d="M4 12a7 7 0 0112-5l2 2M20 12a7 7 0 01-12 5l-2-2"/><path d="M18 4v5h-5M6 20v-5h5"/>',
  }[name] || '';
  return `<svg class="i" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
};
