const DEFAULTS = { enabled: false };

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
