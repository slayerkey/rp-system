#!/usr/bin/env node
/**
 * Generates a marketing preview HTML page for the Claude Usage plugin.
 * Usage: node scripts/gen-preview.mjs
 * Open output/preview.html in Chrome, screenshot each section.
 */
import { writeFileSync, mkdirSync } from "node:fs";

const BRAND  = "#FF8A3D";
const GREEN  = "#30E27B";
const YELLOW = "#FFD60A";
const RED    = "#FF3B30";
const FONT   = `"SF Pro Display","Segoe UI",Arial,sans-serif`;
const FILL_BG = "#0A0A0C";
const DIM    = "rgba(255,255,255,0.13)";

// ── color ──────────────────────────────────────────────────────────────────
function hexc(n) { return Math.max(0,Math.min(255,Math.round(n))).toString(16).padStart(2,"0"); }
function lerp(c1,c2,t) {
  const p = s => [parseInt(s.slice(1,3),16),parseInt(s.slice(3,5),16),parseInt(s.slice(5,7),16)];
  const [r1,g1,b1]=p(c1),[r2,g2,b2]=p(c2);
  return `#${hexc(r1+(r2-r1)*t)}${hexc(g1+(g2-g1)*t)}${hexc(b1+(b2-b1)*t)}`;
}
function usageColor(used) {
  const u=Math.max(0,Math.min(100,used));
  if (u>=85) return {color:RED,label:"Critical"};
  if (u>=50) return {color:lerp(YELLOW,RED,(u-50)/35),label:u>=75?"Warning":"Moderate"};
  return {color:lerp(GREEN,YELLOW,u/50),label:"Safe"};
}

// ── primitives ─────────────────────────────────────────────────────────────
function fitFont(text,maxWidth,maxSize,minSize=20){
  const ratio=text.length<=3?0.58:text.length<=4?0.52:0.46;
  return Math.max(minSize,Math.min(maxSize,Math.floor(maxWidth/(text.length*ratio))));
}
function t(x,y,sz,wt,fill,body,anchor="middle"){
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${FONT}" font-size="${sz}" font-weight="${wt}" fill="${fill}">${body}</text>`;
}
function ts(x,y,sz,wt,body,anchor="middle"){
  return t(x,y+2,sz,wt,"rgba(0,0,0,0.5)",body,anchor)+t(x,y,sz,wt,"#ffffff",body,anchor);
}
function tsc(x,y,sz,wt,color,body,anchor="middle"){
  return t(x,y+2,sz,wt,"rgba(0,0,0,0.5)",body,anchor)+t(x,y,sz,wt,color,body,anchor);
}
function waterFill(used,color,uid="f"){
  const y=(144*(1-Math.max(0,Math.min(1,used/100)))).toFixed(1);
  return `<defs><linearGradient id="${uid}" x1="0" y1="1" x2="0" y2="0">`+
    `<stop offset="0" stop-color="${color}" stop-opacity="0.60"/>`+
    `<stop offset="1" stop-color="${color}" stop-opacity="0.20"/></linearGradient></defs>`+
    `<rect x="0" y="${y}" width="144" height="${(144-parseFloat(y)).toFixed(1)}" fill="url(#${uid})"/>`+
    `<rect x="0" y="${y}" width="144" height="3" fill="${color}"/>`;
}
function frame(inner,bg="#111111"){
  return `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">`+
    `<rect width="144" height="144" fill="${bg}"/>`+inner+`</svg>`;
}

// ── style renderers ────────────────────────────────────────────────────────
function ring(used,label,reset){
  const {color}=usageColor(used);
  const cx=72,cy=66,r=49,sw=13,C=2*Math.PI*r;
  const off=(C*(1-Math.max(0,Math.min(1,used/100)))).toFixed(1);
  const fs=fitFont(`${used}%`,84,46);
  return frame(
    `<g transform="rotate(-90 ${cx} ${cy})">`+
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${DIM}" stroke-width="${sw}"/>`+
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${off}"/></g>`+
    t(72,78,fs,800,color,`${used}<tspan font-size="${Math.round(fs*0.42)}"fill="${color}">%</tspan>`)+
    t(72,99,15,700,"rgba(255,255,255,0.4)",label)+
    (reset?t(72,132,fitFont(reset,92,17),700,"#ffffff",reset):"")
  );
}

function full(used,label,reset){
  const {color}=usageColor(used);
  const fs=fitFont(`${used}%`,110,54);
  return frame(
    waterFill(used,color,"fu"+used)+
    tsc(72,100,fs,800,color,`${used}<tspan font-size="${Math.round(fs*0.45)}">${"%"}</tspan>`)+
    (reset?ts(72,132,14,700,reset):""),
    FILL_BG
  );
}

