import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { deflateSync } from "node:zlib";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const plugin = resolve(root, "com.packrat.performance-grapher.sdPlugin");
const bin = resolve(plugin, "bin");
const imgs = resolve(plugin, "imgs");
const uiOut = resolve(plugin, "ui");
const nativeOut = resolve(plugin, "native", "telemetry");
const pmOut = resolve(plugin, "third_party", "presentmon");
const licensesOut = resolve(plugin, "licenses");

await rm(bin, { recursive: true, force: true });
await rm(imgs, { recursive: true, force: true });
await rm(uiOut, { recursive: true, force: true });
await rm(nativeOut, { recursive: true, force: true });
await rm(pmOut, { recursive: true, force: true });
await rm(licensesOut, { recursive: true, force: true });
for (const dir of [bin, imgs, uiOut, nativeOut, pmOut, licensesOut]) await mkdir(dir, { recursive: true });

for (const name of ["inspector.html", "inspector.css", "inspector.js"]) {
  await cp(resolve(root, "ui", name), resolve(uiOut, name));
}
await cp(resolve(root, "THIRD_PARTY_NOTICES.md"), resolve(licensesOut, "THIRD_PARTY_NOTICES.md"));
await cp(resolve(root, "licenses", "LibreHardwareMonitor-MPL-2.0.txt"), resolve(licensesOut, "LibreHardwareMonitor-MPL-2.0.txt"));
await cp(resolve(root, "licenses", "LibreHardwareMonitor-THIRD-PARTY-NOTICES.txt"), resolve(licensesOut, "LibreHardwareMonitor-THIRD-PARTY-NOTICES.txt"));
await cp(resolve(root, "licenses", "PresentMon-MIT-v2.5.1.txt"), resolve(licensesOut, "PresentMon-MIT-v2.5.1.txt"));

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit", windowsHide: true, ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(command + " failed with exit code " + result.status);
  return result;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const name = Buffer.from(type, "ascii");
  const body = Buffer.concat([name, data]);
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  name.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(body), 8 + data.length);
  return chunk;
}

function iconPng(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const bg = [9, 11, 16, 255];
  const fg = [244, 246, 248, 255];
  const accent = [43, 232, 106, 255];
  for (let i = 0; i < pixels.length; i += 4) pixels.set(bg, i);
  const set = (x, y, color) => {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    pixels.set(color, (y * size + x) * 4);
  };
  const circle = (cx, cy, r, color) => {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y += 1) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x += 1) {
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r ** 2) set(x, y, color);
      }
    }
  };
  const line = (x0, y0, x1, y1, width, color) => {
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      circle(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, width / 2, color);
    }
  };
  const s = size / 256;
  line(38*s, 181*s, 70*s, 151*s, 12*s, accent);
  line(70*s, 151*s, 101*s, 164*s, 12*s, accent);
  line(101*s, 164*s, 133*s, 94*s, 12*s, accent);
  line(133*s, 94*s, 164*s, 128*s, 12*s, accent);
  line(164*s, 128*s, 218*s, 57*s, 12*s, accent);
  line(38*s, 204*s, 218*s, 204*s, 8*s, fg);
  circle(218*s, 57*s, 13*s, fg);

  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    pixels.copy(raw, row + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const signature = Buffer.from([137,80,78,71,13,10,26,10]);
  return Buffer.concat([signature, pngChunk("IHDR", ihdr), pngChunk("IDAT", deflateSync(raw, { level: 9 })), pngChunk("IEND", Buffer.alloc(0))]);
}

const pluginDir = resolve(imgs, "plugin");
await mkdir(pluginDir, { recursive: true });
await writeFile(resolve(pluginDir, "icon.png"), iconPng(256));
await writeFile(resolve(pluginDir, "icon@2x.png"), iconPng(512));

const categoryDir = resolve(imgs, "category");
await mkdir(categoryDir, { recursive: true });
const categorySvg = (size) => '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 28 28" fill="none"><path d="M3 20l5-5 4 2 5-9 3 4 5-7" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 24h22" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>';
await writeFile(resolve(categoryDir, "icon.svg"), categorySvg(28));
await writeFile(resolve(categoryDir, "icon@2x.svg"), categorySvg(56));

