// Toolbar popup, also opened once as a tab (popup.html?welcome) right after install.
const $ = (id) => document.getElementById(id);
const welcome = location.search === '?welcome';

if (welcome) {
  document.body.classList.add('welcome');
  $('title').textContent = 'You’re all set';
  $('sub').textContent = 'QR Region Scanner reads QR codes on any webpage.';
  $('scan').hidden = true; // nothing to scan on this page
  $('pin').hidden = false;
}

async function showShortcut() {
  const s = (await chrome.commands.getAll()).find((c) => c.name === 'scan')?.shortcut ?? '';
  const keys = s.includes('+') ? s.split('+') : [...s]; // macOS reports "⌥⇧Q", without "+"
  $('keys').replaceChildren(...keys.map((k) => Object.assign(document.createElement('kbd'), { textContent: k })));
  if (!s) $('keys').textContent = 'Not set'; // Chrome leaves it blank when another extension took the key
  $('unset').hidden = !!s;
  $('change').textContent = s ? 'Change' : 'Set shortcut';
}
showShortcut();
addEventListener('focus', showShortcut); // welcome tab: refresh after the user comes back from the shortcuts page

// Extensions can't set shortcuts themselves; only this browser page can. Edge, Brave and Vivaldi map chrome:// to their own scheme.
$('change').onclick = () => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });

$('scan').onclick = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (await chrome.runtime.sendMessage(tab)) return close();
  $('err').textContent = 'This page can’t be scanned. Browsers block extensions on their own pages and web stores. Try a regular website.';
};
