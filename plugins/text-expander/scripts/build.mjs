import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { renderActionIconSvg, renderFallbackKeySvg } from "../src/key-visuals.mjs";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const repoRoot=path.resolve(root,"..","..");
const dist=path.join(root,"dist");

async function verifiedProMarketplaceUrl(){
  const map=JSON.parse(await fs.readFile(path.join(repoRoot,"products","lite-pro-map.json"),"utf8"));
  const pair=(map.pairs||[]).find(item=>item.lite_id==="text-expander"&&item.pro_id==="text-expander-pro");
  if(!pair) throw new Error("Text Expander Lite→Pro mapping is missing from products/lite-pro-map.json.");
  const url=String(pair.pro_marketplace_url||"").trim();
  if(!url) return "";
  if(!/^https:\/\/marketplace\.elgato\.com\/product\/[^/?#]+-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(url)){
    throw new Error("Text Expander Pro upsell must be a direct verified Elgato Marketplace product URL.");
  }
  return url;
}

function deterministicUuidV4(seed,{upper=false}={}){
  const bytes=crypto.createHash("sha256").update(seed).digest().subarray(0,16);
  bytes[6]=(bytes[6]&0x0f)|0x40;
  bytes[8]=(bytes[8]&0x3f)|0x80;
  const h=bytes.toString("hex");
  const value=[h.slice(0,8),h.slice(8,12),h.slice(12,16),h.slice(16,20),h.slice(20)].join("-");
  return upper?value.toUpperCase():value;
}

function profileFolderId(uuid){
  return ((uuid.replace(/-/g,"")+"000").match(/.{5}/g)||[])
    .map(value=>parseInt(value,16).toString(32).padStart(4,"0"))
    .join("")
    .substring(0,26)
    .toUpperCase()
    .replace(/V/g,"W")
    .replace(/U/g,"V")+"Z";
}

function crc32(buf){
  let c=0xffffffff;
  for(const byte of buf){
    c^=byte;
    for(let k=0;k<8;k++) c=(c>>>1)^((c&1)?0xedb88320:0);
  }
  return (c^0xffffffff)>>>0;
}

function zipStore(entries){
  const locals=[],centrals=[];let offset=0;
  for(const entry of entries){
    const name=Buffer.from(entry.name.replaceAll("\\","/"),"utf8");
    const data=Buffer.isBuffer(entry.data)?entry.data:Buffer.from(entry.data,"utf8");
    const crc=crc32(data);
    const local=Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(0,6);local.writeUInt16LE(0,8);
    local.writeUInt16LE(0,10);local.writeUInt16LE(0x21,12);local.writeUInt32LE(crc,14);local.writeUInt32LE(data.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(name.length,26);
    locals.push(local,name,data);
    const central=Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(0,8);central.writeUInt16LE(0,10);
    central.writeUInt16LE(0,12);central.writeUInt16LE(0x21,14);central.writeUInt32LE(crc,16);central.writeUInt32LE(data.length,20);central.writeUInt32LE(data.length,24);central.writeUInt16LE(name.length,28);
    central.writeUInt16LE(0,30);central.writeUInt16LE(0,32);central.writeUInt16LE(0,34);central.writeUInt16LE(0,36);central.writeUInt32LE(0,38);central.writeUInt32LE(offset,42);
    centrals.push(central,name);offset+=local.length+name.length+data.length;
  }
  const centralBuf=Buffer.concat(centrals),localBuf=Buffer.concat(locals),end=Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(0,4);end.writeUInt16LE(0,6);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(centralBuf.length,12);end.writeUInt32LE(localBuf.length,16);
  return Buffer.concat([localBuf,centralBuf,end]);
}

// Marketplace artwork remains the one deliberate raster asset in this builder.
// Hardware keys, profile keys, action-list icons and category icons are SVG and
// runtime-owned so they do not inherit generated pixel glyphs.
function pngChunk(type,data){
  const name=Buffer.from(type,"ascii");
  const out=Buffer.alloc(12+data.length);
  out.writeUInt32BE(data.length,0);name.copy(out,4);data.copy(out,8);
  out.writeUInt32BE(crc32(Buffer.concat([name,data])),8+data.length);
  return out;
}
function marketplacePng(size){
  const pixels=Buffer.alloc(size*size*4);
  const set=(x,y,color)=>{
    x=Math.round(x);y=Math.round(y);
    if(x<0||x>=size||y<0||y>=size)return;
    const i=(y*size+x)*4;
    pixels[i]=color[0];pixels[i+1]=color[1];pixels[i+2]=color[2];pixels[i+3]=color[3]??255;
  };
  const fillRect=(x,y,w,h,color)=>{
    for(let yy=Math.max(0,Math.floor(y));yy<Math.min(size,Math.ceil(y+h));yy++)
      for(let xx=Math.max(0,Math.floor(x));xx<Math.min(size,Math.ceil(x+w));xx++)set(xx,yy,color);
  };
  const circle=(cx,cy,r,color)=>{
    for(let y=Math.max(0,Math.floor(cy-r));y<=Math.min(size-1,Math.ceil(cy+r));y++)
      for(let x=Math.max(0,Math.floor(cx-r));x<=Math.min(size-1,Math.ceil(cx+r));x++)
        if((x-cx)**2+(y-cy)**2<=r*r)set(x,y,color);
  };
  const line=(x1,y1,x2,y2,t,color)=>{
    const steps=Math.max(Math.abs(x2-x1),Math.abs(y2-y1),1);
    for(let i=0;i<=steps;i++){
      const p=i/steps;
      circle(x1+(x2-x1)*p,y1+(y2-y1)*p,t/2,color);
    }
  };
  const bg=[8,10,14,255],white=[245,247,251,255],accent=[255,178,30,255];
  fillRect(0,0,size,size,bg);
  const m=size*.23,x=m,y=size*.25,w=size*.46,h=size*.48,t=Math.max(4,size*.025);
  line(x,y,x+w,y,t,white);line(x,y+h,x+w,y+h,t,white);line(x,y,x,y+h,t,white);line(x+w,y,x+w,y+h,t,white);
  for(const p of [.2,.43,.66]) line(x+w*.2,y+h*p,x+w*.8,y+h*p,t*.8,white);
  const bx=size*.75,by=size*.23,r=size*.085;
  circle(bx,by,r,accent);
  line(bx-r*.48,by,bx+r*.48,by,t*.65,bg);
  line(bx,by-r*.48,bx,by+r*.48,t*.65,bg);

  const raw=Buffer.alloc(size*(1+size*4));
  for(let y=0;y<size;y++){
    raw[y*(1+size*4)]=0;
    pixels.copy(raw,y*(1+size*4)+1,y*size*4,(y+1)*size*4);
  }
  const ihdr=Buffer.alloc(13);
  ihdr.writeUInt32BE(size,0);ihdr.writeUInt32BE(size,4);ihdr[8]=8;ihdr[9]=6;
  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    pngChunk("IHDR",ihdr),
    pngChunk("IDAT",zlib.deflateSync(raw,{level:9})),
    pngChunk("IEND",Buffer.alloc(0))
  ]);
}

