// Generates PNG key-preview images and SVG icon files for ratpack-kick.
// Uses the official Kick logo path from SimpleIcons (viewBox 0 0 24 24).
import { PNG } from "pngjs";
import { writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PLUGIN = join(ROOT, "com.ratpack.kick.sdPlugin");

// Official Kick logo path (SimpleIcons, 24×24 viewBox)
const KICK_PATH = "M1.333 0h8v5.333H12V2.667h2.667V0h8v8H20v2.667h-2.667v2.666H20V16h2.667v8h-8v-2.667H12v-2.666H9.333V24h-8Z";

// Derived polygon vertices by parsing the Kick path (all rectilinear — no curves)
const KICK_POLY = [
	[1.333, 0], [9.333, 0], [9.333, 5.333], [12, 5.333], [12, 2.667],
	[14.667, 2.667], [14.667, 0], [22.667, 0], [22.667, 8], [20, 8],
	[20, 10.667], [17.333, 10.667], [17.333, 13.333], [20, 13.333],
	[20, 16], [22.667, 16], [22.667, 24], [14.667, 24], [14.667, 21.333],
	[12, 21.333], [12, 18.667], [9.333, 18.667], [9.333, 24], [1.333, 24],
];

const BLACK = [0, 0, 0, 255];
const KICK_GREEN = [83, 252, 24, 255];
const WHITE = [255, 255, 255, 255];
const TRANS = [0, 0, 0, 0];

function pointInPoly(px, py, poly) {
	let inside = false;
	for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
		const [xi, yi] = poly[i], [xj, yj] = poly[j];
		if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
	}
	return inside;
}

function insideRoundRect(px, py, x, y, w, h, r) {
	if (px < x || px > x + w || py < y || py > y + h) return false;
	const inCorner = (cx, cy) => Math.hypot(px - cx, py - cy) > r;
	if (px < x + r && py < y + r && inCorner(x + r, y + r)) return false;
	if (px > x + w - r && py < y + r && inCorner(x + w - r, y + r)) return false;
	if (px < x + r && py > y + h - r && inCorner(x + r, y + h - r)) return false;
	if (px > x + w - r && py > y + h - r && inCorner(x + w - r, y + h - r)) return false;
	return true;
}

function rasterize(size, sampler, SS = 4) {
	const png = new PNG({ width: size, height: size, filterType: -1 });
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			let r = 0, g = 0, b = 0, a = 0;
			for (let sy = 0; sy < SS; sy++) {
				for (let sx = 0; sx < SS; sx++) {
					const [cr, cg, cb, ca] = sampler(x + (sx + 0.5) / SS, y + (sy + 0.5) / SS);
					r += cr; g += cg; b += cb; a += ca;
				}
			}
			const n = SS * SS, idx = (y * size + x) * 4;
			png.data[idx] = r / n; png.data[idx + 1] = g / n;
			png.data[idx + 2] = b / n; png.data[idx + 3] = a / n;
		}
	}
	return png;
}

function writePng(png, path) {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, PNG.sync.write(png));
}

function writeSvg(content, path) {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, content, "utf8");
}

// PNG key preview — Kick logo centered with padding on black rounded square
function keyPng(size) {
	const pad = size * 0.10;
	const logoSize = size - 2 * pad; // 80% of total
	const r = size * 0.14;
	const scale = logoSize / 24;
	const scaled = KICK_POLY.map(([x, y]) => [pad + x * scale, pad + y * scale]);

	return rasterize(size, (px, py) => {
		if (!insideRoundRect(px, py, 0, 0, size, size, r)) return TRANS;
		return pointInPoly(px, py, scaled) ? KICK_GREEN : BLACK;
	}, 4);
}

// Action list / category icons: white logo on transparent (Elgato requirement)
function whiteIconPng(size) {
	const pad = size * 0.08;
	const logoSize = size - 2 * pad;
	const scale = logoSize / 24;
	const scaled = KICK_POLY.map(([x, y]) => [pad + x * scale, pad + y * scale]);
	return rasterize(size, (px, py) => pointInPoly(px, py, scaled) ? WHITE : TRANS, 4);
}

// SVG: white logo on transparent for action list / category icons
const WHITE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path fill="#FFFFFF" d="${KICK_PATH}"/>
</svg>`;

// SVG: colored logo on dark bg for marketplace icon
function marketplaceSvg() {
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="20%" fill="#000000"/>
  <g transform="translate(8,8) scale(3.5)">
    <path fill="#53FC18" d="${KICK_PATH}"/>
  </g>
</svg>`;
}

// --- Generate PNG key previews (colored — exempt from white rule) ---
writePng(keyPng(72),  `${PLUGIN}/imgs/actions/stats/key.png`);
writePng(keyPng(144), `${PLUGIN}/imgs/actions/stats/key@2x.png`);

// --- Action list icons: white on transparent (Elgato requirement) ---
writeSvg(WHITE_ICON_SVG, `${PLUGIN}/imgs/actions/stats/icon.svg`);
writeSvg(WHITE_ICON_SVG, `${PLUGIN}/imgs/plugin/category-icon.svg`);
writePng(whiteIconPng(20),  `${PLUGIN}/imgs/actions/stats/icon.png`);
writePng(whiteIconPng(40),  `${PLUGIN}/imgs/actions/stats/icon@2x.png`);
writePng(whiteIconPng(28),  `${PLUGIN}/imgs/plugin/category-icon.png`);
writePng(whiteIconPng(56),  `${PLUGIN}/imgs/plugin/category-icon@2x.png`);

// --- Marketplace icon: colored (exempt from white rule) ---
writeSvg(marketplaceSvg(), `${PLUGIN}/imgs/plugin/marketplace.svg`);
writePng(keyPng(256), `${PLUGIN}/imgs/plugin/marketplace.png`);
writePng(keyPng(512), `${PLUGIN}/imgs/plugin/marketplace@2x.png`);

console.log("✔ Generated Kick icons (SVG + PNG) using official Kick logo path");
