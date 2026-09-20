import type { Theme } from "./themes";

const FONT = "'Segoe UI','SF Pro Display','Helvetica Neue',Arial,sans-serif";
const SIZE = 144;

export type QuoteView = {
	/** Name or ticker shown on top. */
	topLabel: string;
	priceText: string;
	changeText: string;
	changeColor: string;
	/** Small timeframe pill, e.g. "1D", "24H", "1W". */
	tag?: string;
	sparkline?: number[];
	sparkColor: string;
	/** Optional position P/L line shown at the bottom. */
	plText?: string;
	plColor?: string;
	/** Optional 52-week range bar; 0 = at the 52w low, 1 = at the 52w high. */
	rangePct?: number;
	alert?: boolean;
	alertColor?: string;
	stale: boolean;
	theme: Theme;
};

/** A live stock / crypto key: name, big price, mid sparkline, change, optional P/L + 52w range. */
export function buildQuoteImage(v: QuoteView): string {
	const t = v.theme;
	const hasPl = !!v.plText;
	const hasRange = v.rangePct !== undefined;

	const spark = v.sparkline && v.sparkline.length > 1 ? sparkline(v.sparkline, v.sparkColor) : "";
	const stale = v.stale ? `<circle cx="11" cy="11" r="4" fill="${t.muted}"/>` : "";
	const tag = v.tag
		? `<text x="136" y="16" text-anchor="end" font-size="12" font-weight="600" fill="${t.muted}" font-family="${FONT}">${esc(v.tag)}</text>`
		: "";
	const alertRing = v.alert
		? `<rect x="3" y="3" width="${SIZE - 6}" height="${SIZE - 6}" rx="12" fill="none" stroke="${v.alertColor ?? t.extended}" stroke-width="6"/>`
		: "";

	// Stack up to two optional rows (P/L text, 52w range bar) beneath the change line,
	// compressing upward as more rows are present so nothing collides.
	let changeY = 124;
	let plY = 0;
	let rangeY = 0;
	if (hasPl && hasRange) {
		changeY = 104;
		plY = 122;
		rangeY = 138;
	} else if (hasPl) {
		changeY = 114;
		plY = 136;
	} else if (hasRange) {
		changeY = 114;
		rangeY = 135;
	}

	const pl = hasPl
		? `<text x="72" y="${plY}" text-anchor="middle" font-size="${fit(v.plText!, 138, 17)}" font-weight="600" fill="${v.plColor ?? t.muted}" font-family="${FONT}" style="font-variant-numeric:tabular-nums">${esc(v.plText!)}</text>`
		: "";
	const range = hasRange ? rangeBar(v.rangePct!, rangeY, t) : "";

	return wrap(`
		<rect width="${SIZE}" height="${SIZE}" fill="${t.bg}"/>
		${spark}
		${stale}
		${tag}
		<text x="72" y="20" text-anchor="middle" font-size="${fit(v.topLabel, 130, 15)}" font-weight="600" fill="${t.label}" font-family="${FONT}">${esc(v.topLabel)}</text>
		<text x="72" y="46" text-anchor="middle" font-size="${fit(v.priceText, 136, 30)}" font-weight="800" fill="${t.label}" font-family="${FONT}" style="font-variant-numeric:tabular-nums">${esc(v.priceText)}</text>
		<text x="72" y="${changeY}" text-anchor="middle" font-size="${fit(v.changeText, 136, 24)}" font-weight="700" fill="${v.changeColor}" font-family="${FONT}" style="font-variant-numeric:tabular-nums">${esc(v.changeText)}</text>
		${pl}
		${range}
		${alertRing}
	`);
}

function rangeBar(pct: number, y: number, t: Theme): string {
	const clamped = Math.max(0, Math.min(1, pct));
	const x0 = 16;
	const x1 = 128;
	const dotX = x0 + clamped * (x1 - x0);
	return `
		<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="${t.muted}" stroke-width="3" stroke-linecap="round" opacity="0.35"/>
		<circle cx="${dotX.toFixed(1)}" cy="${y}" r="4" fill="${t.label}"/>
		<text x="${x0}" y="${y - 7}" font-size="8" fill="${t.muted}" font-family="${FONT}">52WL</text>
		<text x="${x1}" y="${y - 7}" text-anchor="end" font-size="8" fill="${t.muted}" font-family="${FONT}">52WH</text>
	`;
}

