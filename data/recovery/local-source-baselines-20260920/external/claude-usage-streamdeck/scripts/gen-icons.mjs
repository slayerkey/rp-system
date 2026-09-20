// Generates manifest icons: a ¾ gauge ring (Claude orange) on a dark rounded square.
import { PNG } from "pngjs";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const BASE = process.env.SD_PLUGIN_DIR ?? "com.ratpack.claude-usage.sdPlugin";
const hexToRgb = (h) => [0, 2, 4].map((i) => parseInt(h.replace("#", "").slice(i, i + 2), 16));
const BG = [12, 12, 14];
const ORANGE = hexToRgb(process.env.SD_BRAND ?? "#FF8A3D");
const TRACK = [40, 40, 46];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

/** Rounded-square coverage at a pixel (0..1), for anti-aliased corners. */
function squareCoverage(x, y, size) {
	const pad = size * 0.06;
	const rad = size * 0.22;
	const lo = pad, hi = size - pad;
	const cx = clamp(x, lo + rad, hi - rad);
	const cy = clamp(y, lo + rad, hi - rad);
	if (x >= lo + rad && x <= hi - rad) return x < lo || x > hi ? 0 : 1; // straight edges
	if (y >= lo + rad && y <= hi - rad) return y < lo || y > hi ? 0 : 1;
	const d = Math.hypot(x - cx, y - cy);
	return clamp(rad - d + 0.5, 0, 1); // AA at corner radius
}

// The combined tracker has no provider logo to overlay, so its in-app icons are the same
// gauge rendered monochrome white on transparent, which is what Elgato requires there.
const WHITE_INAPP = process.env.SD_WHITE_INAPP === "1";

function icon(size, white = false) {
	const png = new PNG({ width: size, height: size });
	const c = (size - 1) / 2;
	const rO = size * 0.37;
	const rI = size * 0.235;
	const gapHalf = 42; // degrees of opening at the bottom
	const fillEnd = 250; // ring "filled" up to this many degrees of the 360-gap sweep

	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			const i = (size * y + x) << 2;
			const sq = white ? 0 : squareCoverage(x + 0.5, y + 0.5, size);
			let r = BG[0], g = BG[1], b = BG[2];
			let alpha = sq;

			const dx = x + 0.5 - c, dy = y + 0.5 - c;
			const dist = Math.hypot(dx, dy);
			if (dist > rI - 1 && dist < rO + 1) {
				const aOuter = clamp(rO - dist + 0.5, 0, 1);
				const aInner = clamp(dist - rI + 0.5, 0, 1);
				let aRing = Math.min(aOuter, aInner);
				// angle: 0° at top, increasing clockwise; gap centered at bottom (180°)
				let ang = (Math.atan2(dx, -dy) * 180) / Math.PI; // -180..180, 0 = up
				if (ang < 0) ang += 360; // 0..360 clockwise from top
				const fromGap = Math.abs(ang - 180);
				if (fromGap < gapHalf) {
					aRing *= clamp((fromGap - (gapHalf - 6)) / 6, 0, 1); // fade into the opening
				}
				if (aRing > 0) {
					// progress sweep starts at the gap edge, going clockwise
					const sweep = (ang + (180 - gapHalf) + 360) % 360; // 0 at gap's leading edge
					const lit = sweep <= (fillEnd / 360) * (360 - 2 * gapHalf);
					if (white) {
						r = g = b = 255;
						alpha = Math.max(alpha, aRing * (lit ? 1 : 0.32));
					} else {
						const col = lit ? ORANGE : TRACK;
						r = lerp(r, col[0], aRing);
						g = lerp(g, col[1], aRing);
						b = lerp(b, col[2], aRing);
					}
				}
			}

			png.data[i] = Math.round(r);
			png.data[i + 1] = Math.round(g);
			png.data[i + 2] = Math.round(b);
			png.data[i + 3] = Math.round(alpha * 255);
		}
	}
	return PNG.sync.write(png);
}

// inApp marks the two icon sets Elgato wants monochrome white on transparent.
const targets = [
	["imgs/plugin/marketplace.png", 256, false],
	["imgs/plugin/marketplace@2x.png", 512, false],
	["imgs/plugin/category-icon.png", 28, true],
	["imgs/plugin/category-icon@2x.png", 56, true],
	["imgs/actions/usage/icon.png", 20, true],
	["imgs/actions/usage/icon@2x.png", 40, true],
	["imgs/actions/usage/key.png", 72, false],
	["imgs/actions/usage/key@2x.png", 144, false],
];

for (const [rel, sz, inApp] of targets) {
	const path = `${BASE}/${rel}`;
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, icon(sz, WHITE_INAPP && inApp));
}
console.log(`generated ${targets.length} gauge icons`);
