export type WirelessKeyKind =
  | "status"
  | "battery"
  | "charging"
  | "connect"
  | "disconnect"
  | "control"
  | "dashboard"
  | "group"
  | "cycle";

export const WIRELESS_ACCENT = "#FFB21E";
export const ACCENT_RAIL = '<rect x="8" y="12" width="5" height="32" rx="2.5" fill="'+WIRELESS_ACCENT+'"/>';

const GLYPHS: Record<WirelessKeyKind,string> = {
  status:
    '<rect x="13" y="9" width="46" height="31" rx="7"/>'+
    '<path d="M22 31h18"/>'+
    '<circle cx="49" cy="19" r="4" fill="#FFB21E" stroke="none"/>',
  battery:
    '<rect x="14" y="12" width="40" height="24" rx="4"/>'+
    '<path d="M54 19h5v10h-5"/>'+
    '<path d="M21 19h20v10H21Z"/>',
  charging:
    '<rect x="14" y="12" width="40" height="24" rx="4"/>'+
    '<path d="M54 19h5v10h-5"/>'+
    '<path d="M37 14l-9 13h8l-4 11 12-16h-8Z" fill="#FFB21E" stroke="none"/>',
  connect:
    '<path d="M30 30h-7a9 9 0 0 1 0-18h10a9 9 0 0 1 7 3"/>'+
    '<path d="M42 12h7a9 9 0 0 1 0 18H39a9 9 0 0 1-7-3"/>'+
    '<path d="M27 21h18"/>'+
    '<path d="M54 5v10M49 10h10" stroke="#FFB21E"/>',
  disconnect:
    '<path d="M30 30h-7a9 9 0 0 1 0-18h10a9 9 0 0 1 7 3"/>'+
    '<path d="M42 12h7a9 9 0 0 1 0 18H39a9 9 0 0 1-7-3"/>'+
    '<path d="M12 38L60 4" stroke="#FFB21E"/>',
  control:
    '<path d="M30 30h-7a9 9 0 0 1 0-18h10a9 9 0 0 1 7 3"/>'+
    '<path d="M42 12h7a9 9 0 0 1 0 18H39a9 9 0 0 1-7-3"/>'+
    '<path d="M14 36L58 6" stroke="#FFB21E"/>',
  dashboard:
    '<circle cx="17" cy="13" r="3" fill="#FFB21E" stroke="none"/>'+
    '<circle cx="17" cy="24" r="3"/>'+
    '<circle cx="17" cy="35" r="3"/>'+
    '<path d="M26 13h31M26 24h31M26 35h31"/>',
  group:
    '<path d="M10 15h18l6 6h28v25H10Z"/>'+
    '<circle cx="24" cy="33" r="3" fill="#FFB21E" stroke="none"/>'+
    '<circle cx="36" cy="33" r="3"/>'+
    '<circle cx="48" cy="33" r="3"/>',
  cycle:
    '<path d="M21 9l3.2 6.5 7.2 1-5.2 5.1 1.2 7.1L21 25.3l-6.4 3.4 1.2-7.1-5.2-5.1 7.2-1Z" fill="#FFB21E" stroke="none"/>'+
    '<path d="M34 23h25M51 15l8 8-8 8"/>'
};

function escapeXml(value:string):string {
  return value.replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]??c));
}

function normalize(lines:string[]):string[] {
  const out=lines
    .flatMap(line=>String(line??"").split(/\r?\n/))
    .map(line=>line.trim())
    .filter(Boolean);
  return (out.length?out:["?"]).slice(0,2);
}

export function wirelessTextSize(lines:string[]):number {
  const normalized=normalize(lines);
  const max=Math.max(...normalized.map(line=>line.length));
  if(max<=5)return 24;
  if(max<=8)return 20;
  if(max<=10)return 17;
  if(max<=12)return 15;
  return 13;
}

export function wirelessKeySvg(kind:WirelessKeyKind,rawLines:string[]):string {
  const lines=normalize(rawLines);
  const size=wirelessTextSize(lines);
  const text=lines.length===1
    ? '<text x="72" y="131" text-anchor="middle" fill="#F5F7FB" font-family="Arial,sans-serif" font-size="'+size+'" font-weight="800">'+escapeXml(lines[0])+'</text>'
    : lines.map((line,index)=>'<text x="72" y="'+(index===0?112:136)+'" text-anchor="middle" fill="#F5F7FB" font-family="Arial,sans-serif" font-size="'+size+'" font-weight="800">'+escapeXml(line)+'</text>').join("");

  return '<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">'+
    '<rect width="144" height="144" rx="24" fill="#05070A"/>'+
    ACCENT_RAIL+
    '<g transform="translate(21 4) scale(1.42)" fill="none" stroke="#F5F7FB" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">'+
    GLYPHS[kind]+
    '</g>'+
    text+
    '</svg>';
}

export function wirelessKeyImage(kind:WirelessKeyKind,rawLines:string[]):string {
  return "data:image/svg+xml;base64,"+Buffer.from(wirelessKeySvg(kind,rawLines),"utf8").toString("base64");
}

export async function setWirelessKey(target:any,kind:WirelessKeyKind,lines:string[]):Promise<void> {
  if(!target?.isKey?.())return;
  await target.setTitle("");
  await target.setImage(wirelessKeyImage(kind,lines));
}
