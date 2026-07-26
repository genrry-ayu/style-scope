import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "icons");
const gold = [241, 184, 74];
const ink = [23, 24, 22];
const rim = [59, 60, 54];
const cream = [243, 239, 231];

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type);
  const body = Buffer.concat([typeBytes, data]);
  const header = Buffer.alloc(4);
  const footer = Buffer.alloc(4);
  header.writeUInt32BE(data.length);
  footer.writeUInt32BE(crc32(body));
  return Buffer.concat([header, body, footer]);
}

function writePng(path, size, pixels) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0;
    Buffer.from(pixels.buffer, pixels.byteOffset + y * size * 4, size * 4).copy(raw, y * (size * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  writeFileSync(path, Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
}

function render(size) {
  const px = new Uint8Array(size * size * 4);
  const scale = size / 128;
  const blend = (x, y, colour, alpha = 1) => {
    if (x < 0 || y < 0 || x >= size || y >= size || alpha <= 0) return;
    const index = (Math.floor(y) * size + Math.floor(x)) * 4;
    const destinationAlpha = px[index + 3] / 255;
    const outputAlpha = alpha + destinationAlpha * (1 - alpha);
    for (let channel = 0; channel < 3; channel += 1) px[index + channel] = Math.round((colour[channel] * alpha + px[index + channel] * destinationAlpha * (1 - alpha)) / outputAlpha);
    px[index + 3] = Math.round(outputAlpha * 255);
  };
  const fillRounded = (left, top, width, height, radius, colour) => {
    const r = radius * scale;
    const l = left * scale;
    const t = top * scale;
    const w = width * scale;
    const h = height * scale;
    for (let y = Math.floor(t); y < Math.ceil(t + h); y += 1) for (let x = Math.floor(l); x < Math.ceil(l + w); x += 1) {
      const nearestX = Math.max(l + r, Math.min(x + .5, l + w - r));
      const nearestY = Math.max(t + r, Math.min(y + .5, t + h - r));
      if (Math.hypot(x + .5 - nearestX, y + .5 - nearestY) <= r) blend(x, y, colour);
    }
  };
  const line = (x1, y1, x2, y2, width, colour) => {
    const ax = x1 * scale;
    const ay = y1 * scale;
    const bx = x2 * scale;
    const by = y2 * scale;
    const radius = width * scale / 2;
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSq = dx * dx + dy * dy;
    const left = Math.floor(Math.min(ax, bx) - radius - 1);
    const right = Math.ceil(Math.max(ax, bx) + radius + 1);
    const top = Math.floor(Math.min(ay, by) - radius - 1);
    const bottom = Math.ceil(Math.max(ay, by) + radius + 1);
    for (let y = top; y <= bottom; y += 1) for (let x = left; x <= right; x += 1) {
      const progress = Math.max(0, Math.min(1, ((x + .5 - ax) * dx + (y + .5 - ay) * dy) / lengthSq));
      const distance = Math.hypot(x + .5 - (ax + dx * progress), y + .5 - (ay + dy * progress));
      blend(x, y, colour, Math.max(0, Math.min(1, radius + .7 - distance)));
    }
  };
  const fillDiamond = (centerX, centerY, radius, colour) => {
    const cx = centerX * scale;
    const cy = centerY * scale;
    const r = radius * scale;
    for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y += 1) for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x += 1) {
      const distance = Math.abs(x + .5 - cx) + Math.abs(y + .5 - cy);
      blend(x, y, colour, Math.max(0, Math.min(1, r + .7 - distance)));
    }
  };
  fillRounded(0, 0, 128, 128, 28, ink);
  line(10, 28, 28, 10, 2, rim); line(100, 10, 118, 28, 2, rim);
  line(118, 100, 100, 118, 2, rim); line(28, 118, 10, 100, 2, rim);
  const diamond = (radius, width, colour) => {
    line(64, 64 - radius, 64 + radius, 64, width, colour);
    line(64 + radius, 64, 64, 64 + radius, width, colour);
    line(64, 64 + radius, 64 - radius, 64, width, colour);
    line(64 - radius, 64, 64, 64 - radius, width, colour);
  };
  diamond(49, 5, gold);
  diamond(29, 3, gold);
  fillDiamond(64, 64, 9, cream);
  return px;
}

mkdirSync(output, { recursive: true });
for (const size of [16, 32, 48, 128]) writePng(resolve(output, `icon${size}.png`), size, render(size));
