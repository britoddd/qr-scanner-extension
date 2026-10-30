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

On any normal webpage, press **Alt+Shift+Q** (or click the extension's icon and choose **Scan this page**), then drag a box over a QR code.

It can't run on browser-internal pages (`chrome://…`, `edge://…`, the new-tab page) or on the Chrome Web Store / Edge Add-ons sites. Browsers block every extension there.

To change the shortcut, click the extension's icon → **Change**, or go to `chrome://extensions/shortcuts` / `edge://extensions/shortcuts`. If Alt+Shift+Q shows as unassigned there, another extension already uses it, so pick a different one.

## After Claude changes the code

1. On the extensions page, click the reload icon (↻) on this extension's card.
2. Reload the tab you're testing on. Tabs that were open before step 1 keep running the old version.

If something breaks, copy the error text to Claude from:
- the **Errors** button on the extension card, or
- the webpage's DevTools console (F12 → Console).

## Test checklist

Open `test/test.html` (it needs internet, since it loads a QR generator to draw the codes). It's opened as a local file, so first go to the extension card, choose **Details**, and turn on **Allow access to file URLs** (one time only).

Claude has already checked the selection, decoding, and popup logic automatically (`node test/test.mjs`). This manual pass checks what only a real browser can: the shortcut, the screen capture, and how it looks.

- [ ] Overlay shows a "Drag over a QR code · Esc to cancel" pill at the top; it disappears once you start dragging
- [ ] QR containing a web link → popup labeled "LINK · *domain*" shows the link, button says **Open**, Enter opens it in a new tab
- [ ] QR containing plain text → button says **Okay**, Enter closes the popup
- [ ] QR containing a `javascript:` link → button says **Okay** (it must not run)
- [ ] Drag over an area with no QR → "No QR code found" with a tip below + **Okay**
- [ ] The popup is frosted glass: the page behind it shows through, blurred, and its text stays readable
- [ ] With Windows in dark mode (Settings → Personalization → Colors), the popup is dark too
- [ ] Inverted QR (light on dark) → decodes
- [ ] The popup opens up-left of where you released, with its button right next to the cursor
- [ ] Escape while dragging cancels; Escape on the popup closes it
- [ ] Clicking anywhere outside the popup closes it without clicking whatever is underneath
- [ ] Pressing the shortcut several times in a row doesn't stack overlays
- [ ] Still works at 150% page zoom (Ctrl + `+`)

Toolbar popup and welcome page:

- [ ] First install (remove the extension, then **Load unpacked** again) → a "You're all set" tab opens showing **Alt Shift Q**. Reloading the extension doesn't open it again
- [ ] Click the extension's icon (puzzle-piece menu if not pinned) → popup shows **Scan this page**, the shortcut and how-to steps
- [ ] **Scan this page** on a normal site → popup closes and the overlay appears; Escape still cancels it
- [ ] **Scan this page** on `chrome://extensions` or the new-tab page → red "can't be scanned" message, popup stays open
- [ ] **Change** → opens the browser's shortcuts page; change the key there, reopen the popup → shows the new keys
- [ ] Clear the shortcut on that page → popup shows "Not set", a red warning and **Set shortcut**

## Publishing (optional, only if you want others to install it)

Ask Claude to package it, and it'll produce the `.zip`. Then:
- **Chrome Web Store**: one-time US$5 developer registration, then upload the zip in the Developer Dashboard.
- **Edge Add-ons**: free, upload through Microsoft Partner Center.

Both stores also need an icon, screenshots, and a privacy description, and review takes a few days.
