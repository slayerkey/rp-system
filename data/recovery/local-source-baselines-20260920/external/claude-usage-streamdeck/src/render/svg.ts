// Renders Stream Deck key images as SVG data URIs (144x144, crisp on @2x).
// Big text, bright traffic-light colors, six styles incl. water-fill + countdown + sparkline.
import { THEMES, type ThemeName, usageColor, type StyleName } from "./themes";

export interface KeyData {
	label: string; // "5H", "WEEK", "OPUS", "SONNET"
	used: number; // 0..100; not meaningful when `count` or `unlimited` is set
	resetsAt?: string; // ISO-8601
	count?: number; // a raw balance (credits) with no denominator, shown instead of a percentage
	unlimited?: boolean; // the balance is unbounded, so there is no number to show
}

export interface RenderOpts {
	style: StyleName;
	theme: ThemeName;
	showRemaining: boolean;
}

export interface HeatCell {
	letter: string;
	v: number | null; // peak 5h utilization that day, or null if no data
}

const FONT = "-apple-system, Helvetica, Arial, sans-serif";
const BRAND = "#FF8A3D";
const FILL_BG = "#0A0A0C"; // fill styles use a dark vessel so white text always reads

function uri(svg: string): string {
	return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function frame(theme: ThemeName, inner: string, bg?: string): string {
	const t = THEMES[theme];
	return uri(
		`<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">` +
			`<defs><clipPath id="r"><rect width="144" height="144" rx="20"/></clipPath></defs>` +
			`<g clip-path="url(#r)"><rect width="144" height="144" fill="${bg ?? t.bg}"/>${inner}</g></svg>`,
	);
}

function txt(x: number, y: number, size: number, weight: number, fill: string, content: string, anchor = "middle"): string {
	return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}">${content}</text>`;
}

/** White text with a soft dark drop-shadow — legible over the water-fill on any theme. */
function txtShadow(x: number, y: number, size: number, weight: number, content: string, anchor = "middle"): string {
	return (
		`<text x="${x}" y="${(y + 2).toFixed(1)}" text-anchor="${anchor}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="#000000" fill-opacity="0.45">${content}</text>` +
		`<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="#FFFFFF">${content}</text>`
	);
}

/** Like txtShadow but the fill is a chosen colour (e.g. the threshold colour). */
function txtShadowColor(x: number, y: number, size: number, weight: number, color: string, content: string, anchor = "middle"): string {
	return (
		`<text x="${x}" y="${(y + 2).toFixed(1)}" text-anchor="${anchor}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="#000000" fill-opacity="0.5">${content}</text>` +
		`<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${color}">${content}</text>`
	);
}

/** Largest font (<= maxSize) at which `text` fits within maxWidth — keeps long times in-bounds. */
function fitFont(text: string, maxWidth: number, maxSize: number, minSize = 20): number {
	return Math.max(minSize, Math.min(maxSize, Math.floor(maxWidth / (text.length * 0.62))));
}

export function formatReset(iso?: string): string {
	if (!iso) return "";
	const ms = new Date(iso).getTime() - Date.now();
	if (Number.isNaN(ms)) return "";
	if (ms <= 0) return "now";
	const mins = Math.floor(ms / 60000);
	const h = Math.floor(mins / 60);
	const m = mins % 60;
	if (h >= 24) return `${Math.floor(h / 24)}d${h % 24}h`;
	return h > 0 ? `${h}h${m}m` : `${m}m`;
}

function shown(d: KeyData, o: RenderOpts): number {
	return Math.round(o.showRemaining ? 100 - d.used : d.used);
}

/** A balance is a count with no denominator, so it can never be drawn as a percentage. */
function isCount(d: KeyData): boolean {
	return d.unlimited === true || d.count != null;
}

/** Keeps a large balance inside the key: 1234 becomes 1.2k. */
function compact(n: number): string {
	const a = Math.abs(n);
	if (a >= 1_000_000) return `${(n / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1)}M`;
	if (a >= 10_000) return `${Math.round(n / 1000)}k`;
	if (a >= 1000) return `${(n / 1000).toFixed(1)}k`;
	return String(Math.round(n));
}

/**
 * The hero figure and the suffix that follows it. Percentage windows keep their "%"; a
 * count window renders bare, because there is no total for it to be a percentage of.
 * `forceUsed` is for the two fill styles, which always show consumed rather than remaining.
 */
