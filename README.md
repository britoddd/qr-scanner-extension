# QR Region Scanner

Snipping-tool-style QR scanner for Chromium browsers: press a shortcut, drag a box over a QR code on any webpage, and read it.

## Quick Start

1. Open `chrome://extensions` (or `edge://extensions`) and turn on **Developer mode**.
2. Click **Load unpacked** and select this folder.
3. On any webpage, press **Alt+Shift+Q** and drag over a QR code.

No build step and nothing to install. The folder is the extension. Full install, update, and test steps are in [SETUP.md](./SETUP.md).

## Features

- **Region select:** the page freezes under a dimmed overlay with a crosshair cursor, the same way Win+Shift+S does. Drag a box over the code.
- **Popup at the cursor:** opens just up-left of where you release the mouse, so its button is right under your pointer; kept inside the viewport. Press anywhere else to close it. Links are labeled with their domain so you can see where they go before opening. Follows your light/dark theme.
- **Smart action button:**
  - `http`/`https` link → **Open** (new tab)
  - anything else (text, Wi-Fi config, `mailto:`, …) → **Okay**
  - nothing found → "No QR code found" + **Okay**
- **Keyboard:** **Enter** runs the button, **Escape** cancels at any point.
- **Works on tricky codes:** light-on-dark codes, high-DPI screens, browser zoom, and video frames (decoding uses the frozen frame).
- **Private and offline:** no network requests, no remote code. It only asks for `activeTab` + `scripting`, so it can see a page only when you press the shortcut.

Works in Chrome, Edge, Brave, Opera, and Vivaldi.

## Configuration

| Setting | Default | Change it at |
|---------|---------|--------------|
| Scan shortcut | `Alt+Shift+Q` | `chrome://extensions/shortcuts` or `edge://extensions/shortcuts` |

If the shortcut shows as unassigned, another extension already uses it, so pick a different one there.

**Limitations:** it can't run on browser-internal pages (`chrome://`, `edge://`, new tab), on the Chrome Web Store, or on Edge Add-ons. Codes need at least 2 screen pixels per module.

## Development

| File | Role |
|------|------|
| `manifest.json` | Manifest V3: shortcut and permissions |
| `background.js` | On shortcut: captures the visible tab, injects the scanner |
| `content.js` | Overlay, drag selection, crop, decode, popup, keys |
| `lib/jsQR.js` | Vendored QR decoder |
| `test.mjs` | Automated check of `content.js` in headless Chrome |
| `test.html` | Manual test page with sample QR codes |

```sh
node test.mjs   # needs Chrome + internet; exits 1 on failure
```

After changing code, click reload on the extension card, then reload the tab you're testing.

## Documentation

- [SETUP.md](./SETUP.md): install, update, manual test checklist, publishing
- [CLAUDE.md](./CLAUDE.md): spec, architecture, and design decisions

## License

No license chosen for this project yet. The bundled [jsQR](https://github.com/cozmo/jsQR) decoder is Apache-2.0; see [lib/jsQR.LICENSE](./lib/jsQR.LICENSE).
