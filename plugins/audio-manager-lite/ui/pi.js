const PACKRAT_MAKER_URL="https://marketplace.elgato.com/maker/packrat";
let ws=null,uiUuid="",actionContext="",aid="",settings={device:null},state=null,proUrl=PACKRAT_MAKER_URL,seq=0;
const $=id=>document.getElementById(id);
const norm=v=>String(v||"").normalize("NFKC").trim().replace(/\s+/g," ").toLowerCase();
function send(x){if(ws?.readyState===WebSocket.OPEN){ws.send(JSON.stringify(x));return true}return false}
function openUrl(url){send({event:"openUrl",payload:{url:url||PACKRAT_MAKER_URL}})}
function ident(e){return{endpointId:String(e?.id||e?.endpointId||""),name:String(e?.name||""),containerId:String(e?.containerId||"").toLowerCase()}}
function resolve(saved,list=[]){if(!saved)return null;let e=list.find(x=>String(x.id)===String(saved.endpointId||""));if(e)return e;if(saved.containerId&&saved.name){const m=list.filter(x=>norm(x.containerId)===norm(saved.containerId)&&norm(x.name)===norm(saved.name));if(m.length===1)return m[0]}return null}
function opt(sel,v,label,selected=false){const o=document.createElement("option");o.value=v;o.textContent=label;o.selected=selected;sel.appendChild(o)}
function save(){send({event:"setSettings",action:aid,context:uiUuid,payload:settings})}
function request(type){seq+=1;send({event:"sendToPlugin",action:aid,context:uiUuid,payload:{type,actionContext,requestId:`aml-${Date.now()}-${seq}`}})}
function render(){
  const snap=state?.snapshot||null,error=state?.latestError||snap?.error||"";
  const dot=$("dot");dot.className="dot";
  if(error){dot.classList.add("error");$("status").textContent="Windows audio unavailable";$("detail").textContent=error}
  else if(snap){dot.classList.add("ready");$("status").textContent="Windows audio connected";$("detail").textContent=`${snap.outputs?.length||0} playback devices`}
  const list=Array.isArray(snap?.outputs)?snap.outputs:[],sel=$("device"),saved=settings.device,found=resolve(saved,list);
  sel.replaceChildren();opt(sel,"",list.length?"Choose a device":"No outputs detected",!saved);
  if(saved&&!found)opt(sel,"__saved__",`Missing · ${saved.name||"saved device"} · rebind required`,true);
  for(const e of list)opt(sel,String(e.id),String(e.name||"Unnamed audio device"),found?.id===e.id);
  const hint=$("hint");hint.classList.toggle("warn",Boolean(saved&&!found));
  hint.textContent=saved&&!found?"Saved device is missing. Select the intended output to rebind it.":"Choose the speaker, headset, or playback device this key should switch to.";
  $("current").textContent=state?.currentOutput?.name||"No active output";
  const r=state?.lastResult,box=$("result");
  if(r?.status){box.hidden=false;box.className=`result ${String(r.status).toLowerCase()}`;box.textContent=`${r.status} · ${r.message||""}`}else box.hidden=true;
  proUrl=state?.proMarketplaceUrl||PACKRAT_MAKER_URL;
}
window.connectElgatoStreamDeckSocket=(port,u,reg,info,raw)=>{
  uiUuid=u;const a=JSON.parse(raw||"{}");actionContext=String(a.context||"");aid=String(a.action||"");settings={device:a.payload?.settings?.device||null};
  ws=new WebSocket(`ws://127.0.0.1:${port}`);
  ws.onopen=()=>{send({event:reg,uuid:uiUuid});send({event:"getSettings",action:aid,context:uiUuid});request("audioManagerLite.inspect")};
  ws.onmessage=e=>{let m;try{m=JSON.parse(e.data)}catch{return}if(m.event==="didReceiveSettings"){settings={device:m.payload?.settings?.device||null};render()}if(m.event==="sendToPropertyInspector"&&m.payload?.type==="audioManagerLite.state"){state=m.payload;settings={device:m.payload?.settings?.device||settings.device};render()}};
};
$("brand").addEventListener("click",()=>openUrl(PACKRAT_MAKER_URL));$("topPro").addEventListener("click",()=>openUrl(proUrl));$("pro").addEventListener("click",()=>openUrl(proUrl));$("refresh").addEventListener("click",()=>request("audioManagerLite.refresh"));
$("device").addEventListener("change",()=>{const v=$("device").value,list=state?.snapshot?.outputs||[];if(!v)settings={device:null};else if(v!=="__saved__"){const e=list.find(x=>String(x.id)===v);if(e)settings={device:ident(e)}}save();render()});
