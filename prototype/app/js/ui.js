/* HOP — UI primitives: bottom sheet, top bar, full-screen layers, modal sheets, banners,
   and click delegation (data-act="name" → HOP.actions.name). */

HOP.actions = {};

HOP.ui = (() => {
  const $ = (s, el = document) => el.querySelector(s);
  const app = $('#app'), sheet = $('#sheet'), body = $('#sheetBody'), top = $('#top');
  const wide = () => window.matchMedia('(min-width: 900px)').matches;

  // ---------------- sheet ----------------
  let sizes = ['auto'], sizeIdx = 0, onSize = null;
  function heightFor(size) {
    const avail = app.clientHeight - (document.body.classList.contains('hide-nav') ? 0 : $('#nav').offsetHeight);
    const max = avail - (wide() ? 40 + (top.offsetHeight || 0) : 24 + (parseInt(getComputedStyle(document.documentElement).getPropertyValue('--safe-t')) || 0));
    const kids = body.children;
    const last = kids[kids.length - 1];
    const content = kids.length ? last.offsetTop + last.offsetHeight - kids[0].offsetTop + (wide() ? 32 : 40) : 0;
    if (size === 'none') return 0;
    if (size === 'full') return max;
    if (size === 'tall') return Math.min(max, Math.round(avail * (wide() ? 0.86 : 0.72)));
    if (size === 'half') return Math.min(max, Math.round(avail * (wide() ? 0.62 : 0.5)));
    if (size === 'peek') {
      const pe = body.querySelector('.peek-end');
      return Math.min(max, pe && kids.length ? pe.offsetTop - kids[0].offsetTop + (wide() ? 32 : 30) : Math.min(content, 168));
    }
    return Math.min(content, Math.round(avail * (wide() ? 0.9 : 0.62))); // auto
  }
  function applySize(animate = true) {
    const size = sizes[sizeIdx];
    sheet.dataset.size = size;
    if (size === 'none') { setSheetH(0); return; }
    if (!animate) sheet.classList.add('dragging');
    const h = heightFor(size);
    sheet.style.height = h + 'px';
    setSheetH(h);
    if (!animate) requestAnimationFrame(() => sheet.classList.remove('dragging'));
  }
  function setSheetH(h) {
    app.style.setProperty('--sheet-h', (wide() ? 0 : h) + 'px');
    app.style.setProperty('--top-h', top.offsetHeight + 'px');
    const navH = document.body.classList.contains('hide-nav') ? 0 : $('#nav').offsetHeight;
    const topH = top.childElementCount ? top.offsetHeight + 10 : 0;
    if (wide()) HOP.map.setInsets({ top: 20, bottom: 0, left: h ? 424 : 0 });
    else HOP.map.setInsets({ top: topH + 10, bottom: h + navH, left: 0 });
    if (onSize) onSize(sizes[sizeIdx], h);
  }
  function setSheet(html, opts = {}) {
    const keepScroll = opts.keepScroll ? body.scrollTop : 0;
    body.innerHTML = html;
    body.scrollTop = keepScroll;
    if (opts.sizes) { sizes = opts.sizes; sizeIdx = Math.min(opts.sizeIdx ?? 0, sizes.length - 1); }
    onSize = opts.onSize || onSize;
    applySize(!opts.instant);
  }
  function resizeSheet(idx) { sizeIdx = typeof idx === 'string' ? Math.max(0, sizes.indexOf(idx)) : idx; applySize(); }
  const currentSize = () => sizes[sizeIdx];

  // drag to resize
  let drag = null;
  sheet.addEventListener('pointerdown', (e) => {
    const handle = e.target.closest('[data-drag]');
    if (!handle || wide() || e.target.closest('button:not([data-drag]),input,a')) return;
    drag = { y: e.clientY, h: sheet.offsetHeight, moved: false, id: e.pointerId };
    sheet.classList.add('dragging');
    handle.setPointerCapture(e.pointerId);
  });
  sheet.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dy = e.clientY - drag.y;
    if (Math.abs(dy) > 4) drag.moved = true;
    sheet.style.height = Math.max(60, drag.h - dy) + 'px';
  });
  const endDrag = (e) => {
    if (!drag) return;
    sheet.classList.remove('dragging');
    const dy = e.clientY - drag.y;
    if (!drag.moved) sizeIdx = (sizeIdx + 1) % sizes.length; // tap cycles
    else if (dy < -40) sizeIdx = Math.min(sizes.length - 1, sizeIdx + 1);
    else if (dy > 40) sizeIdx = Math.max(0, sizeIdx - 1);
    drag = null;
    applySize();
  };
  sheet.addEventListener('pointerup', endDrag);
  sheet.addEventListener('pointercancel', endDrag);
  window.addEventListener('resize', () => applySize(false));

  // ---------------- top bar ----------------
  function setTop(html) { top.innerHTML = html || ''; app.style.setProperty('--top-h', top.offsetHeight + 'px'); }

  // ---------------- layers (full screen) ----------------
  const layers = $('#layers');
  const stack = [];
  function openLayer(html, cls = '', onClose) {
    const el = document.createElement('section');
    el.className = 'layer ' + cls;
    el.innerHTML = html;
    layers.appendChild(el);
    stack.push({ el, onClose });
    return el;
  }
  function closeLayer() {
    const l = stack.pop();
    if (!l) return false;
    l.el.remove();
    if (l.onClose) l.onClose();
    return true;
  }
  const topLayer = () => stack[stack.length - 1]?.el;
  const closeAllLayers = () => { while (stack.length) closeLayer(); };

  // ---------------- modal sheet ----------------
  const modal = $('#modal');
  let modalClose = null;
  function openModal(html, onClose) {
    modal.innerHTML = `<div class="scrim" data-act="closeModal"><div class="msheet" role="dialog" aria-modal="true">${html}</div></div>`;
    modalClose = onClose;
    return modal.querySelector('.msheet');
  }
  function closeModal() { modal.innerHTML = ''; if (modalClose) { const f = modalClose; modalClose = null; f(); } }
  const modalOpen = () => !!modal.firstChild;

  // ---------------- banners ----------------
  const banners = $('#banners');
  function banner({ lead = '', title, text = '', act = '', data = {}, timeout = 4200 }) {
    const b = document.createElement('button');
    b.className = 'banner';
    if (act) { b.dataset.act = act; Object.entries(data).forEach(([k, v]) => (b.dataset[k] = v)); }
    b.innerHTML = `${lead}<div class="grow"><b>${title}</b>${text ? `<span>${text}</span>` : ''}</div>`;
    banners.prepend(b);
    while (banners.children.length > 3) banners.lastChild.remove();
    setTimeout(() => { b.classList.add('out'); setTimeout(() => b.remove(), 260); }, timeout);
    if (navigator.vibrate) try { navigator.vibrate(12); } catch (e) {}
  }
  function toast(text) {
    const b = document.createElement('div');
    b.className = 'banner toast';
    b.innerHTML = `<b>${text}</b>`;
    let host = document.getElementById('toasts');
    if (!host) { host = document.createElement('div'); host.id = 'toasts'; host.setAttribute('aria-live', 'polite'); app.appendChild(host); }
    host.innerHTML = '';
    host.appendChild(b);
    setTimeout(() => { b.classList.add('out'); setTimeout(() => b.remove(), 260); }, 2200);
  }

  // ---------------- delegation ----------------
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act],[data-go]');
    if (!el) return;
    if (el.dataset.act === 'closeModal' && e.target !== el) return; // only scrim itself closes
    if (el.dataset.go) { e.preventDefault(); HOP.app.go(el.dataset.go, { ...el.dataset }); return; }
    const fn = HOP.actions[el.dataset.act];
    if (fn) { e.preventDefault(); fn(el.dataset, el, e); }
  });
  HOP.actions.closeModal = () => closeModal();
  HOP.actions.closeLayer = () => closeLayer();

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (e) {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (e2) {}
      ta.remove(); return ok;
    }
  }

  return { setSheet, resizeSheet, currentSize, applySize, setTop, openLayer, closeLayer, topLayer, closeAllLayers, openModal, closeModal, modalOpen, banner, toast, copy, wide, $ };
})();