/** Loading / error / prompt state for a key. */
export function buildInfoImage(title: string, sub: string | undefined, theme: Theme, accent?: string): string {
	const subText = sub
		? `<text x="72" y="98" text-anchor="middle" font-size="${fit(sub, 138, 16)}" fill="${theme.muted}" font-family="${FONT}">${esc(sub)}</text>`
		: "";
	return wrap(`
		<rect width="${SIZE}" height="${SIZE}" fill="${theme.bg}"/>
		<text x="72" y="${sub ? 72 : 80}" text-anchor="middle" font-size="${fit(title, 132, 24)}" font-weight="700" fill="${accent ?? theme.label}" font-family="${FONT}">${esc(title)}</text>
		${subText}
	`);
}

export type ClockView = {
	exchangeLabel: string;
	sessionLabel: string;
	countdown: string;
	sub: string;
	color: string;
	/** Candle progress 0..1, shown as a bottom band while the market is open. */
	band?: number;
	theme: Theme;
};

/** Market session + countdown key, with an optional candle progress band. */
export function buildClockImage(v: ClockView): string {
	const t = v.theme;
	const hasBand = v.band !== undefined;
	const countdownY = hasBand ? 84 : 90;
	const band =
		v.band !== undefined
			? `<rect x="12" y="124" width="120" height="6" rx="3" fill="${t.muted}" opacity="0.3"/>` +
				`<rect x="12" y="124" width="${(120 * Math.max(0, Math.min(1, v.band))).toFixed(1)}" height="6" rx="3" fill="${v.color}"/>`
			: "";
	return wrap(`
		<rect width="${SIZE}" height="${SIZE}" fill="${t.bg}"/>
		<text x="72" y="20" text-anchor="middle" font-size="${fit(v.exchangeLabel, 130, 14)}" font-weight="600" fill="${t.muted}" font-family="${FONT}">${esc(v.exchangeLabel)}</text>
		<text x="72" y="46" text-anchor="middle" font-size="${fit(v.sessionLabel, 132, 19)}" font-weight="700" fill="${v.color}" font-family="${FONT}">${esc(v.sessionLabel)}</text>
		<text x="72" y="${countdownY}" text-anchor="middle" font-size="${fit(v.countdown, 136, 30)}" font-weight="800" fill="${t.label}" font-family="${FONT}" style="font-variant-numeric:tabular-nums">${esc(v.countdown)}</text>
		<text x="72" y="${hasBand ? 110 : 114}" text-anchor="middle" font-size="${fit(v.sub, 138, 15)}" fill="${t.muted}" font-family="${FONT}">${esc(v.sub)}</text>
		${band}
	`);
}

export type HeatmapTile = { ticker: string; pct: number };

/** A grid of colored tiles, one per watchlist symbol, shaded by daily move. */
export function buildHeatmapImage(tiles: HeatmapTile[], theme: Theme, stale = false): string {
	const t = theme;
	if (tiles.length === 0) {
		return buildInfoImage("Add symbols", "e.g. AAPL, TSLA, BTC", t);
	}

	// A single symbol becomes one bold, edge-to-edge tile rather than a small square
	// floating in the middle of the key — with only one thing to show, it should fill
	// almost the entire key, the same way a full-key theme card would.
	if (tiles.length === 1) {
		return buildSingleHeatTile(tiles[0], t, stale);
	}

	const cols = tiles.length === 2 ? 2 : tiles.length === 3 ? 3 : tiles.length <= 4 ? 2 : 3;
	const gap = 3;
	const pad = 4;
	const rows = rowCounts(tiles.length, cols);
	const cellW = (SIZE - pad * 2 - gap * (cols - 1)) / cols;
	const cellH = (SIZE - pad * 2 - gap * (rows.length - 1)) / rows.length;
	const showPct = cellH >= 40;
	// Scale text off the actual cell size instead of a fixed constant, so 2-3 large
	// tiles get big, readable text and only dense 8-9 tile grids fall back to small type.
	const tickerBase = Math.max(12, Math.min(30, cellH * 0.24));
	const pctBase = Math.max(10, Math.min(22, cellH * 0.17));

	let index = 0;
	const cells = rows
		.map((count, row) => {
			const rowW = count * cellW + (count - 1) * gap;
			const rowX = pad + (SIZE - pad * 2 - rowW) / 2;
			const y = pad + row * (cellH + gap);
			const rowCells = Array.from({ length: count }, (_, col) => {
				const tile = tiles[index++];
				const x = rowX + col * (cellW + gap);
				const fill = heatColor(tile.pct, t);
				const tickerY = showPct ? y + cellH * 0.40 : y + cellH * 0.58;
				const pctRow = showPct
					? `<text x="${x + cellW / 2}" y="${y + cellH * 0.72}" text-anchor="middle" font-size="${fit(formatPctShort(tile.pct), cellW - 4, pctBase)}" font-weight="700" fill="rgba(255,255,255,0.9)" font-family="${FONT}">${esc(formatPctShort(tile.pct))}</text>`
					: "";
				return `
					<rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" rx="6" fill="${fill}"/>
					<text x="${x + cellW / 2}" y="${tickerY}" text-anchor="middle" font-size="${fit(tile.ticker, cellW - 4, tickerBase)}" font-weight="800" fill="#FFFFFF" font-family="${FONT}">${esc(tile.ticker)}</text>
					${pctRow}
				`;
			}).join("");
			return rowCells;
		})
		.join("");

	const staleDot = stale ? `<circle cx="10" cy="10" r="4" fill="${t.muted}"/>` : "";
	return wrap(`<rect width="${SIZE}" height="${SIZE}" fill="${t.bg}"/>${cells}${staleDot}`);
}

