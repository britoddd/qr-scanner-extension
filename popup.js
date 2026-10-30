// Toolbar popup, also opened once as a tab (popup.html?welcome) right after install.
const $ = (id) => document.getElementById(id);
const welcome = location.search === '?welcome';

if (welcome) {
  document.body.classList.add('welcome');
  $('title').textContent = 'You’re all set';
  $('sub').textContent = 'QR Region Scanner reads QR codes on any webpage.';
  $('actions').hidden = true; // nothing to scan on this page
  $('pin').hidden = false;
  $('how').open = true;
}

async function showShortcut() {
  const s = (await chrome.commands.getAll()).find((c) => c.name === 'scan')?.shortcut ?? '';
  const keys = s.includes('+') ? s.split('+') : [...s]; // macOS reports "⌥⇧Q", without "+"
  $('keys').replaceChildren(...keys.map((k) => Object.assign(document.createElement('kbd'), { textContent: k })));
  if (!s) $('keys').textContent = 'Not set'; // Chrome leaves it blank when another extension took the key
  $('keys').classList.toggle('unset', !s);
  $('unset').hidden = !!s;
  $('change-label').textContent = s ? 'Change shortcut' : 'Set a shortcut';
}
showShortcut();
addEventListener('focus', showShortcut); // welcome tab: refresh after the user comes back from the shortcuts page

// Extensions can't set shortcuts themselves; only this browser page can. Edge, Brave and Vivaldi map chrome:// to their own scheme.
$('change').onclick = () => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });

// whole: find a code anywhere on screen; otherwise the user drags a box (same as the shortcut).
for (const [id, whole] of [['scan', true], ['part', false]]) {
  $(id).onclick = async () => {
    $('scan').disabled = $('part').disabled = true; // capture + decode can take a moment; no double scans
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (await chrome.runtime.sendMessage({ tab, whole })) return close();
    $('scan').disabled = $('part').disabled = false;
    $('err').textContent = 'This page can’t be scanned. Browsers block extensions on their own pages and web stores. Try a regular website.';
  };
}
