// Resolves true if the overlay is up, false on pages the browser won't let us touch.
async function scan(tab) {
  try {
    // Capture before the overlay exists; the user selects on this frozen frame.
    const shot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
    const target = { tabId: tab.id };
    await chrome.scripting.executeScript({ target, files: ['lib/jsQR.js', 'content.js'] });
    await chrome.scripting.executeScript({ target, func: (s) => window.__qrScan(s), args: [shot] });
    return true;
  } catch (e) {
    // chrome://, edge://, the Web Store and the new-tab page can't be captured or scripted.
    console.warn('QR scan unavailable on this page:', e.message);
    return false;
  }
}

chrome.commands.onCommand.addListener((_command, tab) => scan(tab));

// "Scan this page" in the popup. The scan runs here because the popup closes as soon as the page takes focus.
chrome.runtime.onMessage.addListener((tab, _sender, reply) => {
  scan(tab).then(reply);
  return true; // reply asynchronously
});

// New users don't know the shortcut yet: show the popup's content in a tab once.
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') chrome.tabs.create({ url: 'popup.html?welcome' });
});
