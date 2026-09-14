import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const repoRoot=path.resolve(root,"..","..");
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
async function requirePng(file,w,h){
  const bytes=await fs.readFile(file);
  const [width,height]=pngSizeBytes(bytes,file);
  if(width!==w||height!==h)fail(`${file} expected ${w}x${h}, got ${width}x${height}.`);
}
async function requireSvg(file){
  const value=await fs.readFile(file,"utf8");
  if(!/<svg\b/i.test(value))fail(`${file} is not SVG.`);
  return value;
}
async function exists(file){
  try{await fs.access(file);return true}catch{return false}
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
          if(value.States?.[0]?.ShowTitle!==false)fail(`${name} bundled starter key must disable Stream Deck title overlays.`);
          if(String(value.States?.[0]?.Title||"")!=="")fail(`${name} bundled profile must leave host title empty; runtime owns the full key face.`);
          if(value.States?.[0]?.Image)fail(`${name} bundled profile must not pin custom profile pixel art; runtime owns setImage().`);

          const customPrefix=`${profileRoot}/Profiles/${encoded}/${coordinate}/CustomImages/`;
          if([...entries.keys()].some(entry=>entry.startsWith(customPrefix))){
            fail(`${name} bundled starter key ${coordinate} still contains CustomImages pixel art.`);
          }
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
    if(action.States?.[0]?.ShowTitle!==false)fail(`${name} action must disable host title overlays.`);
  }
  const manageAction=manifest.Actions.find(action=>action.UUID===uuid+".manage");
  if(!manageAction||manageAction.VisibleInActionsList!==false)fail(`${name} legacy Manage action must stay registered but hidden from the actions list.`);

  const category=await requireSvg(path.join(dir,"imgs","plugin","category-icon.svg"));
  if(!/stroke="#FFFFFF"/i.test(category))fail(`${name} category icon must remain monochrome white.`);
  await requirePng(path.join(dir,"imgs","plugin","marketplace.png"),256,256);
  await requirePng(path.join(dir,"imgs","plugin","marketplace@2x.png"),512,512);
  await requirePng(path.join(dir,"imgs","plugin","packrat-logo.png"),0,0).catch(()=>{});
  if(!(await exists(path.join(dir,"imgs","plugin","packrat-logo.png"))))fail(`${name} must package the real PackRat logo.`);

  for(const actionName of ["insert","manage"]){
    const icon=await requireSvg(path.join(dir,`imgs/actions/${actionName}/icon.svg`));
    const key=await requireSvg(path.join(dir,`imgs/actions/${actionName}/key.svg`));
    if(!/stroke="#FFFFFF"/i.test(icon))fail(`${name} ${actionName} action-list icon must be monochrome white.`);
    if(!/#FFB21E/i.test(key)||!/#080A0E/i.test(key))fail(`${name} ${actionName} fallback key must use canonical PackRat key colors.`);
    for(const forbidden of ["icon.png","icon@2x.png","key.png","key@2x.png"]){
      if(await exists(path.join(dir,"imgs","actions",actionName,forbidden))){
        fail(`${name} ${actionName} ships competing pixel fallback ${forbidden}.`);
      }
    }
  }

  for(const pkg of ["@elgato/streamdeck","@elgato/schemas","@elgato/utils","ws","zod"]){
    await fs.access(path.join(dir,"node_modules",...pkg.split("/"),"package.json"));
  }
  const shippedWs=JSON.parse(await fs.readFile(path.join(dir,"node_modules","ws","package.json"),"utf8"));
  if(shippedWs.version!=="8.21.0")fail(`${name} must ship patched ws 8.21.0, got ${shippedWs.version}.`);

  const plugin=await fs.readFile(path.join(dir,"bin","plugin.mjs"),"utf8");
  if(!plugin.includes('from "@elgato/streamdeck"'))fail(`${name} is not using the official SDK runtime.`);
  if(plugin.includes("./streamdeck.mjs"))fail(`${name} still references the raw WebSocket runtime.`);
  if(!plugin.includes("streamDeck.ui.onSendToPlugin"))fail(`${name} must use global streamDeck.ui.onSendToPlugin PI transport.`);
  if(!plugin.includes("actionContext")||!plugin.includes("visible.get(actionContext)"))fail(`${name} global PI handler must resolve the selected actionContext.`);
  if(!plugin.includes("streamDeck.ui.sendToPropertyInspector"))fail(`${name} must use global streamDeck.ui.sendToPropertyInspector PI transport.`);
  if(/\.action\.sendToPropertyInspector/.test(plugin))fail(`${name} must not use per-action PI response transport.`);
  if(!plugin.includes("renderSnippetKey")||!plugin.includes("setImage("))fail(`${name} must runtime-render semantic snippet keys.`);
  if(!plugin.includes("loadSnippetSelection")||!plugin.includes("setSettings(selection.settings)"))fail(`${name} must repair stale/missing snippet selections before rendering or insertion.`);
  if(!plugin.includes("onLibraryChanged"))fail(`${name} must refresh runtime state when the local full-library manager saves.`);
  if(!plugin.includes('snippets: current.snippets.map(({ id, name, folder })'))fail(`${name} PI list transport must send snippet metadata only.`);
  if(!plugin.includes('type:"snippetDetail"')||!plugin.includes('payload.type === "getSnippet"'))fail(`${name} PI must lazy-load selected snippet content.`);
  if(plugin.includes('snippets: current.snippets.map(({ id, name, folder, content })'))fail(`${name} PI list transport must not send every snippet body.`);

}

