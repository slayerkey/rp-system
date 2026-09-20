// Visual tokens: bright traffic-light threshold colors, accents, styles, themes.

export type AccentName = "orange" | "blue" | "green" | "purple";
export const ACCENTS: Record<AccentName, string> = {
	orange: "#FF8A3D", // Claude terracotta, brightened
	blue: "#4C9BE8",
	green: "#30E27B",
	purple: "#B98CFF",
};
export const ACCENT_ORDER: AccentName[] = ["orange", "blue", "green", "purple"];

export type StyleName = "ring" | "full" | "number" | "bigdate" | "countdown" | "sparkline" | "heatmap" | "status";
export const STYLE_ORDER: StyleName[] = ["ring", "full", "number", "bigdate", "countdown", "sparkline", "heatmap", "status"];

export type ThemeName = "oled" | "midnight" | "light";
export interface Theme {
	bg: string;
	dim: string; // track / inactive
	text: string;
	sub: string; // secondary text
}
export const THEMES: Record<ThemeName, Theme> = {
	oled: { bg: "#000000", dim: "#222226", text: "#FFFFFF", sub: "#9A9AA2" },
	midnight: { bg: "#0C0C0E", dim: "#2A2A30", text: "#FFFFFF", sub: "#A2A2AC" },
	light: { bg: "#F4F4F6", dim: "#D9D9DF", text: "#17171B", sub: "#6E6E78" },
};

export interface UsageColor {
	color: string;
	label: string;
}

const GREEN = "#30E27B";
const YELLOW = "#FFD60A";
const RED = "#FF3B30";

function mix(a: string, b: string, t: number): string {
	const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
	const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
	const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
	return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
}

/**
 * Continuous green → yellow → red gradient on *consumed* %.
 * Green at 0, yellow by 50, and fully red by 85% (so 85%+ reads as red, not dim yellow).
 */
export function usageColor(used: number): UsageColor {
	const u = Math.max(0, Math.min(100, used));
	let color: string;
	if (u <= 50) color = mix(GREEN, YELLOW, u / 50);
	else if (u <= 85) color = mix(YELLOW, RED, (u - 50) / 35);
	else color = RED;
	const label = u >= 85 ? "Critical" : u >= 50 ? "Caution" : "Safe";
	return { color, label };
}

export function cycle<T>(order: readonly T[], current: T): T {
	const i = order.indexOf(current);
	return order[(i + 1) % order.length];
}
