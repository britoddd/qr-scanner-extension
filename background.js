// Resolves true if the scanner is up, false on pages the browser won't let us touch.
// whole: decode the entire visible page instead of letting the user drag a box.
async function scan(tab, whole = false) {
  try {
    // Capture before the overlay exists; the user selects on this frozen frame.
    const shot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
    const target = { tabId: tab.id };
    await chrome.scripting.executeScript({ target, files: ['lib/jsQR.js', 'content.js'] });
    await chrome.scripting.executeScript({ target, func: (s, w) => window.__qrScan(s, w), args: [shot, whole] });
    return true;
  } catch (e) {
    // chrome://, edge://, the Web Store and the new-tab page can't be captured or scripted.
    console.warn('QR scan unavailable on this page:', e.message);
    return false;
  }
}

chrome.commands.onCommand.addListener((_command, tab) => scan(tab));

// The popup's scan buttons. The scan runs here because the popup closes as soon as the page takes focus.
chrome.runtime.onMessage.addListener(({ tab, whole }, _sender, reply) => {
  scan(tab, whole).then(reply);
  return true; // reply asynchronously
});

// New users don't know the shortcut yet: show the popup's content in a tab once.
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') chrome.tabs.create({ url: 'popup.html?welcome' });
});
