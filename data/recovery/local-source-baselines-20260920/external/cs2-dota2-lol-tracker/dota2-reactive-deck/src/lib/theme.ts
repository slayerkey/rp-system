/** Shared Dota 2 Reactive Deck palette + helpers. Dota's identity is deep crimson on black. */

export const THEME = {
	bg: "#120a0a",
	bgDim: "#1d1010",
	crimson: "#c23c2a",
	crimsonBright: "#ff5a3c",
	gold: "#ffce4a",
	goldBright: "#ffe08a",
	green: "#30e27b",
	yellow: "#ffd60a",
	red: "#ff3b30",
	redDark: "#5a1410",
	mana: "#2f8fff",
	manaTrack: "#15315a",
	grey: "#6a5d5d",
	text: "#ffffff",
	textDim: "#c4b2b0"
} as const;

/** Pick a colour for a 0-100 percentage against high/low thresholds (defaults 60/30). */
export function pctColor(pct: number, good = "#30e27b", mid = "#ffd60a", bad = "#ff3b30", highCut = 60, lowCut = 30): string {
	if (pct > highCut) return good;
	if (pct >= lowCut) return mid;
	return bad;
}

/** Format large gold numbers compactly: 12345 -> 12.3k. */
export function compact(n: number): string {
	if (n >= 10000) return `${(n / 1000).toFixed(1)}k`;
	return String(n);
}
