# QR Region Scanner — browser extension

Snipping-tool-style QR scanner (like Win+Shift+S, but for QR codes on a webpage). Press the shortcut, drag a rectangle over a QR code, get a popup with its value.

Targets Chromium browsers only: Chrome, Edge, Brave, Opera, Vivaldi. One codebase, Manifest V3, `chrome.*` namespace (works in all of them). No Firefox.

## Behavior spec

1. User presses the shortcut (default `Alt+Shift+Q`, rebindable at `chrome://extensions/shortcuts` / `edge://extensions/shortcuts`).
2. The page is "frozen": a full-viewport overlay appears with a dim tint and a `crosshair` (+) cursor. A hint pill at the top ("Drag over a QR code · Esc to cancel") disappears on the first press. Page scroll is blocked while selecting.
3. User drags a rectangle; the selection is drawn live. A click without a meaningful drag (< ~5px) cancels.
4. On mouse release, the selected region is decoded and a popup appears **up-left of the release point**: its bottom-right corner sits at the cursor, so the button is right next to it (clamped to stay inside the viewport).
5. Popup content:
   - A header like the toolbar popup's: an icon badge (gradient for Link/Text, red tint for none) + title "Link" with the *host* below (punycode, so lookalike domains stand out), or "Text".
   - The value sits in an inset glass card. Open is the gradient primary button (with ↗); Okay is the tinted secondary.
   - Decoded value as selectable text.
   - Value is an `http:`/`https:` URL → button **"Open"** (opens it in a new tab).
   - Anything else (plain text, Wi-Fi config, `mailto:`, `javascript:`, etc.) → button **"Okay"** (closes popup).
   - No QR found → message "No QR code found", a recovery tip (drag around the whole code, zoom in if small) + **"Okay"**.
   - Frosted-glass card (translucent, blurs the page behind it); solid under `prefers-reduced-transparency`.
   - Follows the OS light/dark theme; entrance animations are skipped under `prefers-reduced-motion`.
6. **Enter** triggers the popup's button action (open or close). **Escape** cancels selection or closes the popup at any stage. A press anywhere outside the popup closes it; a transparent layer behind the popup swallows that press so it doesn't also click the page.
7. **Toolbar popup** (`popup.html`, opened by clicking the extension icon) for users who don't know the shortcut:
   - **"Scan this page"** decodes the whole visible page with no drag (`__qrScan(shot, true)`); the result popup opens centered. Its "No QR code found" tip points to Scan part of page.
   - **"Scan part of page"** starts the same drag-to-select scan as the shortcut.
   - On pages the browser blocks, both show an inline error instead of closing.
   - Shows the current shortcut as keys (`chrome.commands.getAll()`), or "Not set" with a warning when Chrome left it blank because another extension took the key.
   - **Change / Set shortcut** opens `chrome://extensions/shortcuts`. Extensions can't set shortcuts themselves; only that page can.
   - Layout: the two scans are side-by-side tiles (icon, name, one-line description; Scan this page is the filled primary). Both tiles are disabled while a scan starts. The shortcut is a settings-style card (keys + what it does + "Change shortcut ↗"). "How it works" is a collapsed `<details>`. Footer: "Works offline. Nothing leaves your browser."
   - On first install, the same page opens once as a tab (`popup.html?welcome`): "You're all set" heading, no scan tiles, "How it works" expanded, plus a tip to pin the extension.

## Architecture

No build step, no npm, no framework. Plain JS files loaded unpacked.

