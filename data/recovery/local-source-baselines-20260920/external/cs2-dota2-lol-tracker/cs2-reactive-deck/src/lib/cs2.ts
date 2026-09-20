/** Helpers for reading the fields we care about out of a CS2 GSI payload. */
import type { GsiPayload } from "./gsi-server";

export type ActiveWeapon = {
	name: string;
	clip: number;
	clipMax: number;
	reserve: number;
	type: string;
	reloading: boolean;
};

/** Current health (0-100), or null if not present. */
export function health(p: GsiPayload | null): number | null {
	const h = p?.player?.state?.health;
	return typeof h === "number" ? h : null;
}

/** Current armor (0-100), or null. */
export function armor(p: GsiPayload | null): number | null {
	const a = p?.player?.state?.armor;
	return typeof a === "number" ? a : null;
}

/** The weapon currently in hand. CS2 marks it "active" normally and "reloading" mid-reload. */
export function activeWeapon(p: GsiPayload | null): ActiveWeapon | null {
	const weapons = p?.player?.weapons;
	if (!weapons) return null;
	for (const w of Object.values<any>(weapons)) {
		if (w?.state === "active" || w?.state === "reloading") {
			return {
				name: String(w.name ?? "").replace(/^weapon_/, ""),
				clip: typeof w.ammo_clip === "number" ? w.ammo_clip : -1,
				clipMax: typeof w.ammo_clip_max === "number" ? w.ammo_clip_max : -1,
				reserve: typeof w.ammo_reserve === "number" ? w.ammo_reserve : -1,
				type: String(w.type ?? ""),
				reloading: w.state === "reloading"
			};
		}
	}
	return null;
}

/** Kills scored in the current round (resets each round / on respawn in deathmatch). */
export function roundKills(p: GsiPayload | null): number | null {
	const k = p?.player?.state?.round_kills;
	return typeof k === "number" ? k : null;
}

/** Headshot kills this round, used to flag a kill as a headshot. */
export function roundHsKills(p: GsiPayload | null): number {
	const k = p?.player?.state?.round_killhs;
	return typeof k === "number" ? k : 0;
}

/** Current money ($), or null. */
export function money(p: GsiPayload | null): number | null {
	const m = p?.player?.state?.money;
	return typeof m === "number" ? m : null;
}

export type MatchStats = { kills: number; assists: number; deaths: number; mvps: number; score: number };

/** Cumulative match stats (survive respawns and rounds) — the right counter for deathmatch. */
export function matchStats(p: GsiPayload | null): MatchStats | null {
	const m = p?.player?.match_stats;
	if (!m) return null;
	return {
		kills: m.kills ?? 0,
		assists: m.assists ?? 0,
		deaths: m.deaths ?? 0,
		mvps: m.mvps ?? 0,
		score: m.score ?? 0
	};
}

export type RoundScore = { ct: number; t: number; side: "CT" | "T" | null };

/** Current round score (CT vs T) and which side the player is on. */
export function roundScore(p: GsiPayload | null): RoundScore | null {
	const m = p?.map;
	if (!m?.team_ct || !m?.team_t) return null;
	const side = p?.player?.team;
	return { ct: m.team_ct.score ?? 0, t: m.team_t.score ?? 0, side: side === "CT" || side === "T" ? side : null };
}

export type Phase = "freezetime" | "live" | "bomb" | "over" | "unknown";

/** Normalised round phase, accounting for a planted bomb. */
export function roundPhase(p: GsiPayload | null): Phase {
	const phase = p?.round?.phase;
	const bomb = p?.round?.bomb;
	if (phase === "live" && bomb === "planted") return "bomb";
	if (phase === "freezetime") return "freezetime";
	if (phase === "live") return "live";
	if (phase === "over") return "over";
	return "unknown";
}
