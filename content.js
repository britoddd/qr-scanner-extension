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
    /* Frosted glass: the live page shows through blurred. Alpha .8 + darker/lighter muted text keep contrast ≥4.5:1 on any page. */
    .pop { --bg: rgba(255, 255, 255, .8); --fg: #202124; --muted: #4d5156; --accent: #1a73e8; --on-accent: #fff;
           --ring: rgba(255, 255, 255, .6); --glow: rgba(255, 255, 255, .8);
           position: fixed; display: flex; flex-direction: column; gap: 6px; min-width: 240px; max-width: 360px; padding: 16px 18px;
           background: var(--bg); color: var(--fg); border: 1px solid var(--ring); border-radius: 20px;
           backdrop-filter: blur(24px) saturate(180%); box-shadow: 0 12px 40px rgba(0, 0, 0, .28), inset 0 1px 0 var(--glow);
           font: 14px/1.45 system-ui, sans-serif; color-scheme: light; animation: pop .14s ease-out; transform-origin: bottom right; }
    @media (prefers-color-scheme: dark) {
      .pop { --bg: rgba(32, 33, 36, .8); --fg: #e8eaed; --muted: #bdc1c6; --accent: #8ab4f8; --on-accent: #202124;
             --ring: rgba(255, 255, 255, .14); --glow: rgba(255, 255, 255, .12); color-scheme: dark; }
    }
    @media (prefers-reduced-transparency: reduce) { .pop { background: Canvas; backdrop-filter: none; } }
    .lbl { color: var(--muted); font-size: 12px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; }
    .lbl b { color: var(--fg); letter-spacing: normal; text-transform: none; }
    .val { max-height: 200px; overflow: auto; white-space: pre-wrap; word-break: break-all; user-select: text; }
    .none { font-weight: 600; }
    .note { color: var(--muted); font-size: 13px; }
    button { align-self: flex-end; margin-top: 6px; padding: 7px 18px; border: 0; border-radius: 999px;
             background: var(--accent); color: var(--on-accent); font: 500 14px/1.4 system-ui, sans-serif; cursor: pointer; transition: filter .15s; }
    button:hover { filter: brightness(.92); }
    button:active { filter: brightness(.84); }
    button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    @keyframes fade { from { opacity: 0; } }
    @keyframes pop { from { opacity: 0; transform: translateY(4px) scale(.98); } }
    @media (prefers-reduced-motion: reduce) { .box, .pop { animation: none; } }
  `;

  let host = null; // UI root element while active, null when idle
  let act = null;  // popup button action, null while selecting

  const el = (tag, cls, parent) => parent.appendChild(Object.assign(document.createElement(tag), { className: cls }));

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

  // (x, y): release point. (vw, vh): viewport size without scrollbars.
  function showPopup(root, text, x, y, vw, vh) {
    let url = null;
    try {
      const u = new URL(text);
      if (u.protocol === 'http:' || u.protocol === 'https:') url = u; // never javascript:, data:, etc.
    } catch {}

    // Covers the page behind the popup: a press anywhere else closes it, and that press doesn't reach the page.
    el('div', 'catch', root).onpointerdown = teardown;
    const pop = el('div', 'pop', root);
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', 'QR code');
    pop.setAttribute('aria-describedby', 'val note'); // screen readers read the result when the button takes focus
    if (text !== null) {
      const lbl = el('div', 'lbl', pop);
      lbl.textContent = url ? 'Link · ' : 'Text';
      if (url) el('b', '', lbl).textContent = url.host; // punycode, so lookalike domains stand out
    }
    // textContent: QR data is untrusted
    Object.assign(el('div', text === null ? 'val none' : 'val', pop), { id: 'val', textContent: text ?? 'No QR code found' });
    if (text === null) Object.assign(el('div', 'note', pop), { id: 'note', textContent: 'Drag around the whole code. If it’s small, zoom in first.' });
    const btn = el('button', '', pop);
    btn.textContent = url ? 'Open' : 'Okay';
    btn.onclick = act = () => {
      if (url) window.open(url.href, '_blank', 'noopener,noreferrer');
      teardown();
    };

    // Bottom-right corner at the release point, so the button lands right next to the cursor.
    pop.style.left = Math.max(8, Math.min(x - pop.offsetWidth, vw - pop.offsetWidth - 8)) + 'px';
    pop.style.top = Math.max(8, Math.min(y - pop.offsetHeight, vh - pop.offsetHeight - 8)) + 'px';
    btn.focus();
  }

  window.__qrScan = (shot) => {
    teardown();
    host = document.createElement('qr-scanner-ui');
    host.style.cssText = 'all: initial; position: fixed; top: 0; left: 0; z-index: 2147483647;';
    const root = host.attachShadow({ mode: 'closed' }); // page styles and scripts can't reach in
    el('style', '', root).textContent = CSS;
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
      // The fixed full-viewport shade measures the viewport correctly even on quirks-mode pages.
      showPopup(root, scan(img, r), e.clientX, e.clientY, shade.clientWidth, shade.clientHeight);
      shade.remove();
    };
  };
})();
