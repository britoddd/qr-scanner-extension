// Injected on every shortcut press; the guard keeps a single instance (and its state) per tab.
(() => {
  if (window.__qrScan) return;

  const CSS = `
    .shade { position: fixed; inset: 0; overflow: hidden; cursor: crosshair; user-select: none; touch-action: none; outline: none; }
    .shade img { position: absolute; left: 0; top: 0; width: 100vw; height: 100vh; pointer-events: none; }
    .box { position: absolute; left: -9px; top: -9px; outline: 2px solid #fff; box-shadow: 0 0 0 9999px rgba(0, 0, 0, .45);
           animation: fade .15s ease-out; }
    .hint { position: absolute; top: 16px; left: 50%; transform: translateX(-50%); padding: 8px 14px; border-radius: 999px;
            background: rgba(32, 33, 36, .92); color: #fff; font: 13px/1.4 system-ui, sans-serif; white-space: nowrap; pointer-events: none; }
    kbd { padding: 0 6px; border: 1px solid rgba(255, 255, 255, .4); border-radius: 4px; font: inherit; }
    .catch { position: fixed; inset: 0; }
    /* Same look as the toolbar popup (popup.html), but here the live page shows through, blurred.
       Alpha .8 + darker/lighter muted text keep contrast ≥4.5:1 on any page. */
    .pop { --bg: rgba(255, 255, 255, .8); --fg: #202124; --muted: #4d5156; --accent: #1a73e8; --accent-2: #5b5bf0; --on-accent: #fff;
           --ring: rgba(255, 255, 255, .6); --hi: rgba(255, 255, 255, .8); --inset: rgba(255, 255, 255, .6); --line: rgba(0, 0, 0, .08);
           --tint: rgba(26, 115, 232, .1); --glow: rgba(26, 115, 232, .35); --warn: #b3261e; --warn-tint: rgba(179, 38, 30, .1);
           position: fixed; display: flex; flex-direction: column; gap: 12px; min-width: 260px; max-width: 360px; padding: 14px;
           background: var(--bg); color: var(--fg); border: 1px solid var(--ring); border-radius: 22px;
           backdrop-filter: blur(24px) saturate(180%); box-shadow: 0 12px 40px rgba(0, 0, 0, .28), inset 0 1px 0 var(--hi);
           font: 14px/1.45 system-ui, sans-serif; color-scheme: light; animation: pop .14s ease-out; transform-origin: bottom right; }
    @media (prefers-color-scheme: dark) {
      .pop { --bg: rgba(32, 33, 36, .8); --fg: #e8eaed; --muted: #bdc1c6; --accent: #8ab4f8; --accent-2: #b4a7fa; --on-accent: #202124;
             --ring: rgba(255, 255, 255, .14); --hi: rgba(255, 255, 255, .12); --inset: rgba(255, 255, 255, .06); --line: rgba(255, 255, 255, .1);
             --tint: rgba(138, 180, 248, .14); --glow: rgba(138, 180, 248, .25); --warn: #f2b8b5; --warn-tint: rgba(242, 184, 181, .14);
             color-scheme: dark; }
    }
    @media (prefers-reduced-transparency: reduce) { .pop { background: Canvas; backdrop-filter: none; } }
    .pop svg { flex: none; width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .head { display: flex; align-items: center; gap: 10px; }
    .badge { flex: none; display: grid; place-items: center; width: 34px; height: 34px; border-radius: 10px; color: var(--on-accent);
             background: linear-gradient(135deg, var(--accent), var(--accent-2)); box-shadow: 0 4px 12px var(--glow), inset 0 1px 0 rgba(255, 255, 255, .3); }
    .badge.none { background: var(--warn-tint); color: var(--warn); box-shadow: none; }
    .ttl { font-weight: 600; }
    .sub { color: var(--muted); font-size: 12px; overflow-wrap: anywhere; }
    .val { max-height: 200px; overflow: auto; padding: 10px 12px; border: 1px solid var(--line); border-radius: 14px; background: var(--inset);
           white-space: pre-wrap; word-break: break-all; user-select: text; }
    button { display: inline-flex; align-items: center; gap: 6px; align-self: flex-end; padding: 8px 18px; border: 0; border-radius: 999px;
             background: var(--tint); color: var(--accent); font: 600 14px/1.4 system-ui, sans-serif; cursor: pointer; transition: filter .15s, transform .1s; }
    button.primary { background: linear-gradient(135deg, var(--accent), var(--accent-2)); color: var(--on-accent);
                     box-shadow: 0 6px 18px var(--glow), inset 0 1px 0 rgba(255, 255, 255, .3); }
    button svg { width: 16px; height: 16px; }
    button:hover { filter: brightness(.95); }
    button.primary:hover { filter: brightness(1.06); }
    button:active { transform: scale(.97); }
    button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    @keyframes fade { from { opacity: 0; } }
    @keyframes pop { from { opacity: 0; transform: translateY(4px) scale(.98); } }
    @media (prefers-reduced-motion: reduce) { .box, .pop { animation: none; } button { transition: none; } }
  `;

  // Line icons (same set as popup.html), as path data.
  const ICONS = {
    link: ['M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71', 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'],
    text: ['M17 6H3M21 12H3M15 18H3'],
    none: ['M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0', 'm21 21-4.3-4.3M13.5 8.5l-5 5M8.5 8.5l5 5'],
    open: ['M7 17 17 7M7 7h10v10'],
  };

  let host = null; // UI root element while active, null when idle
  let act = null;  // popup button action, null while selecting

  const el = (tag, cls, parent) => parent.appendChild(Object.assign(document.createElement(tag), { className: cls }));

  function icon(parent, paths) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = parent.appendChild(document.createElementNS(NS, 'svg'));
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    for (const d of paths) svg.appendChild(document.createElementNS(NS, 'path')).setAttribute('d', d);
  }

  function teardown() {
    host?.remove();
    host = act = null;
    removeEventListener('keydown', onKey, true);
  }

  function onKey(e) {
    if (e.key === 'Escape') teardown();
    else if (e.key === 'Enter') act?.();
    else return;
    e.preventDefault();
    e.stopImmediatePropagation(); // keep the page from also reacting
  }

  // Crop the selection (CSS px) out of the screenshot (device px) and decode it.
  function scan(img, r) {
    const s = img.naturalWidth / innerWidth; // also correct under browser zoom
    const m = Math.max(r.w, r.h) * 0.1;      // take a little extra so a tight drag doesn't clip the code's edge
    const x = Math.max(0, Math.round((r.x - m) * s));
    const y = Math.max(0, Math.round((r.y - m) * s));
    const w = Math.min(img.naturalWidth, Math.round((r.x + r.w + m) * s)) - x;
    const h = Math.min(img.naturalHeight, Math.round((r.y + r.h + m) * s)) - y;
    // Full size first. If that fails, retry smaller: shrinking blurs dot-style modules (round "designer" codes)
    // back into solid blocks, which jsQR needs. Measured on a dot-style code: 200px decodes it at 100–2400px.
    for (const k of [1, 300 / Math.max(w, h), 200 / Math.max(w, h)]) {
      if (k > 1) continue; // already smaller than this target
      const cw = Math.round(w * k), ch = Math.round(h * k);
      const ctx = Object.assign(document.createElement('canvas'), { width: cw, height: ch }).getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, x, y, w, h, 0, 0, cw, ch);
      const code = jsQR(ctx.getImageData(0, 0, cw, ch).data, cw, ch, { inversionAttempts: 'attemptBoth' });
      if (code) return code.data;
    }
    return null;
  }

  // (x, y): release point, or null after a whole-page scan (popup is centered).
  function showPopup(root, text, x, y) {
    let url = null;
    try {
      const u = new URL(text);
      if (u.protocol === 'http:' || u.protocol === 'https:') url = u; // never javascript:, data:, etc.
    } catch {}

    // Covers the page behind the popup: a press anywhere else closes it, and that press doesn't reach the page.
    const layer = el('div', 'catch', root);
    layer.onpointerdown = teardown;
    const pop = el('div', 'pop', root);
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', 'QR code');
    pop.setAttribute('aria-describedby', 'val note'); // screen readers read the result when the button takes focus
    const kind = text === null ? 'none' : url ? 'link' : 'text';
    const head = el('div', 'head', pop);
    icon(el('div', `badge ${kind}`, head), ICONS[kind]);
    const words = el('div', '', head);
    const ttl = el('div', 'ttl', words);
    ttl.textContent = { link: 'Link', text: 'Text', none: 'No QR code found' }[kind];
    if (url) el('div', 'sub', words).textContent = url.host; // punycode, so lookalike domains stand out
    if (text === null) {
      ttl.id = 'val';
      Object.assign(el('div', 'sub', words), { id: 'note', textContent: x === null
        ? 'If it’s small or partly hidden, try Scan part of page and drag around it.'
        : 'Drag around the whole code. If it’s small, zoom in first.' });
    } else {
      Object.assign(el('div', 'val', pop), { id: 'val', textContent: text }); // textContent: QR data is untrusted
    }
    const btn = el('button', url ? 'primary' : '', pop);
    btn.append(url ? 'Open' : 'Okay');
    if (url) icon(btn, ICONS.open);
    btn.onclick = act = () => {
      if (url) window.open(url.href, '_blank', 'noopener,noreferrer');
      teardown();
    };

    // The fixed full-viewport layer measures the viewport correctly even on quirks-mode pages.
    const vw = layer.clientWidth, vh = layer.clientHeight, w = pop.offsetWidth, h = pop.offsetHeight;
    if (x === null) [x, y] = [(vw + w) / 2, (vh + h) / 2];
    // Bottom-right corner at the release point, so the button lands right next to the cursor.
    pop.style.left = Math.max(8, Math.min(x - w, vw - w - 8)) + 'px';
    pop.style.top = Math.max(8, Math.min(y - h, vh - h - 8)) + 'px';
    btn.focus();
  }

  // whole: decode the entire frame right away instead of letting the user drag a box.
  window.__qrScan = async (shot, whole = false) => {
    teardown();
    const me = host = document.createElement('qr-scanner-ui');
    host.style.cssText = 'all: initial; position: fixed; top: 0; left: 0; z-index: 2147483647;';
    const root = host.attachShadow({ mode: 'closed' }); // page styles and scripts can't reach in
    el('style', '', root).textContent = CSS;

    if (whole) {
      document.documentElement.append(host);
      addEventListener('keydown', onKey, true);
      const img = Object.assign(new Image(), { src: shot });
      await img.decode();
      if (host !== me) return; // torn down (Escape / new scan) while decoding
      return showPopup(root, scan(img, { x: 0, y: 0, w: innerWidth, h: innerHeight }), null, null);
    }

    const shade = el('div', 'shade', root);
    const img = el('img', '', shade); // the frozen frame: what the user sees is exactly what gets decoded
    img.src = shot;
    const box = el('div', 'box', shade);
    const hint = el('div', 'hint', shade);
    hint.textContent = 'Drag over a QR code · ';
    el('kbd', '', hint).textContent = 'Esc';
    hint.append(' to cancel');
    document.documentElement.append(host);
    addEventListener('keydown', onKey, true);
    shade.tabIndex = -1;
    shade.focus(); // pull focus out of page inputs/iframes so Escape reaches us

    let x0 = null, y0;
    const rect = (e) => ({
      x: Math.min(x0, e.clientX), y: Math.min(y0, e.clientY),
      w: Math.abs(e.clientX - x0), h: Math.abs(e.clientY - y0),
    });

    shade.onwheel = (e) => e.preventDefault();
    shade.onpointerdown = (e) => {
      if (e.button !== 0) return;
      hint.remove(); // out of the way once the user knows what to do
      x0 = e.clientX;
      y0 = e.clientY;
      shade.setPointerCapture(e.pointerId);
    };
    shade.onpointermove = (e) => {
      if (x0 === null) return;
      const r = rect(e);
      Object.assign(box.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
    };
    shade.onpointerup = async (e) => {
      if (x0 === null) return;
      const r = rect(e);
      if (r.w < 5 || r.h < 5) return teardown(); // a click, not a drag
      await img.decode();
      if (!shade.isConnected) return; // torn down (Escape / new scan) while decoding
      showPopup(root, scan(img, r), e.clientX, e.clientY);
      shade.remove();
    };
  };
})();
