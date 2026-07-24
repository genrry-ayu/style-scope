chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target !== "offscreen" || message?.type !== "style-scope:write-image") return;
  writeImage(message)
    .then(sendResponse)
    .catch((error) => sendResponse({
      ok: false,
      code: error?.code || (error?.name === "NotAllowedError" ? "clipboard" : "format"),
      error: error?.message || "图片写入剪贴板失败"
    }));
  return true;
});

function copyError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function base64Bytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function blobDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(copyError("format", "原始图片无法生成剪贴板表示"));
    reader.readAsDataURL(blob);
  });
}

function canvasBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(copyError("format", "无法生成 PNG 兼容图片")), "image/png");
  });
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
  } finally {
    bitmap?.close?.();
  }
}

async function clipboardRepresentations(blob, mime) {
  const representations = {};
  let clipboardMime = mime;
  let originalPreserved = false;

  if (clipboardSupports(mime)) {
    representations[mime] = blob;
    originalPreserved = true;
  } else if (clipboardSupports(`web ${mime}`)) {
    representations[`web ${mime}`] = blob;
    originalPreserved = true;
  }

  const dataUrl = await blobDataUrl(blob);
  representations["text/html"] = new Blob([`<img src="${dataUrl}" alt="" />`], { type: "text/html" });
  originalPreserved = true;

  if (mime === "image/svg+xml") {
    representations["text/plain"] = new Blob([await blob.text()], { type: "text/plain" });
  }

  if (!representations[mime] && mime !== "image/png") {
    representations["image/png"] = await pngFromImageBlob(blob);
    clipboardMime = "image/png";
  }

  return { representations, clipboardMime, originalPreserved };
}

async function writeImage(message) {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    throw copyError("clipboard", "当前浏览器未开放图片剪贴板");
  }
  const blob = new Blob([base64Bytes(message.base64)], { type: message.mime });
  const result = await clipboardRepresentations(blob, message.mime);
  await navigator.clipboard.write([new ClipboardItem(result.representations, { presentationStyle: "inline" })]);
  return { ok: true, clipboardMime: result.clipboardMime, originalPreserved: result.originalPreserved };
}
