// Generates static PNG showcase images for the Elgato Marketplace listing.
// Renders each display mode with realistic sample data.
import { mkdirSync, writeFileSync } from "node:fs";

const OUT = "showcase";
mkdirSync(OUT, { recursive: true });

// Since we don't want to pull in canvas, we export SVG files instead.
// These can be screenshot'd or converted externally (e.g. via Inkscape/browser).
// Each SVG represents a 144×144 key at 2× scale (288×288 for clarity).

const FONT = "-apple-system, Helvetica, Arial, sans-serif";

function frame(bg, inner, rx = 20) {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="288" height="288" viewBox="0 0 144 144">
<defs><clipPath id="r"><rect width="144" height="144" rx="${rx}"/></clipPath></defs>
<g clip-path="url(#r)"><rect width="144" height="144" fill="${bg}"/>${inner}</g></svg>`;
}

function txt(x, y, size, weight, fill, content, anchor = "middle") {
	return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}">${content}</text>`;
}

function bar(x, y, w, h, pct, color, track, rx = 5) {
	const fill = Math.max(h, w * Math.min(pct, 1));
	return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${track}"/>` +
		`<rect x="${x}" y="${y}" width="${fill.toFixed(1)}" height="${h}" rx="${rx}" fill="${color}"/>`;
}

const modes = [
	{
		name: "01-big-number-youtube",
		svg: frame("#000000",
			`<circle cx="18" cy="18" r="7" fill="#FF0000" fill-opacity="0.9"/>` +
			txt(72, 32, 13, 700, "#9A9AA2", "SUBS") +
			txt(72, 92, 52, 800, "#FF0000", "1.24M") +
			bar(12, 114, 120, 10, 0.82, "#FF0000", "#1C1C1E") +
			txt(72, 136, 10, 600, "#9A9AA2", "to 1.5M")
		),
	},
	{
		name: "02-milestone-youtube",
		svg: frame("#000000",
			`<circle cx="18" cy="18" r="7" fill="#FF0000" fill-opacity="0.9"/>` +
			txt(72, 28, 12, 700, "#9A9AA2", "TO: 1.5M SUBS") +
			txt(72, 60, 13, 600, "#FFFFFF", "1,247,832") +
			bar(12, 72, 120, 14, 0.83, "#FF0000", "#1C1C1E", 7) +
			txt(72, 104, 14, 700, "#FF0000", "252K away") +
			txt(72, 124, 12, 600, "#9A9AA2", "~34 days")
		),
	},
	{
		name: "03-live-mode-twitch",
		svg: frame("#000000",
			`<circle cx="18" cy="18" r="7" fill="#FF453A"/>` +
			txt(72, 30, 13, 800, "#FF453A", "● LIVE  1:23:47") +
			txt(72, 88, 52, 800, "#9146FF", "3,241") +
			txt(72, 112, 12, 700, "#9A9AA2", "VIEWERS") +
			txt(72, 134, 11, 600, "#9A9AA2", "Peak: 4,102")
		),
	},
	{
		name: "04-trend-mode",
		svg: frame("#0D0D14",
			`<circle cx="18" cy="18" r="7" fill="#FF0000" fill-opacity="0.9"/>` +
			txt(72, 28, 11, 700, "#8080A0", "SUBS · 7-DAY") +
			txt(55, 76, 36, 800, "#FF0000", "+2.4K") +
			txt(110, 76, 28, 800, "#30E27B", "↑") +
			`<polyline points="10,132 30,118 50,120 70,102 90,108 114,90 134,94" fill="none" stroke="#FF0000" stroke-width="2.5" stroke-opacity="0.7" stroke-linecap="round" stroke-linejoin="round"/>` +
			`<circle cx="134" cy="94" r="3.5" fill="#FF0000"/>`
		),
	},
	{
		name: "05-streak-mode",
		svg: frame("#000000",
			txt(72, 30, 12, 700, "#9A9AA2", "UPLOAD STREAK") +
			txt(50, 92, 52, 800, "#FF9F0A", "14") +
			txt(108, 92, 24, 800, "#FF9F0A", "🔥") +
			txt(72, 114, 12, 700, "#9A9AA2", "DAYS") +
			txt(72, 134, 11, 600, "#9A9AA2", "Last: 2h ago")
		),
	},
	{
		name: "06-platform-icon-youtube",
		svg: frame("#000000",
			// Official YouTube path (24×24 → ×3.75, centered)
			`<g transform="translate(27,15) scale(3.75)">` +
			`<path fill="#FF0000" d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"/>` +
			`<path fill="#FFFFFF" d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>` +
			`</g>` +
			txt(72, 132, 13, 800, "#9A9AA2", "YOUTUBE")
		),
	},
	{
		name: "07-platform-icon-twitch",
		svg: frame("#000000",
			// Official Twitch Glitch mark (24×24 → ×3.75, evenodd for cutouts)
			`<g transform="translate(27,15) scale(3.75)">` +
			`<path fill="#9146FF" fill-rule="evenodd" d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>` +
			`</g>` +
			txt(72, 132, 13, 800, "#9A9AA2", "TWITCH")
		),
	},
];

