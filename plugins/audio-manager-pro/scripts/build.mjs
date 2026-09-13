import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const plugin = resolve(root, "com.packrat.audio-manager-pro.sdPlugin");
const bin = resolve(plugin, "bin");
const imgs = resolve(plugin, "imgs");
const uiOut = resolve(plugin, "ui");
const nativeOut = resolve(plugin, "native", "win-x64");

for (const debugFile of ["PackRat.AudioCore.pdb", "PackRat.AudioManager.Helper.pdb"]) {
  await rm(resolve(nativeOut, debugFile), { force: true });
}

await rm(bin, { recursive: true, force: true });
await rm(imgs, { recursive: true, force: true });
await rm(uiOut, { recursive: true, force: true });
await mkdir(bin, { recursive: true });
await mkdir(imgs, { recursive: true });
await mkdir(uiOut, { recursive: true });
await cp(resolve(root, "ui", "inspector.html"), resolve(uiOut, "inspector.html"));
await cp(resolve(root, "ui", "inspector.css"), resolve(uiOut, "inspector.css"));
await cp(resolve(root, "ui", "inspector.js"), resolve(uiOut, "inspector.js"));

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
  const bg = [9, 12, 18, 255], fg = [245, 247, 250, 255], accent = [86, 242, 165, 255];
  for (let i = 0; i < pixels.length; i += 4) pixels.set(bg, i);
  const set = (x, y, color) => {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    pixels.set(color, (y * size + x) * 4);
  };
  const rect = (x0,y0,x1,y1,color) => {
    for (let y=Math.floor(y0); y<=Math.ceil(y1); y++) for (let x=Math.floor(x0); x<=Math.ceil(x1); x++) set(x,y,color);
  };
  const circle = (cx,cy,r,color) => {
    for (let y=Math.floor(cy-r); y<=Math.ceil(cy+r); y++) for (let x=Math.floor(cx-r); x<=Math.ceil(cx+r); x++) {
      if ((x-cx)**2+(y-cy)**2<=r*r) set(x,y,color);
    }
  };
  const s=size/256;
  rect(42*s,64*s,214*s,76*s,fg); rect(42*s,122*s,214*s,134*s,fg); rect(42*s,180*s,214*s,192*s,fg);
  circle(94*s,70*s,20*s,accent); circle(166*s,128*s,20*s,accent); circle(116*s,186*s,20*s,accent);
  const raw=Buffer.alloc((size*4+1)*size);
  for(let y=0;y<size;y++){const row=y*(size*4+1); raw[row]=0; pixels.copy(raw,row+1,y*size*4,(y+1)*size*4);}
  const ihdr=Buffer.alloc(13); ihdr.writeUInt32BE(size,0); ihdr.writeUInt32BE(size,4); ihdr[8]=8; ihdr[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),pngChunk("IHDR",ihdr),pngChunk("IDAT",deflateSync(raw,{level:9})),pngChunk("IEND",Buffer.alloc(0))]);
}

const pluginDir=resolve(imgs,"plugin");
await mkdir(pluginDir,{recursive:true});
await writeFile(resolve(pluginDir,"icon.png"),iconPng(256));
await writeFile(resolve(pluginDir,"icon@2x.png"),iconPng(512));

const categoryDir=resolve(imgs,"category");
await mkdir(categoryDir,{recursive:true});
const category=(size)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 28 28" fill="none"><path d="M5 7h18M5 14h18M5 21h18" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><circle cx="10" cy="7" r="2.7" fill="#fff"/><circle cx="18" cy="14" r="2.7" fill="#fff"/><circle cx="12" cy="21" r="2.7" fill="#fff"/></svg>`;
await writeFile(resolve(categoryDir,"icon.svg"),category(28));
await writeFile(resolve(categoryDir,"icon@2x.svg"),category(56));

const kinds=["apply","set-output","set-input","cycle","status","mute-mic","volume"];
function glyph(kind,color="#fff") {
  if(kind==="set-output") return `<path d="M34 61h23l25-20v62L57 83H34z" fill="none" stroke="${color}" stroke-width="8" stroke-linejoin="round"/><path d="M94 56c9 9 9 23 0 32M104 47c15 15 15 35 0 50" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round"/>`;
  if(kind==="set-input"||kind==="mute-mic") return `<rect x="60" y="30" width="24" height="51" rx="12" fill="none" stroke="${color}" stroke-width="8"/><path d="M48 70c0 18 10 28 24 28s24-10 24-28M72 98v18M57 116h30" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round"/>`;
  if(kind==="cycle") return `<path d="M39 53a43 43 0 0169 4l9 12M117 69V44M117 69H92M105 91a43 43 0 01-69-4l-9-12M27 75v25M27 75h25" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`;
  if(kind==="status") return `<circle cx="72" cy="72" r="43" fill="none" stroke="${color}" stroke-width="8"/><path d="M48 73l16 16 33-35" fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`;
  if(kind==="volume") return `<path d="M34 61h23l25-20v62L57 83H34z" fill="none" stroke="${color}" stroke-width="8" stroke-linejoin="round"/><path d="M100 42v60M91 53h18M91 91h18" stroke="${color}" stroke-width="7" stroke-linecap="round"/>`;
  return `<rect x="33" y="36" width="78" height="72" rx="16" fill="none" stroke="${color}" stroke-width="8"/><path d="M48 58h48M48 74h48M48 90h31" stroke="${color}" stroke-width="7" stroke-linecap="round"/>`;
}
for(const kind of kinds){
  const dir=resolve(imgs,"actions",kind); await mkdir(dir,{recursive:true});
  const small=(size)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 144 144">${glyph(kind)}</svg>`;
  const key=(size)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 144 144"><rect width="144" height="144" rx="25" fill="#090C12"/>${glyph(kind,"#56F2A5")}</svg>`;
  await writeFile(resolve(dir,"icon.svg"),small(20)); await writeFile(resolve(dir,"icon@2x.svg"),small(40));
  await writeFile(resolve(dir,"key.svg"),key(72)); await writeFile(resolve(dir,"key@2x.svg"),key(144));
  if(kind==="volume"){ await writeFile(resolve(dir,"encoder.svg"),small(72)); await writeFile(resolve(dir,"encoder@2x.svg"),small(144)); }
}
console.log("Built Audio Manager Pro UI and Stream Deck assets");
