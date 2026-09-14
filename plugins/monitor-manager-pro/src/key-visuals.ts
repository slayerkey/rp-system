export type KeyKind =
  | "brightness" | "contrast" | "volume" | "power" | "input"
  | "refresh-rate" | "resolution" | "hdr" | "topology" | "primary"
  | "orientation" | "save-profile" | "apply-profile" | "status";

export const PRIMARY_ACCENT="#FFB21E";
export const ACCENT_HOVER="#FFC44D";
export const ACCENT_SOFT="rgba(255,178,30,.16)";
export const ACCENT_GLOW="rgba(255,178,30,.28)";


const GLYPHS:Record<KeyKind,string>={
  brightness:'<circle cx="36" cy="21" r="8"/><path d="M36 7v5M36 30v5M22 21h5M45 21h5M26 11l4 4M42 27l4 4M46 11l-4 4M30 27l-4 4"/>',
  contrast:'<circle cx="36" cy="21" r="15"/><path d="M36 6a15 15 0 0 1 0 30Z" fill="#fff" stroke="none"/><path d="M36 6v30"/>',
  volume:'<path d="M18 18h8l11-9v25l-11-8h-8Z"/><path d="M44 16c4 4 4 9 0 13M50 11c7 7 7 17 0 24"/>',
  power:'<path d="M36 6v15"/><path d="M26 12a15 15 0 1 0 20 0"/>',
  input:'<rect x="13" y="8" width="46" height="29" rx="4"/><path d="M8 22h27M28 15l7 7-7 7"/>',
  "refresh-rate":'<path d="M19 30a19 19 0 0 1 33-13"/><path d="M52 17V8M52 17h-9"/><path d="M53 27a19 19 0 0 1-33 8"/><path d="M20 35v9M20 35h9"/><path d="M36 15v8l6 4"/>',
  resolution:'<path d="M13 18V8h10M49 8h10v10M13 29v10h10M49 39h10V29"/><rect x="25" y="15" width="22" height="18" rx="2"/>',
  hdr:'<rect x="12" y="8" width="48" height="30" rx="5"/><path d="M22 30V17M22 23h8M30 30V17M37 17h6c7 0 7 13 0 13h-6ZM51 30V17h8"/>',
  topology:'<rect x="9" y="8" width="34" height="24" rx="3"/><rect x="29" y="15" width="34" height="24" rx="3"/>',
  primary:'<rect x="13" y="8" width="46" height="29" rx="4"/><path d="M36 13l2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8Z"/>',
  orientation:'<rect x="26" y="7" width="20" height="31" rx="3"/><path d="M16 14a22 22 0 0 1 9-7M17 14l-1-8M17 14l8 1M56 31a22 22 0 0 1-9 7M55 31l1 8M55 31l-8-1"/>',
  "save-profile":'<rect x="17" y="7" width="38" height="31" rx="4"/><path d="M26 7v11h20V7M29 30h14M36 21v11M31 27l5 5 5-5"/>',
  "apply-profile":'<rect x="16" y="7" width="40" height="31" rx="4"/><path d="M26 14h14M26 22h10M43 20l8 6-8 6Z"/>',
  status:'<path d="M15 32a22 22 0 0 1 42 0"/><path d="M36 32l10-12"/><circle cx="36" cy="32" r="3"/><path d="M20 37h32"/>'
};

function escapeXml(value:string):string{
  return value.replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]??c));
}

function normalizeLines(lines:string[]):string[]{
  const out=lines.flatMap((line)=>String(line??"").split(/\r?\n/)).map((line)=>line.trim()).filter(Boolean);
  return (out.length?out:["?"]).slice(0,2);
}

function textSize(lines:string[]):number{
  const max=Math.max(...lines.map((line)=>line.length));
  if(max<=5)return 24;
  if(max<=8)return 20;
  return 17;
}

export function compactResolutionLabel(width:unknown,height:unknown):string{
  const w=Math.round(Number(width)),h=Math.round(Number(height));
  if(!Number.isFinite(w)||!Number.isFinite(h)||w<=0||h<=0)return "RES ?";
  const a=Math.max(w,h),b=Math.min(w,h);
  const known=new Map([
    ["7680x4320","8K"],["5120x2160","5K2K"],["5120x1440","DQHD"],
    ["3840x2160","4K"],["3440x1440","UW1440"],["2560x1440","1440P"],
    ["2560x1080","UW1080"],["1920x1080","1080P"],["1280x720","720P"]
  ]);
  return known.get(a+"x"+b)??(w+"/"+h);
}

export function keyImage(kind:KeyKind,rawLines:string[]):string{
  const lines=normalizeLines(rawLines);
  const size=textSize(lines);
  const text=lines.length===1
    ? '<text x="72" y="131" text-anchor="middle" fill="#fff" font-family="Arial,sans-serif" font-size="'+size+'" font-weight="800">'+escapeXml(lines[0])+'</text>'
    : lines.map((line,index)=>'<text x="72" y="'+(index===0?112:136)+'" text-anchor="middle" fill="#fff" font-family="Arial,sans-serif" font-size="'+size+'" font-weight="800">'+escapeXml(line)+'</text>').join("");
  return "data:image/svg+xml;base64,"+Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">'+
    '<rect width="144" height="144" rx="24" fill="#05070A"/>'+
    '<g transform="translate(21 4) scale(1.42)" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">'+GLYPHS[kind]+'</g>'+
    text+'</svg>',
    "utf8"
  ).toString("base64");
}

export async function setKey(target:any,kind:KeyKind,lines:string[]):Promise<void>{
  if(!target?.isKey?.())return;
  await target.setTitle("");
  await target.setImage(keyImage(kind,lines));
}