function hero(d: KeyData, o: RenderOpts, forceUsed = false): { text: string; suffix: string } {
	if (d.unlimited) return { text: "∞", suffix: "" };
	if (d.count != null) return { text: compact(d.count), suffix: "" };
	return { text: String(forceUsed ? Math.round(d.used) : shown(d, o)), suffix: "%" };
}

/** A count carries no safe/caution/critical meaning, so it drops the traffic-light colour. */
function heroColor(d: KeyData, plain: string): string {
	return isCount(d) ? plain : usageColor(d.used).color;
}

/** Background that fills bottom-up by consumed % (a "water cup"), behind the text. */
function waterFill(used: number, color: string): string {
	const h = Math.max(0, Math.min(144, (used / 100) * 144));
	const y = (144 - h).toFixed(1);
	return (
		`<defs><linearGradient id="wf" x1="0" y1="0" x2="0" y2="1">` +
		`<stop offset="0" stop-color="${color}" stop-opacity="0.58"/>` +
		`<stop offset="1" stop-color="${color}" stop-opacity="0.22"/></linearGradient></defs>` +
		`<rect x="0" y="${y}" width="144" height="${h.toFixed(1)}" fill="url(#wf)"/>` +
		`<rect x="0" y="${y}" width="144" height="3" fill="${color}"/>`
	);
}

function ring(d: KeyData, o: RenderOpts): string {
	const t = THEMES[o.theme];
	const color = heroColor(d, t.text);
	const h = hero(d, o);
	const cx = 72, cy = 66, r = 49, sw = 13;
	const C = 2 * Math.PI * r;
	// A count has no denominator, so the progress arc stays empty and only the track shows.
	const off = isCount(d) ? C : C * (1 - Math.max(0, Math.min(1, shown(d, o) / 100)));
	const reset = formatReset(d.resetsAt);
	const fs = fitFont(h.text + h.suffix, 84, 46);
	return frame(
		o.theme,
		`<g transform="rotate(-90 ${cx} ${cy})">` +
			`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${t.dim}" stroke-width="${sw}"/>` +
			`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/></g>` +
			txt(72, 78, fs, 800, color, h.suffix ? `${h.text}<tspan font-size="${Math.round(fs * 0.42)}" fill="${color}">${h.suffix}</tspan>` : h.text) +
			txt(72, 99, 15, 700, t.sub, d.label) +
			// t.text, NOT a hardcoded white: ring() draws on the THEMED background, so
			// a literal #FFFFFF was invisible on the light theme (#FFFFFF on #F4F4F6).
			// t.text is #FFFFFF on both dark themes (so dark mode is unchanged) and
			// #17171B on light (readable on #F4F4F6). Customer-reported 2026-08-11.
			// The hardcoded whites in full() and countdown() are correct by contrast,
			// because those pass FILL_BG and so always draw on a dark vessel.
			(reset ? txt(72, 132, fitFont(reset, 92, 17), 700, t.text, reset) : ""),
	);
}

function full(d: KeyData, o: RenderOpts): string {
	const color = heroColor(d, "#FFFFFF");
	const h = hero(d, o, true); // fill styles show consumed %, matching the water level
	const reset = formatReset(d.resetsAt);
	const fs = fitFont(h.text + h.suffix, 124, 66);
	return frame(
		o.theme,
		waterFill(isCount(d) ? 0 : d.used, color) +
			`<text x="72" y="33" text-anchor="middle" font-family="${FONT}" font-size="16" font-weight="800" fill="#FFFFFF" fill-opacity="0.78">${d.label}</text>` +
			txtShadowColor(72, 100, fs, 800, color, h.suffix ? `${h.text}<tspan font-size="${Math.round(fs * 0.45)}">${h.suffix}</tspan>` : h.text) +
			(reset ? txtShadow(72, 130, 16, 700, `resets ${reset}`) : ""),
		FILL_BG,
	);
}

function bigNumber(d: KeyData, o: RenderOpts): string {
	const t = THEMES[o.theme];
	const color = heroColor(d, t.text);
	const h = hero(d, o);
	const bw = 120, bx = 12, by = 120, bh = 12;
	const fill = Math.max(4, (bw * shown(d, o)) / 100);
	const fs = fitFont(h.text + h.suffix, 128, 62);
	return frame(
		o.theme,
		txt(72, 34, 16, 700, t.sub, d.label) +
			txt(72, 96, fs, 800, color, h.suffix ? `${h.text}<tspan font-size="${Math.round(fs * 0.45)}" fill="${t.sub}">${h.suffix}</tspan>` : h.text) +
			`<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="6" fill="${t.dim}"/>` +
			// A count has no denominator, so only the track is drawn.
			(isCount(d) ? "" : `<rect x="${bx}" y="${by}" width="${fill.toFixed(1)}" height="${bh}" rx="6" fill="${color}"/>`),
	);
}