```
manifest.json    MV3 manifest: commands, action popup, permissions, background service worker
background.js    Service worker: handles the shortcut and the popup's scan request, captures the tab, injects content script; opens the welcome tab on install
content.js       Overlay, drag selection, crop, decode, popup, keyboard handling
popup.html       Toolbar popup / first-run welcome page: scan button, current shortcut, how-to (inline CSS)
popup.js         Its logic (MV3 forbids inline scripts in extension pages)
lib/jsQR.js      Vendored jsQR 1.4.0 (Apache-2.0, sha512-verified from npm) — the only third-party code
lib/jsQR.LICENSE Its license; Apache-2.0 requires shipping it
LICENSE          This project's license (MIT). Shipped in the store zip: MIT requires the notice in every copy
icons/           Extension icon: icon.svg (source, same mark as the popup logo) + 16/32/48/128 PNGs rendered from it
                 (Chrome needs PNG). To change it, edit icon.svg and re-render the PNGs with headless Chrome at those sizes.
test/            Everything test-only (not shipped):
  test.mjs         Automated check of content.js in headless Chrome
  test.html        Manual test page with sample QR codes
  qrcode_www.youtube.com.png  Dot-style QR fixture used by test.mjs
screenshots/     README images, copied from the store screenshots in dist/store/ (dist/ is gitignored; not shipped)
SETUP.md         User-facing install/test steps (not shipped)
README.md        Project overview (not shipped)
```

Flow:

1. `chrome.commands.onCommand` fires in `background.js`, or the popup's "Scan this page" sends the active tab via `chrome.runtime.sendMessage`. Both call `scan(tab)`. The popup delegates because it closes as soon as the page takes focus, which would abort its own calls. Clicking the icon grants `activeTab` just like the shortcut.
2. Background calls `chrome.tabs.captureVisibleTab()` **first**, before any overlay exists (freeze-frame, like Win+Shift+S). This avoids the overlay leaking into the screenshot and handles animated/video QR codes.
3. Background injects `lib/jsQR.js` + `content.js` via `chrome.scripting.executeScript`, then a second `executeScript` calls `window.__qrScan(screenshotDataUrl)` (no messaging, so no reply-port semantics to deal with).
4. `content.js` shows the screenshot as a frozen frame under a dimmed overlay, tracks the drag, crops the selection onto a canvas, runs `jsQR`, renders the popup. It uses no `chrome.*` APIs, which is what makes `test/test.mjs` possible.

Permissions: `activeTab` + `scripting` only. `activeTab` is granted when the user presses an extension command, which covers both `captureVisibleTab` and script injection. Do not add `<all_urls>` or host permissions.

## Key decisions & gotchas

- **Decoder is jsQR, not `BarcodeDetector`.** The native `BarcodeDetector` API is not available in desktop Chrome/Edge on Windows or Linux. MV3 forbids remotely hosted code, so jsQR must be vendored into `lib/`, never loaded from a CDN.
- **Crop scale:** compute `scale = screenshotImage.width / window.innerWidth`, not `devicePixelRatio` alone; this also stays correct under browser zoom. Multiply the selection rect (client coords) by `scale` before cropping.
- **Crop margin:** the crop is expanded by 10% of the selection on each side, using real screenshot pixels, so a drag that clips the code's edge still decodes. Measured: jsQR needs no quiet zone at ≥2 device px per module and fails only at 1px/module, so no white padding or upscaling. `inversionAttempts: 'attemptBoth'` handles light-on-dark codes.
- **Downscale retry:** dot-style "designer" codes (round modules) fail at full size, because the dots don't touch and jsQR needs solid runs. The fixture fails natively at ≥350px. If the full-size decode fails, `scan()` retries with the longest side at 300px, then 200px; shrinking blurs the dots into blocks. A 200px retry decoded the fixture at every size from 100 to 2400px. Codes that decode at full size never reach the retries.
- **Re-injection:** the shortcut can be pressed repeatedly on the same tab, re-running `content.js`. The whole file is an IIFE that returns early if `window.__qrScan` exists (top-level `let` would throw on the second run). `__qrScan` tears down any existing overlay/popup first, and the async decode checks `shade.isConnected` so a stale scan can't attach to a new session.
- **Viewport size:** clamp the popup using the fixed full-viewport `.catch` layer's `clientWidth/Height`, not `document.documentElement.client*`, which is wrong on quirks-mode pages. (It exists in both modes; the shade doesn't exist in a whole-page scan.)
- **Whole-page scan:** decodes the full screenshot with the same `scan()` (crop = whole viewport). Measured on a busy 1280×800 page: plain codes from 100px and the dot-style fixture were found at 1x and 2x in 70–310 ms. jsQR returns one code, so with several on screen the user should scan part of the page.
- **Isolation from the page:** render overlay and popup inside a Shadow DOM host with `z-index: 2147483647` and `all: initial` so page CSS can't break it.
- **Untrusted QR content:** render the value with `textContent`, never `innerHTML`. Only `http:`/`https:` (checked via `new URL()`) get the "Open" button; never navigate to `javascript:`, `data:`, or other schemes.
- **Keyboard:** listen for `keydown` on `window` in the **capture** phase and `stopPropagation()`/`preventDefault()` for Enter/Escape while the scanner is active, so page handlers don't also react. Remove all listeners on teardown.
- **Restricted pages:** `chrome://`, `edge://`, the Web Store, and the browser's new-tab page can't be scripted or captured. Catch the error in `background.js` and fail silently (optionally set a badge); don't throw.
- **Capture rate limit:** `captureVisibleTab` is limited to ~2 calls/second. One capture per activation is fine; don't capture on mouseup again.

