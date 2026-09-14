import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const koffi = require("koffi");
const { deflateSync } = require("node:zlib");

const shell32 = koffi.load("shell32.dll");
const user32 = koffi.load("user32.dll");
const gdi32 = koffi.load("gdi32.dll");

const BITMAPINFOHEADER = koffi.struct("PACKRAT_BITMAPINFOHEADER", {
  biSize: "uint32_t",
  biWidth: "long",
  biHeight: "long",
  biPlanes: "uint16_t",
  biBitCount: "uint16_t",
  biCompression: "uint32_t",
  biSizeImage: "uint32_t",
  biXPelsPerMeter: "long",
  biYPelsPerMeter: "long",
  biClrUsed: "uint32_t",
  biClrImportant: "uint32_t",
});

const SHGetFileInfoW = shell32.func(
  "uintptr_t __stdcall SHGetFileInfoW(const uint16_t *pszPath, unsigned long dwFileAttributes, _Out_ void *psfi, unsigned int cbFileInfo, unsigned int uFlags)"
);
const DestroyIcon = user32.func("bool __stdcall DestroyIcon(void *hIcon)");
const DrawIconEx = user32.func(
  "bool __stdcall DrawIconEx(void *hdc, int xLeft, int yTop, void *hIcon, int cxWidth, int cyWidth, unsigned int istepIfAniCur, void *hbrFlickerFreeDraw, unsigned int diFlags)"
);
const CreateCompatibleDC = gdi32.func("void * __stdcall CreateCompatibleDC(void *hdc)");
const DeleteDC = gdi32.func("bool __stdcall DeleteDC(void *hdc)");
const CreateDIBSection = gdi32.func(
  "void * __stdcall CreateDIBSection(void *hdc, const PACKRAT_BITMAPINFOHEADER *pbmi, unsigned int usage, _Out_ void **ppvBits, void *hSection, unsigned long offset)"
);
const SelectObject = gdi32.func("void * __stdcall SelectObject(void *hdc, void *h)");
const DeleteObject = gdi32.func("bool __stdcall DeleteObject(void *ho)");
const GetDIBits = gdi32.func(
  "int __stdcall GetDIBits(void *hdc, void *hbmp, unsigned int start, unsigned int cLines, _Out_ void *lpvBits, _Inout_ PACKRAT_BITMAPINFOHEADER *lpbi, unsigned int usage)"
);

const SHGFI_ICON = 0x00000100;
const SHGFI_LARGEICON = 0x00000000;
const DI_NORMAL = 0x0003;
const DIB_RGB_COLORS = 0;
const BI_RGB = 0;
const ICON_SIZE = 32;
const SHFILEINFOW_SIZE_X64 = 696;
const CACHE_LIMIT = 256;

const cache = new Map();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBytes, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([length, typeBytes, data, crc]);
}

function encodePngRgba(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rowBytes = width * 4;
  const raw = Buffer.alloc((rowBytes + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const dst = y * (rowBytes + 1);
    raw[dst] = 0;
    rgba.copy(raw, dst + 1, y * rowBytes, (y + 1) * rowBytes);
  }

  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw, { level: 6 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function pathBuffer(value) {
  return Buffer.from(`${value}\0`, "utf16le");
}

function extractHicon(executablePath) {
  if (process.arch !== "x64") return null;
  const info = Buffer.alloc(SHFILEINFOW_SIZE_X64);
  const result = SHGetFileInfoW(
    pathBuffer(executablePath),
    0,
    info,
    info.length,
    SHGFI_ICON | SHGFI_LARGEICON
  );
  if (!result) return null;
  const address = info.readBigUInt64LE(0);
  return address === 0n ? null : address;
}

function renderHiconToPng(hIcon) {
  const dc = CreateCompatibleDC(null);
  if (!dc) return null;

  const header = {
    biSize: koffi.sizeof(BITMAPINFOHEADER),
    biWidth: ICON_SIZE,
    biHeight: -ICON_SIZE,
    biPlanes: 1,
    biBitCount: 32,
    biCompression: BI_RGB,
    biSizeImage: ICON_SIZE * ICON_SIZE * 4,
    biXPelsPerMeter: 0,
    biYPelsPerMeter: 0,
    biClrUsed: 0,
    biClrImportant: 0,
  };

  const bitsPointer = [null];
  const bitmap = CreateDIBSection(dc, header, DIB_RGB_COLORS, bitsPointer, null, 0);
  if (!bitmap) {
    DeleteDC(dc);
    return null;
  }

  const previous = SelectObject(dc, bitmap);
  try {
    if (!DrawIconEx(dc, 0, 0, hIcon, ICON_SIZE, ICON_SIZE, 0, null, DI_NORMAL)) {
      return null;
    }
  } finally {
    if (previous) SelectObject(dc, previous);
  }

  try {
    const bgra = Buffer.alloc(ICON_SIZE * ICON_SIZE * 4);
    const readHeader = { ...header };
    if (GetDIBits(dc, bitmap, 0, ICON_SIZE, bgra, readHeader, DIB_RGB_COLORS) !== ICON_SIZE) {
      return null;
    }

    const rgba = Buffer.alloc(bgra.length);
    let anyAlpha = false;
    let anyRgb = false;
    for (let i = 0; i < bgra.length; i += 4) {
      const b = bgra[i];
      const g = bgra[i + 1];
      const r = bgra[i + 2];
      const a = bgra[i + 3];
      rgba[i] = r;
      rgba[i + 1] = g;
      rgba[i + 2] = b;
      rgba[i + 3] = a;
      if (a !== 0) anyAlpha = true;
      if (r !== 0 || g !== 0 || b !== 0) anyRgb = true;
    }

    if (!anyRgb && !anyAlpha) return null;

    // Some legacy icons render RGB correctly but leave the alpha byte at zero.
    // Preserve transparency where possible while still avoiding an invisible icon.
    if (!anyAlpha) {
      for (let i = 0; i < rgba.length; i += 4) {
        rgba[i + 3] = (rgba[i] || rgba[i + 1] || rgba[i + 2]) ? 255 : 0;
      }
    }

    return encodePngRgba(ICON_SIZE, ICON_SIZE, rgba);
  } finally {
    DeleteObject(bitmap);
    DeleteDC(dc);
  }
}

function remember(key, value) {
  if (cache.size >= CACHE_LIMIT && !cache.has(key)) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, value);
  return value;
}

export function iconDataUriForExecutable(executablePath) {
  const path = String(executablePath || "").trim();
  if (!path) return "";
  const key = path.toLowerCase();
  if (cache.has(key)) return cache.get(key);

  let icon = null;
  try {
    icon = extractHicon(path);
    if (!icon) return remember(key, "");
    const png = renderHiconToPng(icon);
    if (!png) return remember(key, "");
    return remember(key, `data:image/png;base64,${png.toString("base64")}`);
  } catch {
    return remember(key, "");
  } finally {
    if (icon) {
      try { DestroyIcon(icon); } catch {}
    }
  }
}
