/**
 * Key faces as SVG strings. Same approach as `plugins/_shared/src/badge.ts`: no canvas, no
 * native binary, identical on Windows and macOS. `keyImage` is reused from the shared module
 * because the base64 data-URI wrapping is the part that silently fails if you get it wrong.
 */
import { escapeXml, keyImage } from "../../_shared/src/badge";

const BG = "#0d1117";
const TEXT = "#ffffff";
const DIM = "#8b949e";
const ACCENT = "#2BE86A"; // Packrat hacker green
const WARN = "#ff7b72";

export { keyImage };

/** Dollars sized so the number always fits the 144px face without measuring glyphs. */
function moneySize(s: string): number {
	if (s.length <= 5) return 44;
	if (s.length <= 6) return 38;
	if (s.length <= 7) return 33;
	if (s.length <= 8) return 29;
	return 25;
}

/**
 * Formats USD for a key.
 *
 * Cents only below $10. Above that they are noise on a key you read at a glance: "$64" carries
 * every bit of the decision "$64.38" does, in fewer glyphs and at a larger size. Below $10 the
 * cents are the whole story, because the difference between $0.40 and $4.00 is the point.
 * A single decimal is never used: "$18.4" is not a shape money is written in.
 */
export function money(v: number): string {
	if (v >= 1000) return `$${Math.round(v).toLocaleString("en-US")}`;
	if (v >= 10) return `$${v.toFixed(0)}`;
	return `$${v.toFixed(2)}`;
}

export function compactTokens(v: number): string {
	if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
	if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
	if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
	return String(v);
}

function frame(inner: string): string {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">
<rect width="144" height="144" fill="${BG}"/>${inner}</svg>`;
}

function line(text: string, y: number, size: number, fill: string, weight = 600): string {
	return `<text x="72" y="${y}" text-anchor="middle" font-family="Verdana,DejaVu Sans,sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}">${escapeXml(text)}</text>`;
}

export type CostFace = {
	/** Period label, e.g. "TODAY" or "30 DAYS". */
	period: string;
	value: string;
	/** Secondary line, e.g. the tool scope or token count. */
	sub?: string;
	/** Draws the value in the warning colour, used when a budget is exceeded. */
	alarm?: boolean;
	/** Marks the figure as incomplete because some turns had no known rate. */
	partial?: boolean;
};

export function costBadge(f: CostFace): string {
	const fill = f.alarm ? WARN : TEXT;
	const parts = [
		line(f.period.toUpperCase(), 26, 15, ACCENT, 700),
		line(f.value, 88, moneySize(f.value), fill, 700)
	];
	if (f.sub) parts.push(line(f.sub, 122, 15, DIM));
	// A dot rather than a word: there is no room for a sentence, and the tooltip carries the
	// explanation. Better an honest "this is incomplete" mark than a wrong total shown clean.
	if (f.partial) parts.push(`<circle cx="132" cy="14" r="4" fill="${WARN}"/>`);
	return frame(parts.join(""));
}

/** Shown when no session logs exist at all, so the key never implies a real zero. */
export function messageBadge(top: string, bottom: string): string {
	return frame(line(top, 62, 17, DIM, 700) + line(bottom, 88, 17, DIM, 700));
}
