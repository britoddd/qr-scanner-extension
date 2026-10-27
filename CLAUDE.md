# QR Region Scanner — browser extension

Snipping-tool-style QR scanner (like Win+Shift+S, but for QR codes on a webpage). Press the shortcut, drag a rectangle over a QR code, get a popup with its value.

Targets Chromium browsers only: Chrome, Edge, Brave, Opera, Vivaldi. One codebase, Manifest V3, `chrome.*` namespace (works in all of them). No Firefox.

## Behavior spec

1. User presses the shortcut (default `Alt+Shift+Q`, rebindable at `chrome://extensions/shortcuts` / `edge://extensions/shortcuts`).
2. The page is "frozen": a full-viewport overlay appears with a dim tint and a `crosshair` (+) cursor. A hint pill at the top ("Drag over a QR code · Esc to cancel") disappears on the first press. Page scroll is blocked while selecting.
3. User drags a rectangle; the selection is drawn live. A click without a meaningful drag (< ~5px) cancels.
4. On mouse release, the selected region is decoded and a popup appears **up-left of the release point**: its bottom-right corner sits at the cursor, so the button is right next to it (clamped to stay inside the viewport).
5. Popup content:
   - A small label: "Link · *host*" (host shown as punycode, so lookalike domains stand out) or "Text".
   - Decoded value as selectable text.
   - Value is an `http:`/`https:` URL → button **"Open"** (opens it in a new tab).
   - Anything else (plain text, Wi-Fi config, `mailto:`, `javascript:`, etc.) → button **"Okay"** (closes popup).
   - No QR found → message "No QR code found", a recovery tip (drag around the whole code, zoom in if small) + **"Okay"**.
   - Follows the OS light/dark theme; entrance animations are skipped under `prefers-reduced-motion`.
6. **Enter** triggers the popup's button action (open or close). **Escape** cancels selection or closes the popup at any stage. A press anywhere outside the popup closes it; a transparent layer behind the popup swallows that press so it doesn't also click the page.

## Architecture

No build step, no npm, no framework. Plain JS files loaded unpacked.

```
manifest.json    MV3 manifest: commands, permissions, background service worker
background.js    Service worker: handles the shortcut, captures the tab, injects content script
content.js       Overlay, drag selection, crop, decode, popup, keyboard handling
lib/jsQR.js      Vendored jsQR 1.4.0 (Apache-2.0, sha512-verified from npm) — the only third-party code
lib/jsQR.LICENSE Its license; Apache-2.0 requires shipping it
test.mjs         Automated check of content.js in headless Chrome (not shipped)
test.html        Manual test page with sample QR codes (not shipped)
SETUP.md         User-facing install/test steps (not shipped)
README.md        Project overview (not shipped)
```

Flow:

1. `chrome.commands.onCommand` fires in `background.js`.
2. Background calls `chrome.tabs.captureVisibleTab()` **first**, before any overlay exists (freeze-frame, like Win+Shift+S). This avoids the overlay leaking into the screenshot and handles animated/video QR codes.
3. Background injects `lib/jsQR.js` + `content.js` via `chrome.scripting.executeScript`, then a second `executeScript` calls `window.__qrScan(screenshotDataUrl)` (no messaging, so no reply-port semantics to deal with).
4. `content.js` shows the screenshot as a frozen frame under a dimmed overlay, tracks the drag, crops the selection onto a canvas, runs `jsQR`, renders the popup. It uses no `chrome.*` APIs, which is what makes `test.mjs` possible.

Permissions: `activeTab` + `scripting` only. `activeTab` is granted when the user presses an extension command, which covers both `captureVisibleTab` and script injection. Do not add `<all_urls>` or host permissions.

## Key decisions & gotchas

- **Decoder is jsQR, not `BarcodeDetector`.** The native `BarcodeDetector` API is not available in desktop Chrome/Edge on Windows or Linux. MV3 forbids remotely hosted code, so jsQR must be vendored into `lib/`, never loaded from a CDN.
- **Crop scale:** compute `scale = screenshotImage.width / window.innerWidth`, not `devicePixelRatio` alone; this also stays correct under browser zoom. Multiply the selection rect (client coords) by `scale` before cropping.
- **Crop margin:** the crop is expanded by 10% of the selection on each side, using real screenshot pixels, so a drag that clips the code's edge still decodes. Measured: jsQR needs no quiet zone at ≥2 device px per module and fails only at 1px/module, so no white padding or upscaling. `inversionAttempts: 'attemptBoth'` handles light-on-dark codes.
- **Re-injection:** the shortcut can be pressed repeatedly on the same tab, re-running `content.js`. The whole file is an IIFE that returns early if `window.__qrScan` exists (top-level `let` would throw on the second run). `__qrScan` tears down any existing overlay/popup first, and the async decode checks `shade.isConnected` so a stale scan can't attach to a new session.
- **Viewport size:** clamp the popup using the fixed full-viewport shade's `clientWidth/Height`, not `document.documentElement.client*`, which is wrong on quirks-mode pages.
- **Isolation from the page:** render overlay and popup inside a Shadow DOM host with `z-index: 2147483647` and `all: initial` so page CSS can't break it.
- **Untrusted QR content:** render the value with `textContent`, never `innerHTML`. Only `http:`/`https:` (checked via `new URL()`) get the "Open" button; never navigate to `javascript:`, `data:`, or other schemes.
- **Keyboard:** listen for `keydown` on `window` in the **capture** phase and `stopPropagation()`/`preventDefault()` for Enter/Escape while the scanner is active, so page handlers don't also react. Remove all listeners on teardown.
- **Restricted pages:** `chrome://`, `edge://`, the Web Store, and the browser's new-tab page can't be scripted or captured. Catch the error in `background.js` and fail silently (optionally set a badge); don't throw.
- **Capture rate limit:** `captureVisibleTab` is limited to ~2 calls/second. One capture per activation is fine; don't capture on mouseup again.

## Development

The extension *is* this folder. There's no build; the browser runs the files as-is (loaded "unpacked").

- **Automated check:** `node test.mjs` runs `content.js` in headless Chrome against fake screenshots at 1x and 2x: tight/reversed drags, URL/text/`javascript:`/inverted/no-QR results, Enter/Escape/click, re-trigger, and viewport clamping. Run it after any `content.js` change; exit code 1 on failure. Needs Chrome (`CHROME=<path>` to override) and internet (it fetches qrcode-generator from jsDelivr).
- **Not automatable here:** the extension wiring (real shortcut, `captureVisibleTab`, injection). Claude can't load the extension into the user's browser, so loading, reloading, and the manual pass are the user's job, documented in `SETUP.md`. Keep that file in sync when behavior, the shortcut, or the checklist changes. After a code change, tell the user what to redo (usually: reload the extension, then reload the tab) and what to check.
- Debugging: ask the user for the text from the extension card's **Errors** button or the page's DevTools console. Service worker logs are under "Inspect views: service worker" on the card; content script logs are in the page console.
- Packaging for a store (only when asked): zip the shipped files only, with `manifest.json` at the zip root:
  `Compress-Archive -Path manifest.json, background.js, content.js, lib -DestinationPath dist/qr-scanner.zip -Force`
  Stores also require a 128×128 icon declared in the manifest.

## Conventions

- Plain ES2020+ JS, no TypeScript, no bundler, no dependencies beyond `lib/jsQR.js`. The test files may load qrcode-generator from a CDN; the extension itself never loads remote code.
- Keep it to the files listed above; don't add an options page, popup page, or icons until there's a real need.
- Keep UI strings in English and inline in `content.js`.