## Development

The extension *is* this folder. There's no build; the browser runs the files as-is (loaded "unpacked").

- **Automated check:** `node test/test.mjs` runs `content.js` in headless Chrome against fake screenshots at 1x and 2x: tight/reversed drags, URL/text/`javascript:`/inverted/no-QR results, whole-page scan, Enter/Escape/click, re-trigger, and viewport clamping. Run it after any `content.js` change; exit code 1 on failure. Needs Chrome (`CHROME=<path>` to override) and internet (it fetches qrcode-generator from jsDelivr).
- **Not automatable here:** the extension wiring (real shortcut, `captureVisibleTab`, injection). Claude can't load the extension into the user's browser, so loading, reloading, and the manual pass are the user's job, documented in `SETUP.md`. Keep that file in sync when behavior, the shortcut, or the checklist changes. After a code change, tell the user what to redo (usually: reload the extension, then reload the tab) and what to check.
- Debugging: ask the user for the text from the extension card's **Errors** button or the page's DevTools console. Service worker logs are under "Inspect views: service worker" on the card; content script logs are in the page console.
- Packaging for a store (only when asked): zip the shipped files only, with `manifest.json` at the zip root:
  `& "$env:SystemRoot\System32\tar.exe" -a -c -f dist/qr-scanner-<version>.zip manifest.json background.js content.js popup.html popup.js lib icons LICENSE`
  Don't use `Compress-Archive`: in Windows PowerShell 5.1 it writes `lib\jsQR.js` with backslashes, which zip readers treat as a file name, not a folder. Don't use a bare `tar` from Git Bash either: that's GNU tar, which silently writes a tar file named `.zip`. Bump `version` in the manifest before every store upload; stores reject a version they already have.

## Conventions

- Plain ES2020+ JS, no TypeScript, no bundler, no dependencies beyond `lib/jsQR.js`. The test files may load qrcode-generator from a CDN; the extension itself never loads remote code.
- Keep it to the files listed above; don't add an options page until there's a real need.
- The icon, the popup logo and the result box's badges share one gradient (`#1a73e8 → #5b5bf0`, dark `#8ab4f8 → #b4a7fa`) and the same line-icon style. Keep them in sync.
- Keep UI strings in English and inline in `content.js` / `popup.html` / `popup.js`.
- `popup.html` reuses `content.js`'s popup palette (same light/dark text tokens and accent) so both feel like one product. Both are glass, but differently: an extension popup window is opaque, so the page can't show through it. Instead, its panels (`.glass`) are translucent + `backdrop-filter` over soft color blobs painted on `body`. Under `prefers-reduced-transparency` both go solid.
