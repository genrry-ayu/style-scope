(() => {
  if (globalThis.__styleScopeLoaded) return;
  globalThis.__styleScopeLoaded = true;

  const ROOT_ID = "__style_scope_root__";
  const DEFAULTS = { enabled: false, panelMode: "follow", showInherited: false };
  let settings = { ...DEFAULTS };
  let root;
  let hoverPreview;
  let hoverPreviewLabel;
  let distanceReadout;
  let distanceXGuide;
  let distanceXLabel;
  let distanceYGuide;
  let distanceYLabel;
  let overlay;
  let marginLayer;
  let borderLayer;
  let paddingLayer;
  let contentLayer;
  let childGapLayer;
  let childGapLabel;
  let panel;
  let detailTooltip;
  let inspected = null;
  let locked = false;
  let raf = 0;
  let cursor = { x: 0, y: 0 };

  const typographyProps = ["font-family", "font-size", "font-weight", "font-style", "line-height", "letter-spacing", "text-transform", "text-decoration-line", "text-decoration-color", "text-decoration-style", "color", "text-shadow", "white-space", "word-break"];
  const appearanceProps = ["background-color", "background-image", "opacity", "border-top", "border-right", "border-bottom", "border-left", "border-radius", "outline", "box-shadow", "filter", "mix-blend-mode", "visibility"];

  const styles = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    #frame { position:fixed; inset:0; pointer-events:none; z-index:2147483647; font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; color:#efe8db; }
    #hover-preview, #distance-readout, #distance-x-guide, #distance-y-guide, #margin-layer, #outline, #border-layer, #padding-layer, #content-layer, #child-gap { position:fixed; display:none; pointer-events:none; }
    #hover-preview { border:1px dashed rgba(104, 205, 194, .98); background:rgba(104, 205, 194, .035); }
    #hover-preview span { position:absolute; top:-21px; left:-1px; max-width:260px; overflow:hidden; padding:3px 5px; border:1px solid rgba(104, 205, 194, .72); background:rgba(10, 25, 24, .96); color:#8cddd3; font-size:8px; font-weight:700; line-height:1.1; letter-spacing:.08em; text-overflow:ellipsis; white-space:nowrap; }
    #distance-readout { z-index:4; padding:3px 5px; border:1px solid rgba(104,205,194,.76); background:rgba(10,25,24,.97); color:#9ce8de; font-size:8px; font-weight:700; line-height:1.1; letter-spacing:.06em; white-space:nowrap; }
    #distance-x-guide { z-index:3; height:1px; border-top:1px dashed rgba(104,205,194,.96); }
    #distance-y-guide { z-index:3; width:1px; border-left:1px dashed rgba(104,205,194,.96); }
    #distance-x-guide::before, #distance-x-guide::after, #distance-y-guide::before, #distance-y-guide::after { position:absolute; width:3px; height:7px; content:""; background:#8cddd3; }
    #distance-x-guide::before { top:-4px; left:0; } #distance-x-guide::after { top:-4px; right:0; }
    #distance-y-guide::before { top:0; left:-4px; width:7px; height:3px; } #distance-y-guide::after { bottom:0; left:-4px; width:7px; height:3px; }
    #distance-x-guide span, #distance-y-guide span { position:absolute; padding:2px 4px; border:1px solid rgba(104,205,194,.72); background:rgba(10,25,24,.97); color:#9ce8de; font-size:8px; font-weight:700; line-height:1.05; letter-spacing:.04em; white-space:nowrap; }
    #distance-x-guide span { top:-18px; left:50%; transform:translateX(-50%); }
    #distance-y-guide span { top:50%; left:5px; transform:translateY(-50%); }
    #margin-layer { border:1px dashed rgba(244,187,76,.82); background:transparent; }
    #outline { border:1px solid #f4bb4c; background:transparent; box-shadow:none; }
    #outline.is-locked { background:transparent; box-shadow:none; }
    #outline::before, #outline::after { position:absolute; width:6px; height:6px; content:""; border:1px solid #f4bb4c; background:#16130f; } #outline::before { top:-4px; left:-4px; } #outline::after { right:-4px; bottom:-4px; }
    #border-layer { border:1px solid rgba(238,120,102,.95); background:rgba(238,120,102,.10); }
    #padding-layer { border:1px solid rgba(100,188,174,.95); background:rgba(100,188,174,.18); }
    #content-layer { border:1px solid rgba(101,157,214,.96); background:rgba(101,157,214,.24); }
    #child-gap { z-index:2; background:rgba(195,151,255,.18); }
    #child-gap[data-axis="x"] { border-left:1px dashed rgba(213,181,255,.96); border-right:1px dashed rgba(213,181,255,.96); }
    #child-gap[data-axis="y"] { border-top:1px dashed rgba(213,181,255,.96); border-bottom:1px dashed rgba(213,181,255,.96); }
    #child-gap span { position:absolute; z-index:1; padding:2px 4px; border:1px solid rgba(213,181,255,.82); background:rgba(29,20,42,.96); color:#e1ccff; font-size:8px; font-weight:700; line-height:1.05; letter-spacing:.05em; white-space:nowrap; }
    #child-gap[data-axis="x"] span { top:-19px; left:50%; transform:translateX(-50%); }
    #child-gap[data-axis="y"] span { top:50%; left:calc(100% + 4px); transform:translateY(-50%); }
    .edge-label, .content-label { position:absolute; display:none; z-index:1; padding:1px 3px; border:1px solid rgba(17,18,17,.35); background:rgba(17,18,17,.68); box-shadow:0 1px 0 rgba(255,255,255,.12); color:#f6eedf; font-size:8px; font-weight:700; line-height:1.1; letter-spacing:.04em; white-space:nowrap; }
    .edge-label[data-edge="top"] { left:50%; transform:translateX(-50%); }.edge-label[data-edge="bottom"] { bottom:0; left:50%; transform:translateX(-50%); }.edge-label[data-edge="left"] { top:50%; left:0; transform:translateY(-50%); }.edge-label[data-edge="right"] { top:50%; right:0; transform:translateY(-50%); }
    .content-label { top:2px; left:2px; color:#dceafa; }
    #panel { position:fixed; z-index:2147483647; display:none; width:360px; max-height:calc(100vh - 16px); overflow:auto; pointer-events:auto; border:1px solid rgba(244,187,76,.78); background:rgba(18,19,18,.97); box-shadow:0 18px 46px rgba(0,0,0,.42), 0 0 0 1px rgba(255,246,224,.08); backdrop-filter:blur(13px); }
    #panel::before { position:absolute; inset:0; opacity:.26; content:""; pointer-events:none; background-image:linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px); background-size:5px 5px; }
    .panel-head, .group, .box-model { position:relative; }.panel-head { padding:12px 13px 11px; border-bottom:1px solid rgba(255,255,255,.13); background:linear-gradient(90deg, rgba(244,187,76,.18), rgba(244,187,76,0)); }.kicker { display:flex; align-items:center; justify-content:space-between; margin-bottom:5px; color:#f4bb4c; font-size:9px; font-weight:700; letter-spacing:.14em; }.kicker span:last-child { color:#aaa398; font-size:8px; }.selector { overflow:hidden; color:#f7f0e2; font-size:12px; line-height:1.2; white-space:nowrap; text-overflow:ellipsis; }.selector b { color:#f4bb4c; font-weight:500; }.meta { margin-top:6px; color:#b5aea0; font-size:9px; line-height:1.2; }
    .groups { display:grid; grid-template-columns:1fr 1fr; }.group { min-width:0; padding:10px 12px 9px; border-bottom:1px solid rgba(255,255,255,.1); }.group:first-child { border-right:1px solid rgba(255,255,255,.1); }.group-title { margin-bottom:7px; color:#f4bb4c; font-size:8px; font-weight:700; letter-spacing:.14em; }.row { position:relative; display:grid; grid-template-columns:minmax(50px,.9fr) minmax(0,1.2fr); gap:6px; align-items:baseline; padding:2px 0; font-size:9px; line-height:1.15; }.key, .value { cursor:help; }.key { overflow:hidden; color:#908a80; text-overflow:ellipsis; white-space:nowrap; }.value { overflow:hidden; color:#ddd6c9; text-align:right; text-overflow:ellipsis; white-space:nowrap; }.value.colour { overflow:visible; color:#f2dfb4; }.row:hover .key { color:#f4bb4c; }.value .chip { display:inline-block; width:7px; height:7px; margin-right:4px; vertical-align:-1px; border:1px solid rgba(255,255,255,.25); border-radius:50%; }.alpha { color:#a99f8d; }.inherited { color:#f4bb4c; }
    .box-model { padding:11px 12px 12px; border-bottom:1px solid rgba(255,255,255,.1); }.box-title { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:5px; color:#f4bb4c; font-size:8px; font-weight:700; letter-spacing:.14em; }.box-size { color:#bab3a6; font-size:9px; font-weight:400; letter-spacing:0; }.content-sample { overflow:hidden; margin:0 0 8px; padding:7px 9px; color:#ded6c7; border-left:2px solid rgba(100,188,174,.9); background:rgba(100,188,174,.08); font-size:10px; line-height:1.2; text-overflow:ellipsis; white-space:nowrap; }.content-sample b { color:#82c5b7; font-size:8px; font-weight:700; letter-spacing:.1em; }.inset-grid { display:grid; grid-template-columns:1fr 1fr; gap:5px; }.inset { display:flex; align-items:baseline; justify-content:space-between; padding:6px 7px; border:1px solid rgba(100,188,174,.28); background:rgba(100,188,174,.06); }.inset span { color:#8c978f; font-size:8px; letter-spacing:.08em; }.inset b { color:#e8e0d3; font-size:11px; font-weight:500; }.copy-note { display:block; margin-top:9px; color:#7e796f; font-size:8px; text-align:right; }
    #detail-tooltip { position:fixed; z-index:2147483647; display:none; max-width:min(330px, calc(100vw - 24px)); padding:5px 7px; pointer-events:none; border:1px solid rgba(244,187,76,.64); background:rgba(14,15,14,.98); box-shadow:0 7px 16px rgba(0,0,0,.25); color:#f4ead9; font-size:9px; line-height:1.35; overflow-wrap:anywhere; }
  `;

  function createUI() {
    if (root) return;
    const host = document.createElement("div");
    host.id = ROOT_ID;
    host.setAttribute("aria-hidden", "true");
    (document.documentElement || document.body).append(host);
    root = host.attachShadow({ mode: "closed" });
    root.innerHTML = `<style>${styles}</style><div id="frame"><div id="hover-preview"><span></span></div><div id="distance-x-guide"><span></span></div><div id="distance-y-guide"><span></span></div><div id="distance-readout"></div><div id="margin-layer" data-kind="M"><span class="edge-label" data-edge="top"></span><span class="edge-label" data-edge="right"></span><span class="edge-label" data-edge="bottom"></span><span class="edge-label" data-edge="left"></span></div><div id="outline"></div><div id="border-layer" data-kind="B"><span class="edge-label" data-edge="top"></span><span class="edge-label" data-edge="right"></span><span class="edge-label" data-edge="bottom"></span><span class="edge-label" data-edge="left"></span></div><div id="padding-layer" data-kind="P"><span class="edge-label" data-edge="top"></span><span class="edge-label" data-edge="right"></span><span class="edge-label" data-edge="bottom"></span><span class="edge-label" data-edge="left"></span></div><div id="content-layer"><span class="content-label"></span></div><div id="child-gap"><span></span></div></div><section id="panel"></section><div id="detail-tooltip" role="tooltip"></div>`;
    hoverPreview = root.querySelector("#hover-preview");
    hoverPreviewLabel = hoverPreview.querySelector("span");
    distanceReadout = root.querySelector("#distance-readout");
    distanceXGuide = root.querySelector("#distance-x-guide");
    distanceXLabel = distanceXGuide.querySelector("span");
    distanceYGuide = root.querySelector("#distance-y-guide");
    distanceYLabel = distanceYGuide.querySelector("span");
    overlay = root.querySelector("#outline");
    marginLayer = root.querySelector("#margin-layer");
    borderLayer = root.querySelector("#border-layer");
    paddingLayer = root.querySelector("#padding-layer");
    contentLayer = root.querySelector("#content-layer");
    childGapLayer = root.querySelector("#child-gap");
    childGapLabel = childGapLayer.querySelector("span");
    panel = root.querySelector("#panel");
    detailTooltip = root.querySelector("#detail-tooltip");
    panel.addEventListener("mousemove", moveDetail);
    panel.addEventListener("mouseleave", hideDetail);
  }

  function clean(value) { return !value || value === "normal" || value === "none" || value === "auto" ? "—" : value.replace(/,\s*/g, ", "); }
  function escapeMarkup(value) { return String(value).replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[character]); }
  function colourDetails(value) {
    if (value === "transparent") return { hex: "transparent", alpha: "α 0%" };
    const match = value?.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/i);
    if (!match) return null;
    const hex = `#${match.slice(1, 4).map((part) => Number(part).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
    const alpha = Math.round(Number(match[4] ?? 1) * 100);
    return { hex, alpha: `α ${alpha}%` };
  }
  function readableName(prop) { return prop.replace(/^font-/, "").replace(/^background-/, "bg-").replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()); }
  function isInherited(element, prop, value) {
    if (!settings.showInherited || !element.parentElement || !["color", "font-family", "font-size", "font-weight", "font-style", "line-height", "letter-spacing", "text-transform", "text-decoration-line", "white-space", "word-break"].includes(prop)) return false;
    return getComputedStyle(element.parentElement).getPropertyValue(prop).trim() === value;
  }
  function row(element, prop, computed) {
    const value = computed.getPropertyValue(prop).trim();
    const colour = ["color", "background-color", "text-decoration-color"].includes(prop) && colourDetails(value);
    const inherited = isInherited(element, prop, value) ? " inherited" : "";
    const source = inherited ? " <sup>↥</sup>" : "";
    const name = readableName(prop);
    const renderedValue = colour ? `<i class="chip" style="background:${value}"></i>${colour.hex} <span class="alpha">${colour.alpha}</span>` : escapeMarkup(clean(value));
    return `<div class="row"><span class="key${inherited}" data-detail="${escapeMarkup(name)}">${escapeMarkup(name)}${source}</span><span class="value${colour ? " colour" : ""}" data-detail="${escapeMarkup(value || "—")}">${renderedValue}</span></div>`;
  }
  function selectorFor(element) {
    const tag = element.tagName.toLowerCase();
    if (element.id) return `${tag}<b>#${CSS.escape(element.id)}</b>`;
    const classes = [...element.classList].slice(0, 2).map((name) => `.${CSS.escape(name)}`).join("");
    return `${tag}${classes ? `<b>${classes}</b>` : ""}`;
  }
  function contentFor(element, rect) {
    const computed = getComputedStyle(element);
    const sets = [["排版 / TYPE", typographyProps], ["外观 / LOOK", appearanceProps]];
    const groups = sets.map(([title, props]) => `<div class="group"><div class="group-title">${title}</div>${props.map((prop) => row(element, prop, computed)).join("")}</div>`).join("");
    const text = element.textContent.trim().replace(/\s+/g, " ").slice(0, 42) || "无文字内容";
    const insets = [["↑ 上", computed.paddingTop], ["→ 右", computed.paddingRight], ["↓ 下", computed.paddingBottom], ["← 左", computed.paddingLeft]];
    const insetGrid = insets.map(([direction, value]) => `<div class="inset"><span>${direction}</span><b>${value}</b></div>`).join("");
    const childGap = measureChildGap(element);
    const boxHint = childGap ? `content → 边缘 · gap ${Math.round(childGap.value)}px` : "content → 边缘";
    const state = locked ? "LOCKED · CLICKED" : "LIVE · HOVER";
    return `<div class="panel-head"><div class="kicker"><span>${state}</span><span>${element.tagName.toLowerCase()} · ${element.childElementCount} children</span></div><div class="selector">${selectorFor(element)}</div><div class="meta">${Math.round(rect.width)} × ${Math.round(rect.height)} px&nbsp;&nbsp; · &nbsp;&nbsp;${element.classList.length ? `.${[...element.classList].join(".")}` : "no class"}</div></div><div class="groups">${groups}</div><div class="box-model"><div class="box-title"><span>内容内距 / TEXT INSETS</span><span class="box-size">${boxHint}</span></div><div class="content-sample"><b>CONTENT&nbsp;&nbsp;</b>${text}</div><div class="inset-grid">${insetGrid}</div><span class="copy-note">⌘ + Caps Lock 开关检视 · 点击重新选中 · ⌘C 复制样式</span></div>`;
  }
  function place(rect) {
    if (!overlay || !panel || !inspected) return;
    overlay.classList.toggle("is-locked", locked);
    paintBoxModel(rect);
    panel.style.display = "block";
    const gap = 14;
    const edge = 8;
    const width = 360;
    const height = Math.min(panel.offsetHeight || 420, window.innerHeight - edge * 2);
    const clamp = (value, min, max) => Math.max(min, Math.min(value, max));
    const candidates = [
      { side: "right", x: rect.right + gap, y: clamp(rect.top, edge, window.innerHeight - height - edge), fits: rect.right + gap + width <= window.innerWidth - edge },
      { side: "left", x: rect.left - gap - width, y: clamp(rect.top, edge, window.innerHeight - height - edge), fits: rect.left - gap - width >= edge },
      { side: "bottom", x: clamp(rect.left, edge, window.innerWidth - width - edge), y: rect.bottom + gap, fits: rect.bottom + gap + height <= window.innerHeight - edge },
      { side: "top", x: clamp(rect.left, edge, window.innerWidth - width - edge), y: rect.top - gap - height, fits: rect.top - gap - height >= edge }
    ];
    const placement = candidates.find((candidate) => candidate.fits);
    if (!placement) {
      // 目标占满视窗时没有不遮挡的位置；此时隐藏面板，保留高亮而不妨碍检视对象。
      panel.style.display = "none";
      return;
    }
    panel.style.left = `${placement.x}px`;
    panel.style.top = `${placement.y}px`;
  }

  function setLayer(layer, rect) {
    if (!layer) return;
    if (rect.width <= 0 || rect.height <= 0) { layer.style.display = "none"; return; }
    layer.style.display = "block";
    layer.style.left = `${rect.left}px`;
    layer.style.top = `${rect.top}px`;
    layer.style.width = `${rect.width}px`;
    layer.style.height = `${rect.height}px`;
  }

  function labelEdges(layer, values) {
    if (!layer) return;
    const kind = layer.dataset.kind;
    const rect = layer.getBoundingClientRect();
    ["top", "right", "bottom", "left"].forEach((edge) => {
      const label = layer.querySelector(`[data-edge="${edge}"]`);
      const value = values[edge];
      const isTopOrBottom = edge === "top" || edge === "bottom";
      const hasRoom = isTopOrBottom ? value >= 16 && rect.width >= 68 : value >= 18 && rect.width >= 128;
      if (!label || !hasRoom) { if (label) label.style.display = "none"; return; }
      label.textContent = `${kind} ${Math.round(value)}px`;
      label.style.display = "block";
      if (edge === "top") label.style.top = `${Math.max(0, (value - 11) / 2)}px`;
      if (edge === "bottom") label.style.bottom = `${Math.max(0, (value - 11) / 2)}px`;
      if (edge === "left") label.style.left = `${Math.max(0, (value - 29) / 2)}px`;
      if (edge === "right") label.style.right = `${Math.max(0, (value - 29) / 2)}px`;
    });
  }

  function measureChildGap(element) {
    const layout = getComputedStyle(element);
    if (!/(flex|grid)/.test(layout.display)) return null;
    const vertical = layout.flexDirection === "column" || layout.flexDirection === "column-reverse";
    const children = [...element.children].map((child) => child.getBoundingClientRect()).filter((rect) => rect.width > 0 && rect.height > 0);
    if (children.length < 2) return null;
    children.sort((a, b) => vertical ? a.top - b.top : a.left - b.left);
    for (let index = 0; index < children.length - 1; index += 1) {
      const first = children[index];
      const second = children[index + 1];
      const value = vertical ? second.top - first.bottom : second.left - first.right;
      const crossStart = vertical ? Math.max(first.left, second.left) : Math.max(first.top, second.top);
      const crossEnd = vertical ? Math.min(first.right, second.right) : Math.min(first.bottom, second.bottom);
      if (value > 1 && crossEnd > crossStart) {
        return vertical
          ? { axis: "y", value, left: crossStart, top: first.bottom, width: crossEnd - crossStart, height: value }
          : { axis: "x", value, left: first.right, top: crossStart, width: value, height: crossEnd - crossStart };
      }
    }
    return null;
  }

  function paintChildGap(gap) {
    if (!childGapLayer || !childGapLabel || !gap) { if (childGapLayer) childGapLayer.style.display = "none"; return; }
    setLayer(childGapLayer, gap);
    childGapLayer.dataset.axis = gap.axis;
    childGapLabel.textContent = `G ${Math.round(gap.value)}px`;
  }

  function paintBoxModel(rect) {
    const style = getComputedStyle(inspected);
    const px = (value) => Number.parseFloat(value) || 0;
    const margin = { top: px(style.marginTop), right: px(style.marginRight), bottom: px(style.marginBottom), left: px(style.marginLeft) };
    const border = { top: px(style.borderTopWidth), right: px(style.borderRightWidth), bottom: px(style.borderBottomWidth), left: px(style.borderLeftWidth) };
    const padding = { top: px(style.paddingTop), right: px(style.paddingRight), bottom: px(style.paddingBottom), left: px(style.paddingLeft) };
    const borderBox = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    const paddingBox = { left: rect.left + border.left, top: rect.top + border.top, width: rect.width - border.left - border.right, height: rect.height - border.top - border.bottom };
    const contentBox = { left: paddingBox.left + padding.left, top: paddingBox.top + padding.top, width: paddingBox.width - padding.left - padding.right, height: paddingBox.height - padding.top - padding.bottom };
    const marginBox = { left: rect.left - margin.left, top: rect.top - margin.top, width: rect.width + margin.left + margin.right, height: rect.height + margin.top + margin.bottom };
    setLayer(marginLayer, marginBox);
    setLayer(overlay, borderBox);
    setLayer(borderLayer, borderBox);
    setLayer(paddingLayer, paddingBox);
    setLayer(contentLayer, contentBox);
    paintChildGap(measureChildGap(inspected));
    labelEdges(marginLayer, margin);
    labelEdges(borderLayer, border);
    labelEdges(paddingLayer, padding);
    const contentLabel = contentLayer?.querySelector(".content-label");
    if (contentLabel) {
      contentLabel.textContent = `C ${Math.round(contentBox.width)} × ${Math.round(contentBox.height)}`;
      contentLabel.style.display = contentBox.width >= 72 && contentBox.height >= 20 ? "block" : "none";
    }
  }
  function isActive() { return settings.enabled; }
  function inspect(element) {
    if (!isActive() || !element || element.id === ROOT_ID || element.closest?.(`#${ROOT_ID}`)) return;
    inspected = element;
    const rect = element.getBoundingClientRect();
    panel.innerHTML = contentFor(element, rect);
    place(rect);
  }
  function hoverName(element) {
    const tag = element.tagName.toLowerCase();
    if (element.id) return `${tag}#${element.id}`;
    const firstClass = [...element.classList][0];
    return firstClass ? `${tag}.${firstClass}` : tag;
  }
  function hideHoverPreview() {
    if (hoverPreview) hoverPreview.style.display = "none";
    [distanceReadout, distanceXGuide, distanceYGuide].forEach((layer) => { if (layer) layer.style.display = "none"; });
  }
  function axisGap(firstStart, firstEnd, secondStart, secondEnd) {
    if (firstEnd <= secondStart) return { value: secondStart - firstEnd, start: firstEnd, end: secondStart };
    if (secondEnd <= firstStart) return { value: firstStart - secondEnd, start: secondEnd, end: firstStart };
    return { value: 0, start: null, end: null };
  }
  function showDistanceReadout(text, targetRect) {
    if (!distanceReadout) return;
    distanceReadout.textContent = text;
    distanceReadout.style.display = "block";
    const clamp = (value, min, max) => Math.max(min, Math.min(value, max));
    distanceReadout.style.left = `${clamp(targetRect.left, 8, window.innerWidth - 220)}px`;
    distanceReadout.style.top = `${targetRect.bottom + 8}px`;
    const readoutRect = distanceReadout.getBoundingClientRect();
    if (readoutRect.bottom > window.innerHeight - 8) distanceReadout.style.top = `${Math.max(8, targetRect.top - readoutRect.height - 8)}px`;
  }
  function paintDistance(target, targetRect) {
    if (!inspected || !distanceReadout) return;
    const sourceRect = inspected.getBoundingClientRect();
    const sourceContainsTarget = inspected.contains(target);
    const targetContainsSource = target.contains(inspected);
    if (sourceContainsTarget || targetContainsSource) {
      const outer = sourceContainsTarget ? sourceRect : targetRect;
      const inner = sourceContainsTarget ? targetRect : sourceRect;
      const insets = {
        top: inner.top - outer.top,
        right: outer.right - inner.right,
        bottom: outer.bottom - inner.bottom,
        left: inner.left - outer.left
      };
      const relation = sourceContainsTarget ? "CONTAINS" : "INSIDE";
      showDistanceReadout(`${relation} · T ${Math.round(insets.top)} · R ${Math.round(insets.right)} · B ${Math.round(insets.bottom)} · L ${Math.round(insets.left)}px`, targetRect);
      distanceXGuide.style.display = "none";
      distanceYGuide.style.display = "none";
      return;
    }
    const xGap = axisGap(sourceRect.left, sourceRect.right, targetRect.left, targetRect.right);
    const yGap = axisGap(sourceRect.top, sourceRect.bottom, targetRect.top, targetRect.bottom);
    showDistanceReadout(`DIST · X ${Math.round(xGap.value)}px · Y ${Math.round(yGap.value)}px`, targetRect);
    const verticalOverlapStart = Math.max(sourceRect.top, targetRect.top);
    const verticalOverlapEnd = Math.min(sourceRect.bottom, targetRect.bottom);
    if (xGap.value > 1 && verticalOverlapEnd - verticalOverlapStart > 8) {
      distanceXGuide.style.display = "block";
      distanceXGuide.style.left = `${xGap.start}px`;
      distanceXGuide.style.top = `${(verticalOverlapStart + verticalOverlapEnd) / 2}px`;
      distanceXGuide.style.width = `${xGap.value}px`;
      distanceXLabel.textContent = `X ${Math.round(xGap.value)}px`;
    } else distanceXGuide.style.display = "none";
    const horizontalOverlapStart = Math.max(sourceRect.left, targetRect.left);
    const horizontalOverlapEnd = Math.min(sourceRect.right, targetRect.right);
    if (yGap.value > 1 && horizontalOverlapEnd - horizontalOverlapStart > 8) {
      distanceYGuide.style.display = "block";
      distanceYGuide.style.left = `${(horizontalOverlapStart + horizontalOverlapEnd) / 2}px`;
      distanceYGuide.style.top = `${yGap.start}px`;
      distanceYGuide.style.height = `${yGap.value}px`;
      distanceYLabel.textContent = `Y ${Math.round(yGap.value)}px`;
    } else distanceYGuide.style.display = "none";
  }
  function previewHover(element) {
    if (!locked || !hoverPreview || !element || element === inspected) { hideHoverPreview(); return; }
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) { hideHoverPreview(); return; }
    hoverPreview.style.display = "block";
    hoverPreview.style.left = `${rect.left}px`;
    hoverPreview.style.top = `${rect.top}px`;
    hoverPreview.style.width = `${rect.width}px`;
    hoverPreview.style.height = `${rect.height}px`;
    hoverPreviewLabel.textContent = `HOVER · ${hoverName(element)} · ${Math.round(rect.width)} × ${Math.round(rect.height)}`;
    hoverPreview.dataset.target = hoverName(element);
    paintDistance(element, rect);
  }
  function ownUiEvent(event) { return event.composedPath().some((node) => node instanceof Element && node.id === ROOT_ID); }
  function placeDetail(event) {
    if (!detailTooltip) return;
    const gap = 12;
    detailTooltip.style.left = `${event.clientX + gap}px`;
    detailTooltip.style.top = `${event.clientY + gap}px`;
    const rect = detailTooltip.getBoundingClientRect();
    if (rect.right > window.innerWidth - 8) detailTooltip.style.left = `${Math.max(8, event.clientX - rect.width - gap)}px`;
    if (rect.bottom > window.innerHeight - 8) detailTooltip.style.top = `${Math.max(8, event.clientY - rect.height - gap)}px`;
  }
  function showDetail(event) {
    const item = event.target.closest?.("[data-detail]");
    if (!item || !detailTooltip) return;
    detailTooltip.textContent = item.dataset.detail;
    detailTooltip.style.display = "block";
    placeDetail(event);
  }
  function moveDetail(event) {
    const item = event.target.closest?.("[data-detail]");
    if (!item || !detailTooltip) { hideDetail(); return; }
    if (detailTooltip.textContent !== item.dataset.detail) detailTooltip.textContent = item.dataset.detail;
    detailTooltip.style.display = "block";
    placeDetail(event);
  }
  function hideDetail() { if (detailTooltip) detailTooltip.style.display = "none"; }
  function onMove(event) {
    cursor = { x: event.clientX, y: event.clientY };
    if (!isActive()) return;
    if (ownUiEvent(event)) { hideHoverPreview(); return; }
    const target = targetFromEvent(event);
    if (locked) {
      if (!target || target === inspected) { hideHoverPreview(); if (inspected) place(inspected.getBoundingClientRect()); return; }
      cancelAnimationFrame(raf); raf = requestAnimationFrame(() => previewHover(target));
      return;
    }
    if (!target || target === inspected) { if (inspected) place(inspected.getBoundingClientRect()); return; }
    cancelAnimationFrame(raf); raf = requestAnimationFrame(() => inspect(target));
  }
  function targetFromEvent(event) {
    if (ownUiEvent(event)) return null;
    return event.composedPath().find((node) => node instanceof Element && node.id !== ROOT_ID);
  }
  function onClick(event) {
    if (!isActive()) return;
    const target = targetFromEvent(event);
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    locked = true;
    hideHoverPreview();
    cursor = { x: event.clientX, y: event.clientY };
    inspect(target);
  }
  function hide() {
    locked = false;
    inspected = null;
    [hoverPreview, distanceReadout, distanceXGuide, distanceYGuide, marginLayer, overlay, borderLayer, paddingLayer, contentLayer, childGapLayer, panel, detailTooltip].forEach((layer) => { if (layer) layer.style.display = "none"; });
  }
  function toCssText(element) { const style = getComputedStyle(element); return [...style].map((property) => `${property}: ${style.getPropertyValue(property)};`).join("\n"); }

  document.addEventListener("mousemove", onMove, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("keydown", (event) => {
    if (event.key === "CapsLock" && event.metaKey && !event.repeat) {
      event.preventDefault();
      event.stopPropagation();
      const enabled = !settings.enabled;
      apply({ ...settings, enabled });
      chrome.storage.local.set({ enabled });
      if (enabled) {
        const target = document.elementFromPoint(cursor.x, cursor.y);
        if (target) inspect(target);
      }
      return;
    }
    if (!isActive()) return;
    if (event.key === "Escape") hide();
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "c" && inspected) navigator.clipboard?.writeText(toCssText(inspected)).catch(() => {});
  }, true);
  window.addEventListener("scroll", () => { if (inspected) place(inspected.getBoundingClientRect()); hideHoverPreview(); }, true);
  window.addEventListener("resize", () => { if (inspected) place(inspected.getBoundingClientRect()); hideHoverPreview(); });
  function apply(next) { settings = { ...DEFAULTS, ...next }; if (isActive()) createUI(); else hide(); }
  chrome.runtime.onMessage.addListener((message) => { if (message?.type === "style-scope:update") apply(message.settings); });
  chrome.storage.onChanged?.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    const patch = Object.fromEntries(Object.entries(changes).map(([key, change]) => [key, change.newValue]));
    apply({ ...settings, ...patch });
  });
  chrome.storage.local.get(DEFAULTS, apply);
})();
