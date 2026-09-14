export type WirelessKeyKind = "device" | "battery" | "control" | "dashboard" | "cycle";

export const WIRELESS_ACCENT = "#FFB21E";

const GLYPHS: Record<WirelessKeyKind,string> = {
  device: '<circle cx="36" cy="23" r="7"/><path d="M22 28a17 17 0 0 1 28 0M15 21a25 25 0 0 1 42 0"/>',
  battery: '<rect x="16" y="12" width="37" height="22" rx="4"/><path d="M53 19h5v8h-5"/><path d="M22 18h17v10H22Z"/>',
  control: '<path d="M36 7v15"/><path d="M25 13a16 16 0 1 0 22 0"/>',
  dashboard: '<rect x="13" y="9" width="18" height="14" rx="2"/><rect x="41" y="9" width="18" height="14" rx="2"/><rect x="13" y="29" width="18" height="14" rx="2"/><rect x="41" y="29" width="18" height="14" rx="2"/>',
  cycle: '<path d="M18 18a21 21 0 0 1 31-5"/><path d="M49 13V5M49 13h-8"/><path d="M54 33a21 21 0 0 1-31 5"/><path d="M23 38v8M23 38h8"/>'
};

function escapeXml(value:string):string {
  return value.replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]??c));
}

function normalize(lines:string[]):string[] {
  const out=lines.flatMap(line=>String(line??"").split(/\r?\n/)).map(line=>line.trim()).filter(Boolean);
  return (out.length?out:["?"]).slice(0,2);
}

function fontSize(lines:string[]):number {
  const max=Math.max(...lines.map(line=>line.length));
  if(max<=5)return 24;
  if(max<=8)return 20;
  return 17;
}

export function wirelessKeyImage(kind:WirelessKeyKind, rawLines:string[]):string {
  const lines=normalize(rawLines);
  const size=fontSize(lines);
  const text=lines.length===1
    ? '<text x="72" y="131" text-anchor="middle" fill="#F5F7FB" font-family="Arial,sans-serif" font-size="'+size+'" font-weight="800">'+escapeXml(lines[0])+'</text>'
    : lines.map((line,index)=>'<text x="72" y="'+(index===0?112:136)+'" text-anchor="middle" fill="#F5F7FB" font-family="Arial,sans-serif" font-size="'+size+'" font-weight="800">'+escapeXml(line)+'</text>').join("");

  return "data:image/svg+xml;base64,"+Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">'+
    '<rect width="144" height="144" rx="24" fill="#05070A"/>'+
    '<rect x="0" y="0" width="5" height="144" rx="2.5" fill="'+WIRELESS_ACCENT+'"/>'+
    '<g transform="translate(21 4) scale(1.42)" fill="none" stroke="#F5F7FB" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">'+GLYPHS[kind]+'</g>'+
    text+'</svg>',
    "utf8"
  ).toString("base64");
}

export async function setWirelessKey(target:any, kind:WirelessKeyKind, lines:string[]):Promise<void> {
  if(!target?.isKey?.())return;
  await target.setTitle("");
  await target.setImage(wirelessKeyImage(kind,lines));
}
