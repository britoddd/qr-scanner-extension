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

On any normal webpage, press **Alt+Shift+Q** (or click the extension's icon and choose **Scan part of page**), then drag a box over a QR code. To skip the dragging, click the icon and choose **Scan this page**: it finds a code anywhere on screen.

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
- [ ] The extension's toolbar icon (and its icon on the extensions page) is the blue rounded square with the white QR mark, the same as the popup's logo
- [ ] QR containing a web link → popup with a link badge, title "Link" and the *domain* under it, the link in a rounded inset box, button **Open ↗**, Enter opens it in a new tab
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
- [ ] The popup and welcome tab look like frosted glass: soft color glow in the background, translucent panels with a light edge, in both light and dark mode
- [ ] Click the extension's icon → popup shows two tiles (**Scan this page**, **Scan part of page**), the shortcut card, and a collapsed **How it works** that expands on click. Tab / Enter work through all of them. New extensions are hidden in the puzzle-piece menu; to keep it in the toolbar, click the pin (Chrome) or eye icon (Edge) next to it there
- [ ] **Scan this page** on `test/test.html` (or any page with one QR code visible) → no overlay; the result popup appears centered with the code's value
- [ ] **Scan this page** with no QR code visible → "No QR code found" with a tip to try Scan part of page
- [ ] **Scan part of page** on a normal site → popup closes and the drag overlay appears; Escape still cancels it
- [ ] Either scan button on `edge://extensions` or the new-tab page → red "can't be scanned" message, popup stays open
- [ ] **Change** → opens the browser's shortcuts page; change the key there, reopen the popup → shows the new keys
- [ ] Clear the shortcut on that page → popup shows "Not set", a red warning and **Set shortcut**

## Publishing (so non-technical people can install it)

### Why a store

Browsers only let normal users install extensions from their store. The alternatives don't work for non-technical people:

- **Load unpacked** (what you do) needs Developer mode, a folder that must never move, and Edge warns about it.
- **`.crx` files** from anywhere other than a store are blocked on Windows and macOS.

A store listing gives people one **Add to Chrome / Get** button. It installs the extension, updates it automatically, and works in every Chromium browser: the Chrome Web Store also serves Brave, Opera and Vivaldi users.

### 1. Build the package

1. Make sure `version` in `manifest.json` is new. The first release is `1.0.0`. Every later upload needs a higher number (`1.0.1` for fixes, `1.1.0` for features), or the store rejects it.
2. In PowerShell, in this folder:

   ```powershell
   & "$env:SystemRoot\System32\tar.exe" -a -c -f dist/qr-scanner-1.0.0.zip manifest.json background.js content.js popup.html popup.js lib icons LICENSE
   ```

   This zips only the files the extension needs, plus the license, with `manifest.json` at the top level. Docs and `test/` stay out. Don't use right-click → "Compress", which zips the folder itself, or `Compress-Archive`, which writes broken folder paths.
3. Optional check: load `dist/qr-scanner-1.0.0.zip` unzipped (extract it to a new folder, then **Load unpacked**) and do a quick scan.

### 2. Edge Add-ons (free)

1. Sign in at [partner.microsoft.com/dashboard/microsoftedge](https://partner.microsoft.com/dashboard/microsoftedge) with a Microsoft account and register as a developer (free).
2. **Create new extension** → upload the zip.
3. **Availability:** *Public* (searchable) or *Hidden* (only people with the link can find it, good for sharing with friends or family).
4. **Properties:** category *Productivity*. When asked whether it collects personal data, answer **no**. That's true: everything runs in the browser and nothing is sent anywhere.
5. **Store listing:** description (text below), the 128px icon (`icons/128.png`, or a larger render of `icons/icon.svg` if a bigger logo is required), and screenshots. The form marks which images are required.
6. **Publish.** Review usually takes a few business days. You get an email when it's live.

### 3. Chrome Web Store (US$5 once)

1. Go to [chrome.google.com/webstore/devconsole](https://chrome.google.com/webstore/devconsole), sign in with a Google account, and pay the one-time US$5 registration.
2. **New item** → upload the zip.
3. **Store listing:** description, category *Productivity*, language, and at least one screenshot (1280×800 or 640×400). It may also ask for a 440×280 promo tile.
4. **Privacy practices:** fill in the answers below.
5. **Distribution:** *Public*, or *Unlisted* (link only).
6. **Submit for review.** It usually takes a few days, sometimes longer for a first item.

### Answers for the store forms

- **Short description:** Read QR codes on any webpage: scan the whole page or drag a box around a code. Works offline.
- **Detailed description:**
  > See a QR code on a webpage and want what's inside, without reaching for your phone? Click the QR Region Scanner icon and choose **Scan this page**, or drag a box around one code with **Scan part of page** (shortcut Alt+Shift+Q). Links open with one click, and their domain is shown first so you can see where they go. Text, Wi-Fi details and other content are shown so you can copy them. Everything happens in your browser: no account, no tracking, nothing sent anywhere.
- **Single purpose:** Read QR codes shown on the current webpage.
- **`activeTab` justification:** Captures the visible tab, only when the user clicks the extension or presses its shortcut, so the QR code in it can be decoded.
- **`scripting` justification:** Injects the selection overlay and the result popup into the current tab when the user starts a scan.
- **Remote code:** No. The QR decoder (jsQR) is bundled in the package.
- **Data usage:** collects none of the listed data types. Check the three certifications (not sold, not used for unrelated purposes, not used for creditworthiness).
- **Privacy policy:** the forms require one only if the extension handles user data, and this one doesn't. If a form insists, a one-line page saying "QR Region Scanner does not collect, store or transmit any data" is enough.

### Updating later

Change the code → bump `version` → rebuild the zip → in each store's dashboard, upload the new zip on the existing item and submit. Users get the update automatically within a day or so of approval.
