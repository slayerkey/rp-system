export const ACCENT="#FFB21E";

function escapeXml(value:string):string{
  return value.replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]??c));
}

function linesFor(mode:string,value:number):string[]{
  if(mode==="up")return["BRIGHT","+"];
  if(mode==="down")return["BRIGHT","-"];
  return[String(Math.round(value))+"%"];
}

export function brightnessLines(settings:{mode?:string;value?:number}):string[]{
  return linesFor(settings.mode??"set",Number(settings.value??65));
}

export function keyImage(lines:string[]):string{
  const clean=lines.map((line)=>String(line).trim()).filter(Boolean).slice(0,2);
  const text=clean.length===1
    ? '<text x="72" y="131" text-anchor="middle" fill="#fff" font-family="Arial,sans-serif" font-size="24" font-weight="800">'+escapeXml(clean[0])+'</text>'
    : clean.map((line,index)=>'<text x="72" y="'+(index===0?112:136)+'" text-anchor="middle" fill="#fff" font-family="Arial,sans-serif" font-size="20" font-weight="800">'+escapeXml(line)+'</text>').join("");
  const glyph='<circle cx="36" cy="22" r="8"/><path d="M36 7v5M36 32v5M21 22h5M46 22h5M25 11l4 4M43 29l4 4M47 11l-4 4M29 29l-4 4"/>';
  return "data:image/svg+xml;base64,"+Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">'+
    '<rect width="144" height="144" rx="24" fill="#05070A"/>'+
    '<rect x="8" y="12" width="5" height="32" rx="2.5" fill="'+ACCENT+'"/>'+
    '<g transform="translate(21 4) scale(1.42)" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">'+glyph+'</g>'+
    text+'</svg>',
    "utf8"
  ).toString("base64");
}

export async function setBrightnessKey(target:any,settings:{mode?:string;value?:number}):Promise<void>{
  if(!target?.isKey?.())return;
  await target.setTitle("");
  await target.setImage(keyImage(brightnessLines(settings)));
}
