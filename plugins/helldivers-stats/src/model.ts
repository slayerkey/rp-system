export type JsonRecord = Record<string, unknown>;

export type MajorOrder = {
	id: string;
	title: string;
	briefing: string;
	expiresAt: string;
	progressPercent: number | null;
};

export type Front = {
	id: string;
	planet: string;
	faction: string;
	liberationPercent: number;
};

export type WarSummary = {
	activeCampaigns: number;
	overallLiberation: number;
	playerCount: number;
};

export type HelldiversSnapshot = {
	majorOrder: MajorOrder | null;
	campaigns: Front[];
	war: WarSummary;
	fetchedAt: number;
};

function record(value: unknown): JsonRecord | null {
	return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function records(value: unknown): JsonRecord[] {
	return Array.isArray(value) ? value.map(record).filter((item): item is JsonRecord => item !== null) : [];
}

function finite(value: unknown): number | null {
	const number = typeof value === "number" ? value : Number(value);
	return Number.isFinite(number) ? number : null;
}

function text(value: unknown): string {
	if (typeof value === "string") return value.replace(/\s+/g, " ").trim();
	const localized = record(value);
	if (!localized) return "";
	const preferred = localized["en-US"];
	if (typeof preferred === "string") return preferred.replace(/\s+/g, " ").trim();
	const first = Object.values(localized).find((item) => typeof item === "string");
	return typeof first === "string" ? first.replace(/\s+/g, " ").trim() : "";
}

function clampPercent(value: number): number {
	return Math.max(0, Math.min(100, value));
}

/**
 * Major Order task values are parallel arrays. A value type of 3 means target count, and the
 * assignment progress array has one current count per task. Average task completion keeps each
 * objective equally visible when an order mixes very different target scales.
 */
export function majorOrderProgress(assignment: JsonRecord): number | null {
	const progress = Array.isArray(assignment.progress) ? assignment.progress.map(finite) : [];
	const tasks = records(assignment.tasks);
	const ratios: number[] = [];

	for (let index = 0; index < Math.min(progress.length, tasks.length); index += 1) {
		const current = progress[index];
		if (current === null) continue;
		const values = Array.isArray(tasks[index].values) ? tasks[index].values : [];
		const valueTypes = Array.isArray(tasks[index].valueTypes) ? tasks[index].valueTypes : [];
		const targetAt = valueTypes.findIndex((value) => finite(value) === 3);
		const target = targetAt >= 0 ? finite(values[targetAt]) : null;
		if (target !== null && target > 0) ratios.push(clampPercent((current / target) * 100));
	}

	if (ratios.length === 0) return null;
	return ratios.reduce((sum, value) => sum + value, 0) / ratios.length;
}

export function parseMajorOrder(value: unknown, nowMs: number): MajorOrder | null {
	const assignments = records(value)
		.filter((item) => {
			const expiresAt = Date.parse(text(item.expiration));
			return !Number.isFinite(expiresAt) || expiresAt > nowMs;
		})
		.sort((a, b) => Date.parse(text(a.expiration)) - Date.parse(text(b.expiration)));
	const assignment = assignments[0];
	if (!assignment) return null;

	return {
		id: String(assignment.id ?? "major-order"),
		title: text(assignment.title) || text(assignment.description) || "MAJOR ORDER",
		briefing: text(assignment.briefing) || text(assignment.description),
		expiresAt: text(assignment.expiration),
		progressPercent: majorOrderProgress(assignment)
	};
}

function liberationPercent(planet: JsonRecord): number {
	const event = record(planet.event);
	const health = finite(event?.health ?? planet.health);
	const maxHealth = finite(event?.maxHealth ?? planet.maxHealth);
	if (health === null || maxHealth === null || maxHealth <= 0) return 0;
	return clampPercent((1 - health / maxHealth) * 100);
}

export function parseFronts(campaignValue: unknown, planetValue: unknown): Front[] {
	const planets = new Map(records(planetValue).map((planet) => [String(planet.index ?? ""), planet]));
	return records(campaignValue)
		.map((campaign): Front | null => {
			const embedded = record(campaign.planet);
			if (!embedded) return null;
			const planet = planets.get(String(embedded.index ?? "")) ?? embedded;
			const name = text(planet.name);
			if (!name) return null;
			return {
				id: String(campaign.id ?? planet.index ?? name),
				planet: name,
				faction: text(campaign.faction) || text(record(planet.event)?.faction) || text(planet.currentOwner) || "Unknown",
				liberationPercent: liberationPercent(planet)
			};
		})
		.filter((front): front is Front => front !== null)
		.sort((a, b) => b.liberationPercent - a.liberationPercent || a.planet.localeCompare(b.planet));
}

function isHumanOwner(owner: string): boolean {
	const normalized = owner.toLowerCase();
	return normalized.includes("human") || normalized.includes("super earth");
}

export function parseWarSummary(warValue: unknown, planetValue: unknown, activeCampaigns: number): WarSummary {
	const war = record(warValue);
	const statistics = record(war?.statistics);
	const planets = records(planetValue).filter((planet) => planet.disabled !== true && text(planet.name));
	const held = planets.filter((planet) => isHumanOwner(text(planet.currentOwner))).length;

	return {
		activeCampaigns,
		overallLiberation: planets.length > 0 ? clampPercent((held / planets.length) * 100) : 0,
		playerCount: Math.max(0, finite(statistics?.playerCount) ?? 0)
	};
}

export function makeSnapshot(
	warValue: unknown,
	campaignValue: unknown,
	assignmentValue: unknown,
	planetValue: unknown,
	nowMs: number
): HelldiversSnapshot {
	const campaigns = parseFronts(campaignValue, planetValue);
	return {
		majorOrder: parseMajorOrder(assignmentValue, nowMs),
		campaigns,
		war: parseWarSummary(warValue, planetValue, campaigns.length),
		fetchedAt: nowMs
	};
}

export function factionAccent(faction: string): string {
	const normalized = faction.toLowerCase();
	if (normalized.includes("terminid")) return "#e99a2b";
	if (normalized.includes("automaton")) return "#e14646";
	if (normalized.includes("illuminate")) return "#4b91e8";
	if (normalized.includes("human") || normalized.includes("super earth")) return "#2be86a";
	return "#667085";
}

export function compactCount(value: number): string {
	if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
	if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 100_000 ? 0 : 1)}K`;
	return String(Math.round(value));
}

