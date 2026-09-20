// Generates all Stream Deck plugin icons for Creator Stats.
// Platform logos drawn from official brand geometry via pngjs — no external image deps.
import { PNG } from "pngjs";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const BASE = process.env.SD_PLUGIN_DIR ?? "com.ratpack.livestats.sdPlugin";
const MKT = process.env.MKT_DIR ?? "scripts/marketing-assets";

const hexToRgb = (h) => [0, 2, 4].map((i) => parseInt(h.replace("#", "").slice(i, i + 2), 16));
const YT_RED = hexToRgb("#FF0000");
const TW_PURPLE = hexToRgb("#9146FF");
const WHITE = [255, 255, 255];
const DARK = [13, 13, 20];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ── Geometry primitives ───────────────────────────────────────────────────────
function insideRoundRect(px, py, x, y, w, h, r) {
	if (px < x || px > x + w || py < y || py > y + h) return false;
	const cx = clamp(px, x + r, x + w - r);
	const cy = clamp(py, y + r, y + h - r);
	return Math.hypot(px - cx, py - cy) <= r;
}

function insideTriangle(px, py, ax, ay, bx, by, cx, cy) {
	const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
	const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
	const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
	const neg = d1 < 0 || d2 < 0 || d3 < 0;
	const pos = d1 > 0 || d2 > 0 || d3 > 0;
	return !(neg && pos);
}

function pointInPoly(px, py, poly) {
	let inside = false;
	for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
		const xi = poly[i][0], yi = poly[i][1];
		const xj = poly[j][0], yj = poly[j][1];
		if (((yi > py) !== (yj > py)) && (px < ((xj - xi) * (py - yi)) / (yj - yi) + xi)) inside = !inside;
	}
	return inside;
}

// ── Official YouTube play-button mark (24×24 brand proportions) ────────────────
// Red badge bbox in source path ≈ x[0,24] y[3.545,20.455] → ratio 1.42:1.
// Triangle (9.545,8.432)-(9.545,15.568)-(15.818,12) mapped into the badge.
function ytMark(px, py, S) {
	const Bw = S * 0.80, Bh = Bw * 0.7046;
	const bx = (S - Bw) / 2, by = (S - Bh) / 2, r = 0.30 * Bh;
	const Ax = bx + 0.3977 * Bw, Ay = by + 0.2890 * Bh;
	const Bx = Ax,              By = by + 0.7110 * Bh;
	const Cx = bx + 0.6591 * Bw, Cy = by + 0.5000 * Bh;
	if (insideTriangle(px, py, Ax, Ay, Bx, By, Cx, Cy)) return WHITE;
	if (insideRoundRect(px, py, bx, by, Bw, Bh, r)) return YT_RED;
	return null;
}

// ── Official Twitch "Glitch" mark (24×24 brand path) ───────────────────────────
const GLITCH = [[6, 0], [1.714, 4.286], [1.714, 19.714], [6.857, 19.714],
	[6.857, 24], [11.143, 19.714], [14.571, 19.714], [22.286, 12], [22.286, 0]];
const EYE1 = [11.571, 4.714, 13.286, 9.857];
const EYE2 = [16.286, 4.714, 18.000, 9.857];
const _twCache = new Map();
function twGeo(S) {
	let g = _twCache.get(S);
	if (g) return g;
	const Sq = S * 0.80, bx = (S - Sq) / 2, by = (S - Sq) / 2, r = 0.22 * Sq;
	const Gh = Sq * 0.64, Gw = Gh * 0.8572, gx0 = (S - Gw) / 2, gy0 = (S - Gh) / 2;
	const mx = (ux) => gx0 + ((ux - 1.714) / 20.572) * Gw;
	const my = (uy) => gy0 + (uy / 24) * Gh;
	g = {
		Sq, bx, by, r,
		poly: GLITCH.map(([ux, uy]) => [mx(ux), my(uy)]),
		e1: [mx(EYE1[0]), my(EYE1[1]), mx(EYE1[2]), my(EYE1[3])],
		e2: [mx(EYE2[0]), my(EYE2[1]), mx(EYE2[2]), my(EYE2[3])],
	};
	_twCache.set(S, g);
	return g;
}
function twMark(px, py, S) {
	const g = twGeo(S);
	if (!insideRoundRect(px, py, g.bx, g.by, g.Sq, g.Sq, g.r)) return null;
	const inEye =
		(px >= g.e1[0] && px <= g.e1[2] && py >= g.e1[1] && py <= g.e1[3]) ||
		(px >= g.e2[0] && px <= g.e2[2] && py >= g.e2[1] && py <= g.e2[3]);
	if (pointInPoly(px, py, g.poly) && !inEye) return WHITE;
	return TW_PURPLE;
}