for (const { name, svg } of modes) {
	const path = `${OUT}/${name}.svg`;
	writeFileSync(path, svg, "utf8");
	console.log(`✔ ${path}`);
}

// Generate the MK2 grid overview (5×3 composite)
const KEY = 144, GAP = 8, CORNER = 8;
const gridW = 5 * KEY + 4 * GAP, gridH = 3 * KEY + 2 * GAP;

// Official brand logo fragments (24×24 → ×3.75, centered in 144×144)
const YT_LOGO = `<g transform="translate(27,15) scale(3.75)"><path fill="#FF0000" d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"/><path fill="#FFFFFF" d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></g>`;
const TW_LOGO = `<g transform="translate(27,15) scale(3.75)"><path fill="#9146FF" fill-rule="evenodd" d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></g>`;

const keys = [
	// Row 0: YouTube
	{ x: 0, y: 0, inner: YT_LOGO + txt(72,132,13,800,"#9A9AA2","YOUTUBE"), bg: "#000" },
	{ x: 1, y: 0, inner: `<circle cx="18" cy="18" r="7" fill="#FF0000" fill-opacity="0.9"/>${txt(72,32,13,700,"#9A9AA2","SUBS")}${txt(72,90,48,800,"#FF0000","1.24M")}${bar(12,114,120,10,0.82,"#FF0000","#1C1C1E")}`, bg: "#000" },
	{ x: 2, y: 0, inner: `<circle cx="18" cy="18" r="7" fill="#FF0000" fill-opacity="0.9"/>${txt(72,32,13,700,"#9A9AA2","VIEWS TODAY")}${txt(72,90,44,800,"#FF0000","48.2K")}`, bg: "#000" },
	{ x: 3, y: 0, inner: `<circle cx="18" cy="18" r="7" fill="#FF0000" fill-opacity="0.9"/>${txt(72,28,12,700,"#9A9AA2","TO: 1.5M SUBS")}${bar(12,72,120,14,0.83,"#FF0000","#1C1C1E",7)}${txt(72,104,14,700,"#FF0000","252K away")}${txt(72,124,12,600,"#9A9AA2","~34 days")}`, bg: "#000" },
	{ x: 4, y: 0, inner: `<circle cx="18" cy="18" r="7" fill="#FF0000" fill-opacity="0.9"/>${txt(72,28,11,700,"#8080A0","SUBS · 7-DAY")}${txt(55,76,34,800,"#FF0000","+2.4K")}${txt(110,76,26,800,"#30E27B","↑")}<polyline points="10,132 30,118 50,120 70,102 90,108 114,90 134,94" fill="none" stroke="#FF0000" stroke-width="2.5" stroke-opacity="0.7" stroke-linecap="round"/>`, bg: "#0D0D14" },
	// Row 1: Twitch
	{ x: 0, y: 1, inner: TW_LOGO + txt(72,132,13,800,"#9A9AA2","TWITCH"), bg: "#000" },
	{ x: 1, y: 1, inner: `<circle cx="18" cy="18" r="7" fill="#9146FF" fill-opacity="0.9"/>${txt(72,32,13,700,"#9A9AA2","FOLLOWERS")}${txt(72,90,44,800,"#9146FF","4,821")}`, bg: "#000" },
	{ x: 2, y: 1, inner: `<circle cx="18" cy="18" r="7" fill="#FF453A"/>${txt(72,30,13,800,"#FF453A","● LIVE 1:23:47")}${txt(72,88,46,800,"#9146FF","3,241")}${txt(72,112,12,700,"#9A9AA2","VIEWERS")}${txt(72,134,11,600,"#9A9AA2","Peak: 4,102")}`, bg: "#000" },
	{ x: 3, y: 1, inner: `<circle cx="18" cy="18" r="7" fill="#9146FF" fill-opacity="0.9"/>${txt(72,32,13,700,"#9A9AA2","SUBS")}${txt(72,90,50,800,"#9146FF","142")}`, bg: "#000" },
	{ x: 4, y: 1, inner: `<circle cx="18" cy="18" r="7" fill="#9146FF" fill-opacity="0.9"/>${txt(72,32,13,700,"#9A9AA2","NEW FOLLOWS")}${txt(72,85,42,800,"#9146FF","+18")}${txt(72,110,13,700,"#30E27B","↑ TODAY")}`, bg: "#000" },
	// Row 2: Advanced
	{ x: 0, y: 2, inner: `<line x1="72" y1="8" x2="72" y2="136" stroke="#1C1C1E" stroke-width="1"/><line x1="8" y1="72" x2="136" y2="72" stroke="#1C1C1E" stroke-width="1"/>${txt(36,50,9,700,"#8080A0","YT SUBS")}${txt(36,62,20,800,"#FF0000","1.24M")}${txt(108,50,9,700,"#8080A0","YT VIEWS")}${txt(108,62,18,800,"#FF0000","48.2K")}${txt(36,122,9,700,"#8080A0","TW FOLLOW")}${txt(36,134,18,800,"#9146FF","4,821")}${txt(108,122,9,700,"#8080A0","TW LIVE")}${txt(108,134,18,800,"#9146FF","3,241")}`, bg: "#000" },
	{ x: 1, y: 2, inner: `${txt(72,30,12,700,"#9A9AA2","UPLOAD STREAK")}${txt(50,92,50,800,"#FF9F0A","14")}${txt(108,92,22,800,"#FF9F0A","🔥")}${txt(72,114,12,700,"#9A9AA2","DAYS")}${txt(72,134,11,600,"#9A9AA2","Last: 2h ago")}`, bg: "#000" },
	{ x: 2, y: 2, inner: `<circle cx="18" cy="18" r="7" fill="#FF0000" fill-opacity="0.9"/>${txt(72,32,13,700,"#9A9AA2","EST. REVENUE")}${txt(72,90,38,800,"#FF0000","$12.40")}${txt(72,112,11,600,"#9A9AA2","today")}`, bg: "#000" },
	{ x: 3, y: 2, inner: `<circle cx="18" cy="18" r="7" fill="#FF0000" fill-opacity="0.9"/>${txt(72,32,13,700,"#9A9AA2","COMMENTS")}${txt(72,90,42,800,"#FF0000","+47")}${txt(72,112,11,600,"#9A9AA2","today")}`, bg: "#000" },
	{ x: 4, y: 2, inner: `${txt(72,72,12,600,"#3a3a5c","Empty slot")}`, bg: "#0D0D14" },
];