function actionObject(actionUuid,keyDef,seed){
  return {
    ActionID:deterministicUuidV4(`packrat-text-expander-action-${seed}`,{upper:true}),
    LinkedTitle:true,
    Name:"Insert Snippet",
    UUID:actionUuid,
    Settings:{snippetId:keyDef.snippetId,insertionMode:"auto",afterInsert:"none"},
    State:0,
    States:[{
      Title:"",
      TitleAlignment:"middle",
      ShowTitle:false,
      TitleColor:"#FFFFFF",
      FontFamily:"Arial",
      FontSize:12,
      FontStyle:"Regular",
      FontUnderline:false
    }]
  };
}

function profileArchive(recipe,edition,actionUuid,deviceKey,columns){
  const rootId=deterministicUuidV4(`packrat-text-expander-${edition}-profile-${deviceKey}`,{upper:true});
  const pageIds=recipe.pages.map((p,i)=>deterministicUuidV4(`packrat-text-expander-${edition}-page-${deviceKey}-${i}-${p.name}`));
  const prefix=`${rootId}.sdProfile`;
  const entries=[{
    name:`${prefix}/manifest.json`,
    data:JSON.stringify({Name:recipe.name,Pages:{Current:pageIds[0],Pages:pageIds},Version:"2.0"},null,2)
  }];
  recipe.pages.forEach((page,index)=>{
    const actions={};
    const pageFolder=profileFolderId(pageIds[index]);
    page.keys.forEach((key,i)=>{
      const col=i%columns,row=Math.floor(i/columns);
      actions[`${col},${row}`]=actionObject(actionUuid,key,`${edition}-${deviceKey}-${page.name}-${i}-${key.snippetId}`);
    });
    entries.push({
      name:`${prefix}/Profiles/${pageFolder}/manifest.json`,
      data:JSON.stringify({Controllers:[{Actions:actions,Type:"Keypad"}],Name:page.name},null,2)
    });
  });
  return zipStore(entries);
}

async function copy(source,target){await fs.mkdir(path.dirname(target),{recursive:true});await fs.copyFile(source,target)}
async function write(target,content){await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,content)}

async function copyRuntimeDependencies(out){
  const packages=["@elgato/streamdeck","@elgato/schemas","@elgato/utils","ws","zod"];
  for(const pkg of packages){
    const source=path.join(root,"node_modules",...pkg.split("/"));
    const target=path.join(out,"node_modules",...pkg.split("/"));
    await fs.cp(source,target,{recursive:true});
  }
}

const verifiedProUrl=await verifiedProMarketplaceUrl();

