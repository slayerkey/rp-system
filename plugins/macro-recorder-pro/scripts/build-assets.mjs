import { cp, mkdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(here,"..");
const plugin=resolve(root,"com.packrat.macro-recorder-pro.sdPlugin");
for(const dir of ["bin","imgs","ui","helpers"])await rm(resolve(plugin,dir),{recursive:true,force:true});
for(const dir of ["bin","imgs","ui","helpers"])await mkdir(resolve(plugin,dir),{recursive:true});
for(const file of ["inspector.html","inspector.css","inspector.js"])await cp(resolve(root,"ui",file),resolve(plugin,"ui",file));
const helper=process.env.PACKRAT_INPUT_HOST||resolve(root,"..","..","artifacts","input-host","PackRat.InputHost.exe");
try{await stat(helper);}catch{throw new Error("PackRat.InputHost.exe is missing. Publish shared/windows-input/PackRat.InputHost first.");}
await cp(helper,resolve(plugin,"helpers","PackRat.InputHost.exe"));

function crc32(b){let crc=0xffffffff;for(const x of b){crc^=x;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return(crc^0xffffffff)>>>0;}
function chunk(type,data){const n=Buffer.from(type),body=Buffer.concat([n,data]),o=Buffer.alloc(12+data.length);o.writeUInt32BE(data.length,0);n.copy(o,4);data.copy(o,8);o.writeUInt32BE(crc32(body),8+data.length);return o;}
function encode(size,p){const raw=Buffer.alloc((size*4+1)*size);for(let y=0;y<size;y++){const row=y*(size*4+1);raw[row]=0;p.copy(raw,row+1,y*size*4,(y+1)*size*4);}const ih=Buffer.alloc(13);ih.writeUInt32BE(size,0);ih.writeUInt32BE(size,4);ih[8]=8;ih[9]=6;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk("IHDR",ih),chunk("IDAT",deflateSync(raw,{level:9})),chunk("IEND",Buffer.alloc(0))]);}
function draw(size,kind,mode){
 const p=Buffer.alloc(size*size*4),dark=[10,12,17,255],white=[255,255,255,255],green=[53,230,126,255],red=[244,76,86,255];
 if(mode!=="list")for(let i=0;i<p.length;i+=4)p.set(dark,i);
 const set=(x,y,c)=>{x=Math.floor(x);y=Math.floor(y);if(x<0||y<0||x>=size||y>=size)return;p.set(c,(y*size+x)*4);};
 const rect=(x0,y0,x1,y1,c)=>{for(let y=Math.floor(y0);y<=Math.ceil(y1);y++)for(let x=Math.floor(x0);x<=Math.ceil(x1);x++)set(x,y,c);};
 const circle=(cx,cy,r,c,stroke=0)=>{for(let y=Math.floor(cy-r);y<=Math.ceil(cy+r);y++)for(let x=Math.floor(cx-r);x<=Math.ceil(cx+r);x++){const d=(x-cx)**2+(y-cy)**2;if(d<=r*r&&(!stroke||d>=(r-stroke)**2))set(x,y,c);}};
 const tri=(x0,y0,h,c)=>{for(let y=0;y<=h;y++){const half=(y/h)*(h*.45);for(let x=Math.floor(x0-half);x<=Math.ceil(x0+half);x++)set(x,y0-h/2+y,c);}};
 const s=size/144;
 if(mode==="list"){
   if(kind==="record")circle(72*s,72*s,35*s,white,12*s);
   else if(kind==="stop")rect(42*s,42*s,102*s,102*s,white);
   else if(kind==="replay")tri(65*s,72*s,82*s,white);
   else{circle(72*s,72*s,48*s,white,11*s);tri(69*s,72*s,54*s,white);}
 }else if(kind==="record")circle(72*s,72*s,32*s,red);
 else if(kind==="stop")rect(45*s,45*s,99*s,99*s,white);
 else if(kind==="replay")tri(64*s,72*s,78*s,green);
 else{circle(72*s,72*s,47*s,green);circle(72*s,72*s,25*s,dark);}
 return encode(size,p);
}
async function savePair(dir,kind,size,mode){await mkdir(dir,{recursive:true});await writeFile(resolve(dir,"icon.png"),draw(size,kind,mode));await writeFile(resolve(dir,"icon@2x.png"),draw(size*2,kind,mode));}
await savePair(resolve(plugin,"imgs","plugin"),"plugin",256,"key");
await savePair(resolve(plugin,"imgs","category"),"category",28,"list");
for(const kind of ["record","stop","replay"]){
 const dir=resolve(plugin,"imgs","actions",kind);await mkdir(dir,{recursive:true});
 await writeFile(resolve(dir,"icon.png"),draw(20,kind,"list"));await writeFile(resolve(dir,"icon@2x.png"),draw(40,kind,"list"));
 await writeFile(resolve(dir,"key.png"),draw(144,kind,"key"));await writeFile(resolve(dir,"key@2x.png"),draw(288,kind,"key"));
}
console.log("Built Marketplace-compliant list icons, key art, UI and local input host.");
