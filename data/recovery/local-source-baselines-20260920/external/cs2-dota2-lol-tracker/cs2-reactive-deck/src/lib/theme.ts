/** Shared CS2 Reactive Deck palette + helpers. CS2's identity is tactical orange on near-black. */

export const THEME = {
	bg: "#0c0d10",
	bgDim: "#16181d",
	orange: "#de9b35",
	orangeBright: "#ff9d2e",
	green: "#30e27b",
	greenBright: "#5dff9b",
	yellow: "#ffd60a",
	red: "#ff3b30",
	redDark: "#7a1a16",
	blue: "#3b82f6",
	grey: "#5b6168",
	text: "#ffffff",
	textDim: "#aab0bb"
} as const;

/** Pick a colour for a 0-100 value against high/low thresholds (defaults 80/50). */
export function thresholdColor(
	value: number,
	good = "#30e27b",
	mid = "#ffd60a",
	bad = "#ff3b30",
	highCut = 80,
	lowCut = 50
): string {
	if (value > highCut) return good;
	if (value >= lowCut) return mid;
	return bad;
}

/** Darken a hex colour toward black by `f` (0..1) — used for gradient bottoms. */
export function darken(hex: string, f = 0.6): string {
	const n = hex.replace("#", "");
	const r = Math.round(parseInt(n.slice(0, 2), 16) * f);
	const g = Math.round(parseInt(n.slice(2, 4), 16) * f);
	const b = Math.round(parseInt(n.slice(4, 6), 16) * f);
	return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
