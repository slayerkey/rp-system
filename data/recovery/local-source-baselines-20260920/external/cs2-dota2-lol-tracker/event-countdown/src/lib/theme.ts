/** Event Countdown palette. Identity: calm violet that escalates amber → red as time runs out. */

export const THEME = {
	bg: "#100a18",
	bgDim: "#1a1226",
	violet: "#a06bdc",
	violetBright: "#c79bff",
	amber: "#ffab2e",
	amberDeep: "#3a2708",
	red: "#ff3b30",
	redDeep: "#3a0e0c",
	gold: "#ffd86b",
	grey: "#6a6080",
	text: "#f3eefb",
	textDim: "#b6a9cc"
} as const;

export type Phase = "normal" | "warn" | "urgent" | "celebrate" | "idle";

export type Remaining = { d: number; h: number; m: number; s: number };

/** Break a positive millisecond span into day/hour/minute/second parts. */
export function breakdown(ms: number): Remaining {
	const t = Math.max(0, Math.floor(ms / 1000));
	return {
		d: Math.floor(t / 86400),
		h: Math.floor((t % 86400) / 3600),
		m: Math.floor((t % 3600) / 60),
		s: t % 60
	};
}

export type Fmt = "d" | "dh" | "dhm";

/** Render the countdown into a big primary string and a smaller secondary string. */
export function formatParts(r: Remaining, fmt: Fmt): { big: string; sub: string } {
	if (r.d >= 1) {
		const big = `${r.d}d`;
		if (fmt === "d") return { big, sub: r.d === 1 ? "day" : "days" };
		if (fmt === "dh") return { big, sub: `${r.h}h` };
		return { big, sub: `${r.h}h ${r.m}m` };
	}
	// Under a day.
	if (fmt === "d") return { big: "<1d", sub: `${r.h}h` };
	if (r.h >= 1) return { big: `${r.h}h`, sub: `${r.m}m` };
	// Under an hour — show minutes (and seconds for the dhm format).
	if (fmt === "dhm") return { big: `${r.m}m`, sub: `${String(r.s).padStart(2, "0")}s` };
	return { big: `${r.m}m`, sub: "" };
}