function bigNumber(used,label,reset){
  const {color}=usageColor(used);
  const val=used;
  const fs=fitFont(`${val}%`,120,60);
  const bh=8,by=120,barW=120,bx=12;
  const fill=((val/100)*barW).toFixed(1);
  return frame(
    t(72,50,14,700,"rgba(255,255,255,0.4)",label)+
    t(72,96,fs,800,color,`${val}<tspan font-size="${Math.round(fs*0.45)}" fill="rgba(255,255,255,0.35)">%</tspan>`)+
    `<rect x="${bx}" y="${by}" width="${barW}" height="${bh}" rx="4" fill="${DIM}"/>`+
    `<rect x="${bx}" y="${by}" width="${fill}" height="${bh}" rx="4" fill="${color}"/>`+
    (reset?t(72,140,11,600,"rgba(255,255,255,0.35)",reset):"")
  );
}

function bigTime(reset,label){
  const fs=fitFont(reset,110,46);
  return frame(
    t(72,38,11,700,"rgba(255,255,255,0.4)",label.toUpperCase())+
    t(72,55,11,600,"rgba(255,255,255,0.3)","RESETS IN")+
    t(72,112,fs,800,"#ffffff",reset)+
    `<rect x="12" y="126" width="120" height="3" rx="1.5" fill="${DIM}"/>`
  );
}

function countdown(used,reset,label){
  const {color}=usageColor(used);
  const fs=fitFont(reset,110,42);
  return frame(
    waterFill(used,color,"co"+used)+
    ts(72,52,11,700,label.toUpperCase())+
    ts(72,66,10,600,"TIME LEFT")+
    ts(72,112,fs,800,reset),
    FILL_BG
  );
}

function status(used,label){
  const {color,label:word}=usageColor(used);
  return frame(
    `<rect x="0" y="0" width="144" height="12" fill="${color}"/>`+
    t(72,42,13,700,"rgba(255,255,255,0.4)",label.toUpperCase())+
    t(72,86,31,800,color,word)+
    t(72,108,22,700,"rgba(255,255,255,0.6)",`${used}%`)+
    `<rect x="12" y="122" width="${((used/100)*120).toFixed(1)}" height="7" rx="3.5" fill="${color}"/>`+
    `<rect x="12" y="122" width="120" height="7" rx="3.5" fill="${DIM}" style="mix-blend-mode:multiply"/>`
  );
}

