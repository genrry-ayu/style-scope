const DEFAULTS = { enabled: false, panelMode: "follow", showInherited: false };
const $ = (selector) => document.querySelector(selector);
const masterToggle = $("#masterToggle");
const stateText = $("#stateText");
const stateHint = $("#stateHint");
const panelMode = $("#panelMode");
const inheritedMode = $("#inheritedMode");

function setSwitch(button, active) {
  button.classList.toggle("is-on", active);
  button.setAttribute("aria-checked", String(active));
}

function paint(settings) {
  const active = settings.enabled;
  document.body.classList.toggle("is-active", active);
  masterToggle.setAttribute("aria-checked", String(active));
  stateText.textContent = active ? "正在检视" : "已静默";
  stateHint.textContent = active ? "悬停预览，点击即可锁定元素" : "⌘ + Caps Lock 开关检视";
  setSwitch(panelMode, settings.panelMode === "follow");
  setSwitch(inheritedMode, settings.showInherited);
}

function showHint(message, isError = false) {
  stateHint.textContent = message;
  stateHint.classList.toggle("is-error", isError);
}

function notifyActiveTab(settings) {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab?.id) return;
    const message = { type: "style-scope:update", settings };
    chrome.tabs.sendMessage(tab.id, message, () => {
      const messageError = chrome.runtime.lastError;
      if (!messageError || !settings.enabled) return;
      chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files: ["content.js"], injectImmediately: true }, () => {
        const injectionError = chrome.runtime.lastError;
        if (injectionError) {
          showHint("此页面不允许注入（浏览器内部页或扩展商店）", true);
          return;
        }
        chrome.tabs.sendMessage(tab.id, message, () => void chrome.runtime.lastError);
        showHint("已接入当前页面，悬停预览、点击选中元素");
      });
    });
  });
}

function save(patch) {
  chrome.storage.local.get(DEFAULTS, (settings) => {
    const next = { ...settings, ...patch };
    chrome.storage.local.set(next, () => {
      paint(next);
      notifyActiveTab(next);
    });
  });
}

masterToggle.addEventListener("click", () => save({ enabled: masterToggle.getAttribute("aria-checked") !== "true" }));
panelMode.addEventListener("click", () => save({ panelMode: panelMode.getAttribute("aria-checked") === "true" ? "fixed" : "follow" }));
inheritedMode.addEventListener("click", () => save({ showInherited: inheritedMode.getAttribute("aria-checked") !== "true" }));
chrome.storage.local.get(DEFAULTS, (settings) => {
  paint(settings);
  if (settings.enabled) notifyActiveTab(settings);
});
