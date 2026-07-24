const DEFAULTS = { enabled: false };

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
});

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
