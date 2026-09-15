import streamDeck,{SingletonAction} from "@elgato/streamdeck";
import { AudioHelper } from "./audio-helper.js";
import { renderKey } from "./render.js";

const ACTION="com.packrat.audio-manager-lite.set-output";
const PRO_URL="https://marketplace.elgato.com/maker/packrat";
const visible=new Map();
const helper=new AudioHelper({log});
let snapshot=null,lastError="",pollTimer=null,renderTimer=null;
let mutation=Promise.resolve();

streamDeck.logger.setLevel("info");
function log(v){try{streamDeck.logger.error(String(v));}catch{}}
function info(v){try{streamDeck.logger.info(String(v));}catch{}}
function ident(e){return{endpointId:String(e?.id||e?.endpointId||""),name:String(e?.name||""),containerId:String(e?.containerId||"").toLowerCase()};}
function settingsOf(raw={}){return{device:raw?.device&&typeof raw.device==="object"?ident(raw.device):null};}
function norm(v){return String(v||"").normalize("NFKC").trim().replace(/\s+/g," ").toLowerCase();}
function match(saved,list=[]){
  if(!saved)return{status:"unconfigured",endpoint:null};
  let endpoint=list.find(e=>String(e.id)===String(saved.endpointId||""));
  if(endpoint)return{status:"matched",endpoint};
  if(saved.containerId&&saved.name){
    const matches=list.filter(e=>norm(e.containerId)===norm(saved.containerId)&&norm(e.name)===norm(saved.name));
    if(matches.length===1)return{status:"matched",endpoint:matches[0]};
  }
  return{status:"missing",endpoint:null};
}
function currentOutput(){
  return (snapshot?.outputs||[]).find(e=>String(e.id)===String(snapshot?.defaultOutputId||""))||null;
}
function accept(s){snapshot=s||null;lastError=String(s?.error||"");schedule();return snapshot;}
async function refresh(){
  try{
    const r=await helper.snapshot();
    snapshot=r?.snapshot||null;lastError=String(r?.error||snapshot?.error||"");schedule();return snapshot;
  }catch(e){snapshot=null;lastError=String(e?.message||e);schedule();return null;}
}
function schedule(delay=20){
  if(renderTimer)return;
  renderTimer=setTimeout(()=>{renderTimer=null;void renderAll();},delay);renderTimer.unref?.();
}
async function renderRecord(record){
  if(!record?.action?.isKey?.())return;
  const m=match(record.settings.device,snapshot?.outputs||[]);
  const configured=Boolean(record.settings.device?.endpointId||record.settings.device?.name||record.settings.device?.containerId);
  const image=renderKey({device:m.endpoint||record.settings.device,missing:configured&&m.status!=="matched",offline:Boolean(lastError)});
  if(image===record.lastImage)return;
  record.lastImage=image;
  await record.action.setImage(image).catch(log);
}
async function sendInspector(record){
  if(!record?.inspectorOpen)return;
  try{
    await streamDeck.ui.sendToPropertyInspector({
      type:"audioManagerLite.state",
      snapshot,
      latestError:lastError,
      settings:record.settings,
      currentOutput:currentOutput(),
      proMarketplaceUrl:PRO_URL,
      lastResult:record.lastResult||null
    });
  }catch(e){log(e?.message||e);}
}
async function renderAll(){
  await Promise.allSettled([...visible.values()].map(renderRecord));
  for(const record of visible.values())if(record.inspectorOpen)void sendInspector(record);
}
function recordFrom(payload={}){
  const id=String(payload.actionContext||streamDeck.ui?.action?.id||"");
  return id?visible.get(id)||null:null;
}
async function setOutput(record){
  const m=match(record.settings.device,snapshot?.outputs||[]);
  if(m.status!=="matched"||!m.endpoint){
    record.lastResult={status:"FAILED",message:"Choose an output device first."};
    await record.action.showAlert().catch(()=>{});schedule();return;
  }
  try{
    const r=await helper.setDefaultOutput(m.endpoint.id);
    const ok=r?.ok===true&&String(r?.snapshot?.defaultOutputId||"")===String(m.endpoint.id)&&String(r?.snapshot?.multimediaOutputId||"")===String(m.endpoint.id);
    if(r?.snapshot)accept(r.snapshot);else await refresh();
    record.lastResult=ok?{status:"SUCCESS",message:`Switched to ${m.endpoint.name}`}:{status:"FAILED",message:r?.error||"Windows did not verify the output switch."};
    if(!ok)await record.action.showAlert().catch(()=>{});
    else await record.action.showOk().catch(()=>{});
  }catch(e){record.lastResult={status:"FAILED",message:String(e?.message||e)};await record.action.showAlert().catch(()=>{});await refresh();}
  schedule(0);
}
class SetOutputAction extends SingletonAction{
  async onWillAppear(ev){
    const id=String(ev.action?.id||"");if(!id)return;
    const record={id,action:ev.action,settings:settingsOf(ev.payload?.settings),lastImage:"",lastResult:null,inspectorOpen:false};
    visible.set(id,record);if(!snapshot)await refresh();await renderRecord(record);
  }
  onWillDisappear(ev){visible.delete(String(ev.action?.id||""));}
  async onDidReceiveSettings(ev){
    const r=visible.get(String(ev.action?.id||""));if(!r)return;
    r.settings=settingsOf(ev.payload?.settings);r.lastImage="";await renderRecord(r);if(r.inspectorOpen)await sendInspector(r);
  }
  async onPropertyInspectorDidAppear(ev){
    const r=visible.get(String(ev.action?.id||""));if(!r)return;
    r.inspectorOpen=true;await refresh();await sendInspector(r);
  }
  onPropertyInspectorDidDisappear(ev){const r=visible.get(String(ev.action?.id||""));if(r)r.inspectorOpen=false;}
  async onKeyDown(ev){
    const r=visible.get(String(ev.action?.id||""));if(!r)return;
    const run=mutation.catch(()=>{}).then(()=>setOutput(r));mutation=run.catch(log);return run;
  }
}
streamDeck.actions.registerAction(new SetOutputAction(ACTION));
streamDeck.ui.onSendToPlugin(ev=>{
  const p=ev?.payload||{},r=recordFrom(p);if(!r)return;
  r.inspectorOpen=true;
  if(p.type==="audioManagerLite.refresh")void refresh().then(()=>sendInspector(r));
  else if(p.type==="audioManagerLite.inspect")void refresh().then(()=>sendInspector(r));
});
streamDeck.ui.onDidAppear(()=>{const r=visible.get(String(streamDeck.ui?.action?.id||""));if(r){r.inspectorOpen=true;void refresh().then(()=>sendInspector(r));}});
streamDeck.ui.onDidDisappear(()=>{for(const r of visible.values())r.inspectorOpen=false;});
process.on("exit",()=>helper.shutdown());
process.on("SIGTERM",()=>{helper.shutdown();setTimeout(()=>process.exit(0),250);});
process.on("SIGINT",()=>{helper.shutdown();setTimeout(()=>process.exit(0),250);});
await streamDeck.connect();
info("Audio Manager Lite 1.0.0.0 connected.");
pollTimer=setInterval(()=>{if(visible.size)void refresh();},2000);pollTimer.unref?.();
