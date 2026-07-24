(() => {
  if (globalThis.__styleScopeLoaded) return;
  globalThis.__styleScopeLoaded = true;

  const ROOT_ID = "__style_scope_root__";
  const DEFAULTS = { enabled: false };
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
  let tokenAnalysis = null;
  let tokenLookupJob = 0;
  let currentDetailItem = null;

  const typographyProps = ["font-family", "font-size", "font-weight", "font-style", "line-height", "letter-spacing", "text-transform", "text-decoration-line", "text-decoration-color", "text-decoration-style", "color", "text-shadow", "white-space", "word-break"];
  const appearanceProps = ["background-color", "background-image", "opacity", "border-top", "border-right", "border-bottom", "border-left", "border-radius", "outline", "box-shadow", "filter", "mix-blend-mode", "visibility"];
  // 已从 Aurora 样式库确认的固定色；其余颜色仅在页面源码可追溯到 CSS token 时展示，避免按色相猜测。
  const AURORA_COLOUR_TOKENS = Object.freeze({
    "#FFFFFF@100": ["token/static/white"],
    "#000000@100": ["token/static/black"]
  });

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
    #panel { position:fixed; z-index:2147483647; display:none; width:420px; max-height:calc(100vh - 16px); overflow-x:hidden; overflow-y:auto; pointer-events:auto; border:1px solid rgba(244,187,76,.78); background:#151615; box-shadow:0 18px 46px rgba(0,0,0,.42), 0 0 0 1px rgba(255,246,224,.08); }
    #panel::before { display:none; }
    .panel-head, .group, .box-model { position:relative; }.panel-head { padding:14px 16px 13px; border-bottom:1px solid rgba(255,255,255,.13); background:#1b1c1b; }.kicker { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; color:#f4bb4c; font-size:12px; font-weight:700; letter-spacing:.12em; }.kicker span:last-child { color:#aaa398; font-size:12px; }.selector-line { display:flex; align-items:center; gap:10px; min-width:0; }.selector { min-width:0; overflow:hidden; color:#f7f0e2; font-size:14px; line-height:1.25; white-space:nowrap; text-overflow:ellipsis; }.selector b { color:#f4bb4c; font-weight:500; }.resource-copy { flex:none; padding:6px 8px; cursor:pointer; color:#f7d881; border:1px solid rgba(244,187,76,.72); border-radius:2px; background:#201d15; font:700 10px/1 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; letter-spacing:.07em; white-space:nowrap; }.resource-copy:hover, .resource-copy:focus-visible { outline:none; color:#1a1710; border-color:#f4bb4c; background:#f4bb4c; }.resource-copy:disabled { cursor:progress; opacity:.58; }.resource-copy.is-copied { color:#b8f2e8; border-color:rgba(104,205,194,.85); background:#122421; }.resource-copy.is-failed { color:#ffad9d; border-color:rgba(238,120,102,.85); background:#2a1715; }.meta { margin-top:8px; color:#b5aea0; font-size:12px; line-height:1.25; }
    .groups { display:grid; grid-template-columns:1fr 1fr; }.group { min-width:0; padding:13px 14px 12px; border-bottom:1px solid rgba(255,255,255,.1); }.group:first-child { border-right:1px solid rgba(255,255,255,.1); }.group-title { margin-bottom:9px; color:#f4bb4c; font-size:12px; font-weight:700; letter-spacing:.12em; }.row { position:relative; display:grid; grid-template-columns:minmax(84px,.95fr) minmax(0,1.2fr); gap:8px; align-items:baseline; padding:3px 0; font-size:12px; line-height:1.2; }.key, .value { cursor:help; }.key { overflow:hidden; color:#aaa49a; text-overflow:ellipsis; white-space:nowrap; }.value { overflow:hidden; color:#e3ddd2; text-align:right; text-overflow:ellipsis; white-space:nowrap; }.value.colour { overflow:visible; color:#f2dfb4; }.row:hover .key { color:#f4bb4c; }.value .chip { display:inline-block; width:9px; height:9px; margin-right:5px; vertical-align:-1px; border:1px solid rgba(255,255,255,.25); border-radius:50%; }.alpha { color:#a99f8d; }
    .box-model { padding:14px; border-bottom:1px solid rgba(255,255,255,.1); }.box-title { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:8px; color:#f4bb4c; font-size:12px; font-weight:700; letter-spacing:.12em; }.box-size { color:#bab3a6; font-size:12px; font-weight:400; letter-spacing:0; }.content-sample { overflow:hidden; margin:0 0 10px; padding:9px 11px; color:#ded6c7; border-left:2px solid rgba(100,188,174,.9); background:#17211f; font-size:12px; line-height:1.3; text-overflow:ellipsis; white-space:nowrap; }.content-sample b { color:#82c5b7; font-size:12px; font-weight:700; letter-spacing:.08em; }.inset-grid { display:grid; grid-template-columns:1fr 1fr; gap:7px; }.inset { display:flex; align-items:baseline; justify-content:space-between; padding:8px 9px; border:1px solid rgba(100,188,174,.36); background:#16201e; }.inset span { color:#9ca59f; font-size:12px; letter-spacing:.06em; }.inset b { color:#e8e0d3; font-size:13px; font-weight:500; }.copy-note { display:block; margin-top:11px; color:#989289; font-size:10px; text-align:right; }
    #detail-tooltip { position:fixed; z-index:2147483647; display:none; max-width:min(360px, calc(100vw - 24px)); padding:7px 9px; pointer-events:none; border:1px solid rgba(244,187,76,.64); background:#0e0f0e; box-shadow:0 7px 16px rgba(0,0,0,.25); color:#f4ead9; font-size:12px; line-height:1.4; white-space:pre-line; overflow-wrap:anywhere; }
  `;

  function createUI() {
    if (root) return;
    const host = document.createElement("div");
    host.id = ROOT_ID;
    host.setAttribute("aria-hidden", "true");
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
  function customPropertyColourIndex(element, computed = getComputedStyle(element)) {
    const index = new Map();
    for (let position = 0; position < computed.length; position += 1) {
      const name = computed[position];
      if (!name?.startsWith("--")) continue;
      const resolved = resolveVariable(element, name, new Set(), computed);
      colourKeys(resolved).forEach((key) => {
        if (!index.has(key)) index.set(key, new Set());
        index.get(key).add(name);
      });
    }
    return index;
  }
  function tokenInfoFor(element, prop, computedValue, customPropertyIndex, computed = getComputedStyle(element)) {
    const expected = colourKeys(computedValue);
    if (!expected.size) return { source: [], candidates: [] };
    const sourceNames = new Set();
    const candidateNames = new Set([...expected].flatMap((key) => AURORA_COLOUR_TOKENS[key] || []));
    declaredValuesFor(element, prop).forEach((value) => {
      variablesIn(value).forEach((name) => {
        const resolved = resolveVariable(element, name, new Set(), computed);
        const resolvedKeys = colourKeys(resolved);
        if ([...resolvedKeys].some((key) => expected.has(key))) sourceNames.add(name);
      });
    });
    expected.forEach((key) => customPropertyIndex.get(key)?.forEach((name) => candidateNames.add(name)));
    sourceNames.forEach((name) => candidateNames.delete(name));
    return { source: [...sourceNames], candidates: [...candidateNames] };
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
    if (tokenInfo.candidates.length) {
      return `MATCHING TOKENS · ${tokenInfo.candidates.length}\n${tokenInfo.candidates.map(displayTokenName).join("\n")}\n${formatted}`;
    }
    return formatted;
  }
  function readableName(prop) { return prop.replace(/^font-/, "").replace(/^background-/, "bg-").replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()); }
  function row(prop, computed) {
    const value = computed.getPropertyValue(prop).trim();
    const colour = ["color", "background-color", "text-decoration-color"].includes(prop) && colourDetails(value);
    const name = readableName(prop);
    const hasColour = colourKeys(value).size > 0;
    const renderedValue = colour
      ? `<i class="chip" style="background:${value}"></i>${colour.hex} <span class="alpha">${colour.alpha.replace("α ", "")}</span>`
      : escapeMarkup(formatColourValue(clean(value)));
    const tokenData = hasColour ? ` data-token-prop="${escapeMarkup(prop)}" data-token-value="${escapeMarkup(value)}"` : "";
    return `<div class="row"><span class="key" data-detail="${escapeMarkup(name)}">${escapeMarkup(name)}</span><span class="value${colour ? " colour" : ""}" data-detail="${escapeMarkup(formatColourValue(value))}"${tokenData}>${renderedValue}</span></div>`;
  }
  function selectorFor(element) {
    const tag = element.tagName.toLowerCase();
    if (element.id) return `${tag}<b>#${CSS.escape(element.id)}</b>`;
    const classes = [...element.classList].slice(0, 2).map((name) => `.${CSS.escape(name)}`).join("");
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
        blob: async () => {
          try {
            return await fetchImage(source);
          } catch (fetchError) {
            try {
              return await pngFromImageElement(element);
            } catch (_) {
              throw fetchError;
            }
          }
        }
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
    const clone = element.cloneNode(true);
    const rect = element.getBoundingClientRect();
    const computed = getComputedStyle(element);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    if (!clone.getAttribute("width")) clone.setAttribute("width", String(Math.max(1, Math.round(rect.width))));
    if (!clone.getAttribute("height")) clone.setAttribute("height", String(Math.max(1, Math.round(rect.height))));
    clone.setAttribute("style", `${clone.getAttribute("style") || ""};color:${computed.color};fill:${computed.fill};stroke:${computed.stroke}`);
    const references = [...clone.querySelectorAll("use")]
      .map((use) => use.getAttribute("href") || use.getAttribute("xlink:href"))
      .filter((reference) => reference?.startsWith("#"));
    if (references.length) {
      const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
      [...new Set(references)].forEach((reference) => {
        const source = document.getElementById(reference.slice(1));
        if (source) defs.append(source.cloneNode(true));
      });
      if (defs.childNodes.length) clone.insertBefore(defs, clone.firstChild);
    }
    const markup = new XMLSerializer().serializeToString(clone);
    return new Blob([markup], { type: "image/svg+xml" });
  }
  function base64Bytes(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
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
    if (!/^https?:/i.test(absoluteSource) || !chrome.runtime?.sendMessage) return fetchImageDirect(absoluteSource);
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
  async function pngFromImageElement(image) {
    if (!image.complete || !image.naturalWidth || !image.naturalHeight) {
      try { await image.decode(); }
      catch (_) { throw copyError("render", "页面中的图片尚未加载完成"); }
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, image.naturalWidth);
    canvas.height = Math.max(1, image.naturalHeight);
    const context = canvas.getContext("2d");
    if (!context) throw copyError("render", "无法创建图片画布");
    try {
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return await canvasBlob(canvas);
    } catch (_) {
      throw copyError("render", "页面限制了图片像素读取");
    }
  }
  function clipboardSupports(type) {
    try { return !ClipboardItem.supports || ClipboardItem.supports(type); }
    catch (_) { return false; }
  }
  async function pngFromImageBlob(blob) {
    let bitmap;
    try {
      bitmap = await createImageBitmap(blob);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, bitmap.width);
      canvas.height = Math.max(1, bitmap.height);
      const context = canvas.getContext("2d");
      if (!context) throw copyError("format", "无法创建图片画布");
      context.drawImage(bitmap, 0, 0);
      return await canvasBlob(canvas);
    } catch (bitmapError) {
      const objectUrl = URL.createObjectURL(blob);
      try {
        const image = new Image();
        image.src = objectUrl;
        await image.decode();
        return await pngFromImageElement(image);
      } catch (_) {
        throw bitmapError;
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    } finally {
      bitmap?.close?.();
    }
  }
  async function prepareClipboardPayload(resource) {
    const source = await resource.blob();
    if (!source?.type?.startsWith("image/")) throw copyError("format", "无法确认资源的图片格式");
    if (resource.kind === "svg" || source.type === "image/svg+xml") {
      const svg = source.type === "image/svg+xml" ? source : new Blob([source], { type: "image/svg+xml" });
      let png = null;
      try { png = await pngFromImageBlob(svg); }
      catch (_) { /* SVG 原件仍可复制；PNG 只是兼容表示。 */ }
      return { svg, png };
    }
    const png = source.type === "image/png" ? source : await pngFromImageBlob(source);
    return { png };
  }
  function clipboardItemFor(payload) {
    if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
      throw copyError("clipboard", "当前页面未开放图片剪贴板");
    }
    const representations = {};
    if (payload.svg && clipboardSupports("image/svg+xml")) representations["image/svg+xml"] = payload.svg;
    if (payload.png && clipboardSupports("image/png")) representations["image/png"] = payload.png;
    const clipboardMime = representations["image/svg+xml"] ? "image/svg+xml" : representations["image/png"] ? "image/png" : "";
    if (!clipboardMime) throw copyError("format", "系统剪贴板不支持此图片格式");
    return {
      item: new ClipboardItem(representations),
      clipboardMime
    };
  }
  function resourceButton() {
    return panel?.querySelector("[data-copy-resource]");
  }
  function syncResourceButton(resource) {
    if (selectedResource !== resource) return;
    const button = resourceButton();
    if (!button) return;
    if (resource.state === "loading") {
      button.textContent = "PREPARING…";
      button.disabled = true;
      return;
    }
    if (resource.state === "ready") {
      button.textContent = resource.label;
      button.title = `复制${resource.description}到剪贴板`;
      button.disabled = false;
      button.classList.remove("is-failed");
      return;
    }
    if (resource.state === "error") {
      button.textContent = "RETRY PREP";
      button.title = resource.error?.message || "资源准备失败，点击重试";
      button.disabled = false;
      button.classList.add("is-failed");
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
      button.textContent = resource.payload.svg ? "COPIED SVG" : "COPIED IMAGE";
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
    const sets = [["排版 / TYPE", typographyProps], ["外观 / LOOK", appearanceProps]];
    const groups = sets.map(([title, props]) => `<div class="group"><div class="group-title">${title}</div>${props.map((prop) => row(prop, computed)).join("")}</div>`).join("");
    const text = sampleText(element);
    const insets = [["↑ 上", computed.paddingTop], ["→ 右", computed.paddingRight], ["↓ 下", computed.paddingBottom], ["← 左", computed.paddingLeft]];
    const insetGrid = insets.map(([direction, value]) => `<div class="inset"><span>${direction}</span><b>${value}</b></div>`).join("");
    const boxHint = childGap ? `content → 边缘 · gap ${Math.round(childGap.value)}px` : "content → 边缘";
    const state = locked ? "LOCKED · CLICKED" : "LIVE · HOVER";
    const resourceAction = selectedResource
      ? `<button class="resource-copy" type="button" data-copy-resource${selectedResource.state === "loading" ? " disabled" : ""} title="复制${selectedResource.description}到剪贴板">${selectedResource.state === "loading" ? "PREPARING…" : selectedResource.label}</button>`
      : "";
    const classes = [...element.classList].slice(0, 8);
    return `<div class="panel-head"><div class="kicker"><span>${state}</span><span>${element.tagName.toLowerCase()} · ${element.childElementCount} children</span></div><div class="selector-line"><div class="selector">${selectorFor(element)}</div>${resourceAction}</div><div class="meta">${Math.round(rect.width)} × ${Math.round(rect.height)} px&nbsp;&nbsp; · &nbsp;&nbsp;${classes.length ? `.${classes.join(".")}${element.classList.length > classes.length ? "…" : ""}` : "no class"}</div></div><div class="groups">${groups}</div><div class="box-model"><div class="box-title"><span>内容内距 / TEXT INSETS</span><span class="box-size">${boxHint}</span></div><div class="content-sample"><b>CONTENT&nbsp;&nbsp;</b>${text}</div><div class="inset-grid">${insetGrid}</div><span class="copy-note">⌘ + E 开关检视 · Esc 退出 · 点击重新选中</span></div>`;
  }
  function place(rect, computed, childGap) {
    if (!overlay || !panel || !inspected) return;
    overlay.classList.toggle("is-locked", locked);
    paintBoxModel(rect, computed, childGap);
    panel.style.display = "block";
    const gap = 14;
    const edge = 8;
    const width = panel.offsetWidth || 420;
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
    if (!enabled) return;
    const target = document.elementFromPoint(cursor.x, cursor.y);
    if (target) inspect(target);
  }
  function inspect(element) {
    if (!isActive() || !element || element.id === ROOT_ID || element.closest?.(`#${ROOT_ID}`)) return;
    inspected = element;
    previewedTarget = null;
    selectedResource = resourceFor(element);
    const rect = element.getBoundingClientRect();
    const computed = getComputedStyle(element);
    const childGap = measureChildGap(element, computed);
    tokenAnalysis = { element, computed, colourIndex: null, details: new Map() };
    cancelTokenLookup();
    panel.innerHTML = contentFor(element, rect, computed, childGap);
    place(rect, computed, childGap);
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
  function cancelTokenLookup() {
    if (!tokenLookupJob) return;
    if ("cancelIdleCallback" in window) window.cancelIdleCallback(tokenLookupJob);
    else window.clearTimeout(tokenLookupJob);
    tokenLookupJob = 0;
  }
  function scheduleTokenLookup(item) {
    if (!item?.dataset.tokenProp || !tokenAnalysis) return;
    const key = `${item.dataset.tokenProp}\u0000${item.dataset.tokenValue}`;
    const cached = tokenAnalysis.details.get(key);
    if (cached) {
      item.dataset.detail = cached;
      return;
    }
    cancelTokenLookup();
    const analysis = tokenAnalysis;
    const run = () => {
      tokenLookupJob = 0;
      if (tokenAnalysis !== analysis) return;
      analysis.colourIndex ||= customPropertyColourIndex(analysis.element, analysis.computed);
      const info = tokenInfoFor(analysis.element, item.dataset.tokenProp, item.dataset.tokenValue, analysis.colourIndex, analysis.computed);
      const detail = detailFor(item.dataset.tokenValue, info);
      analysis.details.set(key, detail);
      if (!item.isConnected) return;
      item.dataset.detail = detail;
      if (currentDetailItem === item && detailTooltip?.style.display === "block") detailTooltip.textContent = detail;
    };
    tokenLookupJob = "requestIdleCallback" in window
      ? window.requestIdleCallback(run, { timeout: 120 })
      : window.setTimeout(run, 0);
  }
  function moveDetail(event) {
    const item = event.target.closest?.("[data-detail]");
    if (!item || !detailTooltip) { hideDetail(); return; }
    if (currentDetailItem !== item) {
      currentDetailItem = item;
      scheduleTokenLookup(item);
    }
    if (detailTooltip.textContent !== item.dataset.detail) detailTooltip.textContent = item.dataset.detail;
    detailTooltip.style.display = "block";
    placeDetail(event);
  }
  function hideDetail() {
    currentDetailItem = null;
    cancelTokenLookup();
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
    locked = true;
    hideHoverPreview();
    cursor = { x: event.clientX, y: event.clientY };
    inspect(target);
  }
  function hide() {
    cancelPointerWork();
    cancelTokenLookup();
    if (placementRaf) cancelAnimationFrame(placementRaf);
    placementRaf = 0;
    locked = false;
    inspected = null;
    tokenAnalysis = null;
    selectedResource = null;
    [hoverPreview, distanceReadout, distanceXGuide, distanceYGuide, marginLayer, overlay, borderLayer, paddingLayer, contentLayer, childGapLayer, panel, detailTooltip].forEach((layer) => { if (layer) layer.style.display = "none"; });
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
  function apply(next) { settings = { ...DEFAULTS, ...next }; if (isActive()) createUI(); else hide(); }
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "style-scope:update") {
      apply(message.settings);
    }
  });
  chrome.storage.onChanged?.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    const patch = Object.fromEntries(Object.entries(changes).map(([key, change]) => [key, change.newValue]));
    apply({ ...settings, ...patch });
  });
  chrome.storage.local.get(DEFAULTS, apply);
})();