async function buildEdition(edition){
  const pro=edition==="pro";
  const cfg=pro?{
    uuid:"com.packrat.textexpanderpro",name:"Text Expander Pro",
    description:"A local Windows text expander for reusable text snippets and fill-in templates with folders, formatted dynamic text, clipboard, app, username/computer, counters, reusable variables, cursor placement, and tab/enter behavior. Built for support replies, email templates, creator blocks, code snippets, shortcuts, and Stream Deck productivity.",
    profile:"text-expander-pro-starter"
  }:{
    uuid:"com.packrat.textexpanderlite",name:"Text Expander Lite",
    description:"Save reusable text snippets and insert dynamic text with date, time, or clipboard variables. A local Windows productivity shortcut for support replies, email templates, links, code snippets, and repeated Stream Deck text.",
    profile:"text-expander-lite-starter"
  };
  const out=path.join(dist,`${cfg.uuid}.sdPlugin`);
  await fs.rm(out,{recursive:true,force:true});
  await fs.mkdir(out,{recursive:true});

  const actionBase=cfg.uuid;
  const profileDevices=[
    {key:"standard",type:0,columns:5},
    {key:"mini",type:1,columns:3},
    {key:"xl",type:2,columns:8},
    {key:"plus",type:7,columns:4},
    {key:"neo",type:9,columns:4}
  ];

  const manifest={
    Name:cfg.name,Version:"1.0.0.0",Author:"Packrat",Category:cfg.name,CategoryIcon:"imgs/plugin/category-icon",
    CodePath:"bin/plugin.mjs",Description:cfg.description,Icon:"imgs/plugin/marketplace",SDKVersion:3,
    Software:{MinimumVersion:"7.1"},OS:[{Platform:"windows",MinimumVersion:"10"}],Nodejs:{Version:"24"},UUID:cfg.uuid,
    Actions:[
      {Name:"Insert Snippet",UUID:`${actionBase}.insert`,Icon:"imgs/actions/insert/icon",Tooltip:"Insert a saved text snippet. Create and edit snippets directly in the Property Inspector.",PropertyInspectorPath:"ui/inspector.html",Controllers:["Keypad"],States:[{Image:"imgs/actions/insert/key",ShowTitle:false,TitleAlignment:"middle"}]},
      {Name:"Snippet Library",UUID:`${actionBase}.manage`,Icon:"imgs/actions/manage/icon",Tooltip:"Legacy library shortcut. Edit snippets directly from Insert Snippet.",PropertyInspectorPath:"ui/inspector.html",Controllers:["Keypad"],VisibleInActionsList:false,States:[{Image:"imgs/actions/manage/key",ShowTitle:false,TitleAlignment:"middle"}]}
    ],
    Profiles:profileDevices.map(device=>({
      Name:`profiles/${cfg.profile}-${device.key}`,
      DeviceType:device.type,
      Readonly:false,
      DontAutoSwitchWhenInstalled:true,
      AutoInstall:true
    }))
  };

  await write(path.join(out,"manifest.json"),JSON.stringify(manifest,null,2)+"\n");
  for(const file of ["core.mjs","library.mjs","windows.mjs","server.mjs","key-visuals.mjs","plugin.mjs"]){
    await copy(path.join(root,"src",file),path.join(out,"bin",file));
  }
  await write(
    path.join(out,"bin","edition.mjs"),
    `export const EDITION=${JSON.stringify(edition)};\nexport const ACTIONS={insert:${JSON.stringify(actionBase+".insert")},manage:${JSON.stringify(actionBase+".manage")}};\nexport const VERIFIED_PRO_URL=${JSON.stringify(edition==="lite"?verifiedProUrl:"")};\n`
  );
  await copyRuntimeDependencies(out);
  await copy(path.join(root,"runtime","win-bridge.ps1"),path.join(out,"runtime","win-bridge.ps1"));

  for(const file of ["inspector.html","inspector.css","inspector.js","manager.html"]){
    await copy(path.join(root,"ui",file),path.join(out,"ui",file));
  }
  await copy(
    path.join(repoRoot,"tools","art","assets","ratpack-icon-transparent.png"),
    path.join(out,"imgs","plugin","packrat-logo.png")
  );

  const profileRecipe=JSON.parse(await fs.readFile(path.join(root,"profiles",edition+".json"),"utf8"));
  for(const device of profileDevices){
    await write(
      path.join(out,"profiles",cfg.profile+"-"+device.key+".streamDeckProfile"),
      profileArchive(profileRecipe,edition,actionBase+".insert",device.key,device.columns)
    );
  }

  await write(path.join(out,"imgs","plugin","category-icon.svg"),renderActionIconSvg("insert"));
  await write(path.join(out,"imgs","plugin","marketplace.png"),marketplacePng(256));
  await write(path.join(out,"imgs","plugin","marketplace@2x.png"),marketplacePng(512));

  await write(path.join(out,"imgs","actions","insert","icon.svg"),renderActionIconSvg("insert"));
  await write(path.join(out,"imgs","actions","insert","key.svg"),renderFallbackKeySvg("insert","SNIPPET"));
  await write(path.join(out,"imgs","actions","manage","icon.svg"),renderActionIconSvg("library"));
  await write(path.join(out,"imgs","actions","manage","key.svg"),renderFallbackKeySvg("library","LIBRARY"));

  await write(path.join(out,".sdignore"),"logs/\n*.tmp\n");
}

await fs.rm(dist,{recursive:true,force:true});
await fs.mkdir(dist,{recursive:true});
await buildEdition("lite");
await buildEdition("pro");
console.log("Built Text Expander Lite and Pro with runtime-owned semantic SVG key visuals.");
