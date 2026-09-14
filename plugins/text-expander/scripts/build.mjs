import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

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
function pngChunk(type,data){
  const name=Buffer.from(type,"ascii");
  const out=Buffer.alloc(12+data.length);
  out.writeUInt32BE(data.length,0);name.copy(out,4);data.copy(out,8);
  out.writeUInt32BE(crc32(Buffer.concat([name,data])),8+data.length);
  return out;
}
function makePng(width,height,draw){
  const pixels=Buffer.alloc(width*height*4);
  const set=(x,y,r,g,b,a=255)=>{
    x=Math.round(x);y=Math.round(y);
    if(x<0||x>=width||y<0||y>=height)return;
    const i=(y*width+x)*4;pixels[i]=r;pixels[i+1]=g;pixels[i+2]=b;pixels[i+3]=a;
  };
  const rect=(x,y,w,h,color)=>{
    for(let yy=Math.max(0,Math.floor(y));yy<Math.min(height,Math.ceil(y+h));yy++)
      for(let xx=Math.max(0,Math.floor(x));xx<Math.min(width,Math.ceil(x+w));xx++)
        set(xx,yy,...color);
  };
  const roundRect=(x,y,w,h,r,color)=>{
    const left=Math.floor(x),top=Math.floor(y),right=Math.ceil(x+w)-1,bottom=Math.ceil(y+h)-1;
    const radius=Math.max(0,Math.min(r,w/2,h/2));
    for(let yy=Math.max(0,top);yy<=Math.min(height-1,bottom);yy++){
      for(let xx=Math.max(0,left);xx<=Math.min(width-1,right);xx++){
        const nx=Math.max(left+radius,Math.min(xx,right-radius));
        const ny=Math.max(top+radius,Math.min(yy,bottom-radius));
        const dx=xx-nx,dy=yy-ny;
        if(dx*dx+dy*dy<=radius*radius)set(xx,yy,...color);
      }
    }
  };
  const circle=(cx,cy,r,color)=>{
    const minX=Math.max(0,Math.floor(cx-r)),maxX=Math.min(width-1,Math.ceil(cx+r));
    const minY=Math.max(0,Math.floor(cy-r)),maxY=Math.min(height-1,Math.ceil(cy+r));
    const rr=r*r;
    for(let yy=minY;yy<=maxY;yy++)for(let xx=minX;xx<=maxX;xx++){
      const dx=xx-cx,dy=yy-cy;if(dx*dx+dy*dy<=rr)set(xx,yy,...color);
    }
  };
  const line=(x1,y1,x2,y2,thickness,color)=>{
    const steps=Math.max(Math.abs(x2-x1),Math.abs(y2-y1),1);
    for(let i=0;i<=steps;i++){
      const t=i/steps;
      circle(x1+(x2-x1)*t,y1+(y2-y1)*t,thickness/2,color);
    }
  };
  draw({set,rect,roundRect,circle,line,width,height});
  const raw=Buffer.alloc(height*(1+width*4));
  for(let y=0;y<height;y++){
    raw[y*(1+width*4)]=0;
    pixels.copy(raw,y*(1+width*4)+1,y*width*4,(y+1)*width*4);
  }
  const ihdr=Buffer.alloc(13);
  ihdr.writeUInt32BE(width,0);ihdr.writeUInt32BE(height,4);ihdr[8]=8;ihdr[9]=6;ihdr[10]=0;ihdr[11]=0;ihdr[12]=0;
  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    pngChunk("IHDR",ihdr),
    pngChunk("IDAT",zlib.deflateSync(raw,{level:9})),
    pngChunk("IEND",Buffer.alloc(0))
  ]);
}
function drawIcon({rect,roundRect,circle,line,width,height},kind,{key=false,pro=false}={}){
  const s=Math.min(width,height);
  const bg=[5,7,10,255],panel=[13,16,21,255],white=[255,255,255,255],muted=[154,162,175,255],accent=[255,178,30,255];
  if(key){
    roundRect(0,0,width,height,s*.16,bg);
    const m=Math.max(2,Math.round(s*.055));
    roundRect(m,m,width-2*m,height-2*m,s*.12,panel);
    roundRect(m+s*.018,m+s*.14,Math.max(2,s*.035),height-2*m-s*.28,s*.018,accent);
  }
  const cx=width/2,cy=height*(key ? .43 : .5);
  const stroke=Math.max(1.5,s*.055);
  const ring=(x,y,r)=>{
    circle(x,y,r,white);
    circle(x,y,Math.max(0,r-stroke),key?panel:bg);
  };
  const plusBadge=()=>{
    const bx=width*.74,by=height*.24,r=s*.12;
    circle(bx,by,r,key?accent:white);
    const t=Math.max(1,s*.035);
    rect(bx-r*.5,by-t/2,r,t,bg);
    rect(bx-t/2,by-r*.5,t,r,bg);
  };
  const outlineRect=(x,y,w,h)=>{
    rect(x,y,w,stroke,white);rect(x,y+h-stroke,w,stroke,white);
    rect(x,y,stroke,h,white);rect(x+w-stroke,y,stroke,h,white);
  };

  if(kind==="plugin"||kind==="insert"||kind==="snippet"){
    const x=cx-s*.27,y=cy-s*.24,w=s*.43,h=s*.48;
    outlineRect(x,y,w,h);
    for(const dy of [.0,.11,.22]) rect(x+s*.09,y+s*(.10+dy),s*.25,Math.max(1,s*.035),white);
    plusBadge();
  }else if(kind==="manage"||kind==="library"){
    const x=cx-s*.30,y=cy-s*.24,w=s*.60,h=s*.48;
    outlineRect(x,y,w,h);
    for(const dy of [-.12,0,.12]){
      circle(x+s*.11,cy+s*dy,s*.022,white);
      rect(x+s*.18,cy+s*dy-s*.018,s*.30,s*.036,white);
    }
  }else if(kind==="email"||kind==="email-plus"){
    const x=cx-s*.31,y=cy-s*.20,w=s*.62,h=s*.40;
    outlineRect(x,y,w,h);
    line(x+stroke, y+stroke, cx, cy+s*.03, stroke*.8, white);
    line(x+w-stroke, y+stroke, cx, cy+s*.03, stroke*.8, white);
    if(kind==="email-plus")plusBadge();
  }else if(kind==="clipboard"||kind==="clipboard-plus"){
    const x=cx-s*.24,y=cy-s*.25,w=s*.48,h=s*.52;
    outlineRect(x,y,w,h);
    rect(cx-s*.12,y-s*.035,s*.24,s*.08,white);
    for(const dy of [-.06,.07,.20])rect(x+s*.11,cy+s*dy,s*.26,Math.max(1,s*.035),white);
    if(kind==="clipboard-plus")plusBadge();
  }else if(kind==="time"){
    ring(cx,cy,s*.27);
    line(cx,cy,cx,cy-s*.14,stroke,white);
    line(cx,cy,cx+s*.13,cy+s*.07,stroke,white);
  }else if(kind==="date"){
    const x=cx-s*.29,y=cy-s*.24,w=s*.58,h=s*.48;
    outlineRect(x,y,w,h);
    rect(x,y+s*.11,w,stroke,white);
    rect(x+s*.12,y-s*.05,stroke,s*.12,white);
    rect(x+w-s*.12-stroke,y-s*.05,stroke,s*.12,white);
    for(const dx of [.16,.31,.46])for(const dy of [.23,.36])circle(x+s*dx,y+s*dy,s*.025,white);
  }else if(kind==="address"){
    ring(cx,cy-s*.07,s*.16);
    circle(cx,cy-s*.07,s*.055,white);
    line(cx-s*.11,cy+s*.05,cx,cy+s*.27,stroke,white);
    line(cx+s*.11,cy+s*.05,cx,cy+s*.27,stroke,white);
  }else if(kind==="link"){
    ring(cx-s*.13,cy+s*.04,s*.16);
    ring(cx+s*.13,cy-s*.04,s*.16);
    line(cx-s*.03,cy+s*.02,cx+s*.03,cy-s*.02,stroke,white);
  }else if(kind==="code"){
    line(cx-s*.05,cy-s*.22,cx-s*.24,cy,stroke,white);
    line(cx-s*.24,cy,cx-s*.05,cy+s*.22,stroke,white);
    line(cx+s*.05,cy-s*.22,cx+s*.24,cy,stroke,white);
    line(cx+s*.24,cy,cx+s*.05,cy+s*.22,stroke,white);
  }else if(kind==="chat"){
    const x=cx-s*.29,y=cy-s*.20,w=s*.58,h=s*.36;
    outlineRect(x,y,w,h);
    line(x+s*.13,y+h,cx-s*.06,cy+s*.28,stroke,white);
    for(const dx of [-.14,0,.14])circle(cx+s*dx,cy-s*.02,s*.025,white);
  }else if(kind==="video"){
    const x=cx-s*.30,y=cy-s*.20,w=s*.60,h=s*.40;
    outlineRect(x,y,w,h);
    line(cx-s*.07,cy-s*.10,cx+s*.12,cy,stroke,white);
    line(cx+s*.12,cy,cx-s*.07,cy+s*.10,stroke,white);
  }else{
    for(const dy of [-.14,0,.14])rect(cx-s*.28,cy+s*dy,s*.56,Math.max(1,s*.04),white);
  }
}
async function writeIconPair(base,width,height,kind,{key=false,pro=false}={}){
  await write(base+".png",makePng(width,height,d=>drawIcon(d,kind,{key,pro})));
  await write(base+"@2x.png",makePng(width*2,height*2,d=>drawIcon(d,kind,{key,pro})));
}
const FONT_5X7={
  "A":["01110","10001","10001","11111","10001","10001","10001"],
  "B":["11110","10001","10001","11110","10001","10001","11110"],
  "C":["01111","10000","10000","10000","10000","10000","01111"],
  "D":["11110","10001","10001","10001","10001","10001","11110"],
  "E":["11111","10000","10000","11110","10000","10000","11111"],
  "F":["11111","10000","10000","11110","10000","10000","10000"],
  "G":["01111","10000","10000","10111","10001","10001","01111"],
  "H":["10001","10001","10001","11111","10001","10001","10001"],
  "I":["11111","00100","00100","00100","00100","00100","11111"],
  "J":["00111","00010","00010","00010","10010","10010","01100"],
  "K":["10001","10010","10100","11000","10100","10010","10001"],
  "L":["10000","10000","10000","10000","10000","10000","11111"],
  "M":["10001","11011","10101","10101","10001","10001","10001"],
  "N":["10001","11001","10101","10011","10001","10001","10001"],
  "O":["01110","10001","10001","10001","10001","10001","01110"],
  "P":["11110","10001","10001","11110","10000","10000","10000"],
  "Q":["01110","10001","10001","10001","10101","10010","01101"],
  "R":["11110","10001","10001","11110","10100","10010","10001"],
  "S":["01111","10000","10000","01110","00001","00001","11110"],
  "T":["11111","00100","00100","00100","00100","00100","00100"],
  "U":["10001","10001","10001","10001","10001","10001","01110"],
  "V":["10001","10001","10001","10001","10001","01010","00100"],
  "W":["10001","10001","10001","10101","10101","10101","01010"],
  "X":["10001","10001","01010","00100","01010","10001","10001"],
  "Y":["10001","10001","01010","00100","00100","00100","00100"],
  "Z":["11111","00001","00010","00100","01000","10000","11111"],
  "0":["01110","10001","10011","10101","11001","10001","01110"],
  "1":["00100","01100","00100","00100","00100","00100","01110"],
  "2":["01110","10001","00001","00010","00100","01000","11111"],
  "3":["11110","00001","00001","01110","00001","00001","11110"],
  "4":["00010","00110","01010","10010","11111","00010","00010"],
  "5":["11111","10000","10000","11110","00001","00001","11110"],
  "6":["01110","10000","10000","11110","10001","10001","01110"],
  "7":["11111","00001","00010","00100","01000","01000","01000"],
  "8":["01110","10001","10001","01110","10001","10001","01110"],
  "9":["01110","10001","10001","01111","00001","00001","01110"],
  "+":["00000","00100","00100","11111","00100","00100","00000"],
  "-":["00000","00000","00000","11111","00000","00000","00000"],
  " ":["00000","00000","00000","00000","00000","00000","00000"]
};
function drawProfileLabel({rect,width,height},rawLabel){
  const label=String(rawLabel||"").toUpperCase().replace(/[^A-Z0-9+ -]/g,"").slice(0,12);
  if(!label)return;
  const chars=[...label];
  const units=chars.length*5+Math.max(0,chars.length-1);
  const maxWidth=width*.84;
  const scale=Math.max(2,Math.min(5,Math.floor(maxWidth/Math.max(1,units))));
  const pixel=scale;
  const totalWidth=units*pixel;
  const x0=Math.round((width-totalWidth)/2);
  const y0=Math.round(height-height*.07-7*pixel);
  const white=[255,255,255,255];
  let x=x0;
  for(const ch of chars){
    const glyph=FONT_5X7[ch]||FONT_5X7[" "];
    glyph.forEach((row,gy)=>{
      [...row].forEach((bit,gx)=>{
        if(bit==="1")rect(x+gx*pixel,y0+gy*pixel,pixel,pixel,white);
      });
    });
    x+=6*pixel;
  }
}
function profileKeyImage(kind,label,pro=false){
  return makePng(288,288,d=>{
    drawIcon(d,kind||"text",{key:true,pro});
    drawProfileLabel(d,label);
  });
}
function actionObject(actionUuid,keyDef,seed){
  return {
    ActionID:deterministicUuidV4(`packrat-text-expander-action-${seed}`,{upper:true}),
    LinkedTitle:true,
    Name:"Insert Snippet",
    UUID:actionUuid,
    Settings:{snippetId:keyDef.snippetId,insertionMode:"auto",afterInsert:"none"},
    State:0,
    States:[{Image:"state0.png",Title:keyDef.label,TitleAlignment:"bottom",ShowTitle:false,TitleColor:"#FFFFFF"}]
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
      entries.push({
        name:`${prefix}/Profiles/${pageFolder}/${col},${row}/CustomImages/state0.png`,
        data:profileKeyImage(key.icon||"text",key.label,edition==="pro")
      });
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
  await fs.rm(out,{recursive:true,force:true});await fs.mkdir(out,{recursive:true});
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
      {Name:"Insert Snippet",UUID:`${actionBase}.insert`,Icon:"imgs/actions/insert/icon",Tooltip:"Insert a saved text snippet. Create and edit snippets directly in the Property Inspector.",PropertyInspectorPath:"ui/inspector.html",Controllers:["Keypad"],States:[{Image:"imgs/actions/insert/key",ShowTitle:false,TitleAlignment:"bottom"}]},
      {Name:"Snippet Library",UUID:`${actionBase}.manage`,Icon:"imgs/actions/manage/icon",Tooltip:"Legacy library shortcut. Edit snippets directly from Insert Snippet.",PropertyInspectorPath:"ui/inspector.html",Controllers:["Keypad"],VisibleInActionsList:false,States:[{Image:"imgs/actions/manage/key",ShowTitle:false,TitleAlignment:"bottom"}]}
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
  for(const file of ["core.mjs","library.mjs","windows.mjs","server.mjs","plugin.mjs"]) await copy(path.join(root,"src",file),path.join(out,"bin",file));
  await write(path.join(out,"bin","edition.mjs"),`export const EDITION=${JSON.stringify(edition)};\nexport const ACTIONS={insert:${JSON.stringify(actionBase+".insert")},manage:${JSON.stringify(actionBase+".manage")}};\nexport const VERIFIED_PRO_URL=${JSON.stringify(edition==="lite"?verifiedProUrl:"")};\n`);
  await copyRuntimeDependencies(out);
  await copy(path.join(root,"runtime","win-bridge.ps1"),path.join(out,"runtime","win-bridge.ps1"));
  await copy(path.join(root,"ui","inspector.html"),path.join(out,"ui","inspector.html"));
  await copy(path.join(repoRoot,"tools","art","assets","ratpack-icon-transparent.png"),path.join(out,"ui","packrat-icon.png"));
  await copy(path.join(root,"ui","manager.html"),path.join(out,"ui","manager.html"));
  const profileRecipe=JSON.parse(await fs.readFile(path.join(root,"profiles",edition+".json"),"utf8"));
  for(const device of profileDevices){
    await write(
      path.join(out,"profiles",cfg.profile+"-"+device.key+".streamDeckProfile"),
      profileArchive(profileRecipe,edition,actionBase+".insert",device.key,device.columns)
    );
  }

  await writeIconPair(path.join(out,"imgs/plugin/category-icon"),28,28,"plugin",{pro});
  await writeIconPair(path.join(out,"imgs/plugin/marketplace"),256,256,"plugin",{key:true,pro});
  await writeIconPair(path.join(out,"imgs/actions/insert/icon"),20,20,"snippet",{pro});
  await writeIconPair(path.join(out,"imgs/actions/insert/key"),72,72,"snippet",{key:true,pro});
  await writeIconPair(path.join(out,"imgs/actions/manage/icon"),20,20,"library",{pro});
  await writeIconPair(path.join(out,"imgs/actions/manage/key"),72,72,"library",{key:true,pro});
  await write(path.join(out,".sdignore"),"logs/\n*.tmp\n");
}
await fs.rm(dist,{recursive:true,force:true});await fs.mkdir(dist,{recursive:true});
await buildEdition("lite");await buildEdition("pro");
console.log("Built Text Expander Lite and Pro with official Stream Deck SDK v2 runtime.");
