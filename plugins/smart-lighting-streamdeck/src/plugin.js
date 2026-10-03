import streamDeck,{SingletonAction} from "@elgato/streamdeck";
import {UUID,KINDS,currentTarget,settingsFor,commandFor,favoriteCommands,SETUP_URL} from "./state.js";
import {LightingCompanion} from "./companion.js";
import {renderKey,viewFor,neoFeedback} from "./render.js";

const visible=new Map(),client=new LightingCompanion();
let renderScheduled=false,inspectorScheduled=false;
const log=e=>{try{streamDeck.logger.error(String(e?.stack||e?.message||e));}catch{}};
function schedule(){
 if(!renderScheduled){renderScheduled=true;setTimeout(()=>{renderScheduled=false;void renderAll();},80).unref?.();}
 if(!inspectorScheduled){inspectorScheduled=true;setTimeout(()=>{inspectorScheduled=false;void sendInspector();},250).unref?.();}
}
client.subscribe(schedule);
function getRecord(ev){return visible.get(String(ev?.action?.id||""));}
async function render(record){
 if(visible.get(record.id)!==record)return;
 const target=currentTarget(client.snapshot,record.settings.targetId);
 if(record.kind==="neo-infobar"){
  if(!record.action?.isNeoInfobar?.())return;
  if(!record.layout){await record.action.setFeedbackLayout("layouts/neo.json");record.layout=true;}
  if(visible.get(record.id)!==record)return;
  const v=neoFeedback(client.snapshot,client.state);
  await record.action.setFeedback(v);
  return;
 }
 if(record.action?.isDial?.()){
  const percentage=target?.capabilities?.brightness&&typeof target.brightness==="number"?Math.round(target.brightness):null;
  await record.action.setFeedback({
   title:target?String(target.name).slice(0,20):"Select light",
   value:client.state!=="connected"?client.state.toUpperCase():percentage===null?"N/A":percentage+"%",
   indicator:{value:percentage??0,range:{min:0,max:100}}
  });
  return;
 }
 if(!record.action?.isKey?.())return;
 const view=record.errorUntil>Date.now()?{top:"LIGHTING",value:"ERROR",foot:"OPEN SETTINGS",tone:"error"}:viewFor(record.kind,record.settings,target,client);
 const svg=renderKey(record.kind,view,144);
 if(svg===record.lastImage)return;
 record.lastImage=svg;
 await record.action.setImage(svg);
}
async function renderAll(){
 await Promise.allSettled([...visible.values()].map(render));
}
async function sendInspector(rec=null){
 const id=String(streamDeck.ui.action?.id||"");
 const record=rec||visible.get(id);
 if(!record||record.id!==id)return;
 const snapshot=client.snapshot;
 try{await streamDeck.ui.sendToPropertyInspector({
  type:"lighting.state",kind:record.kind,settings:record.settings,connection:client.state,
  detail:client.detail,targets:snapshot?.targets||[],providers:snapshot?.providers||{},
  error:record.errorUntil>Date.now()?record.errorMessage:""
 });}catch(e){log(e);}
}
async function execute(rec,command){
 try{await client.send(command);rec.errorMessage="";rec.errorUntil=0;rec.action.showOk?.().catch(()=>{});}
 catch(e){rec.errorMessage=e?.message||String(e);rec.errorUntil=Date.now()+5000;log(e);rec.action.showAlert?.().catch(()=>{});}
 schedule();
}
class LightingAction extends SingletonAction {
 constructor(uuid,kind){super();this.manifestId=uuid;this.kind=kind;}
 async onWillAppear(ev){
  const id=String(ev.action?.id||"");if(!id)return;
  const rec={id,action:ev.action,kind:this.kind,settings:settingsFor(ev.payload?.settings,this.kind),lastImage:"",layout:false,errorUntil:0,errorMessage:"",dialDelta:0,dialTimer:null};
  visible.set(id,rec);
  if(ev.action?.isDial?.())await ev.action.setFeedbackLayout("$B1");
  await render(rec);
 }
 onWillDisappear(ev){const r=getRecord(ev);if(r){clearTimeout(r.dialTimer);visible.delete(r.id);}}
 async onDidReceiveSettings(ev){
  const r=getRecord(ev);if(!r)return;
  r.settings=settingsFor(ev.payload?.settings,r.kind);r.lastImage="";
  await render(r);await sendInspector(r);
 }
 async onPropertyInspectorDidAppear(ev){await sendInspector(getRecord(ev));}
 async onKeyDown(ev){
  const r=getRecord(ev);if(!r||r.kind==="neo-infobar")return;
  if(client.state!=="connected"){await ev.action.showAlert?.();return;}
  if(r.kind==="favorites"){
   const commands=favoriteCommands(client.snapshot,r.settings.powerMode==="on");
   if(!commands.length){r.errorMessage="No power-capable favorites. Add favorites in the companion/widget.";r.errorUntil=Date.now()+5000;schedule();await ev.action.showAlert?.();return;}
   const results=[];
   for(const command of commands){try{results.push(await client.send(command));}catch(e){results.push(e);}}
   const failures=results.filter(x=>x instanceof Error);
   if(failures.length){r.errorMessage=failures.length+"/"+commands.length+" lighting commands not confirmed: "+failures[0].message;r.errorUntil=Date.now()+5000;await ev.action.showAlert?.();}
   else await ev.action.showOk?.();
   schedule();return;
  }
  const target=currentTarget(client.snapshot,r.settings.targetId);
  try{const cmd=commandFor(r.kind,target,r.settings);await execute(r,cmd);}
  catch(e){r.errorMessage=e?.message||String(e);r.errorUntil=Date.now()+5000;await ev.action.showAlert?.();schedule();}
 }
 onDialRotate(ev){
  const r=getRecord(ev);if(!r||r.kind!=="brightness")return;
  r.dialDelta+=Number(ev.payload?.ticks||0)*3;
  if(r.dialTimer)return;
  r.dialTimer=setTimeout(async()=>{
   r.dialTimer=null;
   const t=currentTarget(client.snapshot,r.settings.targetId),delta=r.dialDelta;r.dialDelta=0;
   if(!t?.capabilities?.brightness||t.reachable===false||client.state!=="connected")return;
   const value=Math.max(1,Math.min(100,Math.round(Number(t.brightness??50)+delta)));
   await execute(r,{command:"brightness",id:t.id,value});
  },100);
 }
 async onDialDown(ev){
  const r=getRecord(ev),t=currentTarget(client.snapshot,r?.settings.targetId);
  if(r&&t?.capabilities?.power&&t.reachable!==false)await execute(r,{command:"power",id:t.id,value:!t.on});
 }
}
for(const [kind,uuid] of Object.entries(UUID)){
 streamDeck.actions.registerAction(new LightingAction(uuid,kind));
}
streamDeck.ui.onSendToPlugin(ev=>{
 const p=ev?.payload||{},id=String(p.actionContext||"");
 if(!id||id!==String(streamDeck.ui.action?.id||""))return;
 const r=visible.get(id);if(!r)return;
 if(p.type==="lighting.inspect"){
  void (async()=>{
   const g=await streamDeck.settings.getGlobalSettings();
   client.configure(g?.pairingToken||"");await sendInspector(r);
  })().catch(log);
 }
 if(p.type==="lighting.setup")void streamDeck.system.openUrl(SETUP_URL);
 if(p.type==="lighting.download")void streamDeck.system.openUrl("https://packrat-site.pages.dev/downloads/smart-lighting");
});
streamDeck.settings.onDidReceiveGlobalSettings?.(ev=>{
 client.configure(ev?.payload?.settings?.pairingToken||"");
});
process.on("uncaughtException",log);process.on("unhandledRejection",log);
async function main(){
 await streamDeck.connect();
 const g=await streamDeck.settings.getGlobalSettings();
 client.configure(g?.pairingToken||"");
 schedule();
}
main().catch(log);
process.once("SIGTERM",()=>client.close());
process.once("SIGINT",()=>client.close());
