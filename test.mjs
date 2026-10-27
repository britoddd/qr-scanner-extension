// Headless-Chrome check for content.js: selection, crop, decode, popup, keyboard. Run: node test.mjs
// Needs Chrome (CHROME=<path> to override) and internet (fetches the QR generator).
// Doesn't cover the extension wiring (shortcut, captureVisibleTab, injection); that's the manual pass in SETUP.md.
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Runs inside the page. Returns PASS/FAIL lines.
async function checks() {
  const out = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const ui = () => document.querySelector('qr-scanner-ui')?.shadowRoot;
  const popup = () => [ui()?.querySelector('.val')?.textContent, ui()?.querySelector('button')?.textContent].join();
  const key = (k) => dispatchEvent(new KeyboardEvent('keydown', { key: k, cancelable: true }));
  const check = (name, ok, got) => out.push(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ' -> got ' + JSON.stringify(got)}`);

  // Fake captureVisibleTab: viewport-sized PNG at device resolution with a QR at (qx, qy) CSS px. Starts a scan.
  const shot = (value, qx, qy, invert = false) => {
    const d = devicePixelRatio, cell = 4, c = document.createElement('canvas');
    c.width = innerWidth * d;
    c.height = innerHeight * d;
    const g = c.getContext('2d');
    g.fillStyle = invert ? '#222' : '#fff';
    g.fillRect(0, 0, c.width, c.height);
    let size = 0;
    if (value) {
      const qr = qrcode(0, 'M');
      qr.addData(value);
      qr.make();
      const n = qr.getModuleCount();
      size = n * cell;
      g.fillStyle = invert ? '#eee' : '#000';
      for (let r = 0; r < n; r++) for (let k = 0; k < n; k++)
        if (qr.isDark(r, k)) g.fillRect((qx + k * cell) * d, (qy + r * cell) * d, cell * d, cell * d);
    }
    __qrScan(c.toDataURL());
    return size;
  };
  const drag = async (x1, y1, x2, y2) => {
    const shade = ui().querySelector('.shade');
    for (const [type, x, y] of [['pointerdown', x1, y1], ['pointermove', x2, y2], ['pointerup', x2, y2]])
      shade.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, button: 0, pointerId: 1 }));
    for (let i = 0; i < 40 && ui()?.querySelector('.shade'); i++) await sleep(50); // wait for decode
  };

  const [qx, qy] = [100, 80];
  let size;

  size = shot('https://example.com/a?b=1', qx, qy);
  await drag(qx + 2, qy + 2, qx + size - 2, qy + size - 2); // 2px inside the code's edge
  check('url, tight drag -> Open', popup() === 'https://example.com/a?b=1,Open', popup());
  key('Enter');
  check('Enter opens url and closes', window.opened?.[0] === 'https://example.com/a?b=1' && !ui(), window.opened);

  window.opened = null;
  size = shot('Hello world', qx, qy);
  await drag(qx + size + 10, qy + size + 10, qx - 10, qy - 10); // dragged up-left
  check('text -> Okay', popup() === 'Hello world,Okay', popup());
  key('Enter');
  check('Enter closes without opening', !window.opened && !ui(), window.opened);

  size = shot('javascript:alert(1)', qx, qy);
  await drag(qx - 10, qy - 10, qx + size + 10, qy + size + 10);
  check('javascript: -> Okay', popup() === 'javascript:alert(1),Okay', popup());
  key('Escape');
  check('Escape closes popup', !ui());

  size = shot('https://example.com/inv', qx, qy, true);
  await drag(qx - 10, qy - 10, qx + size + 10, qy + size + 10);
  check('inverted -> Open', popup() === 'https://example.com/inv,Open', popup());
  ui().querySelector('button').click();
  check('button click opens and closes', window.opened?.[0] === 'https://example.com/inv' && !ui(), window.opened);

  shot(null);
  await drag(300, 300, 400, 400);
  check('no QR -> message + Okay', popup() === 'No QR code found,Okay', popup());
  const p = ui().querySelector('.pop');
  check('popup bottom-right at release point',
    parseFloat(p.style.left) + p.offsetWidth === 400 && parseFloat(p.style.top) + p.offsetHeight === 400, p.style.cssText);
  ui().querySelector('.val').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  check('press inside popup keeps it', !!ui());
  ui().elementFromPoint(5, 5)?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  check('press outside popup closes it', !ui());

  shot(null);
  await drag(200, 200, 202, 201);
  check('click without drag cancels', !ui());

  shot(null);
  key('Escape');
  check('Escape while selecting cancels', !ui());

  shot(null);
  shot(null);
  check('repeat press keeps one overlay', document.querySelectorAll('qr-scanner-ui').length === 1);
  key('Escape');

  shot('Hello', innerWidth - 150, innerHeight - 150);
  await drag(innerWidth - 160, innerHeight - 160, innerWidth - 2, innerHeight - 2);
  const b = ui()?.querySelector('.pop')?.getBoundingClientRect();
  check('popup kept inside viewport', b && b.left >= 0 && b.top >= 0 && b.right <= innerWidth && b.bottom <= innerHeight, b);
  key('Escape');
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chrome = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const profile = mkdtempSync(join(tmpdir(), 'qr-test-'));
const proc = spawn(chrome, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank']);

let port;
for (let i = 0; !port && i < 50; i++) {
  await sleep(200);
  try { port = readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]; } catch {}
}
const target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
const pending = new Map();
let id = 0;
ws.onmessage = (e) => { const m = JSON.parse(e.data); pending.get(m.id)?.(m.result); };
const cdp = (method, params = {}) => new Promise((r) => { pending.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async (expression) => {
  const { result, exceptionDetails } = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
  return result.value;
};

try {
  // Test-only: open shadow roots so checks can reach the UI, and record window.open instead of opening tabs.
  await evaluate(`Element.prototype.attachShadow = ((orig) => function (o) { return orig.call(this, { ...o, mode: 'open' }); })(Element.prototype.attachShadow);
    window.opened = null; window.open = (...a) => { window.opened = a; };`);
  await evaluate(await (await fetch('https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js')).text());
  await evaluate(readFileSync(new URL('lib/jsQR.js', import.meta.url), 'utf8'));
  await evaluate(readFileSync(new URL('content.js', import.meta.url), 'utf8'));

  let failed = 0;
  for (const dpr of [1, 2]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width: 1200, height: 800, deviceScaleFactor: dpr, mobile: false });
    for (const line of await evaluate(`(${checks})()`)) {
      if (!line.startsWith('PASS')) failed++;
      console.log(`[${dpr}x] ${line}`);
    }
  }
  process.exitCode = failed ? 1 : 0;
} finally {
  ws.close();
  proc.kill();
}
