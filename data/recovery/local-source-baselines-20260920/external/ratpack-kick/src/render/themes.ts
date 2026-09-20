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
		bg: "#0a0f0a",
		text: "#FFFFFF",
		sub: "#7aaa7a",
		dim: "#0f1a0f",
		track: "#1a2e1a",
	},
};

export const PLATFORM_COLORS: Record<string, string> = {
	kick: "#53FC18",
};

export function cycleMode<T>(arr: T[], current: T): T {
	const i = arr.indexOf(current);
	return arr[(i + 1) % arr.length];
}
