#!/usr/bin/env node
// Tests the actual PackRat shared Stream Deck transport against a disposable, real Home Assistant Core.
import {writeFile,mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {HAClient,HA_STATES} from '../src/ha-client.js';

let base=process.argv[2] || 'http://127.0.0.1:8123'; while(base.endsWith('/'))base=base.slice(0,-1);
const reportPath=resolve(process.argv[3]||'qa-evidence/real-home-assistant.json');
const id='sensor.ratpack_qa_streamdeck';
const clientId=base+'/';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function api(path,options={}){
 const r=await fetch(base+path,options),body=await r.text();
 let data;try{data=JSON.parse(body)}catch{data=body}
 return {status:r.status,ok:r.ok,data};
}
async function until(check,detail,attempts=80){
 for(let i=0;i<attempts;i++){
  const value=await check();if(value)return value;
  await pause(250);
 }
 throw new Error('Real Home Assistant did not satisfy '+detail);
}
async function onboard(){
 let ready=false;
 for(let i=0;i<90;i++){
  try{let r=await api('/api/onboarding');if(r.ok){ready=true;break}}catch{}
  await pause(2000);
 }
 if(!ready)throw new Error('Real HA Core did not start');
 const users=await api('/api/onboarding/users',{
  method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({client_id:clientId,name:'RatPack CI',username:'ratpack_streamdeck_qa',password:'CI-Disposable-Only-2026!',language:'en'})
 });
 if(!users.ok||!users.data?.auth_code)throw new Error('Home Assistant onboarding failed HTTP '+users.status);
 const form=new URLSearchParams({client_id:clientId,grant_type:'authorization_code',code:users.data.auth_code});
 const token=await api('/auth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:form});
 if(!token.ok||!token.data?.access_token)throw new Error('Real HA authentication failed HTTP '+token.status);
 return token.data.access_token;
}
async function seed(token,state){
 const response=await api('/api/states/'+id,{
  method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify({state,attributes:{friendly_name:'Real Core QA Temperature',unit_of_measurement:'°F'}})
 });
 if(!response.ok||response.data?.entity_id!==id)throw new Error('Real HA state seeding failed HTTP '+response.status);
}
const report={schema_version:1,evidence_type:'real Home Assistant Core WebSocket transport (not physical Stream Deck)',passed:false,initial:null,update:null,auth_rejection:false,history_samples:0};
let ha,invalid;
try{
 const token=await onboard();
 await seed(token,'72');
 ha=new HAClient();ha.configure(base,token);
 await until(()=>ha.state===HA_STATES.LIVE&&ha.entity(id)?.state==='72','initial authenticated WebSocket snapshot',120);
 report.initial=ha.entity(id).state;
 await seed(token,'73.5');
 await until(()=>ha.entity(id)?.state==='73.5','live state_changed subscription',120);
 report.update=ha.entity(id).state;
 report.history_samples=ha.history.get(id)?.raw?.length||0;
 if(report.history_samples<2)throw new Error('Real HA history must contain two genuinely observed updates');
 invalid=new HAClient();invalid.configure(base,'ci-intentionally-invalid-token');
 await until(()=>invalid.state===HA_STATES.AUTH_ERROR,'rejected invalid access token',120);
 report.auth_rejection=true;
 report.passed=true;
 console.log('REAL HOME ASSISTANT CORE PASS: snapshot, pushed updates, bounded observed history, rejected bad token');
}finally{
 ha?.close();invalid?.close();
 await mkdir(dirname(reportPath),{recursive:true});await writeFile(reportPath,JSON.stringify(report,null,2)+'\\n');
}