// ── Supersampled rasterizer ────────────────────────────────────────────────────
// sampler(px,py) → [r,g,b,a] (a is 0 or 255). 4×4 box-average gives clean AA.
function rasterize(size, sampler) {
	const SS = 4, png = new PNG({ width: size, height: size });
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			let R = 0, G = 0, B = 0, A = 0;
			for (let sy = 0; sy < SS; sy++) {
				for (let sx = 0; sx < SS; sx++) {
					const px = x + (sx + 0.5) / SS, py = y + (sy + 0.5) / SS;
					const [r, g, b, a] = sampler(px, py);
					const af = a / 255;
					R += r * af; G += g * af; B += b * af; A += af;
				}
			}
			const idx = (size * y + x) << 2;
			if (A > 0) {
				png.data[idx] = Math.round(R / A);
				png.data[idx + 1] = Math.round(G / A);
				png.data[idx + 2] = Math.round(B / A);
			} else {
				png.data[idx] = 0; png.data[idx + 1] = 0; png.data[idx + 2] = 0;
			}
			png.data[idx + 3] = Math.round((A / (SS * SS)) * 255);
		}
	}
	return png;
}

// Black OLED key background + a platform mark on top.
function keySample(px, py, S, markFn) {
	const m = markFn(px, py, S);
	if (m) return [m[0], m[1], m[2], 255];
	if (insideRoundRect(px, py, S * 0.04, S * 0.04, S * 0.92, S * 0.92, S * 0.18)) return [0, 0, 0, 255];
	return [0, 0, 0, 0];
}

function youtubeIcon(size) { return PNG.sync.write(rasterize(size, (px, py) => keySample(px, py, size, ytMark))); }
function twitchIcon(size)  { return PNG.sync.write(rasterize(size, (px, py) => keySample(px, py, size, twMark))); }

// Marketplace / category icon: dark key with YouTube + Twitch marks side by side.
function marketplaceIcon(size) {
	const sub = size * 0.46;
	const ytOX = size * 0.04, ytOY = (size - sub) / 2;
	const twOX = size * 0.50, twOY = (size - sub) / 2;
	return PNG.sync.write(rasterize(size, (px, py) => {
		let m = null;
		if (px >= ytOX && px < ytOX + sub && py >= ytOY && py < ytOY + sub) m = ytMark(px - ytOX, py - ytOY, sub);
		if (!m && px >= twOX && px < twOX + sub && py >= twOY && py < twOY + sub) m = twMark(px - twOX, py - twOY, sub);
		if (m) return [m[0], m[1], m[2], 255];
		if (insideRoundRect(px, py, size * 0.04, size * 0.04, size * 0.92, size * 0.92, size * 0.18)) return [DARK[0], DARK[1], DARK[2], 255];
		return [0, 0, 0, 0];
	}));
}

const targets = [
	// Marketplace / plugin icons (colored — exempt from white rule)
	[`${BASE}/imgs/plugin/marketplace.png`, 256, marketplaceIcon],
	[`${BASE}/imgs/plugin/marketplace@2x.png`, 512, marketplaceIcon],
	// Category + action list icons: white on transparent (Elgato requirement)
	[`${BASE}/imgs/plugin/category-icon.png`, 28, whiteSparkPng],
	[`${BASE}/imgs/plugin/category-icon@2x.png`, 56, whiteSparkPng],
	[`${BASE}/imgs/actions/stats/icon.png`, 20, whiteSparkPng],
	[`${BASE}/imgs/actions/stats/icon@2x.png`, 40, whiteSparkPng],
	[`${BASE}/imgs/actions/stats/key.png`, 72, marketplaceIcon],
	[`${BASE}/imgs/actions/stats/key@2x.png`, 144, marketplaceIcon],
	// YouTube action icons
	[`${BASE}/imgs/actions/youtube/icon.png`, 20, youtubeIcon],
	[`${BASE}/imgs/actions/youtube/icon@2x.png`, 40, youtubeIcon],
	[`${BASE}/imgs/actions/youtube/key.png`, 72, youtubeIcon],
	[`${BASE}/imgs/actions/youtube/key@2x.png`, 144, youtubeIcon],
	// Twitch action icons
	[`${BASE}/imgs/actions/twitch/icon.png`, 20, twitchIcon],
	[`${BASE}/imgs/actions/twitch/icon@2x.png`, 40, twitchIcon],
	[`${BASE}/imgs/actions/twitch/key.png`, 72, twitchIcon],
	[`${BASE}/imgs/actions/twitch/key@2x.png`, 144, twitchIcon],
];

