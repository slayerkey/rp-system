import streamDeck,{SingletonAction} from '@elgato/streamdeck';
import {HAClient} from './ha-client.js';
import {render,imageData,neoFeedback,brightnessPct,brightnessSupport} from './render.js';
const PREFIX='com.packrat.home-assistant-streamdeck.';
const ACTIONS={status:'status',graph:'graph',overview:'overview',control:'control',trigger:'trigger',brightness:'brightness','neo-infobar':'neo-infobar'};
const ha=new HAClient();const visible=new Map();let renderTimer=null,piTimer=null;
const cleanIds=settings=>settings.entityIds?.filter(Boolean).slice(0,3)||[];
const normalize=(source={},kind)=>({
  entityId:String(source.entityId||''),entityIds:Array.isArray(source.entityIds)?source.entityIds.slice(0,3).map(String):[],
  windowMs:[30_000,60_000,300_000].includes(Number(source.windowMs))?Number(source.windowMs):60_000,
  dialStep:Math.max(1,Math.min(20,Number(source.dialStep)||5)),kind,
});
function log(e){try{streamDeck.logger.error(String(e?.message||e).replace(/Bearer\s+\S+/gi,'Bearer [hidden]').slice(0,300))}catch{}}
function refreshSoon(){if(renderTimer)return;renderTimer=setTimeout(()=>{renderTimer=null;void renderAll()},50);renderTimer.unref?.()}
function refreshInspector(){if(piTimer)return;piTimer=setTimeout(()=>{piTimer=null;void sendPI()},300);piTimer.unref?.()}
async function sendPI(){
  const id=String(streamDeck.ui.action?.id||''),rec=visible.get(id);if(!rec)return;
  await streamDeck.ui.sendToPropertyInspector({type:'ha.state',actionContext:id,connection:ha.state,detail:ha.detail||'',
    catalog:ha.catalog(),services:{light:{brightness:ha.serviceAvailable('light','turn_on')},switch:{toggle:ha.serviceAvailable('switch','toggle')},scene:{turn_on:ha.serviceAvailable('scene','turn_on')},script:{turn_on:ha.serviceAvailable('script','turn_on')}},
    settings:rec.settings}).catch(log);
}
async function renderRecord(rec,force=false){
  if(visible.get(rec.id)!==rec)return;
  if(rec.kind==='neo-infobar'){
    if(!rec.action?.isNeoInfobar?.())return;
    if(!rec.layout){try{await rec.action.setFeedbackLayout('layouts/neo-home.json');if(visible.get(rec.id)!==rec)return;rec.layout=true}catch(e){log(e);return}}
    const feedback=neoFeedback(ha,cleanIds(rec.settings)),signature=JSON.stringify(feedback);
    if(!force&&signature===rec.previous)return;
    if(visible.get(rec.id)!==rec)return;
    await rec.action.setFeedback(feedback).then(()=>{rec.previous=signature}).catch(log);return;
  }
  if(rec.kind==='brightness'&&rec.action?.isDial?.()){
    const entity=ha.entity(rec.settings.entityId),pct=entity&&brightnessSupport(entity)?brightnessPct(entity):null;
    const title=entity?.attributes?.friendly_name||'BRIGHTNESS';
    const feedback={title:title.slice(0,18),value:pct===null?'--':`${pct}%`,indicator:pct??0};
    const signature=JSON.stringify(feedback);if(!force&&signature===rec.previous)return;
    if(visible.get(rec.id)!==rec)return;
    await rec.action.setFeedback(feedback).then(()=>{rec.previous=signature}).catch(log);return;
  }
  if(!rec.action?.isKey?.())return;
  const svg=render(ha,rec.kind,rec.settings);
  if(!force&&svg===rec.previous)return;
  if(visible.get(rec.id)!==rec)return;
  await rec.action.setImage(imageData(svg)).then(()=>{rec.previous=svg}).catch(log);
}
async function renderAll(){await Promise.allSettled([...visible.values()].map(x=>renderRecord(x)));}
async function toggle(rec){
  const id=rec.settings.entityId,entity=ha.entity(id),domain=String(id||'').split('.')[0];
  if(!entity||['unavailable','unknown'].includes(entity.state))throw Error('Entity unavailable');
  if(!['light','switch','input_boolean'].includes(domain))throw Error('Choose a supported light or switch');
  const operation=entity.state==='on'?'turn_off':'turn_on';
  if(!ha.serviceAvailable(domain,operation))throw Error('Home Assistant does not advertise this service');
  await ha.call(domain,operation,id);
}
async function press(rec){
  try{
    if(rec.kind==='control')await toggle(rec);
    else if(rec.kind==='trigger'){
      const entity=ha.entity(rec.settings.entityId),domain=entity?.entity_id?.split('.')[0];
      if(!['scene','script'].includes(domain))throw Error('Select a scene or script');
      await ha.call(domain,'turn_on',entity.entity_id);
    }else if(rec.kind==='graph'){
      const windows=[30_000,60_000,300_000],at=windows.indexOf(rec.settings.windowMs);
      rec.settings={...rec.settings,windowMs:windows[(at+1)%windows.length]};await rec.action.setSettings(rec.settings);await renderRecord(rec,true);return;
    }else return;
    await rec.action.showOk?.();
  }catch(error){log(error);await rec.action.showAlert?.()}
}
class HomeAction extends SingletonAction{
  constructor(kind){super();this.kind=kind;this.manifestId=PREFIX+kind}
  async onWillAppear(ev){
    const id=String(ev.action?.id||'');if(!id)return;
    const rec={id,kind:this.kind,settings:normalize(ev.payload?.settings,this.kind),action:ev.action,previous:'',layout:false,dialTimer:null,dialTarget:null};
    visible.set(id,rec);await renderRecord(rec,true);
  }
  onWillDisappear(ev){const id=String(ev.action?.id||''),rec=visible.get(id);if(rec?.dialTimer)clearTimeout(rec.dialTimer);visible.delete(id)}
  async onDidReceiveSettings(ev){const rec=visible.get(String(ev.action?.id||''));if(!rec)return;rec.settings=normalize(ev.payload?.settings,rec.kind);rec.previous='';await renderRecord(rec,true);refreshInspector()}
  async onPropertyInspectorDidAppear(){await sendPI()}
  async onKeyDown(ev){const rec=visible.get(String(ev.action?.id||''));if(rec)await press(rec)}
  async onDialRotate(ev){
    const rec=visible.get(String(ev.action?.id||''));if(!rec||rec.kind!=='brightness')return;
    const entity=ha.entity(rec.settings.entityId);
    if(!entity||!brightnessSupport(entity)||!ha.serviceAvailable('light','turn_on')){await rec.action.showAlert?.();return}
    const ticks=Number(ev.payload?.ticks)||0;if(!ticks)return;
    const current=rec.dialTarget??brightnessPct(entity);
    rec.dialTarget=Math.max(1,Math.min(100,current+ticks*rec.settings.dialStep));
    if(rec.dialTimer)clearTimeout(rec.dialTimer);
    rec.dialTimer=setTimeout(async()=>{
      const target=rec.dialTarget;rec.dialTimer=null;rec.dialTarget=null;
      try{await ha.call('light','turn_on',rec.settings.entityId,{brightness_pct:target});await rec.action.showOk?.()}
      catch(e){log(e);await rec.action.showAlert?.()}
    },180);rec.dialTimer.unref?.();
  }
  async onDialDown(ev){const rec=visible.get(String(ev.action?.id||''));if(rec?.kind==='brightness'){try{await toggle(rec);await rec.action.showOk?.()}catch(e){log(e);await rec.action.showAlert?.()}}}
}
for(const kind of Object.keys(ACTIONS))streamDeck.actions.registerAction(new HomeAction(kind));
streamDeck.ui.onSendToPlugin(ev=>{
 const payload=ev.payload||{},id=String(payload.actionContext||'');
 // Never trust an arbitrary PI request to reconfigure another key.
 if(id!==String(streamDeck.ui.action?.id||''))return;
 if(payload.type==='ha.inspect')void sendPI();
});
streamDeck.settings.onDidReceiveGlobalSettings(ev=>{
 const value=ev.payload?.settings||{};
 ha.configure(value.homeAssistantUrl||'',value.homeAssistantToken||'');
});
ha.on('update',()=>{refreshSoon();refreshInspector()});ha.on('catalog',refreshInspector);
process.on('uncaughtException',log);process.on('unhandledRejection',log);
async function shutdown(){for(const r of visible.values())if(r.dialTimer)clearTimeout(r.dialTimer);ha.close();}
process.once('SIGTERM',()=>{void shutdown().then(()=>process.exit(0))});
process.once('SIGINT',()=>{void shutdown().then(()=>process.exit(0))});
async function start(){await streamDeck.connect();const global=await streamDeck.settings.getGlobalSettings();ha.configure(global.homeAssistantUrl||'',global.homeAssistantToken||'');streamDeck.system.onSystemDidWakeUp(()=>{const url=ha.url,token=ha.token;ha.disconnect();ha.url=url;ha.token=token;ha.retry=0;ha.connect()});}
start().catch(log);
