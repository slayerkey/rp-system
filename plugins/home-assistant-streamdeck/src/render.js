// Compact full-key renderer adapted from Performance Grapher and PackRat semantic key rules.
import {numeric} from './history.js';
const BG='#080A0E',TEXT='#F5F7FB',MUTED='#9AA2AF',ACCENT='#FFB21E',BAD='#FF5D6C',GOOD='#2BE86A';
const xml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const short=(v,n)=>{const s=String(v??'').replace(/\s+/g,' ').trim();return s.length>n?s.slice(0,n-1)+'…':s};
export const GLYPHS={
 status:'<circle cx="72" cy="72" r="32" fill="none" stroke="currentColor" stroke-width="9"/><path d="M72 45v30l20 15" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round"/>',
 graph:'<path d="M18 100L41 78 63 86 82 46 106 66 126 35" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>',
 control:'<path d="M69 21v53M46 32a42 42 0 1 0 52 0" fill="none" stroke="currentColor" stroke-width="10" stroke-linecap="round"/>',
 trigger:'<path d="M74 16L39 80h32l-4 49 40-68H76z" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/>',
 overview:'<rect x="20" y="29" width="44" height="40" rx="8" fill="none" stroke="currentColor" stroke-width="6"/><rect x="80" y="29" width="44" height="40" rx="8" fill="none" stroke="currentColor" stroke-width="6"/><rect x="20" y="79" width="44" height="40" rx="8" fill="none" stroke="currentColor" stroke-width="6"/><rect x="80" y="79" width="44" height="40" rx="8" fill="none" stroke="currentColor" stroke-width="6"/>',
 brightness:'<circle cx="72" cy="72" r="20" fill="none" stroke="currentColor" stroke-width="8"/><path d="M72 16v23m0 66v23M16 72h23m66 0h23M32 32l16 16m48 48l16 16m0-80L96 48M48 96l-16 16" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>',
};
export function statusFor(client,id){
 if(client.state==='SETUP')return{state:'SETUP',detail:'CONNECT HOME',color:ACCENT};
 if(client.state==='AUTH_ERROR')return{state:'TOKEN',detail:'REJECTED',color:BAD};
 if(client.state==='ERROR')return{state:'ERROR',detail:'CHECK SETUP',color:BAD};
 if(client.state!=='LIVE')return{state:client.state==='OFFLINE'?'OFFLINE':'WAITING',detail:'NOT LIVE',color:MUTED};
 if(!id)return{state:'SETUP',detail:'SELECT ENTITY',color:ACCENT};
 const entity=client.entity(id);if(!entity)return{state:'MISSING',detail:'SELECT AGAIN',color:BAD};
 if(['unknown','unavailable'].includes(String(entity.state).toLowerCase()))return{state:'NO DATA',detail:'UNAVAILABLE',color:BAD};
 return null;
}
function sparkline(points,x,y,w,h){
 if(points.length<2)return '';
 const data=points.slice(-50),v=data.map(p=>p[1]),min=Math.min(...v),max=Math.max(...v),span=Math.max(0.01,max-min),start=data[0][0],duration=Math.max(1,data.at(-1)[0]-start);
 return '<path d="'+data.map((p,i)=>(i?'L':'M')+(x+(p[0]-start)/duration*w).toFixed(1)+' '+(y+h-(p[1]-min)/span*h).toFixed(1)).join(' ')+'" fill="none" stroke="'+ACCENT+'" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>';
}
function text(x,y,value,font=16,color=TEXT,anchor='start'){return `<text x="${x}" y="${y}" fill="${color}" font-family="Arial,sans-serif" font-weight="700" font-size="${font}" text-anchor="${anchor}">${xml(value)}</text>`}
function generic(kind,label,value,detail,color=ACCENT,graph=''){
 const v=short(value,11),error=/^(SETUP|TOKEN|ERROR|OFFLINE|WAITING|MISSING|NO DATA)$/.test(v),big=error?Math.min(27,160/Math.max(5,v.length)):Math.min(38,220/Math.max(4,v.length));
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 144 144" width="144" height="144"><rect width="144" height="144" rx="22" fill="${BG}"/><path d="M13 10h118" stroke="${color}" stroke-width="5" stroke-linecap="round"/>${text(15,33,short(label.toUpperCase(),14),14,MUTED)}${text(72,82,v,big,error?color:TEXT,'middle')}${graph||text(72,114,short(detail,17),15,color,'middle')}</svg>`;
}
function display(entity){const n=numeric(entity.state),unit=String(entity.attributes?.unit_of_measurement||'');if(n!==null)return `${Math.abs(n)>=100?Math.round(n):Math.round(n*10)/10}${unit}`;return short(String(entity.state).replaceAll('_',' ').toUpperCase(),11)}
export function render(client,kind,settings={}){
 const ids=(Array.isArray(settings.entityIds)?settings.entityIds:[]).filter(Boolean);
 const id=kind==='overview'?ids[0]:settings.entityId;
 const unavailable=statusFor(client,id);
 if(kind==='overview'){
  if(client.state!=='LIVE'||!ids.length)return generic(kind,'HOME OVERVIEW',unavailable?.state||'SETUP',unavailable?.detail||'PICK 3 SENSORS',unavailable?.color||ACCENT);
  // All three columns have equal hierarchy, with explicit per-cell unavailable states.
  const cols=ids.slice(0,3).map((e,i)=>{const entity=client.entity(e);const value=!entity?'MISSING':['unavailable','unknown'].includes(entity.state)?'N/A':display(entity);const label=short(entity?.attributes?.friendly_name||e.split('.')[1],7);const x=24+i*48;return `<g clip-path="url(#slot${i})">`+text(x,64,label,9,MUTED,'middle')+text(x,94,short(value,7),Math.min(14,88/Math.max(6,value.length)),!entity?BAD:TEXT,'middle')+'</g>'});
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 144 144" width="144" height="144"><rect width="144" height="144" rx="22" fill="${BG}"/><path d="M13 10h118" stroke="${ACCENT}" stroke-width="5" stroke-linecap="round"/><defs><clipPath id="slot0"><rect x="2" y="47" width="44" height="58"/></clipPath><clipPath id="slot1"><rect x="50" y="47" width="44" height="58"/></clipPath><clipPath id="slot2"><rect x="98" y="47" width="44" height="58"/></clipPath></defs>${text(15,32,'HOME OVERVIEW',13,MUTED)}${cols.join('')}${text(72,127,'LIVE • '+ids.length+' ENTITIES',11,GOOD,'middle')}</svg>`;
 }
 const label=kind==='graph'?'LIVE HISTORY':kind==='control'?'SMART CONTROL':kind==='trigger'?'SCENE / SCRIPT':'ENTITY STATUS';
 if(unavailable)return generic(kind,label,unavailable.state,unavailable.detail,unavailable.color);
 const entity=client.entity(id),name=entity.attributes?.friendly_name||id;
 const value=display(entity);
 if(kind==='graph'){
  const n=client.liveNumeric(id);if(n===null)return generic(kind,short(name,14),'NO DATA','NOT NUMERIC',BAD);
  const graph=sparkline(client.history.get(id)?.series(Number(settings.windowMs)||60_000)||[],17,99,110,28);
  return generic(kind,short(name,14),value,graph?'':'COLLECTING',ACCENT,graph);
 }
 if(kind==='control'){
  const domain=id.split('.')[0],supported=['light','switch','input_boolean'].includes(domain);
  const operation=entity.state==='on'?'turn_off':'turn_on';
  if(!supported||!client.serviceAvailable(domain,operation))return generic(kind,short(name,14),'NO SERVICE','NOT SUPPORTED',BAD);
  return generic(kind,short(name,14),value,'PRESS TO TOGGLE',entity.state==='on'?GOOD:ACCENT);
 }
 if(kind==='trigger'){
  const domain=id.split('.')[0];
  if(!['scene','script'].includes(domain)||!client.serviceAvailable(domain,'turn_on'))return generic(kind,short(name,14),'NO SERVICE','NOT SUPPORTED',BAD);
  return generic(kind,short(name,14),'RUN','PRESS TO ACTIVATE',ACCENT);
 }
 return generic(kind,short(name,14),value,kind==='status'?'LIVE STATE':'',entity.state==='on'?GOOD:ACCENT);
}
export function imageData(svg){return 'data:image/svg+xml;base64,'+Buffer.from(svg).toString('base64')}
export function neoFeedback(client,ids){
 const slots=[0,1,2].map(index=>{const id=ids[index],entity=id&&client.entity(id);if(client.state!=='LIVE')return{label:index===0?'HOME':'',value:'--'};if(!entity)return{label:id?short(id,10):'SELECT',value:'--'};return{label:short(entity.attributes?.friendly_name||id,11),value:display(entity)}});
 return {firstLabel:slots[0].label,firstValue:slots[0].value,secondLabel:slots[1].label,secondValue:slots[1].value,thirdLabel:slots[2].label,thirdValue:slots[2].value};
}
export function brightnessSupport(entity){return !!(entity?.entity_id?.startsWith('light.')&&Array.isArray(entity.attributes?.supported_color_modes)&&entity.attributes.supported_color_modes.some(m=>['brightness','color_temp','hs','xy','rgb','rgbw','rgbww','white'].includes(m)))}
export function brightnessPct(entity){return entity?.state==='on'&&numeric(entity.attributes?.brightness)!==null?Math.round(Number(entity.attributes.brightness)/255*100):0}
