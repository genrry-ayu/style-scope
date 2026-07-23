const DEFAULTS = { enabled: false, panelMode: "follow", showInherited: false };

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(DEFAULTS, (stored) => chrome.storage.local.set({ ...DEFAULTS, ...stored }));
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "style-scope:get-state") {
    chrome.storage.local.get(DEFAULTS, (settings) => sendResponse(settings));
    return true;
  }
});