/** Number of tiles in each row when laying `n` tiles out left-to-right, `cols` wide. */
function rowCounts(n: number, cols: number): number[] {
	const counts: number[] = [];
	let remaining = n;
	while (remaining > 0) {
		const c = Math.min(cols, remaining);
		counts.push(c);
		remaining -= c;
	}
	return counts;
}

/** One symbol, filling almost the entire key: big ticker, huge % change. */
function buildSingleHeatTile(tile: HeatmapTile, t: Theme, stale: boolean): string {
	const fill = heatColor(tile.pct, t);
	const pctText = formatPctShort(tile.pct);
	const staleDot = stale ? `<circle cx="14" cy="14" r="4" fill="rgba(255,255,255,0.6)"/>` : "";
	return wrap(`
		<rect width="${SIZE}" height="${SIZE}" rx="16" fill="${fill}"/>
		<text x="${SIZE / 2}" y="40" text-anchor="middle" font-size="${fit(tile.ticker, 132, 30)}" font-weight="800" fill="#FFFFFF" font-family="${FONT}">${esc(tile.ticker)}</text>
		<text x="${SIZE / 2}" y="100" text-anchor="middle" font-size="${fit(pctText, 136, 50)}" font-weight="800" fill="#FFFFFF" font-family="${FONT}" style="font-variant-numeric:tabular-nums">${esc(pctText)}</text>
		${staleDot}
	`);
}

