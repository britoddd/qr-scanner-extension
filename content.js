// Injected on every shortcut press; the guard keeps a single instance (and its state) per tab.
(() => {
  if (window.__qrScan) return;

  const CSS = `
    .shade { position: fixed; inset: 0; overflow: hidden; cursor: crosshair; user-select: none; touch-action: none; outline: none; }
    .shade img { position: absolute; left: 0; top: 0; width: 100vw; height: 100vh; pointer-events: none; }
    .box { position: absolute; left: -9px; top: -9px; outline: 1px solid #fff; box-shadow: 0 0 0 9999px rgba(0, 0, 0, .4); }
    .pop { position: fixed; display: flex; flex-direction: column; gap: 10px; min-width: 220px; max-width: 360px; padding: 12px;
           background: #fff; color: #202124; border-radius: 8px; box-shadow: 0 4px 20px rgba(0, 0, 0, .3);
           font: 14px/1.4 system-ui, sans-serif; }
    .val { max-height: 200px; overflow: auto; white-space: pre-wrap; word-break: break-all; user-select: text; }
    button { align-self: flex-end; padding: 6px 16px; border: 0; border-radius: 6px;
             background: #1a73e8; color: #fff; font: inherit; cursor: pointer; }
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
    const ctx = Object.assign(document.createElement('canvas'), { width: w, height: h }).getContext('2d');
    ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
    return jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'attemptBoth' })?.data ?? null;
  }

  // (x, y): release point. (vw, vh): viewport size without scrollbars.
  function showPopup(root, text, x, y, vw, vh) {
    let url = null;
    try {
      const u = new URL(text);
      if (u.protocol === 'http:' || u.protocol === 'https:') url = u.href; // never javascript:, data:, etc.
    } catch {}

    const pop = el('div', 'pop', root);
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', 'QR code');
    el('div', 'val', pop).textContent = text ?? 'No QR code found'; // textContent: QR data is untrusted
    const btn = el('button', '', pop);
    btn.textContent = url ? 'Open' : 'Okay';
    btn.onclick = act = () => {
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
      teardown();
    };

    pop.style.left = Math.max(8, Math.min(x, vw - pop.offsetWidth - 8)) + 'px';
    pop.style.top = Math.max(8, Math.min(y, vh - pop.offsetHeight - 8)) + 'px';
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
