const DEFAULTS = { enabled: false };
const OFFSCREEN_DOCUMENT_PATH = "offscreen.html";
let creatingOffscreenDocument;

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(DEFAULTS, (stored) => chrome.storage.local.set({ ...DEFAULTS, ...stored }));
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "style-scope:get-state") {
    chrome.storage.local.get(DEFAULTS, (settings) => sendResponse(settings));
    return true;
  }
  if (message?.type === "style-scope:fetch-image") {
    fetchImageResource(message.url)
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, error: error?.message || "资源请求失败" }));
    return true;
  }
  if (message?.type === "style-scope:copy-image") {
    copyImageToClipboard(message)
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, code: error?.code || "clipboard", error: error?.message || "图片复制失败" }));
    return true;
  }
});

async function ensureOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH);
  let exists = false;
  if ("getContexts" in chrome.runtime) {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
      documentUrls: [offscreenUrl]
    });
    exists = contexts.length > 0;
  } else {
    const clientsList = await clients.matchAll();
    exists = clientsList.some((client) => client.url === offscreenUrl);
  }
  if (exists) return;
  if (!creatingOffscreenDocument) {
    creatingOffscreenDocument = chrome.offscreen.createDocument({
      url: OFFSCREEN_DOCUMENT_PATH,
      reasons: ["CLIPBOARD"],
      justification: "将用户选中的网页图片写入系统剪贴板"
    }).finally(() => { creatingOffscreenDocument = null; });
  }
  await creatingOffscreenDocument;
}

async function copyImageToClipboard(message) {
  if (!message.base64 || !message.mime?.startsWith("image/")) throw new Error("图片数据无效");
  await ensureOffscreenDocument();
  const response = await chrome.runtime.sendMessage({
    target: "offscreen",
    type: "style-scope:write-image",
    base64: message.base64,
    mime: message.mime
  });
  if (!response?.ok) {
    const error = new Error(response?.error || "离屏剪贴板写入失败");
    error.code = response?.code || "clipboard";
    throw error;
  }
  return response;
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

async function fetchImageResource(source) {
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