function countdown(d: KeyData, o: RenderOpts): string {
	const color = heroColor(d, "#FFFFFF");
	const h = hero(d, o, true);
	const reset = formatReset(d.resetsAt) || "—";
	const size = fitFont(reset, 124, 54); // hero text, auto-fit so it never spills
	return frame(
		o.theme,
		waterFill(isCount(d) ? 0 : d.used, color) +
			`<text x="72" y="30" text-anchor="middle" font-family="${FONT}" font-size="13" font-weight="800" fill="#FFFFFF" fill-opacity="0.7">RESETS IN</text>` +
			txtShadow(72, 92, size, 800, reset) +
			txtShadow(72, 128, 15, 800, `${d.label} · ${h.text}${h.suffix}`),
		FILL_BG,
	);
}

/** Hero = how much time is left until reset (no water fill). */
function bigDate(d: KeyData, o: RenderOpts): string {
	const t = THEMES[o.theme];
	const h = hero(d, o);
	const reset = formatReset(d.resetsAt) || "—";
	const size = fitFont(reset, 132, 60);
	return frame(
		o.theme,
		txt(72, 32, 13, 800, t.sub, "TIME LEFT") +
			txt(72, 88, size, 800, t.text, reset) +
			txt(72, 126, 14, 700, t.sub, `${d.label} · ${h.text}${h.suffix}`),
	);
}

function status(d: KeyData, o: RenderOpts): string {
	const t = THEMES[o.theme];
	const { label } = usageColor(d.used);
	const color = heroColor(d, t.text);
	const h = hero(d, o);
	const reset = formatReset(d.resetsAt);
	return frame(
		o.theme,
		`<rect x="0" y="0" width="144" height="12" fill="${color}"/>` +
			txt(72, 46, 14, 700, t.sub, d.label) +
			// A balance has no safe/caution/critical band, so the count itself is the headline.
			txt(72, 86, 31, 800, color, isCount(d) ? h.text : label) +
			txt(72, 110, 16, 700, t.text, isCount(d) ? "available" : `${h.text}${h.suffix} ${o.showRemaining ? "left" : "used"}`) +
			(reset ? txt(72, 133, 15, 700, t.sub, reset) : ""),
	);
}

function sparkline(d: KeyData, o: RenderOpts, series?: number[]): string {
	const t = THEMES[o.theme];
	const color = heroColor(d, t.text);
	const h = hero(d, o);
	let chart: string;
	if (series && series.length >= 2) {
		const n = series.length;
		const x0 = 10, x1 = 134, yTop = 92, yBot = 134;
		const min = Math.min(...series), max = Math.max(...series);
		const range = Math.max(1, max - min);
		const xy = series.map((v, i) => [x0 + (x1 - x0) * (i / (n - 1)), yTop + (yBot - yTop) * (1 - (v - min) / range)] as const);
		const pts = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
		const last = xy[xy.length - 1];
		chart =
			`<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>` +
			`<circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="4" fill="${color}"/>`;
	} else {
		chart = txt(72, 120, 12, 600, t.sub, "collecting…");
	}
	return frame(
		o.theme,
		txt(72, 32, 15, 700, t.sub, d.label) +
			txt(72, 80, 48, 800, color, h.suffix ? `${h.text}<tspan font-size="22" fill="${t.sub}">${h.suffix}</tspan>` : h.text) +
			chart,
	);
}

/** 7-day strip; each cell coloured by that day's peak 5h utilization. */
function heatmap(o: RenderOpts, cells: HeatCell[]): string {
	const t = THEMES[o.theme];
	const n = 7, pad = 11, gap = 4;
	const w = (144 - 2 * pad - (n - 1) * gap) / n;
	const top = 48, h = 50;
	let bars = "";
	for (let i = 0; i < n; i++) {
		const c = cells[i] ?? { letter: "", v: null };
		const x = pad + i * (w + gap);
		const col = c.v === null ? t.dim : usageColor(c.v).color;
		const today = i === cells.length - 1;
		bars +=
			`<rect x="${x.toFixed(1)}" y="${top}" width="${w.toFixed(1)}" height="${h}" rx="3" fill="${col}"${today ? ` stroke="${t.text}" stroke-width="2"` : ""}/>` +
			txt(x + w / 2, top + h + 17, 11, 700, today ? t.text : t.sub, c.letter);
	}
	return frame(o.theme, txt(72, 30, 14, 800, t.sub, "7-DAY · 5H PEAK") + bars);
}