const actionKinds = {
  graph: '<path d="M20 105l24-23 25 11 23-52 24 30 16-21" stroke="COLOR" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  fps: '<path d="M25 92h23l10-37 18 65 16-47 11 19h17" stroke="COLOR" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  session: '<circle cx="72" cy="72" r="43" stroke="COLOR" stroke-width="8" fill="none"/><path d="M72 45v28l20 13" stroke="COLOR" stroke-width="8" fill="none" stroke-linecap="round"/>',
  metric: '<path d="M42 103V67a30 30 0 0160 0v36" stroke="COLOR" stroke-width="8" fill="none"/><path d="M35 103h74" stroke="COLOR" stroke-width="8" stroke-linecap="round"/><circle cx="72" cy="67" r="12" fill="COLOR"/>',
  alert: '<path d="M72 24l50 92H22L72 24z" stroke="COLOR" stroke-width="8" fill="none" stroke-linejoin="round"/><path d="M72 55v30" stroke="COLOR" stroke-width="9" stroke-linecap="round"/><circle cx="72" cy="101" r="6" fill="COLOR"/>',
};
for (const [kind, glyph] of Object.entries(actionKinds)) {
  const dir = resolve(imgs, "actions", kind);
  await mkdir(dir, { recursive: true });
  const small = (size) => '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 144 144">' + glyph.replaceAll("COLOR", "#fff") + '</svg>';
  const key = (size) => '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 144 144"><rect width="144" height="144" rx="25" fill="#090B10"/>' + glyph.replaceAll("COLOR", "#2BE86A") + '</svg>';
  await writeFile(resolve(dir, "icon.svg"), small(20));
  await writeFile(resolve(dir, "icon@2x.svg"), small(40));
  await writeFile(resolve(dir, "key.svg"), key(72));
  await writeFile(resolve(dir, "key@2x.svg"), key(144));
}

console.log("Generating runtime npm license inventory...");
run(process.execPath, [resolve(root, "scripts", "npm-license-inventory.mjs")]);

console.log("Publishing Libre Hardware Monitor telemetry helper...");
run("dotnet", [
  "publish",
  resolve(root, "native", "PackRat.PerformanceTelemetry", "PackRat.PerformanceTelemetry.csproj"),
  "-c", "Release",
  "-r", "win-x64",
  "--self-contained", "true",
  "-p:PublishSingleFile=true",
  "-p:DebugType=None",
  "-p:DebugSymbols=false",
  "-o", nativeOut,
]);

console.log("Generating resolved NuGet license inventory...");
run(process.execPath, [resolve(root, "scripts", "dotnet-license-inventory.mjs")]);

async function walk(directory) {
  const out = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) out.push(...await walk(path));
    else out.push(path);
  }
  return out;
}

async function fetchPresentMon() {
  const url = "https://github.com/GameTechDev/PresentMon/releases/download/v2.5.1/PresentMon-2.5.1-x64.exe";
  const expectedSha256 = "9bec3083069f58f911e6a512f4806db51a27bd096103087bc1d05ef54c80a191";
  const response = await fetch(url, { redirect: "follow", headers: { "User-Agent": "PackRat-Performance-Grapher-Build" } });
  if (!response.ok) throw new Error("PresentMon v2.5.1 download failed: HTTP " + response.status);
  const bytes = Buffer.from(await response.arrayBuffer());
  const actualSha256 = createHash("sha256").update(bytes).digest("hex");
  if (actualSha256 !== expectedSha256) {
    throw new Error("PresentMon v2.5.1 SHA-256 mismatch: expected " + expectedSha256 + ", got " + actualSha256);
  }
  const executable = "PresentMon.exe";
  await writeFile(resolve(pmOut, executable), bytes);
  await writeFile(resolve(pmOut, "provider.json"), JSON.stringify({
    version: "2.5.1",
    sourceAsset: "PresentMon-2.5.1-x64.exe",
    executable,
    sha256: actualSha256,
    release: "https://github.com/GameTechDev/PresentMon/releases/tag/v2.5.1"
  }, null, 2));
  await writeFile(resolve(pmOut, "SHA256.txt"), actualSha256 + "  " + executable + "\n");
  console.log("Bundled checksum-pinned PresentMon 2.5.1 (" + actualSha256.slice(0, 12) + "...)");
}
await fetchPresentMon();

const nativeFiles = await walk(nativeOut);
if (!nativeFiles.some((path) => /PackRat\.PerformanceTelemetry\.exe$/i.test(path))) {
  throw new Error("Native telemetry publish did not produce PackRat.PerformanceTelemetry.exe");
}
console.log("Built Performance Grapher assets, telemetry providers, UI, and licenses.");
