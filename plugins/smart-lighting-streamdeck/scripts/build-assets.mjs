import {mkdir,rm,writeFile} from "node:fs/promises";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {keyFixture,renderKey} from "../src/render.js";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const dir=resolve(root,"com.packrat.smart-lighting-streamdeck.sdPlugin/imgs");
await rm(dir,{recursive:true,force:true});
const kinds=["power","brightness","tone","scene","favorites","neo-infobar"];
for(const kind of kinds){
 const dst=resolve(dir,"actions",kind);await mkdir(dst,{recursive:true});
 const glyphKind=kind==="neo-infobar"?"favorites":kind;
 await writeFile(resolve(dst,"key.svg"),keyFixture(glyphKind,"SETUP"));
 await writeFile(resolve(dst,"icon.svg"),keyFixture(glyphKind,""));
}
await mkdir(resolve(dir,"category"),{recursive:true});
await writeFile(resolve(dir,"category/icon.svg"),'<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><path d="M14 3v9M7 7a11 11 0 1014 0" fill="none" stroke="#F5F7FB" stroke-width="2.8" stroke-linecap="round"/></svg>');
await writeFile(resolve(dir,"category/icon@2x.svg"),'<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 28 28"><path d="M14 3v9M7 7a11 11 0 1014 0" fill="none" stroke="#F5F7FB" stroke-width="2.8" stroke-linecap="round"/></svg>');
// Export exactly 15 representative runtime SVGs for canonical Rat Art, not
// separate marketing mockups. The final ship hero rasterizes these same faces.
const scenes=[
 ["power","OFF","DESK LIGHT","hue"],["power","ON","DESK LIGHT","hue"],
 ["brightness","35%","DESK LIGHT","hue"],["brightness","75%","DESK LIGHT","hue"],
 ["favorites","2","FAVORITES","hue + govee"],["scene","APPLY","NIGHT SCENE","hue"],
 ["power","ON","ACCENT","govee"],["tone","2700K","DESK LIGHT","hue"],
 ["tone","#FFB21E","ACCENT","govee"],["favorites","2","FAVORITES","hue + govee"],
 ["power","SETUP","POWER",""],["brightness","SELECT","BRIGHTNESS",""],
 ["tone","4000K","ACCENT",""],["scene","APPLY","FOCUS","hue"],["power","OFFLINE","DESK LIGHT",""]
];
const svgs=resolve(root,"art-source-keys");
await rm(svgs,{recursive:true,force:true});await mkdir(svgs,{recursive:true});
for(const [i,[kind,value,top,provider]] of scenes.entries()){
 const tone=value==="OFFLINE"?"error":value==="ON"?"active":value==="OFF"?"neutral":"preset";
 await writeFile(resolve(svgs,String(i+1).padStart(2,"0")+".svg"),renderKey(kind,{top,value,foot:provider.toUpperCase(),tone},288));
}
console.log("Generated canonical PackRat lighting action art + 15 runtime faces");
