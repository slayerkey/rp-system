#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";

const rootArg=process.argv[2];
const flags=new Set(process.argv.slice(3));
const requireCanonicalPi=flags.has("--require-canonical-pi");
const requireLiteProUpsell=flags.has("--require-lite-pro-upsell");
if(!rootArg){
  console.error("Usage: node tools/qa/streamdeck-plugin-design-audit.mjs <plugin-source-root> [--require-canonical-pi] [--require-lite-pro-upsell]");
  process.exit(2);
}
const root=resolve(rootArg);
const errors=[];
const warnings=[];

function walk(dir,accept=()=>true){
  if(!existsSync(dir))return[];
  const out=[];
  for(const entry of readdirSync(dir,{withFileTypes:true})){
    const file=resolve(dir,entry.name);
    if(entry.isDirectory())out.push(...walk(file,accept));
    else if(accept(file))out.push(file);
  }
  return out;
}
function text(file){return existsSync(file)?readFileSync(file,"utf8"):"";}
function findPluginDir(){
  if(root.endsWith(".sdPlugin")&&existsSync(resolve(root,"manifest.json")))return root;
  const entries=readdirSync(root,{withFileTypes:true});
  const matches=entries.filter((entry)=>entry.isDirectory()&&entry.name.endsWith(".sdPlugin"));
  if(matches.length>1){
    errors.push("Multiple top-level .sdPlugin directories found; product metadata/rat-dev must identify the intended plugin directory.");
  }
  return matches.length?resolve(root,matches[0].name):null;
}
function localRef(base,src){
  if(!src||/^(https?:|data:|javascript:|#)/i.test(src))return null;
  return resolve(dirname(base),src.split(/[?#]/)[0]);
}
function uiBundleForHtml(htmlPath){
  const html=text(htmlPath);
  let combined=html;
  const css=[];
  for(const m of html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)){
    const file=localRef(htmlPath,m[1]);
    if(file&&existsSync(file))combined+="\n"+text(file);
    else if(file)errors.push("Property Inspector references missing script: "+file);
  }
  for(const m of html.matchAll(/<link[^>]+href=["']([^"']+\.css(?:[?#][^"']*)?)["']/gi)){
    const file=localRef(htmlPath,m[1]);
    if(file&&existsSync(file)){const t=text(file);combined+="\n"+t;css.push(t);}
    else if(file)errors.push("Property Inspector references missing stylesheet: "+file);
  }
  return {html,combined,css:css.join("\n")};
}
function collectPropertyInspectors(manifest){
  const paths=new Set();
  if(manifest.PropertyInspectorPath)paths.add(String(manifest.PropertyInspectorPath));
  for(const action of manifest.Actions??[]){
    if(action.PropertyInspectorPath)paths.add(String(action.PropertyInspectorPath));
  }
  return [...paths];
}

const pluginDir=findPluginDir();
if(!pluginDir){
  console.error("ERROR: no .sdPlugin directory found under "+root);
  process.exit(2);
}
const manifestPath=resolve(pluginDir,"manifest.json");
if(!existsSync(manifestPath)){
  console.error("ERROR: manifest.json not found at "+manifestPath);
  process.exit(2);
}
const manifest=JSON.parse(readFileSync(manifestPath,"utf8"));

const sourceFiles=walk(root,(file)=>/\.(?:js|mjs|cjs|ts)$/i.test(file)&&!file.includes("node_modules"));
const pluginSource=sourceFiles
  .filter(file=>/[\\/](?:src|bin)[\\/]/.test(file)||/[\\/]plugin\.(?:js|ts)$/i.test(file))
  .map(text).join("\n");

for(const action of manifest.Actions??[]){
  if(!(action.Controllers??[]).includes("Keypad"))continue;
  const suffix=String(action.UUID||"").split(".").pop();
  if(!suffix)errors.push((action.Name||"Unnamed action")+": action UUID has no stable semantic suffix");
  if(action.Icon&&!String(action.Icon).includes("/actions/"+suffix+"/")){
    warnings.push((action.Name||action.UUID)+": action Icon path does not mirror UUID suffix '"+suffix+"'");
  }
  for(const [index,state] of (action.States??[]).entries()){
    if(state.ShowTitle!==false)errors.push((action.Name||action.UUID)+" state "+index+": ShowTitle must be false");
  }
}

const piPaths=collectPropertyInspectors(manifest);
const piBundles=[];
for(const relative of piPaths){
  const file=resolve(pluginDir,relative);
  if(!existsSync(file)){
    errors.push("Property Inspector file is missing: "+relative);
    continue;
  }
  const ext=extname(file).toLowerCase();
  if(ext===".html")piBundles.push({path:file,...uiBundleForHtml(file)});
  else piBundles.push({path:file,html:"",combined:text(file),css:""});
}
const inspectorSource=piBundles.map(x=>x.combined).join("\n");
const inspectorCss=piBundles.map(x=>x.css).join("\n");

if(piPaths.length){
  if(!inspectorSource)errors.push("Property Inspector paths are declared but no inspector source could be read.");
  else{
    if(/sendToPlugin/.test(inspectorSource)&&!/context\s*:\s*uiUuid/.test(inspectorSource)){
      errors.push("Property Inspector sends plugin messages but does not use the PI UUID as websocket context.");
    }
    if(/sendToPlugin/.test(inspectorSource)&&!/actionContext/.test(inspectorSource)){
      errors.push("Property Inspector sends plugin commands but does not carry the selected action separately as actionContext.");
    }
    if(/setSettings/.test(inspectorSource)&&!/context\s*:\s*uiUuid/.test(inspectorSource)){
      errors.push("Property Inspector saves settings but does not use the PI UUID as websocket context.");
    }
    if(/actionInfo\.context/.test(inspectorSource)&&/context\s*:\s*actionContext/.test(inspectorSource)){
      errors.push("Property Inspector uses action context as websocket context; pass it separately in payload instead.");
    }
  }

  if(pluginSource){
    if(/sendToPlugin/.test(inspectorSource)&&!/streamDeck\.ui\.onSendToPlugin/.test(pluginSource)){
      errors.push("Plugin does not use global streamDeck.ui.onSendToPlugin for Property Inspector commands.");
    }
    if(/sendToPlugin/.test(inspectorSource)&&!/actionContext/.test(pluginSource)){
      errors.push("Plugin global PI handler does not appear to resolve the actionContext carried by the Property Inspector.");
    }
    if(/sendToPropertyInspector/.test(pluginSource)&&!/streamDeck\.ui\.sendToPropertyInspector/.test(pluginSource)){
      errors.push("Plugin sends Property Inspector state without the global streamDeck.ui channel.");
    }
    if(/\.action\.sendToPropertyInspector/.test(pluginSource)){
      errors.push("Per-action sendToPropertyInspector found; PackRat default is the global streamDeck.ui channel.");
    }
  }
}

if(requireCanonicalPi||requireLiteProUpsell){
  const allUi=walk(resolve(pluginDir,"ui"),file=>/\.(?:html|css|js|mjs)$/i.test(file)).map(text).join("\n");
  const css=walk(resolve(pluginDir,"ui"),file=>/\.css$/i.test(file)).map(text).join("\n");
  const logo=resolve(pluginDir,"imgs","plugin","packrat-logo.png");

  if(!/#080a0e/i.test(css))errors.push("Canonical PI: missing PackRat page background #080A0E.");
  if(!/#151920/i.test(css)||!/#0d1015/i.test(css))errors.push("Canonical PI: missing approved dark card gradient #151920 -> #0D1015.");
  if(!/#ffb21e/i.test(css))errors.push("Canonical PI: missing PackRat accent #FFB21E.");
  if(!/rgba\(255\s*,\s*178\s*,\s*30\s*,\s*\.12\)/i.test(css))warnings.push("Canonical PI: approved subtle top-right glow was not found.");
  if(!existsSync(logo))errors.push("Canonical PI: local imgs/plugin/packrat-logo.png is missing.");
  if(!/PackRat\s*↗/.test(allUi))errors.push("Canonical PI: PackRat ↗ brand link is missing.");
  if(!/marketplace\.elgato\.com\/maker\/packrat/i.test(allUi))errors.push("Canonical PI: PackRat maker URL is missing.");
  if(/\.packrat-logo[\s\S]{0,700}(?:mask-image|-webkit-mask|data:image)/i.test(allUi)){
    errors.push("Canonical PI: PackRat logo must render as a normal local <img>, not a CSS mask/data URI.");
  }
}

if(requireLiteProUpsell){
  const allUi=walk(resolve(pluginDir,"ui"),file=>/\.(?:html|css|js|mjs)$/i.test(file)).map(text).join("\n");
  if(!/packrat-topbar/.test(allUi))errors.push("Lite→Pro: .packrat-topbar is missing.");
  if(!/Upgrade to Pro\s*↗/.test(allUi))errors.push("Lite→Pro: top 'Upgrade to Pro ↗' CTA is missing.");
  if(!/(?:class=["'][^"']*\bupsell\b[^"']*["']|className\s*=\s*["']upsell["'])/.test(allUi))errors.push("Lite→Pro: bottom .upsell feature card is missing.");
  if(!/Open [^\n"'<>]{1,80} Pro\s*↗/.test(allUi))errors.push("Lite→Pro: bottom direct 'Open <Product> Pro ↗' CTA is missing.");
  if(!/marketplace\.elgato\.com\/product\//i.test(allUi))errors.push("Lite→Pro: no direct Pro Marketplace /product/ URL was found.");
  if(/marketplace\.elgato\.com\/(?:search|maker)\//i.test(allUi)&&!/marketplace\.elgato\.com\/product\//i.test(allUi)){
    errors.push("Lite→Pro: generic maker/search URL found without a direct Pro product URL.");
  }
  if(!/justify-content\s*:\s*space-between/i.test(allUi))warnings.push("Lite→Pro: top bar does not visibly use the approved left/right space-between layout.");
  if(!/white-space\s*:\s*nowrap/i.test(allUi))warnings.push("Lite→Pro: top CTA should use white-space: nowrap.");
}

const profileEntries=Array.isArray(manifest.Profiles)?manifest.Profiles:[];
if(profileEntries.length){
  const types=new Set(profileEntries.map((p)=>Number(p.DeviceType)));
  for(const profile of profileEntries){
    const name=String(profile?.Name??"Bundled profile");
    if(profile.AutoInstall!==true)errors.push(name+": AutoInstall must be true");
    if(profile.DontAutoSwitchWhenInstalled!==true)errors.push(name+": DontAutoSwitchWhenInstalled must be true");
    if(profile.Readonly!==false)errors.push(name+": Readonly must be false");
  }
  for(const [type,label] of [[0,"standard / MK.2"],[2,"XL"],[7,"Plus"],[9,"Neo"]]){
    if(!types.has(type))warnings.push("Bundled profiles do not cover "+label+" (DeviceType "+type+")");
  }
}

console.log("Stream Deck plugin design audit");
console.log("Plugin: "+root);
console.log("Actions: "+(manifest.Actions??[]).length);
console.log("Property Inspectors: "+piPaths.length);
console.log("Profiles: "+profileEntries.length);
if(requireCanonicalPi)console.log("Canonical PI: required");
if(requireLiteProUpsell)console.log("Lite→Pro pattern: required");
for(const warning of warnings)console.log("WARN: "+warning);
for(const error of errors)console.error("ERROR: "+error);
if(errors.length){
  console.error("FAIL: "+errors.length+" design contract error(s), "+warnings.length+" warning(s)");
  process.exit(1);
}
console.log("PASS: no design contract errors, "+warnings.length+" warning(s)");