export function renderKey(d: KeyData, o: RenderOpts, series?: number[], cells?: HeatCell[]): string {
	switch (o.style) {
		case "ring":
			return ring(d, o);
		case "full":
			return full(d, o);
		case "number":
			return bigNumber(d, o);
		case "bigdate":
			return bigDate(d, o);
		case "countdown":
			return countdown(d, o);
		case "sparkline":
			return sparkline(d, o, series);
		case "heatmap":
			return heatmap(o, cells ?? []);
		case "status":
			return status(d, o);
	}
}

/** Overview: two big bars (e.g. 5h + week) on one key. */
export function renderDual(a: KeyData, b: KeyData, o: RenderOpts): string {
	const t = THEMES[o.theme];
	const row = (d: KeyData, y: number): string => {
		const val = shown(d, o);
		const { color } = usageColor(d.used);
		const w = 120, x = 12;
		const fill = Math.max(4, (w * val) / 100);
		return (
			txt(x, y - 13, 15, 800, t.text, d.label, "start") +
			txt(132, y - 13, 17, 800, color, `${val}%`, "end") +
			`<rect x="${x}" y="${y}" width="${w}" height="13" rx="6.5" fill="${t.dim}"/>` +
			`<rect x="${x}" y="${y}" width="${fill.toFixed(1)}" height="13" rx="6.5" fill="${color}"/>`
		);
	};
	return frame(o.theme, row(a, 56) + row(b, 110));
}

export interface RollupCell {
	label: string; // short provider tag, e.g. "CLAUDE", "GPT"
	used: number | null; // null when that provider has no reading, so it dims instead of lying
}

/**
 * Rollup: every switched-on provider on one key, one bar each.
 *
 * Bars are coloured by the shared usage thresholds rather than by each provider's brand,
 * so a glance answers "which of these needs attention" instead of "which brand is which".
 */
export function renderRollup(cells: RollupCell[], o: RenderOpts): string {
	const t = THEMES[o.theme];
	if (cells.length === 0) return renderMessage("Set up", ["pick your providers", "in settings"], o.theme);

	const cols = cells.length > 4 ? 2 : 1;
	const rows = Math.ceil(cells.length / cols);
	const padX = 10;
	const gapX = 8;
	const cellW = (144 - padX * 2 - (cols - 1) * gapX) / cols;
	const rowH = Math.min(34, 132 / rows);
	const top = (144 - rows * rowH) / 2 + 2;
	// Two columns leaves a 58px cell, where "COPILOT" plus "12%" at 11px overruns the
	// label into the number. Dropping a size and the percent sign buys back the room,
	// and on a key that is nothing but percentages the sign carries no information.
	const fs = cols === 2 ? 10 : 15;
	const barH = cols === 2 ? 5 : 8;
	const suffix = cols === 2 ? "" : "%";

	let out = "";
	cells.forEach((c, i) => {
		const x = padX + (i % cols) * (cellW + gapX);
		const y = top + Math.floor(i / cols) * rowH;
		const color = c.used === null ? t.dim : usageColor(c.used).color;
		const val = c.used === null ? null : Math.round(o.showRemaining ? 100 - c.used : c.used);
		const barY = y + fs + 4;
		out +=
			txt(x, y + fs, fs, 800, t.sub, c.label, "start") +
			txt(x + cellW, y + fs, fs, 800, color, val === null ? "--" : `${val}${suffix}`, "end") +
			`<rect x="${x.toFixed(1)}" y="${barY.toFixed(1)}" width="${cellW.toFixed(1)}" height="${barH}" rx="${barH / 2}" fill="${t.dim}"/>` +
			(val === null
				? ""
				: `<rect x="${x.toFixed(1)}" y="${barY.toFixed(1)}" width="${Math.max(3, (cellW * Math.min(100, Math.max(0, val))) / 100).toFixed(1)}" height="${barH}" rx="${barH / 2}" fill="${color}"/>`);
	});
	return frame(o.theme, out);
}

/** State screens: no token, expired, offline, rate-limited, loading. */
export function renderMessage(title: string, lines: string[], theme: ThemeName, accent = BRAND): string {
	const t = THEMES[theme];
	const body = lines
		.slice(0, 3)
		.map((l, i) => txt(72, 98 + i * 18, 13, 600, t.sub, l))
		.join("");
	return frame(theme, `<circle cx="72" cy="46" r="8" fill="${accent}"/>` + txt(72, 84, 21, 800, t.text, title) + body);
}