function formatPctShort(pct: number): string {
	return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

/** Interpolates red (down) -> gray (flat) -> green (up) for a heatmap tile, clamped at +/-3%. */
function heatColor(pct: number, t: Theme): string {
	const clamped = Math.max(-3, Math.min(3, pct));
	const down = hexToRgb(t.down);
	const flat = { r: 46, g: 50, b: 56 };
	const up = hexToRgb(t.up);
	const from = clamped < 0 ? down : up;
	const amount = Math.abs(clamped) / 3;
	const r = Math.round(flat.r + (from.r - flat.r) * amount);
	const g = Math.round(flat.g + (from.g - flat.g) * amount);
	const b = Math.round(flat.b + (from.b - flat.b) * amount);
	return `rgb(${r},${g},${b})`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
	const clean = hex.replace("#", "");
	return {
		r: parseInt(clean.slice(0, 2), 16),
		g: parseInt(clean.slice(2, 4), 16),
		b: parseInt(clean.slice(4, 6), 16),
	};
}

export type GaugeView = {
	value: number;
	label: string;
	theme: Theme;
	stale?: boolean;
};

const GAUGE_BANDS: Array<{ from: number; to: number; color: string }> = [
	{ from: 0, to: 20, color: "#EA3943" },
	{ from: 20, to: 40, color: "#F0803C" },
	{ from: 40, to: 60, color: "#F0B90B" },
	{ from: 60, to: 80, color: "#9ACD32" },
	{ from: 80, to: 100, color: "#16C784" },
];

/** The color of the band a gauge value currently sits in, for matching the label to the needle. */
function bandColorFor(value: number): string {
	const clamped = Math.max(0, Math.min(100, value));
	const band = GAUGE_BANDS.find((b) => clamped < b.to) ?? GAUGE_BANDS[GAUGE_BANDS.length - 1];
	return band.color;
}

/**
 * A speedometer-style Fear & Greed gauge: the label sits at the top (readable even when a Stream
 * Deck is tilted back and its lower half is hard to see), colored to match the band the needle is
 * currently in, with colored bands, the needle, and the numeric value beneath.
 */
export function buildGaugeImage(v: GaugeView): string {
	const t = v.theme;
	const cx = 72;
	const cy = 92;
	const r = 56;
	const color = bandColorFor(v.value);

	const bands = GAUGE_BANDS.map((b) => arcPath(cx, cy, r, b.from, b.to, b.color)).join("");
	const needleAngle = 180 - (Math.max(0, Math.min(100, v.value)) / 100) * 180;
	const rad = (needleAngle * Math.PI) / 180;
	const nx = cx + (r - 12) * Math.cos(rad);
	const ny = cy - (r - 12) * Math.sin(rad);
	const stale = v.stale ? `<circle cx="11" cy="11" r="4" fill="${t.muted}"/>` : "";

	return wrap(`
		<rect width="${SIZE}" height="${SIZE}" fill="${t.bg}"/>
		<text x="${cx}" y="18" text-anchor="middle" font-size="${fit(v.label, 136, 15)}" font-weight="800" fill="${color}" font-family="${FONT}">${esc(v.label.toUpperCase())}</text>
		${bands}
		<line x1="${cx}" y1="${cy}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" stroke="${t.label}" stroke-width="3.5" stroke-linecap="round"/>
		<circle cx="${cx}" cy="${cy}" r="4.5" fill="${t.label}"/>
		<text x="${cx}" y="126" text-anchor="middle" font-size="${fit(String(v.value), 100, 30)}" font-weight="800" fill="${color}" font-family="${FONT}">${v.value}</text>
		${stale}
	`);
}

function arcPath(cx: number, cy: number, r: number, fromVal: number, toVal: number, color: string): string {
	const a0 = 180 - (fromVal / 100) * 180;
	const a1 = 180 - (toVal / 100) * 180;
	const p0 = polar(cx, cy, r, a0);
	const p1 = polar(cx, cy, r, a1);
	return `<path d="M${p0.x.toFixed(1)},${p0.y.toFixed(1)} A${r},${r} 0 0 1 ${p1.x.toFixed(1)},${p1.y.toFixed(1)}" fill="none" stroke="${color}" stroke-width="12" stroke-linecap="butt"/>`;
}

function polar(cx: number, cy: number, r: number, angleDeg: number): { x: number; y: number } {
	const rad = (angleDeg * Math.PI) / 180;
	return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}

export type EarningsView = {
	ticker: string;
	dateText: string;
	countdownText: string;
	sub: string;
	theme: Theme;
	urgent?: boolean;
	today?: boolean;
	stale?: boolean;
};

/** Countdown to a company's next scheduled earnings report. */
export function buildEarningsImage(v: EarningsView): string {
	const t = v.theme;
	const accent = v.today ? t.extended : v.urgent ? t.down : t.label;
	const ring = v.urgent
		? `<rect x="3" y="3" width="${SIZE - 6}" height="${SIZE - 6}" rx="12" fill="none" stroke="${t.extended}" stroke-width="5"/>`
		: "";
	const stale = v.stale ? `<circle cx="11" cy="11" r="4" fill="${t.muted}"/>` : "";
	return wrap(`
		<rect width="${SIZE}" height="${SIZE}" fill="${t.bg}"/>
		<text x="72" y="22" text-anchor="middle" font-size="${fit(v.ticker, 130, 16)}" font-weight="700" fill="${t.label}" font-family="${FONT}">${esc(v.ticker)}</text>
		<text x="72" y="42" text-anchor="middle" font-size="${fit("EARNINGS", 130, 12)}" font-weight="600" fill="${t.muted}" font-family="${FONT}">EARNINGS</text>
		<text x="72" y="80" text-anchor="middle" font-size="${fit(v.countdownText, 136, 38)}" font-weight="800" fill="${accent}" font-family="${FONT}" style="font-variant-numeric:tabular-nums">${esc(v.countdownText)}</text>
		<text x="72" y="106" text-anchor="middle" font-size="${fit(v.sub, 136, 14)}" fill="${t.muted}" font-family="${FONT}">${esc(v.sub)}</text>
		<text x="72" y="128" text-anchor="middle" font-size="${fit(v.dateText, 136, 15)}" font-weight="600" fill="${t.label}" font-family="${FONT}">${esc(v.dateText)}</text>
		${stale}
		${ring}
	`);
}

/** Solid sparkline in the mid band, between the price and the change line. */
function sparkline(points: number[], color: string): string {
	const min = Math.min(...points);
	const max = Math.max(...points);
	const range = max - min || 1;
	const x0 = 12;
	const x1 = 132;
	const y0 = 56;
	const y1 = 98;
	const step = (x1 - x0) / (points.length - 1);
	const d = points
		.map((p, i) => `${i === 0 ? "M" : "L"}${(x0 + i * step).toFixed(1)},${(y1 - ((p - min) / range) * (y1 - y0)).toFixed(1)}`)
		.join(" ");
	return `<path d="${d}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>`;
}

/** Estimate a font size that keeps text within maxWidth (sans-serif average glyph ≈ 0.62em). */
function fit(text: string, maxWidth: number, base: number): number {
	const estimated = text.length * base * 0.62;
	return estimated <= maxWidth ? base : Math.max(11, Math.floor((base * maxWidth) / estimated));
}

function esc(s: string): string {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function wrap(inner: string): string {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">${inner}</svg>`;
	return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
