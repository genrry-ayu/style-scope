const panel = document.querySelector("#panel");
const emptyState = document.querySelector("#emptyState");
const detailTooltip = document.querySelector("#detailTooltip");
const versionText = document.querySelector("#versionText");
let activeTabId = null;
let currentSnapshot = null;
const snapshotsByTab = new Map();

versionText.textContent = `v${chrome.runtime.getManifest().version}`;

function base64Bytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function clipboardSupports(type) {
  try { return !ClipboardItem.supports || ClipboardItem.supports(type); }
  catch (_) { return false; }
}

function clipboardItemFor(payload) {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    throw new Error("当前侧边栏未开放图片剪贴板");
  }
  const source = new Blob([base64Bytes(payload.base64)], { type: payload.mime });
  const representations = {};
  if (clipboardSupports(payload.mime)) representations[payload.mime] = source;
  if (payload.mime === "image/svg+xml" && payload.text) {
    if (clipboardSupports("text/html")) representations["text/html"] = new Blob([payload.text], { type: "text/html" });
    if (clipboardSupports("text/plain")) representations["text/plain"] = new Blob([payload.text], { type: "text/plain" });
  }
  if (!Object.keys(representations).length) throw new Error(`系统剪贴板不支持原始格式 ${payload.mime}`);
  return new ClipboardItem(representations);
}

function render(snapshot) {
  currentSnapshot = snapshot || null;
  if (activeTabId != null) {
    if (currentSnapshot) snapshotsByTab.set(activeTabId, currentSnapshot);
    else snapshotsByTab.delete(activeTabId);
  }
  if (!currentSnapshot?.html) {
    panel.replaceChildren();
    panel.style.display = "none";
    emptyState.style.display = "flex";
    return;
  }
  panel.innerHTML = currentSnapshot.html;
  panel.style.display = "block";
  emptyState.style.display = "none";
}

async function refreshActiveTab(tabId) {
  if (tabId == null) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTabId = tab?.id ?? null;
  } else {
    activeTabId = tabId;
  }
  if (activeTabId == null) { render(null); return; }
  const requestedTabId = activeTabId;
  if (snapshotsByTab.has(requestedTabId)) render(snapshotsByTab.get(requestedTabId));
  const response = await chrome.runtime.sendMessage({ type: "style-scope:get-inspection", tabId: requestedTabId });
  if (activeTabId !== requestedTabId) return;
  if (response?.snapshot) render(response.snapshot);
  else if (!snapshotsByTab.has(requestedTabId)) render(null);
}

async function copyResource(button) {
  const resource = currentSnapshot?.resource;
  if (!resource?.payload || resource.state !== "ready") {
    if (activeTabId != null && currentSnapshot?.frameId != null) {
      chrome.tabs.sendMessage(activeTabId, { type: "style-scope:retry-resource" }, { frameId: currentSnapshot.frameId }).catch(() => {});
    }
    return;
  }
  button.textContent = "COPYING…";
  button.disabled = true;
  try {
    await navigator.clipboard.write([clipboardItemFor(resource.payload)]);
    button.textContent = resource.payload.mime === "image/svg+xml" ? "COPIED SVG" : "COPIED IMAGE";
    button.classList.add("is-copied");
  } catch (error) {
    button.textContent = error?.name === "NotAllowedError" ? "CLIPBOARD BLOCKED" : "COPY FAILED";
    button.title = error?.message || "资源复制失败";
    button.classList.add("is-failed");
  }
  window.setTimeout(() => {
    if (!button.isConnected) return;
    button.textContent = resource.label;
    button.title = `复制${resource.description}到剪贴板`;
    button.disabled = false;
    button.classList.remove("is-copied", "is-failed");
  }, 3000);
}

panel.addEventListener("click", (event) => {
  const button = event.target.closest("[data-copy-resource]");
  if (button) copyResource(button);
});

panel.addEventListener("mousemove", (event) => {
  const item = event.target.closest("[data-detail]");
  if (!item) { detailTooltip.style.display = "none"; return; }
  detailTooltip.textContent = item.dataset.detail;
  detailTooltip.style.display = "block";
  const gap = 10;
  const rect = detailTooltip.getBoundingClientRect();
  detailTooltip.style.left = `${Math.max(8, Math.min(event.clientX + gap, window.innerWidth - rect.width - 8))}px`;
  detailTooltip.style.top = `${Math.max(8, Math.min(event.clientY + gap, window.innerHeight - rect.height - 8))}px`;
});
panel.addEventListener("mouseleave", () => { detailTooltip.style.display = "none"; });

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "style-scope:sidebar-update" && message.tabId === activeTabId) render(message.snapshot);
});
chrome.tabs.onActivated.addListener(({ tabId }) => refreshActiveTab(tabId));
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (tabId === activeTabId && changeInfo.status === "loading") render(null);
});

refreshActiveTab();
