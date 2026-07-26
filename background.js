const DEFAULT_SHORTCUT = { code: "KeyE", key: "E", metaKey: true, ctrlKey: false, altKey: false, shiftKey: false };
const DEFAULTS = { enabled: false, panelMode: "overlay", shortcut: DEFAULT_SHORTCUT };
const inspectionByTab = new Map();

function inspectionFrameKey(tabId) {
  return `inspection-frame:${tabId}`;
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(DEFAULTS, (stored) => chrome.storage.local.set({ ...DEFAULTS, ...stored }));
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "style-scope:get-state") {
    chrome.storage.local.get(DEFAULTS, (settings) => sendResponse(settings));
    return true;
  }
  if (message?.type === "style-scope:fetch-image") {
    fetchImageResource(message.url, sender)
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, error: error?.message || "资源请求失败" }));
    return true;
  }
  if (message?.type === "style-scope:inspection-update" && sender.tab?.id != null) {
    const tabId = sender.tab.id;
    const frameId = sender.frameId ?? 0;
    if (!inspectionByTab.has(tabId)) inspectionByTab.set(tabId, new Map());
    const frames = inspectionByTab.get(tabId);
    if (message.snapshot) frames.set(frameId, { ...message.snapshot, frameId });
    else frames.delete(frameId);
    if (!frames.size) inspectionByTab.delete(tabId);
    if (message.snapshot) chrome.storage.session.set({ [inspectionFrameKey(tabId)]: frameId });
    else if (!frames.size) chrome.storage.session.remove(inspectionFrameKey(tabId));
    chrome.runtime.sendMessage({
      type: "style-scope:sidebar-update",
      tabId,
      snapshot: latestInspection(tabId)
    }).catch(() => {});
    return;
  }
  if (message?.type === "style-scope:get-inspection") {
    restoreInspection(message.tabId)
      .then((snapshot) => sendResponse({ snapshot }))
      .catch(() => sendResponse({ snapshot: null }));
    return true;
  }
  if (message?.type === "style-scope:set-side-panel") {
    setSidePanelOpen(message.open, message.windowId ?? sender.tab?.windowId)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || "侧边栏操作失败" }));
    return true;
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  inspectionByTab.delete(tabId);
  chrome.storage.session.remove(inspectionFrameKey(tabId));
});
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status !== "loading") return;
  inspectionByTab.delete(tabId);
  chrome.storage.session.remove(inspectionFrameKey(tabId));
  chrome.runtime.sendMessage({ type: "style-scope:sidebar-update", tabId, snapshot: null }).catch(() => {});
});

function latestInspection(tabId) {
  const frames = inspectionByTab.get(Number(tabId));
  if (!frames?.size) return null;
  return [...frames.values()].sort((left, right) => (right.updatedAt || 0) - (left.updatedAt || 0))[0] || null;
}

async function restoreInspection(tabId) {
  const current = latestInspection(tabId);
  if (current) return current;
  const key = inspectionFrameKey(tabId);
  const stored = await chrome.storage.session.get(key);
  const frameId = stored[key];
  if (!Number.isInteger(frameId)) return null;
  const response = await chrome.tabs.sendMessage(Number(tabId), { type: "style-scope:get-inspection-snapshot" }, { frameId });
  if (!response?.snapshot) return null;
  if (!inspectionByTab.has(Number(tabId))) inspectionByTab.set(Number(tabId), new Map());
  const snapshot = { ...response.snapshot, frameId };
  inspectionByTab.get(Number(tabId)).set(frameId, snapshot);
  return snapshot;
}

async function setSidePanelOpen(open, windowId) {
  if (!chrome.sidePanel) throw new Error("当前浏览器不支持扩展侧边栏");
  if (!open) {
    if (windowId != null && chrome.sidePanel.close) {
      await chrome.sidePanel.close({ windowId });
    } else {
      await chrome.sidePanel.setOptions({ enabled: false });
    }
    return;
  }
  if (windowId == null) throw new Error("无法定位当前浏览器窗口");
  // Both calls must start before yielding, otherwise the browser drops the click's user activation.
  const configuring = chrome.sidePanel.setOptions({ path: "sidepanel.html", enabled: true });
  const opening = chrome.sidePanel.open({ windowId });
  await Promise.all([configuring, opening]);
}

function bytesToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

async function fetchImageFromExtension(source) {
  const url = new URL(source);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("不支持的资源地址");
  const response = await fetch(url.href, {
    cache: "force-cache",
    credentials: "include",
    redirect: "follow"
  });
  if (!response.ok) throw new Error(`资源请求失败（${response.status}）`);
  const buffer = await response.arrayBuffer();
  const mime = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  return { ok: true, base64: bytesToBase64(buffer), mime };
}

async function fetchImageFromPage(source, sender) {
  if (!sender.tab?.id) throw new Error("无法定位资源所在页面");
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId: sender.tab.id, frameIds: [sender.frameId ?? 0] },
    world: "MAIN",
    func: async (url) => {
      const response = await fetch(url, {
        cache: "force-cache",
        credentials: "include",
        redirect: "follow"
      });
      if (!response.ok) throw new Error(`页面请求失败（${response.status}）`);
      const blob = await response.blob();
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const chunkSize = 0x8000;
      let binary = "";
      for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
      }
      return {
        ok: true,
        base64: btoa(binary),
        mime: blob.type.split(";")[0].trim().toLowerCase()
      };
    },
    args: [source]
  });
  if (!injection?.result?.ok || !injection.result.base64) throw new Error("页面未返回图片资源");
  return injection.result;
}

async function fetchImageResource(source, sender) {
  let extensionError;
  try {
    return await fetchImageFromExtension(source);
  } catch (error) {
    extensionError = error;
  }
  try {
    return await fetchImageFromPage(source, sender);
  } catch (pageError) {
    throw new Error(`${extensionError.message}；页面读取失败：${pageError.message}`);
  }
}