const inspector=await fs.readFile(path.join(root,"ui","inspector.html"),"utf8");
const inspectorJs=await fs.readFile(path.join(root,"ui","inspector.js"),"utf8");
const inspectorCss=await fs.readFile(path.join(root,"ui","inspector.css"),"utf8");

if(!inspector.includes('class="packrat-topbar"'))fail("Property Inspector PackRat chrome must live in the canonical topbar.");
if(!inspector.includes('src="../imgs/plugin/packrat-logo.png"'))fail("Property Inspector must use the packaged PackRat logo asset.");
if(!inspector.includes("Loading snippets…"))fail("Property Inspector must show a clear snippet-loading state instead of a blank selector.");
if(!inspector.includes("Open snippet library"))fail("Property Inspector must expose a clear snippet-library control.");
if(!inspector.includes('id="topUpgrade"')||!inspector.includes("Upgrade to Pro ↗"))fail("Lite Property Inspector must include the canonical hidden top Pro conversion surface.");
if(!inspector.includes('class="upsell hidden"')||!inspector.includes("Open Text Expander Pro ↗"))fail("Lite Property Inspector must include the canonical bottom Pro feature card.");
if(!inspector.includes("multiline, tabbed, or very long text"))fail("Initial Smart insertion help must match the hardened structured-text fallback behavior.");
if(!inspector.includes("Dynamic text"))fail("Pro Property Inspector must explain available dynamic text.");
if(!inspector.includes("Open reusable variables & full library"))fail("Pro Property Inspector must expose reusable/global variables without requiring the hidden legacy action.");
if(!inspector.includes("{{name}}")||!inspector.includes("literal braces"))fail("Pro Property Inspector must explain how code/text can escape fill-in braces.");
if(!inspector.includes("Type text")||!inspector.includes("Paste with clipboard"))fail("Insert method copy must use plain-language labels.");
if(inspector.includes("Unicode typing")||inspector.includes("Clipboard paste + restore"))fail("Old technical insertion labels must not return.");

if(!inspectorJs.includes('context:uiUuid'))fail("Property Inspector websocket envelopes must use the PI UUID.");
if(!inspectorJs.includes("actionContext"))fail("Property Inspector must pass selected action context separately.");
if(!inspectorJs.includes('event:"getSettings",action:actionUuid,context:uiUuid'))fail("Property Inspector getSettings must use canonical PI UUID transport.");
if(!inspectorJs.includes('event:"setSettings",action:actionUuid,context:uiUuid'))fail("Property Inspector setSettings must use canonical PI UUID transport.");
if(!inspectorJs.includes('event:"sendToPlugin"'))fail("Property Inspector must use sendToPlugin for snippet library commands.");
if(inspectorJs.includes("context:actionContext"))fail("Property Inspector must not use the action instance as websocket context.");
if(!inspectorJs.includes("Saving…")||!inspectorJs.includes("Saved"))fail("Property Inspector must visibly report settings persistence.");
if(!inspectorJs.includes('document.createElement("optgroup")'))fail("Pro snippet selector must group the built-in library by folder.");
if(!inspectorJs.includes('type:"getSnippet"')||!inspectorJs.includes('"Loading snippet…"'))fail("Property Inspector must lazy-load only the selected snippet body.");
if(!inspectorJs.includes('type:"openManager"'))fail("Pro Property Inspector must wire the reusable-variable/full-library manager.");
if(!inspectorJs.includes('BUILD_VERIFIED_PRO_URL')||!inspectorJs.includes('__PACKRAT_VERIFIED_PRO_URL__'))fail("Source Property Inspector must reserve the verified Pro URL for build-time injection.");
if(!inspectorJs.includes('BUILD_VERIFIED_PRO_URL.startsWith("__PACKRAT_")'))fail("Property Inspector placeholder detection must survive replacement with a real Pro URL.");
if(inspectorJs.includes('BUILD_VERIFIED_PRO_URL==="__PACKRAT_VERIFIED_PRO_URL__"'))fail("Property Inspector must not compare against the full replaceable Pro URL placeholder.");
if(!inspectorJs.includes('const topUpgrade=$("topUpgrade")')||!inspectorJs.includes('topUpgrade.classList.remove("hidden")'))fail("Lite top Pro CTA must activate only through verified Pro URL state.");
if(!inspectorJs.includes('topUpgrade.classList.add("hidden")'))fail("Lite top Pro CTA must stay hidden without a verified Pro URL.");
if(!inspectorJs.includes("multiline, tabbed, or very long text"))fail("Smart insertion help must describe its structured-text clipboard fallback.");

