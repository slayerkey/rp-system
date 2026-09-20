// Preview for the new stock-chart arrow icon design
import { writeFileSync, mkdirSync } from "node:fs";

const YT = `<path fill="#FF0000" d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"/><path fill="#FFFFFF" d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>`;
const TW = `<path fill="#9146FF" fill-rule="evenodd" d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>`;

function icon(size, arrowColor) {
    const sc = size / 256;
    const logoSz = size * 0.36;
    const ls = (logoSz / 24).toFixed(4);
    const ytX = (size * 0.26 - logoSz / 2).toFixed(1);
    const twX = (size * 0.74 - logoSz / 2).toFixed(1);
    const rx = (size * 0.18).toFixed(1);
    const sw = Math.max(1.5, 9 * sc).toFixed(1);

    const linePts = [[20,205],[75,150],[100,167],[155,112],[175,120],[220,63]]
        .map(([x,y]) => `${(x*sc).toFixed(1)},${(y*sc).toFixed(1)}`).join(" ");
    const tip = `${(236*sc).toFixed(1)},${(43*sc).toFixed(1)}`;
    const wl  = `${(209*sc).toFixed(1)},${(54*sc).toFixed(1)}`;
    const wr  = `${(231*sc).toFixed(1)},${(72*sc).toFixed(1)}`;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
<defs><clipPath id="c${size}"><rect width="${size}" height="${size}" rx="${rx}"/></clipPath></defs>
<g clip-path="url(#c${size})">
<rect width="${size}" height="${size}" fill="#000"/>
<polyline points="${linePts}" fill="none" stroke="${arrowColor}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M${tip} L${wl} L${wr} Z" fill="${arrowColor}"/>
<g transform="translate(${ytX},${ytX}) scale(${ls})">${YT}</g>
<g transform="translate(${twX},${twX}) scale(${ls})">${TW}</g>
</g></svg>`;
}

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>New Icon Design — ratpack-livestats</title>
<style>
  body { background: #111; font-family: "Segoe UI", sans-serif; color: #ddd; margin: 0; padding: 30px; }
  h1 { color: #fff; font-size: 18px; margin-bottom: 4px; }
  p  { color: #888; font-size: 13px; margin: 0 0 28px; }
  .row { display: flex; gap: 30px; align-items: flex-end; flex-wrap: wrap; margin-bottom: 40px; }
  .card { text-align: center; }
  .card span { display: block; font-size: 11px; color: #555; margin-top: 6px; }
  h2 { color: #aaa; font-size: 13px; margin: 0 0 12px; font-weight: 600; }
</style>
</head>
<body>
<h1>New Icon: Stock Chart Arrow</h1>
<p>YouTube top-left · Twitch bottom-right · Rising stock-chart zigzag with filled arrowhead · No area fill · No dots</p>

<h2>Green (current theme — #30E27B)</h2>
<div class="row">
  <div class="card">${icon(256,'#30E27B')}<span>256px (marketplace)</span></div>
  <div class="card">${icon(144,'#30E27B')}<span>144px (key@2x)</span></div>
  <div class="card">${icon(72,'#30E27B')}<span>72px (key)</span></div>
  <div class="card">${icon(56,'#30E27B')}<span>56px (category@2x)</span></div>
  <div class="card">${icon(28,'#30E27B')}<span>28px (category)</span></div>
</div>

<h2>White arrow (alternative)</h2>
<div class="row">
  <div class="card">${icon(256,'#ffffff')}<span>256px</span></div>
  <div class="card">${icon(72,'#ffffff')}<span>72px</span></div>
  <div class="card">${icon(28,'#ffffff')}<span>28px</span></div>
</div>

<h2>Yellow arrow (alternative)</h2>
<div class="row">
  <div class="card">${icon(256,'#FFD60A')}<span>256px</span></div>
  <div class="card">${icon(72,'#FFD60A')}<span>72px</span></div>
  <div class="card">${icon(28,'#FFD60A')}<span>28px</span></div>
</div>
</body>
</html>`;

mkdirSync("scripts/output", { recursive: true });
writeFileSync("scripts/output/icon-variations.html", html, "utf8");
console.log("✔ Saved → scripts/output/icon-variations.html");