function sparkline(used,label,series){
  const {color}=usageColor(used);
  const val=used;
  // chart area: x 12-132, y 28-104
  const W=120,H=76,ox=12,oy=28;
  const max=Math.max(...series,1);
  const pts=series.map((v,i)=>{
    const x=ox+(i/(series.length-1))*W;
    const y=oy+H*(1-v/max);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const [lx,ly]=pts.split(" ").pop().split(",");
  return frame(
    t(12,20,11,700,"rgba(255,255,255,0.4)",label,"start")+
    t(132,20,13,700,color,`${val}%`,"end")+
    `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`+
    `<circle cx="${lx}" cy="${ly}" r="4" fill="${color}"/>`+
    t(72,132,11,600,"rgba(255,255,255,0.3)","24h history")
  );
}

function heatmap(cells,label){
  // cells: array of {v:0-100|null, day:"Mon"}
  const days=["M","T","W","T","F","S","S"];
  const W=14,gap=4,total=days.length*(W+gap)-gap;
  const ox=(144-total)/2;
  let rects="";
  cells.forEach((c,i)=>{
    const x=ox+i*(W+gap);
    const col=c.v===null?"rgba(255,255,255,0.08)":usageColor(c.v).color;
    const op=c.v===null?1:(0.25+0.75*(c.v/100));
    const isToday=i===cells.length-1;
    rects+=`<rect x="${x.toFixed(1)}" y="72" width="${W}" height="${W}" rx="3" fill="${col}" opacity="${op}"/>`;
    if(isToday) rects+=`<rect x="${(x-1.5).toFixed(1)}" y="70.5" width="${W+3}" height="${W+3}" rx="4" fill="none" stroke="${col}" stroke-width="1.5"/>`;
    rects+=`<text x="${(x+W/2).toFixed(1)}" y="105" text-anchor="middle" font-family="${FONT}" font-size="9" fill="rgba(255,255,255,0.3)">${days[i]}</text>`;
  });
  return frame(
    t(72,44,13,700,"rgba(255,255,255,0.4)",label)+
    t(72,60,10,600,"rgba(255,255,255,0.25)","7-DAY HISTORY")+
    rects+
    t(72,130,11,600,"rgba(255,255,255,0.25)","today →")
  );
}

function dual(aUsed,bUsed){
  const {color:ac}=usageColor(aUsed);
  const {color:bc}=usageColor(bUsed);
  const bh=16,bx=12,bw=120;
  function row(label,used,color,y){
    const fill=((used/100)*bw).toFixed(1);
    return t(bx,y-4,13,700,"rgba(255,255,255,0.4)",label,"start")+
      t(144-bx,y-4,13,700,color,`${used}%`,"end")+
      `<rect x="${bx}" y="${y}" width="${bw}" height="${bh}" rx="8" fill="${DIM}"/>`+
      `<rect x="${bx}" y="${y}" width="${fill}" height="${bh}" rx="8" fill="${color}"/>`;
  }
  return frame(
    t(72,26,11,700,"rgba(255,255,255,0.35)","OVERVIEW")+
    row("5H",aUsed,ac,40)+
    row("WEEK",bUsed,bc,90)
  );
}

// ── HTML builder ────────────────────────────────────────────────────────────
function key(svg,caption=""){
  return `<div style="display:flex;flex-direction:column;align-items:center;gap:8px">`+
    `<div style="border-radius:10px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.6)">${svg}</div>`+
    (caption?`<div style="font-size:11px;color:#666;font-family:system-ui;text-align:center;line-height:1.4">${caption}</div>`:``)
    +`</div>`;
}
function row(...items){
  return `<div style="display:flex;gap:18px;align-items:flex-end;flex-wrap:wrap">${items.join("")}</div>`;
}
function section(title,subtitle,content){
  return `<div style="padding:48px 60px;border-bottom:1px solid #1a1a1a">`+
    `<h2 style="margin:0 0 4px;font-size:32px;font-weight:800;letter-spacing:-1px;color:#fff">${title}</h2>`+
    (subtitle?`<p style="margin:0 0 32px;font-size:14px;color:#555;font-family:system-ui">${subtitle}</p>`:`<div style="margin-bottom:32px"></div>`)+
    content+`</div>`;
}
function chip(text,color){
  return `<span style="font-size:11px;padding:3px 10px;border-radius:20px;border:1px solid ${color}44;color:${color};background:${color}14;font-family:system-ui">${text}</span>`;
}

// ── sample data ─────────────────────────────────────────────────────────────
const SERIES=[18,28,35,42,51,45,38,58,72,68,55,65,78,72]; // sparkline history
const HEAT=[
  {v:45},{v:60},{v:35},{v:80},{v:55},{v:88},{v:72}
]; // 7-day heatmap, last=today

// ── render all sections ─────────────────────────────────────────────────────
const heroSection = section(
  "Claude Usage",
  "Know if you can keep going — at a glance.",
  row(
    key(ring(42,"5H","2h 14m"),"Ring · Safe"),
    key(ring(72,"7D","1h 40m"),"Ring · Moderate"),
    key(ring(95,"5H","12m"),"Ring · Critical"),
    key(dual(42,72),"Overview"),
  )
);

const styleSection = section(
  "8 Display Styles · 3 Themes",
  "Short-press to cycle · Long-press to switch type",
  `<div style="display:flex;flex-direction:column;gap:32px">`+
    row(
      key(ring(42,"5H","2h 14m"),"Ring"),
      key(full(78,"7D","1h 40m"),"Full (fills up)"),
      key(bigNumber(42,"5H","2h 14m"),"Big Number"),
      key(bigTime("2h 14m","5H"),"Big Time"),
    )+
    `<div style="margin-top:4px"/>`+
    row(
      key(countdown(78,"1h 40m","7D"),"Countdown"),
      key(sparkline(72,"7D",SERIES),"Sparkline"),
      key(heatmap(HEAT,"7D"),"Weekly Heatmap"),
      key(status(42,"5H"),"Status"),
    )+
  `</div>`
);

const alertSection = section(
  "Smart Alerts · Live Countdown",
  "Color shifts as you climb — no browser tab to refresh",
  `<div style="display:flex;flex-direction:column;gap:28px">`+
    row(
      key(ring(32,"5H","3h"),"0–49% · Safe"),
      key(ring(64,"5H","1h 40m"),"50–74% · Moderate"),
      key(ring(82,"5H","42m"),"75–84% · Warning"),
      key(ring(95,"5H","12m"),"85–100% · Critical"),
    )+
    `<div style="display:flex;gap:10px;margin-top:8px">`+
      chip("Green · safe (0–49%)",GREEN)+
      chip("Yellow · moderate (50–74%)",YELLOW)+
      chip(`Orange · warning (75–84%)`,lerp(YELLOW,RED,0.7))+
      chip("Red · critical (85%+)",RED)+
    `</div>`+
  `</div>`
);

const bigTimeSection = section(
  "Big Time · Countdown",
  "Focus on how long you have left, not how much you've used",
  row(
    key(bigTime("2h 14m","5H"),"Plenty of time"),
    key(bigTime("42m","5H"),"Pace yourself"),
    key(bigTime("8m","5H"),"Wrap it up"),
    key(countdown(95,"8m","5H"),"Countdown fill"),
  )
);

const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Claude Usage · Preview</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#0d0d0d;color:#fff;font-family:"SF Pro Display","Segoe UI",Arial,sans-serif}
    svg text{font-family:"SF Pro Display","Segoe UI",Arial,sans-serif}
  </style>
</head>
<body>
  <!-- SECTION 1: Hero — screenshot this (1520×400 or crop to taste) -->
  ${heroSection}
  <!-- SECTION 2: All Styles — screenshot this -->
  ${styleSection}
  <!-- SECTION 3: Smart Alerts — screenshot this -->
  ${alertSection}
  <!-- SECTION 4: Big Time — screenshot this -->
  ${bigTimeSection}
</body>
</html>`;

mkdirSync("scripts/output",{recursive:true});
writeFileSync("scripts/output/preview.html",html,"utf8");
console.log("\n✔ Saved → scripts/output/preview.html");
console.log("  Open in Chrome and screenshot each section.\n");