// High-res masters for marketing banners (sharp when displayed large). Not shipped.
const mktTargets = [
	[`${MKT}/youtube-logo.png`, 512, youtubeIcon],
	[`${MKT}/twitch-logo.png`, 512, twitchIcon],
	[`${MKT}/marketplace-logo.png`, 512, marketplaceIcon],
];

for (const [path, size, fn] of [...targets, ...mktTargets]) {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, fn(size));
}

// ── Also write SVG versions with official brand paths ─────────────────────────
// SVGs look perfect at any size. Stream Deck SDK accepts SVG for Icon fields.
// These are ready to drop in as replacements for the PNGs if desired.

function roundedSquareSvg(size, rx, inner) {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
<defs><clipPath id="sq"><rect width="${size}" height="${size}" rx="${rx}"/></clipPath></defs>
<g clip-path="url(#sq)">
<rect width="${size}" height="${size}" fill="#000000"/>
${inner}
</g></svg>`;
}

// YouTube: official play-button mark (24×24 path scaled to icon size, centered)
function ytSvg(size) {
	const s = (size * 0.70 / 24).toFixed(4); // scale so icon = 70% of container
	const tx = ((size - size * 0.70) / 2).toFixed(1);
	const ty = ((size - size * 0.70) / 2).toFixed(1);
	return roundedSquareSvg(size, size * 0.20,
		`<g transform="translate(${tx},${ty}) scale(${s})">
<path fill="#FF0000" d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"/>
<path fill="#FFFFFF" d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
</g>`);
}

// Twitch: official Glitch mark (24×24 path scaled, even-odd for cutouts)
function twSvg(size) {
	const s = (size * 0.70 / 24).toFixed(4);
	const tx = ((size - size * 0.70) / 2).toFixed(1);
	const ty = ((size - size * 0.70) / 2).toFixed(1);
	return roundedSquareSvg(size, size * 0.20,
		`<g transform="translate(${tx},${ty}) scale(${s})">
<path fill="#9146FF" fill-rule="evenodd" d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
</g>`);
}

// Marketplace: YouTube top-left + stock-chart zigzag arrow + Twitch bottom-right
// All path points verified to clear both logo bounding boxes.
function marketplaceSvg(size) {
	const sc = size / 256;
	const logoSz = size * 0.36;
	const ls = (logoSz / 24).toFixed(4);
	const ytX = (size * 0.26 - logoSz / 2).toFixed(1);
	const twX = (size * 0.74 - logoSz / 2).toFixed(1);

	// Stock-chart zigzag designed in 256×256 space, shifted up 15px for balance.
	// Clears YT logo (x 20-113, y 20-113) and TW logo (x 143-236, y 143-236).
	const linePts = [[20,205],[75,150],[100,167],[155,112],[175,120],[220,63]]
		.map(([x,y]) => `${(x*sc).toFixed(1)},${(y*sc).toFixed(1)}`).join(" ");

	// Filled arrowhead shifted up 15px — all points above TW logo.
	const tip = `${(236*sc).toFixed(1)},${(43*sc).toFixed(1)}`;
	const wl  = `${(209*sc).toFixed(1)},${(54*sc).toFixed(1)}`;
	const wr  = `${(231*sc).toFixed(1)},${(72*sc).toFixed(1)}`;

	const sw = Math.max(1.5, 9 * sc).toFixed(1);

	return roundedSquareSvg(size, size * 0.18,
		`<polyline points="${linePts}" fill="none" stroke="#30E27B" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M${tip} L${wl} L${wr} Z" fill="#30E27B"/>
<g transform="translate(${ytX},${ytX}) scale(${ls})">
<path fill="#FF0000" d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"/>
<path fill="#FFFFFF" d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
</g>
<g transform="translate(${twX},${twX}) scale(${ls})">
<path fill="#9146FF" fill-rule="evenodd" d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
</g>`);
}

// Action list / category icons: white sparkline on transparent (Elgato requirement).
// Arrow sparkline points in a 256x256 coordinate space (same as marketplace SVG).
// Inlined to avoid const TDZ — targets loop runs before module-level const init.
function _dToSeg(px, py, ax, ay, bx, by) {
	const dx = bx-ax, dy = by-ay, l2 = dx*dx+dy*dy;
	if (l2 === 0) return Math.hypot(px-ax, py-ay);
	const t = Math.max(0, Math.min(1, ((px-ax)*dx+(py-ay)*dy)/l2));
	return Math.hypot(px-(ax+t*dx), py-(ay+t*dy));
}

function whiteSparkPng(size) {
	const sp = [[20,205],[75,150],[100,167],[155,112],[175,120],[220,63]];
	const ar = [[236,43],[209,54],[231,72]];
	const sc = size / 256;
	const halfW = Math.max(1.5, 10*sc) / 2;
	const pts = sp.map(([x,y]) => [x*sc, y*sc]);
	return PNG.sync.write(rasterize(size, (px, py) => {
		for (let i = 0; i < pts.length-1; i++) {
			if (_dToSeg(px, py, pts[i][0], pts[i][1], pts[i+1][0], pts[i+1][1]) <= halfW)
				return [255,255,255,255];
		}
		const tx=ar[0][0]*sc, ty=ar[0][1]*sc, lx=ar[1][0]*sc, ly=ar[1][1]*sc, rx=ar[2][0]*sc, ry=ar[2][1]*sc;
		if (insideTriangle(px, py, tx, ty, lx, ly, rx, ry)) return [255,255,255,255];
		return [0,0,0,0];
	}));
}

function whiteSparkSvg(size) {
	const sp = [[20,205],[75,150],[100,167],[155,112],[175,120],[220,63]];
	const ar = [[236,43],[209,54],[231,72]];
	const sc = size / 256;
	const pts = sp.map(([x,y]) => `${(x*sc).toFixed(1)},${(y*sc).toFixed(1)}`).join(" ");
	const [tx,ty] = [ar[0][0]*sc, ar[0][1]*sc];
	const [lx,ly] = [ar[1][0]*sc, ar[1][1]*sc];
	const [rx,ry] = [ar[2][0]*sc, ar[2][1]*sc];
	const sw = Math.max(1.5, 10*sc).toFixed(1);
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
<polyline points="${pts}" fill="none" stroke="#FFFFFF" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M${tx.toFixed(1)},${ty.toFixed(1)} L${lx.toFixed(1)},${ly.toFixed(1)} L${rx.toFixed(1)},${ry.toFixed(1)} Z" fill="#FFFFFF"/>
</svg>`;
}

