import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";
import { resolve } from "node:path";

const root = resolve(".");
const plugin = resolve(root, "com.packrat.hwinfo-sensor-monitor.sdPlugin");
const imgs = resolve(plugin, "imgs");
const ui = resolve(plugin, "ui");
const bin = resolve(plugin, "bin");
await rm(imgs, { recursive: true, force: true });
await rm(ui, { recursive: true, force: true });
await rm(bin, { recursive: true, force: true });
await mkdir(imgs, { recursive: true });
await mkdir(ui, { recursive: true });
await mkdir(bin, { recursive: true });
for (const file of ["inspector.html","inspector.css","inspector.js"]) await cp(resolve(root, "ui", file), resolve(ui, file));

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type, "ascii"), body = Buffer.concat([name, data]), out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0); name.copy(out, 4); data.copy(out, 8); out.writeUInt32BE(crc32(body), 8 + data.length); return out;
}
function png(size, paint) {
  const px = Buffer.alloc(size * size * 4);
  const put = (x,y,color) => { x=Math.floor(x); y=Math.floor(y); if(x<0||y<0||x>=size||y>=size)return; px.set(color,(y*size+x)*4); };
  const circle=(cx,cy,r,color)=>{for(let y=cy-r;y<=cy+r;y++)for(let x=cx-r;x<=cx+r;x++)if((x-cx)**2+(y-cy)**2<=r*r)put(x,y,color);};
  const line=(x0,y0,x1,y1,w,color)=>{const steps=Math.max(1,Math.ceil(Math.hypot(x1-x0,y1-y0)));for(let i=0;i<=steps;i++){const t=i/steps;circle(x0+(x1-x0)*t,y0+(y1-y0)*t,w/2,color);}};
  for(let i=0;i<px.length;i+=4)px.set([9,11,16,255],i);
  paint({put,circle,line,s:size/256});
  const raw=Buffer.alloc((size*4+1)*size);
  for(let y=0;y<size;y++){const row=y*(size*4+1);raw[row]=0;px.copy(raw,row+1,y*size*4,(y+1)*size*4);}
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(size,0);ihdr.writeUInt32BE(size,4);ihdr[8]=8;ihdr[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk("IHDR",ihdr),chunk("IDAT",deflateSync(raw,{level:9})),chunk("IEND",Buffer.alloc(0))]);
}
function monitorPaint({circle,line,s}) {
  const orange=[255,178,30,255], white=[244,246,248,255], green=[43,232,106,255];
  line(42*s,191*s,42*s,73*s,9*s,white); line(42*s,191*s,215*s,191*s,9*s,white);
  line(55*s,159*s,85*s,135*s,11*s,green); line(85*s,135*s,113*s,147*s,11*s,green); line(113*s,147*s,145*s,93*s,11*s,green); line(145*s,93*s,177*s,113*s,11*s,green); line(177*s,113*s,215*s,61*s,11*s,green);
  circle(215*s,61*s,12*s,orange);
}
function logoPaint({circle,line,s}) {
  const orange=[255,178,30,255], white=[244,246,248,255];
  circle(128*s,128*s,91*s,orange); circle(128*s,128*s,69*s,[13,16,21,255]);
  line(87*s,172*s,87*s,82*s,15*s,white); line(87*s,82*s,137*s,82*s,15*s,white); line(137*s,82*s,164*s,108*s,15*s,white); line(164*s,108*s,137*s,134*s,15*s,white); line(137*s,134*s,87*s,134*s,15*s,white);
}
await mkdir(resolve(imgs,"plugin"),{recursive:true});
await writeFile(resolve(imgs,"plugin","icon.png"), png(256,monitorPaint));
await writeFile(resolve(imgs,"plugin","icon@2x.png"), png(512,monitorPaint));
await writeFile(resolve(imgs,"plugin","packrat-logo.png"), png(96,logoPaint));

await mkdir(resolve(imgs,"category"),{recursive:true});
const category = (size) => '<svg xmlns="http://www.w3.org/2000/svg" width="'+size+'" height="'+size+'" viewBox="0 0 28 28" fill="none"><path d="M3 22V7M3 22h22M6 18l4-4 4 2 4-7 3 3 4-6" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
await writeFile(resolve(imgs,"category","icon.svg"),category(28));
await writeFile(resolve(imgs,"category","icon@2x.svg"),category(56));

const glyphs = {
  sensor:'<circle cx="72" cy="72" r="37" stroke="COLOR" stroke-width="9" fill="none"/><path d="M72 38v34l25 15" stroke="COLOR" stroke-width="9" stroke-linecap="round"/>',
  graph:'<path d="M22 105l25-24 25 12 27-50 22 29 17-23" stroke="COLOR" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  dashboard:'<rect x="26" y="29" width="92" height="86" rx="10" stroke="COLOR" stroke-width="8" fill="none"/><path d="M39 53h27M39 72h48M39 91h36" stroke="COLOR" stroke-width="8" stroke-linecap="round"/>',
  alert:'<path d="M72 24l50 92H22L72 24z" stroke="COLOR" stroke-width="8" fill="none" stroke-linejoin="round"/><path d="M72 55v30" stroke="COLOR" stroke-width="9" stroke-linecap="round"/><circle cx="72" cy="101" r="6" fill="COLOR"/>'
};
for (const [kind,glyph] of Object.entries(glyphs)) {
  const dir=resolve(imgs,"actions",kind); await mkdir(dir,{recursive:true});
  const side='<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 144 144">'+glyph.replaceAll("COLOR","#fff")+'</svg>';
  const key='<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144"><rect width="144" height="144" rx="24" fill="#090B10"/>'+glyph.replaceAll("COLOR","#2BE86A")+'</svg>';
  await writeFile(resolve(dir,"icon.svg"),side);
  await writeFile(resolve(dir,"key.svg"),key);
  if(kind==="dashboard"){
    await writeFile(resolve(dir,"encoder.svg"),'<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 144 144">'+glyph.replaceAll("COLOR","#fff")+'</svg>');
    await writeFile(resolve(dir,"encoder@2x.svg"),'<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">'+glyph.replaceAll("COLOR","#fff")+'</svg>');
  }
}
console.log("Built deterministic HWiNFO Monitor runtime assets.");