const cells = keys.map(({ x, y, inner, bg }) => {
	const ox = x * (KEY + GAP), oy = y * (KEY + GAP);
	const clip = `clip${x}_${y}`;
	return `<clipPath id="${clip}"><rect x="${ox}" y="${oy}" width="${KEY}" height="${KEY}" rx="${CORNER}"/></clipPath>` +
		`<g clip-path="url(#${clip})"><rect x="${ox}" y="${oy}" width="${KEY}" height="${KEY}" fill="${bg}"/>` +
		`<g transform="translate(${ox},${oy})">${inner}</g></g>`;
}).join("");

const gridSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${gridW * 2}" height="${gridH * 2}" viewBox="0 0 ${gridW} ${gridH}">
<rect width="${gridW}" height="${gridH}" fill="#0a0a10"/>
<defs>${cells.split("</clipPath>").filter(s => s.includes("clipPath")).map(s => s + "</clipPath>").join("")}</defs>
${cells}
</svg>`;

// Rebuild properly
const allDefs = keys.map(({ x, y }) => {
	const clip = `clip${x}_${y}`;
	const ox = x * (KEY + GAP), oy = y * (KEY + GAP);
	return `<clipPath id="${clip}"><rect x="${ox}" y="${oy}" width="${KEY}" height="${KEY}" rx="${CORNER}"/></clipPath>`;
}).join("");

const allCells = keys.map(({ x, y, inner, bg }) => {
	const clip = `clip${x}_${y}`;
	const ox = x * (KEY + GAP), oy = y * (KEY + GAP);
	return `<g clip-path="url(#${clip})"><rect x="${ox}" y="${oy}" width="${KEY}" height="${KEY}" fill="${bg}"/>` +
		`<g transform="translate(${ox},${oy})">${inner}</g></g>`;
}).join("");

const gridOut = `<svg xmlns="http://www.w3.org/2000/svg" width="${gridW * 2}" height="${gridH * 2}" viewBox="0 0 ${gridW} ${gridH}">
<rect width="${gridW}" height="${gridH}" fill="#0a0a10" rx="12"/>
<defs>${allDefs}</defs>
${allCells}
</svg>`;

const gridPath = `${OUT}/08-mk2-profile-grid.svg`;
writeFileSync(gridPath, gridOut, "utf8");
console.log(`✔ ${gridPath}`);
console.log(`\n✔ All showcase images written to ${OUT}/`);
console.log("   Open SVG files in a browser and screenshot for marketplace uploads.\n");
