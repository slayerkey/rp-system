/** Helpers for reading the fields we care about out of a Dota 2 GSI payload. */
import type { GsiPayload } from "./gsi-server";

export type HeroVitals = {
	hp: number;
	maxHp: number;
	hpPct: number;
	mp: number;
	maxMp: number;
	mpPct: number;
	alive: boolean;
	level: number;
};

/** Hero health / mana, or null when no hero is in play. */
export function heroVitals(p: GsiPayload | null): HeroVitals | null {
	const h = p?.hero;
	if (!h || typeof h.health !== "number") return null;
	const maxHp = h.max_health || 1;
	const maxMp = h.max_mana || 1;
	return {
		hp: h.health,
		maxHp,
		hpPct: typeof h.health_percent === "number" ? h.health_percent : Math.round((h.health / maxHp) * 100),
		mp: h.mana ?? 0,
		maxMp,
		mpPct: typeof h.mana_percent === "number" ? h.mana_percent : Math.round(((h.mana ?? 0) / maxMp) * 100),
		alive: h.alive !== false,
		level: h.level ?? 0
	};
}

/** Current unreliable+reliable gold, or null. */
export function gold(p: GsiPayload | null): number | null {
	const g = p?.player?.gold;
	return typeof g === "number" ? g : null;
}

export type Kda = { k: number; d: number; a: number };

/** Kills / deaths / assists, or null. */
export function kda(p: GsiPayload | null): Kda | null {
	const pl = p?.player;
	if (!pl || typeof pl.kills !== "number") return null;
	return { k: pl.kills ?? 0, d: pl.deaths ?? 0, a: pl.assists ?? 0 };
}

/** Net worth (gold + items), or null. */
export function netWorth(p: GsiPayload | null): number | null {
	const n = p?.player?.net_worth;
	return typeof n === "number" ? n : null;
}

export type Respawn = { alive: boolean; seconds: number };

/** Alive state + respawn countdown (auto-detected from GSI — no button press needed). */
export function respawn(p: GsiPayload | null): Respawn | null {
	const h = p?.hero;
	if (!h || h.alive === undefined) return null;
	return { alive: h.alive !== false, seconds: typeof h.respawn_seconds === "number" ? h.respawn_seconds : 0 };
}

export type MatchClock = { clock: number; day: boolean };

/** Game clock (seconds; negative during the pre-game horn) + day/night. */
export function matchClock(p: GsiPayload | null): MatchClock | null {
	const m = p?.map;
	if (!m || typeof m.clock_time !== "number") return null;
	return { clock: m.clock_time, day: m.daytime !== false };
}
