/** LoL Live Companion palette + parsing helpers. Identity: Hextech gold on dark teal. */
import type { LiveData } from "./lol-client";
import { keyImage } from "./svg";

export const THEME = {
	bg: "#0a1014",
	bgDim: "#11181d",
	gold: "#c8aa6e",
	goldBright: "#f0d8a0",
	teal: "#0ac8b9",
	green: "#30e27b",
	yellow: "#ffd60a",
	red: "#ff3b30",
	redDark: "#5a1410",
	grey: "#5c6b72",
	text: "#ffffff",
	textDim: "#a8b8bf"
} as const;

export function pctColor(pct: number, good: string = THEME.green, mid: string = THEME.yellow, bad: string = THEME.red, highCut = 60, lowCut = 30): string {
	if (pct > highCut) return good;
	if (pct >= lowCut) return mid;
	return bad;
}

export function compact(n: number): string {
	if (n >= 10000) return `${(n / 1000).toFixed(1)}k`;
	return String(Math.round(n));
}

/** Shared "League isn't running" key image used by every action's idle state. */
export function idleCard(label: string): string {
	return keyImage({
		bg: THEME.bg,
		bg2: "#05080a",
		border: "#16242a",
		lines: [
			{ text: label, y: 68, size: 24, color: THEME.grey, weight: 800, spacing: 1 },
			{ text: "NOT IN GAME", y: 104, size: 14, color: THEME.grey, weight: 700, spacing: 1 }
		]
	});
}

/** The active player's gold. */
export function gold(d: LiveData | null): number | null {
	const g = d?.activePlayer?.currentGold;
	return typeof g === "number" ? g : null;
}

export type Vitals = { hp: number; maxHp: number; pct: number };

/** Active player's champion health. */
export function health(d: LiveData | null): Vitals | null {
	const cs = d?.activePlayer?.championStats;
	if (!cs || typeof cs.currentHealth !== "number") return null;
	const maxHp = cs.maxHealth || 1;
	return { hp: cs.currentHealth, maxHp, pct: Math.round((cs.currentHealth / maxHp) * 100) };
}

export type Resource = { val: number; max: number; pct: number; type: string };

/** Active player's mana / energy / resource. `max` is 0 for manaless champions. */
export function resource(d: LiveData | null): Resource | null {
	const cs = d?.activePlayer?.championStats;
	if (!cs || typeof cs.resourceValue !== "number") return null;
	const max = cs.resourceMax || 0;
	const type = String(d?.activePlayer?.championStats?.resourceType ?? cs.resourceType ?? "MANA");
	return { val: cs.resourceValue, max, pct: max > 0 ? Math.round((cs.resourceValue / max) * 100) : 0, type };
}

/** Active player's champion level. */
export function level(d: LiveData | null): number | null {
	const l = d?.activePlayer?.level;
	return typeof l === "number" ? l : null;
}

/** Game time in seconds (for CS/min etc.). */
export function gameTime(d: LiveData | null): number {
	const t = d?.gameData?.gameTime;
	return typeof t === "number" ? t : 0;
}

export type Scores = { k: number; d: number; a: number; cs: number };

/** Find the active player in allPlayers and return their scoreline. */
export function scores(d: LiveData | null): Scores | null {
	const me = activeName(d);
	const all = d?.allPlayers;
	if (!me || !Array.isArray(all)) return null;
	const entry = all.find((p: any) => p.summonerName === me || p.riotId === me || p.riotIdGameName === me);
	const sc = entry?.scores;
	if (!sc) return null;
	return { k: sc.kills ?? 0, d: sc.deaths ?? 0, a: sc.assists ?? 0, cs: sc.creepScore ?? 0 };
}

/** Best-effort name of the active player across API versions. */
function activeName(d: LiveData | null): string | null {
	const ap = d?.activePlayer;
	return ap?.summonerName ?? ap?.riotId ?? ap?.riotIdGameName ?? null;
}
