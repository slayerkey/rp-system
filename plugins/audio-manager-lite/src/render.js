const BG="#090C12",FG="#F5F7FA",ACCENT="#FFB21E",WARN="#FFC44D",DANGER="#FF5D6C";
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]));
const trunc=(v,max=13)=>{const a=Array.from(String(v||""));return a.length<=max?a.join(""):`${a.slice(0,max-1).join("")}…`;};
const data=body=>`data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">${body}</svg>`)}`;
const text=(y,v,size,fill=FG)=>`<text x="72" y="${y}" text-anchor="middle" fill="${fill}" font-family="Arial,Segoe UI,sans-serif" font-size="${size}" font-weight="850">${esc(v)}</text>`;
export function renderKey({device=null,missing=false,offline=false}={}){
  const color=offline?DANGER:missing?WARN:ACCENT;
  const raw=offline?"AUDIO OFFLINE":missing?"REBIND":device?.name||"SELECT DEVICE";
  const name=trunc(String(raw).replace(/\s+\([^)]*\)\s*$/u,"").trim()||raw,13);
  const size=Array.from(name).length<=8?19:Array.from(name).length<=11?17:15;
  const glyph=`<path d="M35 43h21l22-17v57L56 66H35z" fill="none" stroke="${FG}" stroke-width="6" stroke-linejoin="round"/><path d="M89 40c8 8 8 21 0 29M99 31c14 14 14 31 0 45" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round"/>`;
  return data(`<rect width="144" height="144" rx="24" fill="${BG}"/><rect x="6" y="6" width="132" height="132" rx="19" fill="none" stroke="${color}" stroke-width="3" opacity=".62"/>${glyph}${text(121,name,size,color)}`);
}
