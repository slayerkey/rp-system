export type ThemeName = "oled" | "creator";

export interface Theme {
	bg: string;
	text: string;
	sub: string;
	dim: string;
	track: string;
}

export const THEMES: Record<ThemeName, Theme> = {
	oled: {
		bg: "#000000",
		text: "#FFFFFF",
		sub: "#9A9AA2",
		dim: "#1C1C1E",
		track: "#2C2C2E",
	},
	creator: {
		bg: "#0D0D14",
		text: "#FFFFFF",
		sub: "#8080A0",
		dim: "#1A1A2E",
		track: "#252540",
	},
};

export const PLATFORM_COLORS: Record<string, string> = {
	youtube: "#FF0000",
	twitch: "#9146FF",
	tiktok: "#010101",
	instagram: "#E1306C",
	x: "#1D9BF0",
};

export const DISPLAY_MODE_ORDER: Array<import("../platforms/types").DisplayMode> = [
	"number",
	"milestone",
	"trend",
	"live",
	"streak",
];

export function cycleMode<T>(arr: T[], current: T): T {
	const i = arr.indexOf(current);
	return arr[(i + 1) % arr.length];
}
