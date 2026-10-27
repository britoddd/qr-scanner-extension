chrome.commands.onCommand.addListener(async (_command, tab) => {
  try {
    // Capture before the overlay exists; the user selects on this frozen frame.
    const shot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
    const target = { tabId: tab.id };
    await chrome.scripting.executeScript({ target, files: ['lib/jsQR.js', 'content.js'] });
    await chrome.scripting.executeScript({ target, func: (s) => window.__qrScan(s), args: [shot] });
  } catch (e) {
    // chrome://, edge://, the Web Store and the new-tab page can't be captured or scripted.
    console.warn('QR scan unavailable on this page:', e.message);
  }
});
