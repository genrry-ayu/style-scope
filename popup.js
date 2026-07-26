const DEFAULT_SHORTCUT = { code: "KeyE", key: "E", metaKey: true, ctrlKey: false, altKey: false, shiftKey: false };
const DEFAULTS = { enabled: false, panelMode: "overlay", shortcut: DEFAULT_SHORTCUT };
const $ = (selector) => document.querySelector(selector);
const masterToggle = $("#masterToggle");
const stateText = $("#stateText");
const stateHint = $("#stateHint");
const versionText = $("#versionText");
const shortcutRecorder = $("#shortcutRecorder");
const shortcutValue = $("#shortcutValue");
const shortcutReset = $("#shortcutReset");
const modeButtons = [...document.querySelectorAll("[data-panel-mode]")];
let currentSettings = { ...DEFAULTS };
let recordingShortcut = false;

versionText.textContent = `v${chrome.runtime.getManifest().version}`;

function paint(settings) {
  const active = settings.enabled;
  document.body.classList.toggle("is-active", active);
  masterToggle.setAttribute("aria-checked", String(active));
  masterToggle.setAttribute("aria-label", active ? "关闭元素检视" : "开启元素检视");
  stateText.textContent = "元素检视";
  stateHint.textContent = active
    ? settings.panelMode === "sidebar" ? "已开启 · 侧边栏" : "已开启 · 浮层"
    : "已关闭";
  modeButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.panelMode === settings.panelMode)));
  if (!recordingShortcut) shortcutValue.textContent = shortcutLabel(settings.shortcut);
}

function normaliseShortcut(shortcut) {
  if (!shortcut?.code) return { ...DEFAULT_SHORTCUT };
  return {
    code: shortcut.code,
    key: shortcut.key || shortcut.code,
    metaKey: Boolean(shortcut.metaKey),
    ctrlKey: Boolean(shortcut.ctrlKey),
    altKey: Boolean(shortcut.altKey),
    shiftKey: Boolean(shortcut.shiftKey)
  };
}

function shortcutLabel(shortcut) {
  const value = normaliseShortcut(shortcut);
  const modifiers = [
    value.metaKey ? "⌘" : "",
    value.ctrlKey ? "Ctrl" : "",
    value.altKey ? "⌥" : "",
    value.shiftKey ? "⇧" : ""
  ].filter(Boolean);
  const key = value.code.startsWith("Key")
    ? value.code.slice(3)
    : value.code.startsWith("Digit")
      ? value.code.slice(5)
      : ({
          Space: "Space",
          Enter: "↵",
          Backspace: "⌫",
          Tab: "Tab",
          ArrowUp: "↑",
          ArrowRight: "→",
          ArrowDown: "↓",
          ArrowLeft: "←"
        }[value.code] || value.key);
  return [...modifiers, key].join(" ");
}

function stopRecording() {
  recordingShortcut = false;
  shortcutRecorder.classList.remove("is-recording", "is-invalid");
  shortcutRecorder.setAttribute("aria-pressed", "false");
  shortcutValue.textContent = shortcutLabel(currentSettings.shortcut);
}

function startRecording() {
  recordingShortcut = true;
  shortcutRecorder.classList.remove("is-invalid");
  shortcutRecorder.classList.add("is-recording");
  shortcutRecorder.setAttribute("aria-pressed", "true");
  shortcutValue.textContent = "按下新快捷键…";
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
        showHint("已接入当前页面");
      });
    });
  });
}

function syncSidePanel(settings) {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (tab?.windowId == null) return;
    if (!settings.enabled || settings.panelMode !== "sidebar") {
      const closing = chrome.sidePanel.close
        ? chrome.sidePanel.close({ windowId: tab.windowId })
        : chrome.sidePanel.setOptions({ enabled: false });
      closing.catch((error) => showHint(error.message, true));
      return;
    }
    // Invoke open during the click callback; awaiting setOptions first loses user activation.
    const configuring = chrome.sidePanel.setOptions({ path: "sidepanel.html", enabled: true });
    const opening = chrome.sidePanel.open({ windowId: tab.windowId });
    Promise.all([configuring, opening])
      .catch((error) => showHint(error.message || "无法打开侧边栏", true));
  });
}

function save(patch, userInitiated = false) {
  currentSettings = { ...currentSettings, ...patch };
  chrome.storage.local.set(currentSettings);
  paint(currentSettings);
  notifyActiveTab(currentSettings);
  if (userInitiated) syncSidePanel(currentSettings);
}

masterToggle.addEventListener("click", () => save({ enabled: masterToggle.getAttribute("aria-checked") !== "true" }, true));
modeButtons.forEach((button) => button.addEventListener("click", () => save({ panelMode: button.dataset.panelMode }, true)));
shortcutRecorder.addEventListener("click", () => recordingShortcut ? stopRecording() : startRecording());
shortcutReset.addEventListener("click", () => {
  stopRecording();
  save({ shortcut: { ...DEFAULT_SHORTCUT } });
});
window.addEventListener("keydown", (event) => {
  if (!recordingShortcut) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (event.code === "Escape") {
    stopRecording();
    return;
  }
  if (["MetaLeft", "MetaRight", "ControlLeft", "ControlRight", "AltLeft", "AltRight", "ShiftLeft", "ShiftRight"].includes(event.code)) return;
  if (!event.metaKey && !event.ctrlKey && !event.altKey) {
    shortcutRecorder.classList.add("is-invalid");
    shortcutValue.textContent = "需含 ⌘ / Ctrl / ⌥";
    return;
  }
  const shortcut = normaliseShortcut({
    code: event.code,
    key: event.key,
    metaKey: event.metaKey,
    ctrlKey: event.ctrlKey,
    altKey: event.altKey,
    shiftKey: event.shiftKey
  });
  stopRecording();
  save({ shortcut });
}, true);

chrome.storage.local.get(DEFAULTS, (settings) => {
  currentSettings = { ...DEFAULTS, ...settings, shortcut: normaliseShortcut(settings.shortcut) };
  paint(currentSettings);
  if (currentSettings.enabled) notifyActiveTab(currentSettings);
});
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;
  const patch = Object.fromEntries(Object.entries(changes).map(([key, change]) => [key, change.newValue]));
  currentSettings = { ...currentSettings, ...patch };
  paint(currentSettings);
});
