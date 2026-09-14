import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const expected=[
  ["com.packrat.textexpanderlite","Text Expander Lite"],
  ["com.packrat.textexpanderpro","Text Expander Pro"]
];
function fail(message){throw new Error(message)}
function profileFolderId(uuid){
  return ((uuid.replace(/-/g,"")+"000").match(/.{5}/g)||[])
    .map(value=>parseInt(value,16).toString(32).padStart(4,"0"))
    .join("")
    .substring(0,26)
    .toUpperCase()
    .replace(/V/g,"W")
    .replace(/U/g,"V")+"Z";
}
function zipEntries(bytes){
  const entries=new Map();
  let offset=0;
  while(offset+4<=bytes.length&&bytes.readUInt32LE(offset)===0x04034b50){
    const compression=bytes.readUInt16LE(offset+8);
    const compressedSize=bytes.readUInt32LE(offset+18);
    const nameLength=bytes.readUInt16LE(offset+26);
    const extraLength=bytes.readUInt16LE(offset+28);
    if(compression!==0)fail("Bundled starter profiles must use deterministic stored ZIP entries.");
    const nameStart=offset+30;
    const dataStart=nameStart+nameLength+extraLength;
    const dataEnd=dataStart+compressedSize;
    if(dataEnd>bytes.length)fail("Truncated bundled starter profile.");
    const name=bytes.subarray(nameStart,nameStart+nameLength).toString("utf8");
    entries.set(name,bytes.subarray(dataStart,dataEnd));
    offset=dataEnd;
  }
  return entries;
}
function pngSizeBytes(bytes,label="PNG"){
  if(!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))fail(`${label} is not PNG.`);
  return [bytes.readUInt32BE(16),bytes.readUInt32BE(20)];
}
async function pngSize(file){
  return pngSizeBytes(await fs.readFile(file),file);
}
async function requirePng(file,w,h){
  const [width,height]=await pngSize(file);
  if(width!==w||height!==h)fail(`${file} expected ${w}x${h}, got ${width}x${height}.`);
}
for(const [uuid,name] of expected){
  const dir=path.join(root,"dist",uuid+".sdPlugin");
  const manifest=JSON.parse(await fs.readFile(path.join(dir,"manifest.json"),"utf8"));
  if(manifest.UUID!==uuid||manifest.Name!==name)fail(`Manifest identity mismatch for ${name}`);
  if(manifest.SDKVersion!==3)fail(`${name} must use SDKVersion 3.`);
  if(manifest.Nodejs?.Version!=="24")fail(`${name} must use the current Node 24 runtime.`);
  if(manifest.Software?.MinimumVersion!=="7.1")fail(`${name} must match the current SDK 2.x Stream Deck baseline.`);
  if(manifest.OS?.length!==1||manifest.OS[0].Platform!=="windows")fail(`${name} must remain truthfully Windows-only in v1.`);
  const expectedDeviceTypes=[0,1,2,7,9];
  const isLite=uuid.endsWith("textexpanderlite");
  const expectedPages=isLite?["STARTER"]:["QUICK","EMAIL","SUPPORT","CREATOR","DEVELOPMENT","PERSONAL"];
  const expectedFirstPageIds=isLite
    ?["lite-email","lite-clipboard"]
    :["pro-quick-email","pro-quick-clipboard","pro-quick-time","pro-quick-date","pro-quick-address","pro-quick-link"];
  const deviceDimensions=new Map([[0,[5,3]],[1,[3,2]],[2,[8,4]],[7,[4,2]],[9,[4,2]]]);
  if(!Array.isArray(manifest.Profiles)||manifest.Profiles.length!==expectedDeviceTypes.length){
    fail(`${name} must bundle five device-specific starter profiles.`);
  }
  const actualDeviceTypes=manifest.Profiles.map(profile=>profile.DeviceType).sort((a,b)=>a-b);
  if(JSON.stringify(actualDeviceTypes)!==JSON.stringify([...expectedDeviceTypes].sort((a,b)=>a-b))){
    fail(`${name} starter profile device types are incomplete.`);
  }

  for(const profileEntry of manifest.Profiles){
    if(profileEntry.AutoInstall!==true)fail(`${name} starter profiles must auto-install.`);
    if(profileEntry.DontAutoSwitchWhenInstalled!==true)fail(`${name} starter profiles must not steal the active profile on install.`);
    if(profileEntry.Readonly!==false)fail(`${name} starter profiles must remain editable.`);

    const profile=path.join(dir,profileEntry.Name+".streamDeckProfile");
    const bytes=await fs.readFile(profile);
    if(bytes.readUInt32LE(0)!==0x04034b50)fail(`${name} profile is not a ZIP-based .streamDeckProfile.`);
    const entries=zipEntries(bytes);
    const roots=[...entries.keys()].map(entry=>entry.split("/")[0]);
    const uniqueRoots=[...new Set(roots)];
    if(uniqueRoots.length!==1)fail(`${name} starter profile archive must contain exactly one profile root.`);
    const profileRoot=uniqueRoots[0];

    if(!/^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}\.sdProfile$/.test(profileRoot||"")){
      fail(`${name} starter profile root is not a deterministic UUIDv4 .sdProfile folder.`);
    }
    const rootManifestBytes=entries.get(`${profileRoot}/manifest.json`);
    if(!rootManifestBytes)fail(`${name} starter profile root manifest is missing.`);
    const rootManifest=JSON.parse(rootManifestBytes.toString("utf8"));
    if(rootManifest.Version!=="2.0")fail(`${name} starter profile must use Version 2.0.`);

    const pageIds=rootManifest.Pages?.Pages;
    if(!Array.isArray(pageIds)||!pageIds.length)fail(`${name} starter profile has no pages.`);
    if(rootManifest.Pages?.Current!==pageIds[0])fail(`${name} starter profile current page must be its first page.`);

    const actionIds=new Set();
    const actualPageNames=[];
    let firstPageIds=[];
    for(const [pageIndex,pageId] of pageIds.entries()){
      if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(pageId)){
        fail(`${name} contains an invalid page UUIDv4: ${pageId}`);
      }
      const encoded=profileFolderId(pageId);
      const pagePath=`${profileRoot}/Profiles/${encoded}/manifest.json`;
      const pageBytes=entries.get(pagePath);
      if(!pageBytes)fail(`${name} is missing encoded page folder ${encoded}.`);
      if(entries.has(`${profileRoot}/Profiles/${pageId}/manifest.json`)){
        fail(`${name} incorrectly uses raw page UUID folder names.`);
      }
      const page=JSON.parse(pageBytes.toString("utf8"));
      actualPageNames.push(page.Name||"");
      const [maxCols,maxRows]=deviceDimensions.get(profileEntry.DeviceType)||[];
      for(const controller of page.Controllers||[]){
        for(const [coordinate,value] of Object.entries(controller.Actions||{})){
          if(pageIndex===0)firstPageIds.push(value.Settings?.snippetId||"");
          const [col,row]=coordinate.split(",").map(Number);
          if(!Number.isInteger(col)||!Number.isInteger(row)||col<0||row<0||col>=maxCols||row>=maxRows){
            fail(`${name} profile for DeviceType ${profileEntry.DeviceType} contains out-of-grid key ${coordinate}.`);
          }
          if(!/^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/.test(value.ActionID||"")){
            fail(`${name} bundled action is missing a deterministic UUIDv4 ActionID.`);
          }
          if(actionIds.has(value.ActionID))fail(`${name} bundled profile contains duplicate ActionID ${value.ActionID}.`);
          actionIds.add(value.ActionID);
          if(value.LinkedTitle!==true)fail(`${name} bundled action must link its title.`);
          if(!value.Settings?.snippetId)fail(`${name} bundled action has no snippetId setting.`);
          if(value.UUID!==uuid+".insert")fail(`${name} bundled profile references the wrong action UUID.`);
          if(value.States?.[0]?.Image!=="state0.png")fail(`${name} bundled starter key must use its custom state0.png icon.`);
          if(value.States?.[0]?.ShowTitle!==false)fail(`${name} bundled starter key must disable Stream Deck title overlays and render its label into the image.`);
          const customImage=entries.get(`${profileRoot}/Profiles/${encoded}/${coordinate}/CustomImages/state0.png`);
          if(!customImage)fail(`${name} bundled starter key ${coordinate} is missing CustomImages/state0.png.`);
          const [iconW,iconH]=pngSizeBytes(customImage,`${name} profile icon ${coordinate}`);
          if(iconW!==288||iconH!==288)fail(`${name} profile icon ${coordinate} must be 288x288, got ${iconW}x${iconH}.`);
        }
      }
    }
    if(JSON.stringify(actualPageNames)!==JSON.stringify(expectedPages)){
      fail(`${name} starter page order mismatch. Expected ${expectedPages.join(", ")}, got ${actualPageNames.join(", ")}.`);
    }
    if(JSON.stringify(firstPageIds)!==JSON.stringify(expectedFirstPageIds)){
      fail(`${name} first starter page has the wrong defaults: ${firstPageIds.join(", ")}.`);
    }
  }

  for(const action of manifest.Actions){
    for(const field of ["UUID","Name","PropertyInspectorPath"])if(!action[field])fail(`${name} action missing ${field}`);
  }
  const manageAction=manifest.Actions.find(action=>action.UUID===uuid+".manage");
  if(!manageAction||manageAction.VisibleInActionsList!==false)fail(`${name} legacy Manage action must stay registered but hidden from the actions list.`);

  await requirePng(path.join(dir,"imgs/plugin/category-icon.png"),28,28);
  await requirePng(path.join(dir,"imgs/plugin/category-icon@2x.png"),56,56);
  await requirePng(path.join(dir,"imgs/plugin/marketplace.png"),256,256);
  await requirePng(path.join(dir,"imgs/plugin/marketplace@2x.png"),512,512);
  for(const actionName of ["insert","manage"]){
    await requirePng(path.join(dir,`imgs/actions/${actionName}/icon.png`),20,20);
    await requirePng(path.join(dir,`imgs/actions/${actionName}/icon@2x.png`),40,40);
    await requirePng(path.join(dir,`imgs/actions/${actionName}/key.png`),72,72);
    await requirePng(path.join(dir,`imgs/actions/${actionName}/key@2x.png`),144,144);
  }

  for(const pkg of ["@elgato/streamdeck","@elgato/schemas","@elgato/utils","ws","zod"]){
    await fs.access(path.join(dir,"node_modules",...pkg.split("/"),"package.json"));
  }
  const shippedWs=JSON.parse(await fs.readFile(path.join(dir,"node_modules","ws","package.json"),"utf8"));
  if(shippedWs.version!=="8.21.0")fail(`${name} must ship patched ws 8.21.0, got ${shippedWs.version}.`);
  const plugin=await fs.readFile(path.join(dir,"bin","plugin.mjs"),"utf8");
  if(!plugin.includes('from "@elgato/streamdeck"'))fail(`${name} is not using the official SDK runtime.`);
  if(plugin.includes("./streamdeck.mjs"))fail(`${name} still references the raw WebSocket runtime.`);
}
const inspector=await fs.readFile(path.join(root,"ui","inspector.html"),"utf8");
if(inspector.includes("ctx=uuid"))fail("Property Inspector must not use its registration UUID as the action context.");
if(!inspector.includes('ctx=parsed.context||""'))fail("Property Inspector must source action context from actionInfo.");
if(!inspector.includes('event:"getSettings",action,context:ctx'))fail("Property Inspector getSettings must include action UUID and action context.");
if(!inspector.includes('event:"setSettings",action,context:ctx'))fail("Property Inspector setSettings must include action UUID and action context.");
if(!inspector.includes('$("afterWrap").style.display=edition==="pro"?"block":"none"'))fail("Tab/Enter controls must be hidden in Lite.");
if(!inspector.includes('Create / edit snippets'))fail("Property Inspector must expose the inline snippet editor.");
if(!inspector.includes('type:"saveSnippet"')||!inspector.includes('type:"deleteSnippet"'))fail("Property Inspector must support inline snippet save/delete.");
if(!inspector.includes('Type text')||!inspector.includes('Paste with clipboard'))fail("Insert method copy must use plain-language labels.");
if(inspector.includes('Unicode typing')||inspector.includes('Clipboard paste + restore'))fail("Old technical insertion labels must not return.");
if(!inspector.includes('$("insertSettings").style.display="none"'))fail("Legacy hidden library action must show the editor instead of insertion controls.");
for(const token of ["--packrat-bg:#080A0E","--packrat-accent:#FFB21E","--packrat-button:#181C21","--packrat-danger:#FF5D6C"]){
  if(!inspector.includes(token))fail(`Property Inspector is missing canonical PackRat token ${token}.`);
}
if(!inspector.includes("linear-gradient(145deg,var(--packrat-card-start),var(--packrat-card-end))"))fail("Property Inspector must use the canonical PackRat card gradient.");
if(!inspector.includes("rgba(255,178,30,.12) 0%")||!inspector.includes("top:-130px")||!inspector.includes("right:-110px"))fail("Property Inspector must include the canonical top-right PackRat ambient glow.");
if(!inspector.includes('src="packrat-icon.png"'))fail("Property Inspector must use the packaged PackRat logo asset.");
if(!inspector.includes("https://marketplace.elgato.com/maker/packrat"))fail("Property Inspector must link to the PackRat maker page.");
if(!inspector.includes('$("brandLink").addEventListener("click"'))fail("PackRat maker branding must use Stream Deck openUrl behavior.");
const buildSource=await fs.readFile(path.join(root,"scripts","build.mjs"),"utf8");
if(!buildSource.includes('tools","art","assets","ratpack-icon-transparent.png'))fail("Build must package the shared PackRat logo locally.");
if(!buildSource.includes("const bg=[5,7,10,255],panel=[13,16,21,255]")||!buildSource.includes("accent=[255,178,30,255]"))fail("Key renderer must use the canonical PackRat dark surface and cheddar accent.");
if(!buildSource.includes("roundRect(0,0,width,height,s*.16,bg)"))fail("Key renderer must own a rounded dark key face.");
const sourcePlugin=await fs.readFile(path.join(root,"src","plugin.mjs"),"utf8");
if(!sourcePlugin.includes('afterInsert: EDITION === "pro" ? (settings.afterInsert || "none") : "none"'))fail("Lite runtime must ignore Tab/Enter settings.");
if(!sourcePlugin.includes('saveSnippetFromInspector')||!sourcePlugin.includes('deleteSnippetFromInspector'))fail("Plugin must implement inline snippet CRUD.");
const map=JSON.parse(await fs.readFile(path.join(root,"..","..","products","lite-pro-map.json"),"utf8"));
const pair=(map.pairs||[]).find(item=>item.lite_id==="text-expander"&&item.pro_id==="text-expander-pro");
if(!pair)fail("Text Expander Lite→Pro mapping is missing.");
const expectedProUrl=String(pair.pro_marketplace_url||"").trim();
if(expectedProUrl&&!/^https:\/\/marketplace\.elgato\.com\/product\/[^/?#]+-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(expectedProUrl)){
  fail("Text Expander Pro upsell URL is not a direct Elgato Marketplace product URL.");
}
const liteEdition=await fs.readFile(path.join(root,"dist","com.packrat.textexpanderlite.sdPlugin","bin","edition.mjs"),"utf8");
if(!liteEdition.includes(`VERIFIED_PRO_URL=${JSON.stringify(expectedProUrl)}`)){
  fail("Lite packaged upsell URL does not match canonical Lite→Pro metadata.");
}
const bridge=await fs.readFile(path.join(root,"runtime","win-bridge.ps1"),"utf8");
for(const forbidden of ["Invoke-Expression","iex ","cmd.exe /c","Start-Process"])if(bridge.toLowerCase().includes(forbidden.toLowerCase()))fail(`Unsafe bridge primitive found: ${forbidden}`);
console.log("Text Expander structural QA passed.");