for(const token of ["#080A0E","#151920","#0D1015","#FFB21E","#181C21","#FF5D6C"]){
  if(!inspectorCss.includes(token))fail(`Property Inspector CSS is missing canonical PackRat token ${token}.`);
}
if(!inspectorCss.includes("rgba(255,178,30,.12) 0%")||!inspectorCss.includes("top:-130px")||!inspectorCss.includes("right:-110px")){
  fail("Property Inspector must include the canonical top-right PackRat ambient glow.");
}

const buildSource=await fs.readFile(path.join(root,"scripts","build.mjs"),"utf8");
for(const forbidden of ["FONT_5X7","drawProfileLabel","profileKeyImage","CustomImages/state0.png"]){
  if(buildSource.includes(forbidden))fail(`Text Expander build must not restore pixel-profile renderer primitive: ${forbidden}`);
}
if(!buildSource.includes('key-visuals.mjs'))fail("Build must package the semantic runtime key renderer.");
if(!buildSource.includes('packrat-logo.png'))fail("Build must package the shared PackRat logo at the canonical PI path.");

const sourceLibrary=await fs.readFile(path.join(root,"src","library.mjs"),"utf8");
if(!sourceLibrary.includes("CURRENT_SCHEMA_VERSION = 3"))fail("Text Expander must migrate existing local libraries to schema v3.");
if(!sourceLibrary.includes("ensureSeeds"))fail("Text Expander v3 migration must restore missing built-in starter snippets.");

const map=JSON.parse(await fs.readFile(path.join(repoRoot,"products","lite-pro-map.json"),"utf8"));
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
const liteInspectorJs=await fs.readFile(path.join(root,"dist","com.packrat.textexpanderlite.sdPlugin","ui","inspector.js"),"utf8");
if(!liteInspectorJs.includes(`const BUILD_VERIFIED_PRO_URL=${JSON.stringify(expectedProUrl)}`)){
  fail("Lite packaged Property Inspector does not embed the same verified direct Pro URL as canonical metadata.");
}
if(liteInspectorJs.includes("__PACKRAT_VERIFIED_PRO_URL__")){
  fail("Lite packaged Property Inspector still contains the build-time Pro URL placeholder.");
}

const bridge=await fs.readFile(path.join(root,"runtime","win-bridge.ps1"),"utf8");
for(const forbidden of ["Invoke-Expression","iex ","cmd.exe /c","Start-Process"]){
  if(bridge.toLowerCase().includes(forbidden.toLowerCase()))fail(`Unsafe bridge primitive found: ${forbidden}`);
}
if(!bridge.includes("Invoke-ClipboardRetry"))fail("Windows bridge must retry transient clipboard locks.");
if(!bridge.includes("pasteDelayMs"))fail("Windows bridge must wait adaptively before restoring clipboard after paste.");
if(!bridge.includes("UnicodeChar('\\r')")||!bridge.includes("UnicodeChar('\\t')"))fail("Type text must inject authored newlines/tabs as text packets instead of submit/navigation keys.");

const windowsSource=await fs.readFile(path.join(root,"src","windows.mjs"),"utf8");
if(!windowsSource.includes("Windows bridge timed out while running")||!windowsSource.includes("15000")){
  fail("Windows bridge wrapper must time out hung host input work.");
}

const smoke=await fs.readFile(path.join(root,"scripts","hardware-smoke.ps1"),"utf8");
if(!smoke.includes("Get-OfficialPackagedContentDigest")||!smoke.includes("streamDeckPlugin")||!smoke.includes("Expand-Archive")){
  fail("Hardware smoke must hash the exact file set produced by the official Elgato packer, not approximate the raw build directory.");
}
if(!smoke.includes("lite_unpacked_content_sha256")||!smoke.includes("pro_unpacked_content_sha256")){
  fail("Hardware smoke must require exact unpacked-package digests for both editions.");
}

console.log("Text Expander structural QA passed.");
