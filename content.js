(() => {
  if (globalThis.__styleScopeLoaded) return;
  globalThis.__styleScopeLoaded = true;

  const ROOT_ID = "__style_scope_root__";
  const DEFAULTS = { enabled: false, panelMode: "overlay" };
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
  let selectedResource = null;
  let locked = false;
  let raf = 0;
  let placementRaf = 0;
  let pendingTarget = null;
  let previewedTarget = null;
  let cursor = { x: 0, y: 0 };
  let commandDown = false;
  let cachedStyleRules = [];
  let cachedStyleSheetCount = -1;
  let matchedDeclarationsCache = new WeakMap();
  let currentDetailItem = null;

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
    #panel { position:fixed; z-index:2147483647; display:none; width:320px; max-height:calc(100vh - 16px); overflow-x:hidden; overflow-y:auto; pointer-events:auto; border:1px solid #464646; border-radius:6px; background:#2c2c2c; box-shadow:0 12px 32px rgba(0,0,0,.34); color:#f5f5f5; font-family:Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    #panel::before { display:none; }
    .panel-head { padding:12px 12px 10px; border-bottom:1px solid #444; }.element-state { display:flex; align-items:center; gap:6px; margin-bottom:8px; color:#aaa; font-size:10px; line-height:1; }.element-state span { width:6px; height:6px; border:1px solid #8a8a8a; border-radius:50%; }.element-state span.is-locked { border-color:#0d99ff; background:#0d99ff; }.element-state b { margin-left:auto; color:#8f8f8f; font:500 9px/1 ui-monospace, SFMono-Regular, Menlo, monospace; text-transform:uppercase; }.selector-line { display:flex; align-items:center; gap:8px; min-width:0; }.selector { min-width:0; overflow:hidden; color:#f2f2f2; font:500 12px/1.25 ui-monospace, SFMono-Regular, Menlo, monospace; text-overflow:ellipsis; white-space:nowrap; }.selector b { color:#53b7ff; font-weight:500; }.text-preview { overflow:hidden; margin-top:8px; color:#a8a8a8; font-size:11px; line-height:1.3; text-overflow:ellipsis; white-space:nowrap; }.resource-copy { flex:none; height:24px; padding:0 7px; cursor:pointer; color:#f2f2f2; border:1px solid #545454; border-radius:4px; background:#383838; font:500 9px/1 ui-monospace, SFMono-Regular, Menlo, monospace; white-space:nowrap; }.resource-copy:hover, .resource-copy:focus-visible { outline:none; border-color:#0d99ff; background:#3d3d3d; }.resource-copy:disabled { cursor:progress; opacity:.55; }.resource-copy.is-copied { color:#fff; border-color:#0d99ff; background:#0d99ff; }.resource-copy.is-failed { color:#ffb4ab; border-color:#b95f56; background:#4a2d2a; }
    .property-section { border-bottom:1px solid #444; }.property-section summary { display:flex; align-items:center; min-height:34px; padding:0 12px; cursor:pointer; list-style:none; color:#f2f2f2; font-size:11px; font-weight:600; user-select:none; }.property-section summary::-webkit-details-marker { display:none; }.property-section summary::before { width:0; height:0; margin-right:8px; content:""; border-top:4px solid transparent; border-bottom:4px solid transparent; border-left:5px solid #aaa; transform:rotate(90deg); transition:transform .12s ease; }.property-section:not([open]) summary::before { transform:rotate(0); }.property-body { padding:0 8px 9px; }.metric-grid { display:grid; grid-template-columns:1fr 1fr; gap:6px; margin:0 4px 7px; }.metric-field { display:grid; grid-template-columns:15px 1fr auto; align-items:center; height:28px; padding:0 7px; border-radius:4px; background:#383838; }.metric-field span { color:#999; font-size:10px; }.metric-field b { overflow:hidden; color:#e8e8e8; font-size:11px; font-weight:400; text-overflow:ellipsis; white-space:nowrap; }.metric-field small { color:#888; font-size:9px; }.property-row { display:grid; grid-template-columns:88px minmax(0,1fr); align-items:center; min-height:28px; padding:0 7px; border-radius:4px; font-size:11px; }.property-row:hover { background:#383838; }.property-label { overflow:hidden; color:#b8b8b8; text-overflow:ellipsis; white-space:nowrap; }.property-value { overflow:hidden; color:#ededed; text-align:left; text-overflow:ellipsis; white-space:nowrap; }.property-value.colour { display:grid; grid-template-columns:16px minmax(0,1fr) auto auto; gap:6px; align-items:center; }.colour-swatch { display:block; width:16px; height:16px; border:1px solid rgba(255,255,255,.18); border-radius:3px; background-image:linear-gradient(45deg,#555 25%,transparent 25%),linear-gradient(-45deg,#555 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#555 75%),linear-gradient(-45deg,transparent 75%,#555 75%); }.property-value small { color:#999; font-size:9px; }.property-value em { overflow:hidden; color:#999; font-size:9px; font-style:normal; text-overflow:ellipsis; white-space:nowrap; }
    #detail-tooltip { position:fixed; z-index:2147483647; display:none; max-width:min(300px, calc(100vw - 24px)); padding:7px 9px; pointer-events:none; border:1px solid #4c4c4c; border-radius:4px; background:#1e1e1e; box-shadow:0 6px 18px rgba(0,0,0,.3); color:#f0f0f0; font:10px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace; white-space:pre-line; overflow-wrap:anywhere; }
  `;

  function createUI() {
    if (root) return;
    const host = document.createElement("div");
    host.id = ROOT_ID;
    host.setAttribute("aria-hidden", "true");
    host.style.pointerEvents = "none";
    (document.documentElement || document.body).append(host);
    // 演示页开放 Shadow DOM 便于真实交互验收；扩展环境仍保持隔离。
    root = host.attachShadow({ mode: chrome.runtime?.id ? "closed" : "open" });
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
    panel.addEventListener("click", copyResource);
  }

  function clean(value) { return !value || value === "normal" || value === "none" || value === "auto" ? "—" : value.replace(/,\s*/g, ", "); }
  function primaryFontFamily(value) {
    const source = String(value || "").trim();
    let family = "";
    let quote = "";
    let escaped = false;
    for (const character of source) {
      if (escaped) {
        family += character;
        escaped = false;
        continue;
      }
      if (character === "\\") {
        family += character;
        escaped = true;
        continue;
      }
      if (quote) {
        family += character;
        if (character === quote) quote = "";
        continue;
      }
      if (character === "\"" || character === "'") {
        quote = character;
        family += character;
        continue;
      }
      if (character === ",") break;
      family += character;
    }
    family = family.trim();
    if ((family.startsWith("\"") && family.endsWith("\"")) || (family.startsWith("'") && family.endsWith("'"))) {
      family = family.slice(1, -1);
    }
    return family || "—";
  }
  function escapeMarkup(value) { return String(value).replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[character]); }
  function colourDetails(value) {
    const source = String(value || "").trim();
    if (source.toLowerCase() === "transparent") return { hex: "#000000", alpha: "α 0%", key: "#000000@0" };
    const hex = source.match(/^#([\da-f]{3,8})$/i);
    if (hex) {
      const digits = hex[1];
      const expanded = digits.length <= 4 ? [...digits].map((digit) => digit + digit).join("") : digits;
      if (expanded.length !== 6 && expanded.length !== 8) return null;
      const opacity = expanded.length === 8 ? Math.round((Number.parseInt(expanded.slice(6), 16) / 255) * 100) : 100;
      const colour = `#${expanded.slice(0, 6).toUpperCase()}`;
      return { hex: colour, alpha: `α ${opacity}%`, key: `${colour}@${opacity}` };
    }
    const match = source.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i);
    if (!match) return null;
    const colour = `#${match.slice(1, 4).map((part) => Number(part).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
    const rawAlpha = match[4] ?? "1";
    const alpha = rawAlpha.endsWith("%") ? Math.round(Number.parseFloat(rawAlpha)) : Math.round(Number(rawAlpha) * 100);
    return { hex: colour, alpha: `α ${alpha}%`, key: `${colour}@${alpha}` };
  }
  function colourKeys(value) {
    const matches = String(value || "").match(/(?:rgba?\([^)]*\)|#[\da-f]{3,8}\b|\btransparent\b)/gi) || [];
    return new Set(matches.map(colourDetails).filter(Boolean).map((colour) => colour.key));
  }
  function formattedColour(value) {
    const detail = colourDetails(value);
    return detail ? `${detail.hex} ${detail.alpha.replace("α ", "")}` : value;
  }
  function formatColourValue(value) {
    const source = value || "—";
    const direct = colourDetails(source);
    if (direct) return formattedColour(source);
    return source.replace(/(?:rgba?\([^)]*\)|#[\da-f]{3,8}\b|\btransparent\b)/gi, (match) => formattedColour(match));
  }
  function variablesIn(value) {
    return [...String(value || "").matchAll(/var\(\s*(--[\w-]+)/g)].map((match) => match[1]);
  }
  function resolveVariable(element, name, seen = new Set(), computed = getComputedStyle(element)) {
    if (!name || seen.has(name)) return "";
    seen.add(name);
    const value = computed.getPropertyValue(name).trim();
    return value.replace(/var\(\s*(--[\w-]+)(?:\s*,[^)]*)?\)/g, (_, nested) => resolveVariable(element, nested, seen, computed));
  }
  function collectRules(ruleList, result) {
    [...ruleList].forEach((rule) => {
      if (rule.selectorText && rule.style) result.push(rule);
      if (rule.cssRules) {
        try { collectRules(rule.cssRules, result); } catch (_) { /* Cross-origin nested rules are intentionally skipped. */ }
      }
    });
  }
  function pageStyleRules() {
    if (cachedStyleSheetCount === document.styleSheets.length) return cachedStyleRules;
    const rules = [];
    [...document.styleSheets].forEach((sheet) => {
      try { collectRules(sheet.cssRules, rules); } catch (_) { /* A page may block CSSOM access to third-party sheets. */ }
    });
    cachedStyleRules = rules;
    cachedStyleSheetCount = document.styleSheets.length;
    matchedDeclarationsCache = new WeakMap();
    return cachedStyleRules;
  }
  function sourcePropertiesFor(prop) {
    if (prop === "background-color") return ["background-color", "background"];
    if (prop.startsWith("border-")) return [prop, "border", "border-color", `${prop}-color`];
    if (prop === "outline") return ["outline", "outline-color"];
    if (prop === "box-shadow") return ["box-shadow"];
    if (prop === "text-shadow") return ["text-shadow"];
    return [prop];
  }
  function declarationsFor(element) {
    const rules = pageStyleRules();
    const signature = `${element.id}\u0000${element.getAttribute("class") || ""}\u0000${element.getAttribute("style") || ""}\u0000${cachedStyleSheetCount}`;
    const cached = matchedDeclarationsCache.get(element);
    if (cached?.signature === signature) return cached.values;
    const values = new Map();
    const add = (style) => {
      if (!style) return;
      for (let position = 0; position < style.length; position += 1) {
        const property = style[position];
        const value = style.getPropertyValue(property).trim();
        if (!value) continue;
        if (!values.has(property)) values.set(property, []);
        values.get(property).push(value);
      }
    };
    add(element.style);
    rules.forEach((rule) => {
      try {
        if (element.matches(rule.selectorText)) add(rule.style);
      } catch (_) { /* Unsupported selectors do not affect token discovery. */ }
    });
    matchedDeclarationsCache.set(element, { signature, values });
    return values;
  }
  function declaredValuesFor(element, prop) {
    const values = [];
    const inherited = ["color", "font-family", "font-size", "font-weight", "font-style", "line-height", "letter-spacing", "text-transform", "text-decoration-color", "text-decoration-style", "white-space", "word-break"].includes(prop);
    const sourceProperties = sourcePropertiesFor(prop);
    for (let current = element; current && current.nodeType === Node.ELEMENT_NODE; current = inherited ? current.parentElement : null) {
      const declarations = declarationsFor(current);
      sourceProperties.forEach((sourceProperty) => values.push(...(declarations.get(sourceProperty) || [])));
    }
    return values;
  }
  function tokenInfoFor(element, prop, computedValue, computed = getComputedStyle(element)) {
    const expected = colourKeys(computedValue);
    if (!expected.size) return { source: [] };
    const sourceNames = new Set();
    declaredValuesFor(element, prop).forEach((value) => {
      variablesIn(value).forEach((name) => {
        const resolved = resolveVariable(element, name, new Set(), computed);
        const resolvedKeys = colourKeys(resolved);
        if ([...resolvedKeys].some((key) => expected.has(key))) sourceNames.add(name);
      });
    });
    return { source: [...sourceNames] };
  }
  function displayTokenName(token) {
    if (!token.startsWith("--")) return token;
    // CSS 变量常用前两段表达命名空间/类别，余下连字符保留为 token 自身名称。
    return token.slice(2).replace("-", "/").replace("-", "/");
  }
  function detailFor(value, tokenInfo) {
    const formatted = formatColourValue(value);
    if (tokenInfo.source.length) {
      return `SOURCE TOKEN\n${tokenInfo.source.map(displayTokenName).join("\n")}\n${formatted}`;
    }
    return formatted;
  }
  function propertyRow(label, value, detail = value) {
    return `<div class="property-row"><span class="property-label" data-detail="${escapeMarkup(label)}">${escapeMarkup(label)}</span><span class="property-value" data-detail="${escapeMarkup(detail)}">${escapeMarkup(value)}</span></div>`;
  }
  function colourPropertyRow(label, value, element, prop, suffix = "") {
    const colour = colourDetails(value);
    if (!colour) return "";
    const detail = detailFor(value, tokenInfoFor(element, prop, value, getComputedStyle(element)));
    return `<div class="property-row"><span class="property-label" data-detail="${escapeMarkup(label)}">${escapeMarkup(label)}</span><span class="property-value colour" data-detail="${escapeMarkup(detail)}"><i class="colour-swatch" style="background:${escapeMarkup(value)}"></i><span>${colour.hex}</span><small>${colour.alpha.replace("α ", "")}</small>${suffix ? `<em>${escapeMarkup(suffix)}</em>` : ""}</span></div>`;
  }
  function propertySection(title, contents) {
    const body = contents.filter(Boolean).join("");
    return body ? `<details class="property-section" open><summary><span>${escapeMarkup(title)}</span></summary><div class="property-body">${body}</div></details>` : "";
  }
  function metricField(label, value) {
    return `<div class="metric-field"><span>${escapeMarkup(label)}</span><b>${escapeMarkup(String(value))}</b><small>px</small></div>`;
  }
  function rounded(value) {
    const number = Number.parseFloat(value);
    if (!Number.isFinite(number)) return value;
    return String(Math.round(number * 100) / 100);
  }
  function lengthValue(value) {
    if (!value || value === "normal") return "—";
    if (/^-?[\d.]+px$/.test(value)) return `${rounded(value)} px`;
    return value;
  }
  function compactBox(values) {
    const formatted = values.map(lengthValue);
    const [top, right, bottom, left] = formatted;
    if (formatted.every((value) => value === top)) return top;
    if (top === bottom && right === left) return `${top} · ${right}`;
    return formatted.join(" · ");
  }
  function hasPositiveLength(value) {
    return (Number.parseFloat(value) || 0) > 0;
  }
  function visibleColour(value) {
    const colour = colourDetails(value);
    return colour && colour.alpha !== "α 0%";
  }
  function fontWeightLabel(value) {
    const weight = Number.parseInt(value, 10);
    const names = { 100: "Thin", 200: "Extra Light", 300: "Light", 400: "Regular", 500: "Medium", 600: "Semi Bold", 700: "Bold", 800: "Extra Bold", 900: "Black" };
    return names[weight] ? `${names[weight]} · ${weight}` : value;
  }
  function textElement(element) {
    if ([...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.nodeValue.trim())) return true;
    return ["A", "BUTTON", "LABEL", "P", "SPAN", "STRONG", "EM", "B", "I", "H1", "H2", "H3", "H4", "H5", "H6", "LI", "TD", "TH"].includes(element.tagName)
      && sampleText(element) !== "无文字内容";
  }
  function borderRows(element, computed) {
    const edges = [
      ["Top", "border-top", computed.borderTopWidth, computed.borderTopStyle, computed.borderTopColor],
      ["Right", "border-right", computed.borderRightWidth, computed.borderRightStyle, computed.borderRightColor],
      ["Bottom", "border-bottom", computed.borderBottomWidth, computed.borderBottomStyle, computed.borderBottomColor],
      ["Left", "border-left", computed.borderLeftWidth, computed.borderLeftStyle, computed.borderLeftColor]
    ].filter(([, , width, style]) => hasPositiveLength(width) && style !== "none");
    if (!edges.length) return [];
    const signature = (edge) => edge.slice(2).join("|");
    if (edges.length === 4 && edges.every((edge) => signature(edge) === signature(edges[0]))) {
      const [, prop, width, style, colour] = edges[0];
      return [colourPropertyRow("Stroke", colour, element, prop, `${lengthValue(width)} · ${style}`)];
    }
    return edges.map(([label, prop, width, style, colour]) => colourPropertyRow(label, colour, element, prop, `${lengthValue(width)} · ${style}`));
  }
  function selectorFor(element) {
    const tag = escapeMarkup(element.tagName.toLowerCase());
    if (element.id) return `${tag}<b>#${escapeMarkup(CSS.escape(element.id))}</b>`;
    const classes = [...element.classList].slice(0, 2).map((name) => `.${escapeMarkup(CSS.escape(name))}`).join("");
    return `${tag}${classes ? `<b>${classes}</b>` : ""}`;
  }
  function resourceFor(element) {
    const originalTag = element.tagName.toLowerCase();
    if (element.namespaceURI === "http://www.w3.org/2000/svg" && originalTag !== "svg" && originalTag !== "image") {
      element = element.ownerSVGElement || element.closest?.("svg") || element;
    }
    const tag = element.tagName.toLowerCase();
    if (tag === "img") {
      const source = element.currentSrc || element.src || element.getAttribute("src");
      return source ? {
        kind: "raster",
        label: "COPY IMAGE",
        description: "图片",
        state: "idle",
        blob: () => fetchImage(source)
      } : null;
    }
    if (tag === "svg") {
      return { kind: "svg", label: "COPY SVG", description: "SVG 矢量图", state: "idle", blob: () => Promise.resolve(svgBlob(element)) };
    }
    if (tag === "image" && element.namespaceURI === "http://www.w3.org/2000/svg") {
      const source = element.href?.baseVal || element.getAttribute("href") || element.getAttribute("xlink:href");
      return source ? { kind: "raster", label: "COPY IMAGE", description: "SVG 引用图片", state: "idle", blob: () => fetchImage(source) } : null;
    }
    if (tag === "canvas") {
      return { kind: "raster", label: "COPY PNG", description: "画布导出图像", state: "idle", blob: () => canvasBlob(element) };
    }
    return null;
  }
  function copyError(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
  }
  function svgBlob(element) {
    const markup = new XMLSerializer().serializeToString(element);
    return new Blob([markup], { type: "image/svg+xml" });
  }
  function base64Bytes(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  }
  function bytesToBase64(bytes) {
    const chunkSize = 0x8000;
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return btoa(binary);
  }
  function mimeFromSource(source) {
    const extension = new URL(source, document.baseURI).pathname.split(".").pop()?.toLowerCase();
    return { svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", avif: "image/avif" }[extension] || "";
  }
  function mimeFromBytes(bytes) {
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
    if (String.fromCharCode(...bytes.subarray(0, 6)).startsWith("GIF8")) return "image/gif";
    if (String.fromCharCode(...bytes.subarray(0, 12)).startsWith("RIFF") && String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP") return "image/webp";
    if (String.fromCharCode(...bytes.subarray(4, 12)).includes("ftypavif")) return "image/avif";
    const prefix = new TextDecoder().decode(bytes.subarray(0, 256)).trimStart();
    if (/^(?:<\?xml[^>]*>\s*)?<svg[\s>]/i.test(prefix)) return "image/svg+xml";
    return "";
  }
  async function fetchImageDirect(source) {
    const response = await fetch(source, { credentials: "include" });
    if (!response.ok) throw copyError("network", `资源请求失败（${response.status}）`);
    const blob = await response.blob();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const responseMime = blob.type.split(";")[0].toLowerCase();
    const mime = responseMime.startsWith("image/") ? responseMime : mimeFromSource(source) || mimeFromBytes(bytes);
    return mime ? new Blob([bytes], { type: mime }) : blob;
  }
  async function fetchImage(source) {
    const absoluteSource = new URL(source, document.baseURI).href;
    if (/^data:/i.test(absoluteSource) || !chrome.runtime?.sendMessage) return fetchImageDirect(absoluteSource);
    let response;
    try {
      response = await chrome.runtime.sendMessage({ type: "style-scope:fetch-image", url: absoluteSource });
    } catch (error) {
      throw copyError("network", error?.message || "扩展后台无法读取图片资源");
    }
    if (!response?.ok || !response.base64) throw copyError("network", response?.error || "扩展后台无法读取图片资源");
    const bytes = base64Bytes(response.base64);
    const responseMime = String(response.mime || "").toLowerCase();
    const mime = responseMime.startsWith("image/") ? responseMime : mimeFromSource(absoluteSource) || mimeFromBytes(bytes);
    if (!mime.startsWith("image/")) throw copyError("format", "无法确认资源的原始图片格式");
    return new Blob([bytes], { type: mime });
  }
  function canvasBlob(canvas) {
    return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(copyError("render", "画布无法导出 PNG")), "image/png"));
  }
  function clipboardSupports(type) {
    try { return !ClipboardItem.supports || ClipboardItem.supports(type); }
    catch (_) { return false; }
  }
  async function prepareClipboardPayload(resource) {
    const source = await resource.blob();
    const mime = String(source?.type || "").split(";")[0].toLowerCase();
    if (!mime.startsWith("image/")) throw copyError("format", "无法确认资源的原始图片格式");
    const bytes = new Uint8Array(await source.arrayBuffer());
    const stableSource = new Blob([bytes], { type: mime });
    const text = mime === "image/svg+xml" ? new TextDecoder().decode(bytes) : "";
    return { source: stableSource, mime, text, base64: bytesToBase64(bytes) };
  }
  function clipboardItemFor(payload) {
    if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
      throw copyError("clipboard", "当前页面未开放图片剪贴板");
    }
    const representations = {};
    if (clipboardSupports(payload.mime)) representations[payload.mime] = payload.source;
    if (payload.mime === "image/svg+xml" && payload.text) {
      if (clipboardSupports("text/html")) {
        representations["text/html"] = new Blob([payload.text], { type: "text/html" });
      }
      if (clipboardSupports("text/plain")) {
        representations["text/plain"] = new Blob([payload.text], { type: "text/plain" });
      }
    }
    const clipboardMime = Object.keys(representations).join(",");
    if (!clipboardMime) {
      throw copyError("format", `系统剪贴板不支持原始格式 ${payload.mime}`);
    }
    return {
      item: new ClipboardItem(representations),
      clipboardMime
    };
  }
  function resourceButton() {
    return panel?.querySelector("[data-copy-resource]");
  }
  function sidebarResource() {
    if (!selectedResource) return null;
    return {
      state: selectedResource.state,
      label: selectedResource.label,
      description: selectedResource.description,
      error: selectedResource.error?.message || "",
      payload: selectedResource.payload ? {
        mime: selectedResource.payload.mime,
        text: selectedResource.payload.text,
        base64: selectedResource.payload.base64
      } : null
    };
  }
  function inspectionSnapshot() {
    return inspected && panel ? {
      html: panel.innerHTML,
      resource: sidebarResource(),
      updatedAt: Date.now()
    } : null;
  }
  function publishInspection() {
    if (!chrome.runtime?.sendMessage || settings.panelMode !== "sidebar") return;
    const snapshot = inspectionSnapshot();
    chrome.runtime.sendMessage({ type: "style-scope:inspection-update", snapshot }).catch?.(() => {});
  }
  function syncResourceButton(resource) {
    if (selectedResource !== resource) return;
    const button = resourceButton();
    if (!button) { publishInspection(); return; }
    if (resource.state === "loading") {
      button.textContent = "PREPARING…";
      button.disabled = true;
      publishInspection();
      return;
    }
    if (resource.state === "ready") {
      button.textContent = resource.label;
      button.title = `复制${resource.description}到剪贴板`;
      button.disabled = false;
      button.classList.remove("is-failed");
      publishInspection();
      return;
    }
    if (resource.state === "error") {
      button.textContent = "RETRY PREP";
      button.title = resource.error?.message || "资源准备失败，点击重试";
      button.disabled = false;
      button.classList.add("is-failed");
      publishInspection();
    }
  }
  function prepareResource(resource) {
    if (!resource || resource.state === "loading" || resource.state === "ready") return resource?.preparing;
    resource.state = "loading";
    resource.error = null;
    syncResourceButton(resource);
    resource.preparing = prepareClipboardPayload(resource)
      .then((payload) => {
        resource.payload = payload;
        resource.state = "ready";
        syncResourceButton(resource);
        return payload;
      })
      .catch((error) => {
        resource.error = error;
        resource.state = "error";
        syncResourceButton(resource);
        return null;
      });
    return resource.preparing;
  }
  function copyFailureLabel(error) {
    if (error?.name === "NotAllowedError" || error?.code === "clipboard") return "CLIPBOARD BLOCKED";
    if (error?.code === "network") return "IMAGE UNAVAILABLE";
    if (error?.code === "format") return "FORMAT UNSUPPORTED";
    return "COPY FAILED";
  }
  async function copyResource(event) {
    const button = event.target.closest?.("[data-copy-resource]");
    if (!button || !selectedResource) return;
    const resource = selectedResource;
    event.preventDefault();
    event.stopPropagation();
    if (resource.state !== "ready" || !resource.payload) {
      prepareResource(resource);
      return;
    }
    button.textContent = "COPYING…";
    button.disabled = true;
    try {
      // 资源已在选中后完成读取与转码；点击时只做同步构造，确保保留用户手势与焦点。
      const { item, clipboardMime } = clipboardItemFor(resource.payload);
      await navigator.clipboard.write([item]);
      button.dataset.clipboardMime = clipboardMime;
      button.dataset.copyResult = "success";
      button.dataset.copyMime = clipboardMime;
      delete button.dataset.copyError;
      button.textContent = resource.payload.mime === "image/svg+xml" ? "COPIED SVG" : "COPIED IMAGE";
      button.classList.add("is-copied");
    } catch (error) {
      button.dataset.copyResult = "failed";
      button.dataset.copyError = error?.message || "图片复制失败";
      button.textContent = copyFailureLabel(error);
      button.title = error.message || "图片复制失败";
      button.classList.add("is-failed");
    }
    window.setTimeout(() => {
      if (!button.isConnected) return;
      button.textContent = resource.label;
      button.title = `复制${resource.description}到剪贴板`;
      button.disabled = false;
      delete button.dataset.clipboardMime;
      button.classList.remove("is-copied", "is-failed");
    }, 3000);
  }
  function sampleText(element) {
    if (typeof element.value === "string" && element.value.trim()) return element.value.trim().replace(/\s+/g, " ").slice(0, 42);
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let sample = "";
    let visited = 0;
    while (sample.length < 42 && visited < 24) {
      const node = walker.nextNode();
      if (!node) break;
      sample += ` ${node.nodeValue || ""}`;
      visited += 1;
    }
    return sample.trim().replace(/\s+/g, " ").slice(0, 42) || "无文字内容";
  }
  function contentFor(element, rect, computed, childGap) {
    const isText = textElement(element);
    const text = sampleText(element);
    const dimensions = `<div class="metric-grid">${metricField("W", rounded(rect.width))}${metricField("H", rounded(rect.height))}</div>`;
    const layoutRows = [];
    if (computed.display === "flex" || computed.display === "inline-flex") {
      const direction = computed.flexDirection.startsWith("column") ? "Vertical" : "Horizontal";
      layoutRows.push(propertyRow("Layout", `Auto · ${direction}`, `${computed.display} · ${computed.flexDirection}`));
      if (!["normal", "stretch"].includes(computed.alignItems)) layoutRows.push(propertyRow("Align", computed.alignItems));
      if (!["normal", "flex-start"].includes(computed.justifyContent)) layoutRows.push(propertyRow("Distribute", computed.justifyContent));
    } else if (computed.display === "grid" || computed.display === "inline-grid") {
      layoutRows.push(propertyRow("Layout", "Grid"));
    } else if (!["block", "inline"].includes(computed.display)) {
      layoutRows.push(propertyRow("Display", computed.display));
    }
    if (computed.position !== "static") layoutRows.push(propertyRow("Position", computed.position));
    const gapValues = [computed.rowGap, computed.columnGap];
    if (childGap || gapValues.some(hasPositiveLength)) {
      layoutRows.push(propertyRow("Gap", childGap ? `${rounded(childGap.value)} px` : compactBox([...gapValues, ...gapValues])));
    }
    const paddings = [computed.paddingTop, computed.paddingRight, computed.paddingBottom, computed.paddingLeft];
    if (paddings.some(hasPositiveLength)) layoutRows.push(propertyRow("Padding", compactBox(paddings), `Top · Right · Bottom · Left\n${paddings.map(lengthValue).join(" · ")}`));
    const radii = [computed.borderTopLeftRadius, computed.borderTopRightRadius, computed.borderBottomRightRadius, computed.borderBottomLeftRadius];
    if (radii.some(hasPositiveLength)) layoutRows.push(propertyRow("Radius", compactBox(radii), `Top left · Top right · Bottom right · Bottom left\n${radii.map(lengthValue).join(" · ")}`));
    if ([computed.overflowX, computed.overflowY].some((value) => value === "hidden" || value === "clip")) {
      layoutRows.push(propertyRow("Clip content", "On", `${computed.overflowX} · ${computed.overflowY}`));
    }

    const typographyRows = [];
    if (isText) {
      typographyRows.push(propertyRow("Font", primaryFontFamily(computed.fontFamily)));
      const style = computed.fontStyle === "normal" ? fontWeightLabel(computed.fontWeight) : `${fontWeightLabel(computed.fontWeight)} · ${computed.fontStyle}`;
      typographyRows.push(propertyRow("Style", style));
      typographyRows.push(propertyRow("Size", lengthValue(computed.fontSize)));
      typographyRows.push(propertyRow("Line height", computed.lineHeight === "normal" ? "Auto" : lengthValue(computed.lineHeight)));
      if (computed.letterSpacing !== "normal" && !/^0(?:px)?$/.test(computed.letterSpacing)) typographyRows.push(propertyRow("Letter spacing", lengthValue(computed.letterSpacing)));
      if (!["left", "start"].includes(computed.textAlign)) typographyRows.push(propertyRow("Align", computed.textAlign));
      if (computed.textDecorationLine !== "none") typographyRows.push(propertyRow("Decoration", computed.textDecorationLine));
      if (computed.textTransform !== "none") typographyRows.push(propertyRow("Case", computed.textTransform));
    }

    const fillRows = [];
    if (isText && visibleColour(computed.color)) fillRows.push(colourPropertyRow("Text", computed.color, element, "color"));
    if (visibleColour(computed.backgroundColor)) fillRows.push(colourPropertyRow("Background", computed.backgroundColor, element, "background-color"));
    if (computed.backgroundImage !== "none") {
      const kind = computed.backgroundImage.includes("gradient(") ? "Gradient" : "Image";
      fillRows.push(propertyRow("Image", kind, computed.backgroundImage));
    }

    const strokeRows = borderRows(element, computed);
    if (hasPositiveLength(computed.outlineWidth) && computed.outlineStyle !== "none") {
      strokeRows.push(colourPropertyRow("Outline", computed.outlineColor, element, "outline", `${lengthValue(computed.outlineWidth)} · ${computed.outlineStyle}`));
    }

    const effectRows = [];
    if (computed.boxShadow !== "none") effectRows.push(propertyRow("Shadow", "Drop shadow", computed.boxShadow));
    if (isText && computed.textShadow !== "none") effectRows.push(propertyRow("Text shadow", "Enabled", computed.textShadow));
    if (computed.filter !== "none") effectRows.push(propertyRow("Filter", computed.filter));
    if (computed.mixBlendMode !== "normal") effectRows.push(propertyRow("Blend", computed.mixBlendMode));
    if (Number.parseFloat(computed.opacity) < 1) effectRows.push(propertyRow("Opacity", `${Math.round(Number.parseFloat(computed.opacity) * 100)}%`));

    const sections = [
      propertySection("Layout", [dimensions, ...layoutRows]),
      propertySection("Typography", typographyRows),
      propertySection("Fill", fillRows),
      propertySection("Stroke", strokeRows),
      propertySection("Effects", effectRows)
    ].join("");
    const state = locked ? "Selected" : "Inspecting";
    const resourceAction = selectedResource
      ? `<button class="resource-copy" type="button" data-copy-resource${selectedResource.state === "loading" ? " disabled" : ""} title="复制${selectedResource.description}到剪贴板">${selectedResource.state === "loading" ? "PREPARING…" : selectedResource.label}</button>`
      : "";
    const textPreview = isText ? `<div class="text-preview" title="${escapeMarkup(text)}">${escapeMarkup(text)}</div>` : "";
    return `<div class="panel-head"><div class="element-state"><span class="${locked ? "is-locked" : ""}"></span>${state}<b>${element.tagName.toLowerCase()}</b></div><div class="selector-line"><div class="selector">${selectorFor(element)}</div>${resourceAction}</div>${textPreview}</div><div class="property-sections">${sections}</div>`;
  }
  function place(rect, computed, childGap) {
    if (!overlay || !panel || !inspected) return;
    overlay.classList.toggle("is-locked", locked);
    paintBoxModel(rect, computed, childGap);
    if (settings.panelMode === "sidebar") {
      panel.style.display = "none";
      return;
    }
    panel.style.display = "block";
    const gap = 14;
    const edge = 8;
    const width = panel.offsetWidth || 320;
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

  function labelEdges(layer, values, rect) {
    if (!layer) return;
    const kind = layer.dataset.kind;
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

  function measureChildGap(element, layout = getComputedStyle(element)) {
    if (!/(flex|grid)/.test(layout.display)) return null;
    const vertical = layout.flexDirection === "column" || layout.flexDirection === "column-reverse";
    const children = [];
    const scanLimit = Math.min(element.children.length, 32);
    for (let index = 0; index < scanLimit; index += 1) {
      const rect = element.children[index].getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) children.push(rect);
    }
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

  function paintBoxModel(rect, style = getComputedStyle(inspected), childGap = measureChildGap(inspected, style)) {
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
    paintChildGap(childGap);
    labelEdges(marginLayer, margin, marginBox);
    labelEdges(borderLayer, border, borderBox);
    labelEdges(paddingLayer, padding, paddingBox);
    const contentLabel = contentLayer?.querySelector(".content-label");
    if (contentLabel) {
      contentLabel.textContent = `C ${Math.round(contentBox.width)} × ${Math.round(contentBox.height)}`;
      contentLabel.style.display = contentBox.width >= 72 && contentBox.height >= 20 ? "block" : "none";
    }
  }
  function isActive() { return settings.enabled; }
  function isCommandKey(event) { return event.code === "MetaLeft" || event.code === "MetaRight"; }
  function isCommandE(event) { return commandDown && event.metaKey && event.code === "KeyE"; }
  function setInspectionEnabled(enabled) {
    apply({ ...settings, enabled });
    chrome.storage.local.set({ enabled });
    if (settings.panelMode === "sidebar") {
      chrome.runtime.sendMessage({ type: "style-scope:set-side-panel", open: enabled }).catch?.(() => {});
    }
    if (!enabled) return;
    const target = document.elementFromPoint(cursor.x, cursor.y);
    if (target) inspect(target);
  }
  function renderInspection() {
    if (!inspected || !panel) { publishInspection(); return; }
    const rect = inspected.getBoundingClientRect();
    const computed = getComputedStyle(inspected);
    const childGap = measureChildGap(inspected, computed);
    panel.innerHTML = contentFor(inspected, rect, computed, childGap);
    place(rect, computed, childGap);
    publishInspection();
  }
  function inspect(element) {
    if (!isActive() || !element || element.id === ROOT_ID || element.closest?.(`#${ROOT_ID}`)) return;
    inspected = element;
    previewedTarget = null;
    selectedResource = resourceFor(element);
    renderInspection();
    if (selectedResource && locked) prepareResource(selectedResource);
  }
  function hoverName(element) {
    const tag = element.tagName.toLowerCase();
    if (element.id) return `${tag}#${element.id}`;
    const firstClass = [...element.classList][0];
    return firstClass ? `${tag}.${firstClass}` : tag;
  }
  function hideHoverPreview() {
    if (hoverPreview) hoverPreview.style.display = "none";
    previewedTarget = null;
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
    previewedTarget = element;
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
  function moveDetail(event) {
    const item = event.target.closest?.("[data-detail]");
    if (!item || !detailTooltip) { hideDetail(); return; }
    currentDetailItem = item;
    if (detailTooltip.textContent !== item.dataset.detail) detailTooltip.textContent = item.dataset.detail;
    detailTooltip.style.display = "block";
    placeDetail(event);
  }
  function hideDetail() {
    currentDetailItem = null;
    if (detailTooltip) detailTooltip.style.display = "none";
  }
  function cancelPointerWork() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    pendingTarget = null;
  }
  function schedulePointerWork(target) {
    pendingTarget = target;
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const nextTarget = pendingTarget;
      pendingTarget = null;
      if (!nextTarget || !isActive()) return;
      if (locked) previewHover(nextTarget);
      else inspect(nextTarget);
    });
  }
  function schedulePlacement() {
    if (placementRaf || !inspected) return;
    placementRaf = requestAnimationFrame(() => {
      placementRaf = 0;
      if (!inspected || !isActive()) return;
      place(inspected.getBoundingClientRect());
    });
  }
  function onMove(event) {
    cursor = { x: event.clientX, y: event.clientY };
    if (!isActive()) return;
    if (ownUiEvent(event)) { hideHoverPreview(); return; }
    const target = targetFromEvent(event);
    if (locked) {
      if (!target || target === inspected) { cancelPointerWork(); hideHoverPreview(); return; }
      if (target === previewedTarget) return;
      schedulePointerWork(target);
      return;
    }
    if (!target || target === inspected) { cancelPointerWork(); return; }
    schedulePointerWork(target);
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
    if (settings.panelMode === "sidebar") {
      chrome.runtime
        .sendMessage({ type: "style-scope:set-side-panel", open: true })
        .catch(() => {});
    }
    locked = true;
    hideHoverPreview();
    cursor = { x: event.clientX, y: event.clientY };
    inspect(target);
  }
  function hide() {
    cancelPointerWork();
    if (placementRaf) cancelAnimationFrame(placementRaf);
    placementRaf = 0;
    locked = false;
    inspected = null;
    selectedResource = null;
    [hoverPreview, distanceReadout, distanceXGuide, distanceYGuide, marginLayer, overlay, borderLayer, paddingLayer, contentLayer, childGapLayer, panel, detailTooltip].forEach((layer) => { if (layer) layer.style.display = "none"; });
    publishInspection();
  }
  document.addEventListener("mousemove", onMove, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("keydown", (event) => {
    if (isCommandKey(event)) {
      commandDown = true;
      return;
    }
    if (event.code === "Escape" && event.key === "Escape" && isActive()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      setInspectionEnabled(false);
      return;
    }
    if (!isCommandE(event) || event.repeat) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    setInspectionEnabled(!settings.enabled);
  }, true);
  document.addEventListener("keyup", (event) => {
    if (isCommandKey(event)) commandDown = false;
  }, true);
  window.addEventListener("blur", () => { commandDown = false; });
  window.addEventListener("scroll", () => { schedulePlacement(); hideHoverPreview(); }, true);
  window.addEventListener("resize", () => { schedulePlacement(); hideHoverPreview(); });
  function apply(next) {
    const previousMode = settings.panelMode;
    settings = { ...DEFAULTS, ...next };
    if (!isActive()) { hide(); return; }
    createUI();
    if (inspected && previousMode !== settings.panelMode) renderInspection();
    else if (settings.panelMode === "sidebar") publishInspection();
    else if (panel && inspected) panel.style.display = "block";
  }
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "style-scope:update") {
      apply(message.settings);
    }
    if (message?.type === "style-scope:retry-resource" && selectedResource) {
      prepareResource(selectedResource);
    }
    if (message?.type === "style-scope:get-inspection-snapshot") {
      sendResponse({ snapshot: settings.panelMode === "sidebar" ? inspectionSnapshot() : null });
    }
  });
  chrome.storage.onChanged?.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    const patch = Object.fromEntries(Object.entries(changes).map(([key, change]) => [key, change.newValue]));
    apply({ ...settings, ...patch });
  });
  chrome.storage.local.get(DEFAULTS, apply);
})();