const svgTargets = [
	// Marketplace icon: colored (exempt from white rule)
	[`${BASE}/imgs/plugin/marketplace.svg`,        256, marketplaceSvg],
	[`${BASE}/imgs/plugin/marketplace@2x.svg`,     512, marketplaceSvg],
	// Category + action list icons: white on transparent (Elgato requirement)
	[`${BASE}/imgs/plugin/category-icon.svg`,       28, whiteSparkSvg],
	[`${BASE}/imgs/plugin/category-icon@2x.svg`,    56, whiteSparkSvg],
	[`${BASE}/imgs/actions/stats/icon.svg`,         20, whiteSparkSvg],
	[`${BASE}/imgs/actions/stats/icon@2x.svg`,      40, whiteSparkSvg],
	[`${BASE}/imgs/actions/youtube/key.svg`,        72, ytSvg],
	[`${BASE}/imgs/actions/youtube/key@2x.svg`,    144, ytSvg],
	[`${BASE}/imgs/actions/twitch/key.svg`,         72, twSvg],
	[`${BASE}/imgs/actions/twitch/key@2x.svg`,     144, twSvg],
	[`${BASE}/imgs/actions/stats/key.svg`,          72, marketplaceSvg],
	[`${BASE}/imgs/actions/stats/key@2x.svg`,      144, marketplaceSvg],
];

for (const [path, size, fn] of svgTargets) {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, fn(size), "utf8");
}
console.log(`✔ Generated ${targets.length} PNG icons + ${mktTargets.length} marketing masters + ${svgTargets.length} SVG icons`);
