// Generates minimal PNG icon files for the plugin
// A minimal valid 40x40 PNG with a dark background and simple design

import { writeFileSync, mkdirSync } from "fs";

// Minimal PNG generator - creates a solid color PNG
function createPng(width, height, r, g, b) {
  const crc32Table = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crc32Table[i] = c;
  }

  function crc32(data, offset = 0, length = data.length) {
    let crc = 0xffffffff;
    for (let i = offset; i < offset + length; i++) {
      crc = crc32Table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function adler32(data) {
    let s1 = 1, s2 = 0;
    for (const b of data) {
      s1 = (s1 + b) % 65521;
      s2 = (s2 + s1) % 65521;
    }
    return (s2 << 16) | s1;
  }

  function chunk(type, data) {
    const typeBytes = Buffer.from(type, "ascii");
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const crcInput = Buffer.concat([typeBytes, data]);
    const crcVal = Buffer.alloc(4);
    crcVal.writeUInt32BE(crc32(crcInput));
    return Buffer.concat([len, typeBytes, data, crcVal]);
  }

  // Build raw image data (filter byte 0 = None per scanline)
  const rawRows = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 3);
    row[0] = 0; // filter type None
    for (let x = 0; x < width; x++) {
      row[1 + x * 3] = r;
      row[2 + x * 3] = g;
      row[3 + x * 3] = b;
    }
    rawRows.push(row);
  }
  const raw = Buffer.concat(rawRows);

  // zlib compress (deflate with store method for simplicity)
  // Use a simple zlib wrapper with no compression (type 0 block)
  const deflate = deflateStore(raw);

  const IHDR_data = Buffer.alloc(13);
  IHDR_data.writeUInt32BE(width, 0);
  IHDR_data.writeUInt32BE(height, 4);
  IHDR_data[8] = 8; // bit depth
  IHDR_data[9] = 2; // color type RGB
  IHDR_data[10] = 0; // compression
  IHDR_data[11] = 0; // filter
  IHDR_data[12] = 0; // interlace

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    chunk("IHDR", IHDR_data),
    chunk("IDAT", deflate),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function deflateStore(data) {
  // zlib header (no compression)
  const zlibHeader = Buffer.from([0x78, 0x01]);

  // Split into 65535-byte blocks
  const blocks = [];
  let offset = 0;
  while (offset < data.length) {
    const end = Math.min(offset + 65535, data.length);
    const chunk = data.slice(offset, end);
    const isLast = end >= data.length;
    const header = Buffer.alloc(5);
    header[0] = isLast ? 1 : 0;
    header.writeUInt16LE(chunk.length, 1);
    header.writeUInt16LE(~chunk.length & 0xffff, 3);
    blocks.push(header, chunk);
    offset = end;
  }

  const adler = adler32_(data);
  const adlerBuf = Buffer.alloc(4);
  adlerBuf.writeUInt32BE(adler);

  return Buffer.concat([zlibHeader, ...blocks, adlerBuf]);
}

function adler32_(data) {
  let s1 = 1, s2 = 0;
  for (const b of data) {
    s1 = (s1 + b) % 65521;
    s2 = (s2 + s1) % 65521;
  }
  return ((s2 << 16) | s1) >>> 0;
}

const base = "com.matchcenter.streamdeck.sdPlugin";

// Plugin icon (dark background, green accent) - 72x72
const pluginIcon = createPng(72, 72, 15, 15, 15);
writeFileSync(`${base}/imgs/plugin.png`, pluginIcon);
writeFileSync(`${base}/imgs/plugin@2x.png`, createPng(144, 144, 15, 15, 15));

// Category icon
writeFileSync(`${base}/imgs/category.png`, createPng(72, 72, 15, 15, 15));
writeFileSync(`${base}/imgs/category@2x.png`, createPng(144, 144, 15, 15, 15));

// Action key icon - dark with green tint
mkdirSync(`${base}/imgs/actions/livescore`, { recursive: true });
writeFileSync(`${base}/imgs/actions/livescore/key.png`, createPng(72, 72, 0, 30, 20));
writeFileSync(`${base}/imgs/actions/livescore/key@2x.png`, createPng(144, 144, 0, 30, 20));

console.log("Icons generated.");
