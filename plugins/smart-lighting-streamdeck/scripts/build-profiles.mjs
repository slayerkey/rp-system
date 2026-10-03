import {dirname,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {profileAction,writeProfiles} from "../../../tools/streamdeck/profile-builder.mjs";
import {UUID} from "../src/state.js";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const target=resolve(root,"com.packrat.smart-lighting-streamdeck.sdPlugin/profiles");
const action=(model,slot,kind,name,settings={})=>profileAction("lighting:"+model+":"+slot,UUID[kind],name,{targetId:"",...settings});
const mk2={
 "0,0":action("mk2","power1","power","Hue / Govee Power"),
 "1,0":action("mk2","power2","power","Second Light"),
 "2,0":action("mk2","bright1","brightness","Desk 35%",{brightness:35}),
 "3,0":action("mk2","bright2","brightness","Desk 75%",{brightness:75}),
 "4,0":action("mk2","favon","favorites","Favorites On",{powerMode:"on"}),
 "0,1":action("mk2","scene1","scene","Hue Scene"),
 "1,1":action("mk2","scene2","scene","Other Scene"),
 "2,1":action("mk2","warm","tone","Warm Light",{toneMode:"temperature",kelvin:2700}),
 "3,1":action("mk2","white","tone","White Light",{toneMode:"temperature",kelvin:4500}),
 "4,1":action("mk2","favoff","favorites","Favorites Off",{powerMode:"off"}),
 "0,2":action("mk2","power3","power","Third Light"),
 "1,2":action("mk2","power4","power","Fourth Light"),
 "2,2":action("mk2","orange","tone","Orange",{hex:"#FFB21E"}),
 "3,2":action("mk2","blue","tone","Blue",{hex:"#287BFF"}),
 "4,2":action("mk2","scene3","scene","Another Scene")
};
const xl={...Object.fromEntries(Object.entries(mk2).map(([coord,a])=>{const kind=Object.keys(UUID).find(k=>UUID[k]===a.UUID);return [coord,action('xl','base-'+coord,kind,a.Name,a.Settings)];}))};
for(const [i,s] of [20,40,60,80,100].entries())xl[i+",3"]=action("xl","brightness"+i,"brightness",s+"%",{brightness:s});
for(const [i,s] of ["#FF0000","#00FF00","#0000FF","#FFFFFF"].entries())xl[(i+4)+",3"]=action("xl","color"+i,"tone","Color "+i,{hex:s});
for(const [i,s] of [2400,3200,4000,5000,6200,7500].entries())xl[i+",2"]=action("xl","temp"+i,"tone","Temperature "+s+"K",{toneMode:"temperature",kelvin:s});
xl["6,2"]=action("xl","extra1","power","Extra Light");
xl["7,2"]=action("xl","extra2","scene","Scene");
const compact=model=>({
 "0,0":action(model,"power","power","Light Power"),
 "1,0":action(model,"brightness","brightness","Brightness",{brightness:65}),
 "2,0":action(model,"scene","scene","Scene"),
 "3,0":action(model,"favon","favorites","All Favorites ON",{powerMode:"on"}),
 "0,1":action(model,"tone","tone","Color / Temperature"),
 "1,1":action(model,"warm","tone","Warm White",{toneMode:"temperature",kelvin:2700}),
 "2,1":action(model,"power2","power","Other Light"),
 "3,1":action(model,"favoff","favorites","All Favorites OFF",{powerMode:"off"})
});
const specs=[
 {file:"lighting-mk2",name:"Smart Lighting",keypad:mk2},
 {file:"lighting-xl",name:"Smart Lighting XL",keypad:xl},
 {file:"lighting-plus",name:"Smart Lighting +",keypad:compact("plus"),
  encoder:{"0,0":action("plus","dial1","brightness","Light Brightness"),"1,0":action("plus","dial2","brightness","Other Brightness")}},
 {file:"lighting-neo",name:"Smart Lighting Neo",keypad:compact("neo")}
];
const actionIds=specs.flatMap(s=>Object.values(s.keypad).concat(Object.values(s.encoder||{})).map(a=>a.ActionID));
if(new Set(actionIds).size!==actionIds.length)throw Error("Duplicate profile ActionIDs");
await writeProfiles(target,specs);
console.log("Unique profile ActionIDs:",actionIds.length);
