import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const root = process.cwd();
const plugin = path.join(root, "com.packrat.internet-health-pro.sdPlugin");
const sourceUi = path.join(root, "ui");
const targetUi = path.join(plugin, "ui");
fs.mkdirSync(path.join(plugin, "bin"), { recursive: true });
fs.rmSync(targetUi, { recursive: true, force: true });
fs.cpSync(sourceUi, targetUi, { recursive: true });

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type, "ascii");
  const body = Buffer.concat([name, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  return Buffer.concat([length, body, crc]);
}
function makePng(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const set = (x, y, r, g, b, a = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = a;
  };
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) set(x, y, 7, 9, 13);
  for (let y = 0; y < size; y += 1) for (let x = 0; x < Math.ceil(size * .055); x += 1) set(x, y, 43, 232, 106);

  const cx = Math.round(size * .54);
  const cy = Math.round(size * .58);
  const drawDot = (x, y, radius, color) => {
    for (let yy = -radius; yy <= radius; yy += 1) for (let xx = -radius; xx <= radius; xx += 1) {
      if (xx * xx + yy * yy <= radius * radius) set(x + xx, y + yy, ...color);
    }
  };
  const white = [244, 246, 248], green = [43, 232, 106];
  for (const [radius, width] of [[.31,.018],[.22,.020],[.13,.022]]) {
    const r = size * radius, w = Math.max(2, Math.round(size * width));
    for (let deg = 215; deg <= 325; deg += .7) {
      const angle = deg * Math.PI / 180;
      drawDot(Math.round(cx + r * Math.cos(angle)), Math.round(cy + r * Math.sin(angle)), w, white);
    }
  }
  drawDot(cx, Math.round(size * .76), Math.max(3, Math.round(size * .035)), green);

  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    rgba.copy(raw, row + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

const pluginIconDir = path.join(plugin, "imgs", "plugin");
fs.mkdirSync(pluginIconDir, { recursive: true });
fs.writeFileSync(path.join(pluginIconDir, "icon.png"), makePng(256));
fs.writeFileSync(path.join(pluginIconDir, "icon@2x.png"), makePng(512));
