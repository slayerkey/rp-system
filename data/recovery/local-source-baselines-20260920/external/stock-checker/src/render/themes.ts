import type { ThemeName } from "../settings";

export type Theme = {
	bg: string;
	label: string;
	muted: string;
	up: string;
	down: string;
	flat: string;
	extended: string;
};

export const THEMES: Record<ThemeName, Theme> = {
	dark: {
		bg: "#0B0E11",
		label: "#E6E8EA",
		muted: "#848E9C",
		up: "#16C784",
		down: "#EA3943",
		flat: "#848E9C",
		extended: "#F0B90B",
	},
	minimal: {
		bg: "#000000",
		label: "#9AA0A6",
		muted: "#5F6368",
		up: "#34A853",
		down: "#EA4335",
		flat: "#9AA0A6",
		extended: "#FBBC04",
	},
	pro: {
		bg: "#0A0A0A",
		label: "#FFFFFF",
		muted: "#B0B0B0",
		up: "#00E676",
		down: "#FF1744",
		flat: "#B0B0B0",
		extended: "#FFC400",
	},
};
