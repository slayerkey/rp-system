import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root=resolve(".");
const plugin=resolve(root,"com.packrat.hwinfo-sensor-monitor.sdPlugin");
const manifest=JSON.parse(readFileSync(resolve(plugin,"manifest.json"),"utf8"));
const errors=[];
if(manifest.UUID!=="com.packrat.hwinfo-sensor-monitor")errors.push("unexpected plugin UUID");
if(manifest.Version!=="1.0.0.0")errors.push("unexpected version");
if(manifest.SDKVersion!==3)errors.push("SDKVersion must be 3");
if(manifest.Nodejs?.Version!=="24")errors.push("Node 24 required");
if((manifest.OS||[]).some(os=>os.Platform!=="windows"))errors.push("plugin must be Windows-only");
if((manifest.Actions||[]).length!==4)errors.push("expected exactly four focused actions");
const dashboard=(manifest.Actions||[]).find(a=>a.UUID.endsWith(".dashboard"));
if(!dashboard?.Controllers?.includes("Encoder"))errors.push("dashboard must support Encoder");
for(const p of manifest.Profiles||[]){
 const file=resolve(plugin,p.Name+".streamDeckProfile");
 if(!existsSync(file))errors.push("missing profile "+file);
}
function walk(dir){
 const out=[]; for(const e of readdirSync(dir,{withFileTypes:true})){const p=resolve(dir,e.name); if(e.isDirectory())out.push(...walk(p)); else out.push(p);} return out;
}
for(const file of walk(plugin)){
 const name=file.toLowerCase();
 if(/hwinfo.*\.(exe|dll|msi|zip)$/.test(name) && !name.includes("packrat.hwinfo"))errors.push("HWiNFO binary-like file must never be bundled: "+file);
}
for(const required of ["bin/plugin.js","native/PackRat.HWiNFOReader.exe","ui/inspector.html","imgs/plugin/packrat-logo.png"]){
 if(!existsSync(resolve(plugin,required)))errors.push("missing built file "+required);
}
if(errors.length){for(const e of errors)console.error("ERROR:",e);process.exit(1);}
console.log("PASS: package audit; no HWiNFO binaries bundled, four actions, Encoder support, major profiles present.");
