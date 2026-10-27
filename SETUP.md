# Setup & testing (your part)

These steps happen inside your browser, so you have to do them yourself. Claude Code writes the code. You load it into the browser and try it.

## What an extension is before you install it

There's nothing to build, compile, or "render". A Chromium extension is just a **folder** containing a `manifest.json` plus the JS files that manifest names. The browser reads that folder directly. This project folder *is* the extension.

| Install method | What you give the browser | Use it for |
|---|---|---|
| **Unpacked** (developer mode) | The folder itself | Personal use and development (this project) |
| **Store** | A `.zip` of the folder, uploaded to Chrome Web Store / Edge Add-ons | Only if you want to publish it for other people |

Ignore `.crx` files. Chrome and Edge block installing them from anywhere other than a store.

Nothing else needs installing: no Node, no npm, no build tools.

## Install (one time)

1. Open the extensions page:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
   - Brave / Opera / Vivaldi: `brave://extensions`, `opera://extensions`, `vivaldi://extensions`
2. Turn on the **Developer mode** toggle on that page.
3. Click **Load unpacked** and select `D:\personal\qr-scanner-extension`.
4. The extension now shows in the list and stays installed across browser restarts.

Don't move, rename, or delete the folder. The browser loads the extension from it every time.

## Use it

On any normal webpage, press **Alt+Shift+Q**, then drag a box over a QR code.

It can't run on browser-internal pages (`chrome://…`, `edge://…`, the new-tab page) or on the Chrome Web Store / Edge Add-ons sites. Browsers block every extension there.

To change the shortcut, go to `chrome://extensions/shortcuts` or `edge://extensions/shortcuts`. If Alt+Shift+Q shows as unassigned there, another extension already uses it, so pick a different one.

## After Claude changes the code

1. On the extensions page, click the reload icon (↻) on this extension's card.
2. Reload the tab you're testing on. Tabs that were open before step 1 keep running the old version.

If something breaks, copy the error text to Claude from:
- the **Errors** button on the extension card, or
- the webpage's DevTools console (F12 → Console).

## Test checklist

Open `test.html` from this folder (it needs internet, since it loads a QR generator to draw the codes). It's opened as a local file, so first go to the extension card, choose **Details**, and turn on **Allow access to file URLs** (one time only).

Claude has already checked the selection, decoding, and popup logic automatically (`node test.mjs`). This manual pass checks what only a real browser can: the shortcut, the screen capture, and how it looks.

- [ ] Overlay shows a "Drag over a QR code · Esc to cancel" pill at the top; it disappears once you start dragging
- [ ] QR containing a web link → popup labeled "LINK · *domain*" shows the link, button says **Open**, Enter opens it in a new tab
- [ ] QR containing plain text → button says **Okay**, Enter closes the popup
- [ ] QR containing a `javascript:` link → button says **Okay** (it must not run)
- [ ] Drag over an area with no QR → "No QR code found" with a tip below + **Okay**
- [ ] With Windows in dark mode (Settings → Personalization → Colors), the popup is dark too
- [ ] Inverted QR (light on dark) → decodes
- [ ] The popup opens up-left of where you released, with its button right next to the cursor
- [ ] Escape while dragging cancels; Escape on the popup closes it
- [ ] Clicking anywhere outside the popup closes it without clicking whatever is underneath
- [ ] Pressing the shortcut several times in a row doesn't stack overlays
- [ ] Still works at 150% page zoom (Ctrl + `+`)

## Publishing (optional, only if you want others to install it)

Ask Claude to package it, and it'll produce the `.zip`. Then:
- **Chrome Web Store**: one-time US$5 developer registration, then upload the zip in the Developer Dashboard.
- **Edge Add-ons**: free, upload through Microsoft Partner Center.

Both stores also need an icon, screenshots, and a privacy description, and review takes a few days.
