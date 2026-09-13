import { cp, mkdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(here,"..");
const plugin=resolve(root,"com.packrat.macro-recorder-pro.sdPlugin");
for (const dir of ["bin","imgs","ui","helpers"]) await rm(resolve(plugin,dir),{recursive:true,force:true});
for (const dir of ["bin","imgs","ui","helpers"]) await mkdir(resolve(plugin,dir),{recursive:true});
for (const file of ["inspector.html","inspector.css","inspector.js"]) await cp(resolve(root,"ui",file),resolve(plugin,"ui",file));

const helper=process.env.PACKRAT_INPUT_HOST || resolve(root,"..","..","artifacts","input-host","PackRat.InputHost.exe");
try { await stat(helper); } catch { throw new Error("PackRat.InputHost.exe is missing. Publish shared/windows-input/PackRat.InputHost first."); }
await cp(helper,resolve(plugin,"helpers","PackRat.InputHost.exe"));

function crc32(buffer){let crc=0xffffffff;for(const byte of buffer){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return(crc^0xffffffff)>>>0;}
function chunk(type,data){const name=Buffer.from(type);const body=Buffer.concat([name,data]);const out=Buffer.alloc(12+data.length);out.writeUInt32BE(data.length,0);name.copy(out,4);data.copy(out,8);out.writeUInt32BE(crc32(body),8+data.length);return out;}
function png(size,kind){
 const p=Buffer.alloc(size*size*4);const bg=[10,12,17,255],white=[245,247,250,255],green=[53,230,126,255],red=[244,76,86,255];
 for(let i=0;i<p.length;i+=4)p.set(bg,i);
 const set=(x,y,c)=>{x=Math.floor(x);y=Math.floor(y);if(x<0||y<0||x>=size||y>=size)return;p.set(c,(y*size+x)*4);};
 const rect=(x0,y0,x1,y1,c)=>{for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)set(x,y,c);};
 const circle=(cx,cy,r,c)=>{for(let y=Math.floor(cy-r);y<=cy+r;y++)for(let x=Math.floor(cx-r);x<=cx+r;x++)if((x-cx)**2+(y-cy)**2<=r*r)set(x,y,c);};
 const s=size/144;
 if(kind==="record")circle(72*s,72*s,32*s,red);
 else if(kind==="stop")rect(45*s,45*s,99*s,99*s,white);
 else if(kind==="replay"){for(let y=38*s;y<=106*s;y++){const t=(y-38*s)/(68*s);const w=(1-Math.abs(t-.5)*2)*48*s;for(let x=48*s;x<=48*s+w;x++)set(x,y,green);}}
 else { circle(72*s,72*s,47*s,green);rect(66*s,36*s,78*s,108*s,bg);rect(36*s,66*s,108*s,78*s,bg); }
 const raw=Buffer.alloc((size*4+1)*size);for(let y=0;y<size;y++){const row=y*(size*4+1);raw[row]=0;p.copy(raw,row+1,y*size*4,(y+1)*size*4);}
 const ih=Buffer.alloc(13);ih.writeUInt32BE(size,0);ih.writeUInt32BE(size,4);ih[8]=8;ih[9]=6;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk("IHDR",ih),chunk("IDAT",deflateSync(raw,{level:9})),chunk("IEND",Buffer.alloc(0))]);
}
async function pair(dir,kind,base=144){await mkdir(dir,{recursive:true});await writeFile(resolve(dir,"icon.png"),png(base,kind));await writeFile(resolve(dir,"icon@2x.png"),png(base*2,kind));}
await pair(resolve(plugin,"imgs","plugin"),"plugin",256);
await pair(resolve(plugin,"imgs","category"),"plugin",28);
for(const kind of ["record","stop","replay"]){const dir=resolve(plugin,"imgs","actions",kind);await pair(dir,kind,72);await writeFile(resolve(dir,"key.png"),png(144,kind));await writeFile(resolve(dir,"key@2x.png"),png(288,kind));}
console.log("Built Pro assets and copied local input host.");
