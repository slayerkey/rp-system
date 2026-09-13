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
  const releaseUrl = "https://api.github.com/repos/GameTechDev/PresentMon/releases/tags/v2.5.1";
  const response = await fetch(releaseUrl, { headers: { "User-Agent": "PackRat-Performance-Grapher-Build", "Accept": "application/vnd.github+json" } });
  if (!response.ok) throw new Error("PresentMon release metadata failed: HTTP " + response.status);
  const release = await response.json();
  const assets = Array.isArray(release.assets) ? release.assets : [];
  const scored = assets.map((asset) => {
    const name = String(asset.name || "");
    let score = 0;
    if (/console/i.test(name)) score += 100;
    if (/presentmon/i.test(name)) score += 50;
    if (/x64|win64|windows/i.test(name)) score += 20;
    if (/\.zip$/i.test(name)) score += 15;
    if (/\.exe$/i.test(name)) score += 5;
    if (/setup|installer|msi/i.test(name)) score -= 80;
    return { asset, score };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
  if (!scored.length) throw new Error("No PresentMon v2.5.1 binary release asset found.");

  const work = resolve(root, ".presentmon-build");
  await rm(work, { recursive: true, force: true });
  await mkdir(work, { recursive: true });

  let chosen = null;
  let sourceAsset = null;
  for (const item of scored) {
    const asset = item.asset;
    const url = asset.browser_download_url;
    if (!url) continue;
    const download = await fetch(url, { headers: { "User-Agent": "PackRat-Performance-Grapher-Build" } });
    if (!download.ok) continue;
    const bytes = Buffer.from(await download.arrayBuffer());
    const assetPath = resolve(work, String(asset.name || "presentmon.bin"));
    await writeFile(assetPath, bytes);

    let searchRoot = work;
    if (/\.zip$/i.test(assetPath)) {
      const expanded = resolve(work, "expanded-" + scored.indexOf(item));
      await mkdir(expanded, { recursive: true });
      const ps = spawnSync("powershell.exe", ["-NoLogo", "-NoProfile", "-Command", "Expand-Archive -LiteralPath '" + assetPath.replaceAll("'", "''") + "' -DestinationPath '" + expanded.replaceAll("'", "''") + "' -Force"], { windowsHide: true, encoding: "utf8" });
      if (ps.status !== 0) continue;
      searchRoot = expanded;
    }

    const candidates = (await walk(searchRoot)).filter((path) => extname(path).toLowerCase() === ".exe" && /presentmon/i.test(path));
    for (const exe of candidates) {
      const help = spawnSync(exe, ["--help"], { windowsHide: true, encoding: "utf8", timeout: 15_000 });
      const text = String(help.stdout || "") + "\n" + String(help.stderr || "");
      if (/output_stdout/i.test(text) && /session_name/i.test(text)) {
        chosen = exe;
        sourceAsset = String(asset.name || "");
        break;
      }
    }
    if (chosen) break;
  }

  if (!chosen) throw new Error("PresentMon v2.5.1 assets did not contain a console executable with --output_stdout and --session_name.");

  const sourceDir = dirname(chosen);
  await cp(sourceDir, pmOut, { recursive: true, force: true });
  const executable = chosen.slice(sourceDir.length + 1);
  const copiedExe = resolve(pmOut, executable);
  const hash = createHash("sha256").update(await readFile(copiedExe)).digest("hex");
  await writeFile(resolve(pmOut, "provider.json"), JSON.stringify({
    version: "2.5.1",
    sourceAsset,
    executable,
    sha256: hash,
    release: "https://github.com/GameTechDev/PresentMon/releases/tag/v2.5.1"
  }, null, 2));
  await writeFile(resolve(pmOut, "SHA256.txt"), hash + "  " + executable + "\n");
  await rm(work, { recursive: true, force: true });
  console.log("Bundled PresentMon " + executable + " from " + sourceAsset + " (" + hash.slice(0, 12) + "...)");
}

await fetchPresentMon();

const nativeFiles = await walk(nativeOut);
if (!nativeFiles.some((path) => /PackRat\.PerformanceTelemetry\.exe$/i.test(path))) {
  throw new Error("Native telemetry publish did not produce PackRat.PerformanceTelemetry.exe");
}
console.log("Built Performance Grapher assets, telemetry providers, UI, and licenses.");
