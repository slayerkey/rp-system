/**
 * Pro key faces. Builds on the Lite renderer (`../code-cost/src/badge`) rather than forking
 * it, so the money formatting and the SVG frame stay identical across the two products.
 */
import { escapeXml, keyImage } from "../../_shared/src/badge";
import { compactTokens, money } from "../../code-cost/src/badge";

const BG = "#0d1117";
const TEXT = "#ffffff";
const DIM = "#8b949e";
const ACCENT = "#2BE86A";
const WARN = "#ff7b72";
const AMBER = "#e3b341";

export { keyImage, money, compactTokens };

function frame(inner: string): string {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">
<rect width="144" height="144" fill="${BG}"/>${inner}</svg>`;
}

function line(t: string, y: number, size: number, fill: string, weight = 600, x = 72, anchor = "middle"): string {
	return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="Verdana,DejaVu Sans,sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}">${escapeXml(t)}</text>`;
}

function fit(s: string, max: number): string {
	return s.length <= max ? s : s.slice(0, max - 1) + "…";
}

/**
 * Model ids are too long for a 144px row next to a dollar figure: at full length the label and
 * the amount overlap. The vendor prefix carries no information on a key that is already headed
 * "By model", so it comes off and the family name is what is left.
 */
export function prettyModel(id: string): string {
	const m = id.replace(/^claude-/, "").replace(/-\d{8}$/, "");
	const parts = m.split("-");
	if (parts[0] === "gpt") return `GPT-${parts[1] ?? ""}`.replace(/-$/, "");
	const fam = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
	const ver = parts.slice(1).join(".");
	return ver ? `${fam} ${ver}` : fam;
}

/**
 * The hero face. What the usage was worth against what the plan cost, e.g. "18x".
 *
 * Green once the plan has paid for itself, amber below that. This is the one number no
 * competitor shows and the reason Pro exists, so it gets the largest type in the product.
 */
export function valueBadge(ratio: number, spend: number, plan: number): string {
	const good = ratio >= 1;
	const shown = ratio >= 100 ? String(Math.round(ratio)) : ratio >= 10 ? ratio.toFixed(0) : ratio.toFixed(1);
	return frame(
		[
			line("PLAN VALUE", 26, 14, ACCENT, 700),
			line(`${shown}x`, 92, ratio >= 100 ? 46 : 52, good ? ACCENT : AMBER, 700),
			line(`${money(spend)} / ${money(plan)}`, 124, 14, DIM)
		].join("")
	);
}

/** Cost with an optional budget bar along the bottom. */
export function costBadge(label: string, value: string, budget?: { used: number; cap: number }): string {
	const over = budget ? budget.used > budget.cap : false;
	const parts = [
		line(label.toUpperCase(), 26, 14, ACCENT, 700),
		line(value, budget ? 86 : 92, value.length > 6 ? 36 : 44, over ? WARN : TEXT, 700)
	];
	if (budget) {
		const pct = Math.max(0, Math.min(1, budget.cap > 0 ? budget.used / budget.cap : 0));
		parts.push(`<rect x="16" y="112" width="112" height="8" rx="4" fill="#21262d"/>`);
		parts.push(
			`<rect x="16" y="112" width="${(112 * pct).toFixed(1)}" height="8" rx="4" fill="${over ? WARN : ACCENT}"/>`
		);
		parts.push(line(`of ${money(budget.cap)}`, 136, 12, DIM));
	}
	return frame(parts.join(""));
}

/** Top three rows of a breakdown, by model or by project. */
export function breakdownBadge(title: string, rows: [string, number][]): string {
	const parts = [line(title.toUpperCase(), 22, 14, ACCENT, 700)];
	if (rows.length === 0) {
		parts.push(line("no data", 84, 16, DIM));
	} else {
		rows.slice(0, 3).forEach(([name, v], i) => {
			const y = 56 + i * 30;
			// 11 chars at 13px ends near x=88; the right-aligned amount starts near x=90.
			// Any wider and the two columns collide, which is what the first render did.
			parts.push(line(fit(name, 11), y, 13, TEXT, 600, 10, "start"));
			parts.push(line(money(v), y, 13, DIM, 600, 134, "end"));
		});
	}
	return frame(parts.join(""));
}

/** Cache hit rate. High is good here, so the colour scale is inverted from the budget bar. */
export function cacheBadge(pct: number, saved: number): string {
	const good = pct >= 60;
	return frame(
		[
			line("CACHE HIT", 26, 14, ACCENT, 700),
			line(`${pct.toFixed(0)}%`, 92, 48, good ? ACCENT : AMBER, 700),
			line(`saved ${money(saved)}`, 124, 14, DIM)
		].join("")
	);
}

/**
 * Daily spend as a sparkline. Bars rather than a path: at 144px a 7 to 30 bar chart reads
 * cleanly and a smoothed line does not.
 */
export function sparkBadge(label: string, value: string, series: number[]): string {
	const parts = [line(label.toUpperCase(), 22, 13, ACCENT, 700), line(value, 70, 34, TEXT, 700)];
	const max = Math.max(...series, 0);
	if (series.length > 0 && max > 0) {
		const w = 128 / series.length;
		series.forEach((v, i) => {
			const h = Math.max(2, (v / max) * 44);
			parts.push(
				`<rect x="${(8 + i * w).toFixed(1)}" y="${(130 - h).toFixed(1)}" width="${Math.max(1, w - 1.5).toFixed(1)}" height="${h.toFixed(1)}" rx="1" fill="${ACCENT}" opacity="0.85"/>`
			);
		});
	}
	return frame(parts.join(""));
}

export function messageBadge(top: string, bottom: string): string {
	return frame(line(top, 62, 17, DIM, 700) + line(bottom, 88, 17, DIM, 700));
}
