const COLORS = {
  bg:"#080A0E",
  border:"#303640",
  text:"#F5F7FB",
  muted:"#9AA2AF",
  accent:"#FFB21E"
};

const GLYPHS = {
  insert:'<path d="M45 35h54v52H45z"/><path d="M57 49h30M57 61h30M57 73h21"/><path d="M101 30v20M91 40h20"/>',
  library:'<rect x="42" y="32" width="60" height="56" rx="6"/><path d="M55 48h34M55 61h34M55 74h24"/><path d="M33 42v47h58"/>',
  email:'<rect x="35" y="39" width="74" height="50" rx="7"/><path d="m39 45 33 24 33-24"/>',
  "email-plus":'<rect x="31" y="42" width="70" height="47" rx="7"/><path d="m35 48 31 22 31-22"/><path d="M108 28v22M97 39h22"/>',
  clipboard:'<rect x="43" y="37" width="58" height="57" rx="6"/><path d="M58 37v-8h28v8"/><path d="M56 54h32M56 67h32M56 80h23"/>',
  "clipboard-plus":'<rect x="39" y="39" width="56" height="55" rx="6"/><path d="M53 39v-8h28v8"/><path d="M52 56h29M52 68h25"/><path d="M108 29v22M97 40h22"/>',
  time:'<circle cx="72" cy="61" r="30"/><path d="M72 43v20l15 9"/>',
  date:'<rect x="37" y="37" width="70" height="58" rx="7"/><path d="M37 53h70M53 29v16M91 29v16"/><path d="M53 67h8M68 67h8M83 67h8M53 80h8M68 80h8M83 80h8"/>',
  address:'<path d="M72 94s27-28 27-48a27 27 0 1 0-54 0c0 20 27 48 27 48z"/><circle cx="72" cy="47" r="9"/>',
  link:'<path d="M61 75 51 85a16 16 0 0 1-23-23l14-14a16 16 0 0 1 23 0"/><path d="m83 49 10-10a16 16 0 0 1 23 23l-14 14a16 16 0 0 1-23 0"/><path d="m56 68 32-32"/>',
  reply:'<path d="M56 44 35 62l21 18"/><path d="M38 62h34c23 0 34 9 37 26-9-10-20-14-37-14H38"/>',
  support:'<path d="M37 42h70v44H67L52 98V86H37z"/><path d="M52 56h40M52 68h30"/>',
  video:'<rect x="34" y="39" width="76" height="51" rx="8"/><path d="m65 52 23 13-23 13z"/>',
  chat:'<path d="M35 39h74v48H69L51 99V87H35z"/><circle cx="55" cy="63" r="3"/><circle cx="72" cy="63" r="3"/><circle cx="89" cy="63" r="3"/>',
  code:'<path d="m58 43-20 20 20 20M86 43l20 20-20 20M80 35 64 91"/>',
  text:'<path d="M43 38h58M72 38v56M55 94h34"/>'
};

const BUILTIN_VISUALS = new Map([
  ["lite-email",["email-plus","EMAIL +"]],
  ["lite-clipboard",["clipboard-plus","CLIP +"]],
  ["pro-quick-email",["email-plus","EMAIL +"]],
  ["pro-quick-clipboard",["clipboard-plus","CLIP +"]],
  ["pro-quick-time",["time","TIME"]],
  ["pro-quick-date",["date","DATE"]],
  ["pro-quick-address",["address","ADDRESS"]],
  ["pro-quick-link",["link","LINK"]],
  ["pro-email-reply",["reply","REPLY"]],
  ["pro-follow-up",["reply","FOLLOW UP"]],
  ["pro-meeting-link",["link","MEETING"]],
  ["pro-support-response",["support","RESPONSE"]],
  ["pro-bug-request",["clipboard","BUG INFO"]],
  ["pro-youtube",["video","YOUTUBE"]],
  ["pro-discord",["chat","DISCORD"]],
  ["pro-code",["code","CODE"]],
  ["pro-timestamp",["time","STAMP"]],
  ["pro-personal-meeting",["link","MEETING"]],
  ["pro-address",["address","ADDRESS"]]
]);

function escapeXml(value){
  return String(value).replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]||c));
}

