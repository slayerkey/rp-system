import { clamp } from "./state.js";
const BG="#080A0E",WHITE="#F5F7FB",MUTED="#9AA2AF",ORANGE="#FFB21E",GREEN="#2BE86A",RED="#FF5D6C";
const glyphs={
 power:'<path d="M72 25v48M47 41a42 42 0 1050 0"/>',
 brightness:'<circle cx="72" cy="67" r="18"/><path d="M72 25v-10M72 119v-10M30 67H20m104 0h-10M42 37l-8-8m68 77-8-8m8-69-8 8m-60 61 8-8"/>',
 tone:'<path d="M73 20a48 48 0 100 96 9 9 0 008-15c-5-7 1-14 9-14h10c19 0 29-18 22-32C112 34 94 20 73 20z"/><circle cx="44" cy="57" r="6"/><circle cx="65" cy="40" r="6"/><circle cx="93" cy="47" r="6"/>',
 scene:'<path d="M23 100L55 62l23 22 21-36 22 52M20 109h104"/><circle cx="103" cy="29" r="10"/>',
 favorites:'<path d="M72 22l15 31 35 5-25 25 6 35-31-16-31 16 6-35-25-25 35-5z"/>'
};
export const trim=(v,n=14)=>{const t=String(v||"").replace(/\s+/g," ").trim();return t.length>n?t.slice(0,n-1)+"…":t;};
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]));
export function viewFor(kind,settings,target,client){
 const state=client.state;
 if(state!=="connected")return {top:kind.toUpperCase(),value:state==="setup"?"SETUP":state==="unauthorized"?"PAIR":state==="incompatible"?"UPDATE":"OFFLINE",tone:state==="setup"?"neutral":"error"};
 if(kind==="favorites"){
  const fav=(client.snapshot?.targets||[]).filter(t=>t.favorite&&t.capabilities?.power&&t.kind!=="scene");
  return {top:settings.powerMode==="off"?"ALL FAVORITES OFF":"ALL FAVORITES ON",value:fav.length?String(fav.length):"NO FAV",tone:fav.length?"active":"neutral",foot:"HUE + GOVEE"};
 }
 if(!settings.targetId)return {top:kind.toUpperCase(),value:"SELECT",tone:"neutral"};
 if(!target)return {top:kind.toUpperCase(),value:"MISSING",tone:"error"};
 const name=trim(target.name,15),provider=target.provider.toUpperCase();
 if(target.reachable===false)return {top:name,value:"OFFLINE",foot:provider,tone:"error"};
 if(!target.capabilities?.[kind==="tone"?settings.toneMode:kind==="scene"?"scene":kind==="brightness"?"brightness":"power"])return{top:name,value:"N/A",foot:provider,tone:"error"};
 if(kind==="power")return{top:name,value:target.on?"ON":"OFF",foot:provider,tone:target.on?"active":"neutral"};
 if(kind==="brightness")return{top:name,value:String(settings.brightness)+"%",foot:provider+" PRESET",tone:"preset"};
 if(kind==="tone")return{top:name,value:settings.toneMode==="temperature"?String(settings.kelvin)+"K":settings.hex,foot:provider+" PRESET",tone:"preset"};
 if(kind==="scene")return{top:name,value:"APPLY",foot:provider+" SCENE",tone:"preset"};
 return {top:kind.toUpperCase(),value:"SETUP",tone:"neutral"};
}
export function renderKey(kind,view,size=144){
 const tone=view.tone==="error"?RED:view.tone==="active"?GREEN:view.tone==="preset"?ORANGE:WHITE;
 const top=trim(view.top,19),primary=trim(view.value,12),foot=trim(view.foot||"",20);
 // Separate state word sizing and explicit width guard; SVG remains sharp at 36px.
 const font=primary.length>9?19:primary.length>7?22:primary.length>5?26:35;
 return '<svg xmlns="http://www.w3.org/2000/svg" width="'+size+'" height="'+size+'" viewBox="0 0 144 144">'+
 '<rect width="144" height="144" rx="19" fill="'+BG+'"/>'+
 '<text x="72" y="19" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" font-weight="700" fill="'+MUTED+'">'+esc(top)+'</text>'+
 '<g fill="none" stroke="'+tone+'" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" transform="translate(41 20) scale(.43)">'+(glyphs[kind]||glyphs.power)+'</g>'+
 '<text x="72" y="112" text-anchor="middle" font-family="Arial,sans-serif" font-size="'+font+'" font-weight="800" fill="'+tone+'">'+esc(primary)+'</text>'+
 '<text x="72" y="135" text-anchor="middle" font-family="Arial,sans-serif" font-size="10" font-weight="700" fill="'+MUTED+'">'+esc(foot)+'</text></svg>';
}
export function keyFixture(kind,value="SETUP"){return renderKey(kind,{top:kind.toUpperCase(),value,tone:value==="ERROR"?"error":"preset",foot:"HUE + GOVEE"});}
export function neoFeedback(snapshot,status){
 if(status!=="connected")return{left:"LIGHTS",center:status==="setup"?"PAIR":status==="unauthorized"?"TOKEN":"OFFLINE",right:""};
 const t=(snapshot?.targets||[]).filter(x=>x.kind!=="scene"&&x.capabilities?.power);
 return{left:"LIGHTS",center:String(t.filter(x=>x.on).length)+"/"+t.length+" ON",right:trim(t.filter(x=>x.on).map(x=>x.name).join(", ")||"ALL OFF",16)};
}