function inferKind(snippet){
  const explicit=BUILTIN_VISUALS.get(String(snippet?.id||""));
  if(explicit)return explicit[0];
  const name=String(snippet?.name||"").toLowerCase();
  const content=String(snippet?.content||"").toLowerCase();
  if(name.includes("email")||name.includes("mail"))return "email";
  if(name.includes("clip")||content.includes("{clipboard}"))return "clipboard";
  if(name.includes("time")||content.includes("{time}")||content.includes("{datetime"))return "time";
  if(name.includes("date")||content.includes("{date"))return "date";
  if(name.includes("address")||name.includes("contact"))return "address";
  if(name.includes("link")||name.includes("url")||content.includes("http"))return "link";
  if(name.includes("reply")||name.includes("follow"))return "reply";
  if(name.includes("support")||name.includes("response"))return "support";
  if(name.includes("youtube")||name.includes("video"))return "video";
  if(name.includes("discord")||name.includes("chat"))return "chat";
  if(name.includes("code")||name.includes("script"))return "code";
  return "text";
}

function compactLines(raw){
  let label=String(raw||"SNIPPET").toUpperCase().replace(/[^A-Z0-9+& /_-]/g," ").replace(/\s+/g," ").trim();
  if(!label)label="SNIPPET";
  if(label.length<=10)return [label];
  const words=label.split(" ");
  if(words.length>1){
    let first="",second="";
    for(const word of words){
      if(!first||first.length+1+word.length<=9)first+=(first?" ":"")+word;
      else if(!second||second.length+1+word.length<=9)second+=(second?" ":"")+word;
    }
    if(first&&second)return [first.slice(0,9),second.slice(0,9)];
  }
  return [label.slice(0,9),label.slice(9,18)].filter(Boolean);
}

export function visualForSnippet(snippet){
  const built=BUILTIN_VISUALS.get(String(snippet?.id||""));
  if(built)return {kind:built[0],label:built[1],builtin:true};
  return {kind:inferKind(snippet),label:String(snippet?.name||"SNIPPET"),builtin:false};
}

function textMarkup(label){
  const lines=compactLines(label);
  const longest=Math.max(...lines.map(line=>line.length));
  const size=longest<=5?21:longest<=8?18:16;
  if(lines.length===1){
    return '<text x="72" y="126" text-anchor="middle" fill="'+COLORS.text+'" font-family="Segoe UI,Arial,sans-serif" font-size="'+size+'" font-weight="800">'+escapeXml(lines[0])+'</text>';
  }
  return lines.map((line,index)=>'<text x="72" y="'+(index===0?115:136)+'" text-anchor="middle" fill="'+COLORS.text+'" font-family="Segoe UI,Arial,sans-serif" font-size="'+size+'" font-weight="800">'+escapeXml(line)+'</text>').join("");
}

export function renderKeySvg(kind,label=""){
  const glyph=GLYPHS[kind]||GLYPHS.text;
  return '<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">'+
    '<rect width="144" height="144" rx="24" fill="'+COLORS.bg+'"/>'+
    '<rect x="4" y="4" width="136" height="136" rx="21" fill="none" stroke="'+COLORS.border+'" stroke-width="4"/>'+
    '<path d="M22 12h100" stroke="'+COLORS.accent+'" stroke-width="4" stroke-linecap="round"/>'+
    '<g fill="none" stroke="'+COLORS.text+'" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" transform="translate(0 -6)">'+glyph+'</g>'+
    (label?textMarkup(label):"")+
    '</svg>';
}

export function renderSnippetKey(snippet){
  const visual=visualForSnippet(snippet);
  return "data:image/svg+xml;base64,"+Buffer.from(renderKeySvg(visual.kind,visual.label),"utf8").toString("base64");
}

export function renderActionIconSvg(kind="insert"){
  const glyph=GLYPHS[kind]||GLYPHS.text;
  return '<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">'+
    '<g fill="none" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">'+glyph+'</g>'+
    '</svg>';
}

export function renderFallbackKeySvg(kind="insert",label=""){
  return renderKeySvg(kind,label);
}

export const BUILTIN_SNIPPET_IDS = Object.freeze([...BUILTIN_VISUALS.keys()]);
