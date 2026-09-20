/**
 * The other half of the sport model: sports whose unit is an event with a field, not a game
 * between two teams.
 *
 * A UFC card is one event holding fourteen bouts. A NASCAR race is one event holding forty
 * drivers in finishing order. Neither fits home-versus-away with a score, so they get their own
 * parsers here and their own key faces, while sharing the client, the poller, the cache and the
 * stale handling with the team sports.
 */
import type { GameState } from "./espn";

export type CardEntry = {
	id: string;
	/** The line that carries the meaning: a matchup, or a driver's name. */
	primary: string;
	/** Supporting line: the bout's status, or the finishing position. */
	secondary: string;
	/** True when this entry is decided in someone's favour, used to mark a winner. */
	settled?: boolean;
};

export type SportEvent = {
	id: string;
	/** "UFC Fight Night: Medic vs. Rodriguez", "NASCAR Cup Series at Iowa". */
	name: string;
	shortName: string;
	startIso: string;
	state: GameState;
	statusShort: string;
	link: string;
	entries: CardEntry[];
};

function asArray(v: unknown): unknown[] {
	return Array.isArray(v) ? v : [];
}

function state(raw: unknown): GameState {
	return raw === "in" || raw === "post" ? raw : "pre";
}

function eventLink(links: unknown): string {
	const all = asArray(links) as { href?: string }[];
	const href = all[0]?.href;
	return typeof href === "string" && href.startsWith("http") ? href : "";
}

function athleteName(competitor: unknown): { long: string; short: string } {
	const athlete = (competitor as { athlete?: { displayName?: string; shortName?: string } })?.athlete;
	const long = String(athlete?.displayName ?? "");
	return { long, short: String(athlete?.shortName ?? long) };
}

/**
 * A fight card: one event, one entry per bout, in the order ESPN lists them. The main event is
 * the last competition on the card, which is why the entries get reversed.
 */
export function parseFightCard(json: unknown): SportEvent[] {
	const events: SportEvent[] = [];
	for (const raw of asArray((json as { events?: unknown })?.events)) {
		const ev = raw as {
			id?: string;
			name?: string;
			shortName?: string;
			date?: string;
			status?: { type?: { state?: string; shortDetail?: string } };
			competitions?: unknown[];
			links?: unknown[];
		};
		if (!ev.id) continue;
		const bouts = asArray(ev.competitions).map((rawBout) => {
			const bout = rawBout as {
				id?: string;
				competitors?: unknown[];
				status?: { type?: { state?: string; shortDetail?: string } };
			};
			const sides = asArray(bout.competitors);
			const names = sides.map(athleteName);
			const winner = sides.find((c) => (c as { winner?: boolean })?.winner === true);
			return {
				id: String(bout.id ?? ""),
				primary: names.map((n) => n.short).join(" vs ") || "TBA",
				secondary: winner ? `${athleteName(winner).short} won` : String(bout.status?.type?.shortDetail ?? ""),
				settled: winner !== undefined
			};
		});
		events.push({
			id: String(ev.id),
			name: String(ev.name ?? ""),
			shortName: String(ev.shortName ?? ev.name ?? ""),
			startIso: String(ev.date ?? ""),
			state: state(ev.status?.type?.state),
			statusShort: String(ev.status?.type?.shortDetail ?? ""),
			link: eventLink(ev.links),
			// Main event last on ESPN's card, first on a key that only shows one line at a time.
			entries: bouts.reverse()
		});
	}
	return events;
}

/**
 * A race: one event, one entry per driver, in finishing order. Before the green flag ESPN
 * publishes the race with an empty field, which is a real state, not an error.
 */
export function parseRaceField(json: unknown): SportEvent[] {
	const events: SportEvent[] = [];
	for (const raw of asArray((json as { events?: unknown })?.events)) {
		const ev = raw as {
			id?: string;
			name?: string;
			shortName?: string;
			date?: string;
			status?: { type?: { state?: string; shortDetail?: string } };
			competitions?: unknown[];
			links?: unknown[];
		};
		if (!ev.id) continue;
		const race = asArray(ev.competitions)[0] as { competitors?: unknown[] } | undefined;
		const field = asArray(race?.competitors)
			.map((c) => {
				const order = Number((c as { order?: unknown })?.order);
				const name = athleteName(c);
				return {
					id: String((c as { id?: string })?.id ?? name.short),
					primary: name.short || "TBA",
					secondary: Number.isFinite(order) && order > 0 ? `P${order}` : "",
					settled: order === 1,
					order: Number.isFinite(order) ? order : 999
				};
			})
			.sort((a, b) => a.order - b.order)
			.map(({ order: _order, ...entry }) => entry);
		events.push({
			id: String(ev.id),
			name: String(ev.name ?? ""),
			shortName: String(ev.shortName ?? ev.name ?? ""),
			startIso: String(ev.date ?? ""),
			state: state(ev.status?.type?.state),
			statusShort: String(ev.status?.type?.shortDetail ?? ""),
			link: eventLink(ev.links),
			entries: field
		});
	}
	return events;
}

export type RankRow = {
	id: string;
	name: string;
	shortName: string;
	rank: number;
	points: number;
};

/** A championship table: drivers, riders, anyone ranked on season points. */
export function parseRankings(json: unknown): RankRow[] {
	const groups = asArray((json as { children?: unknown[] })?.children);
	const rows: RankRow[] = [];
	for (const rawGroup of groups) {
		const group = rawGroup as { standings?: { entries?: unknown[] } };
		for (const rawEntry of asArray(group.standings?.entries)) {
			const entry = rawEntry as {
				athlete?: { id?: string; displayName?: string; shortName?: string };
				stats?: { name?: string; value?: unknown; displayValue?: unknown }[];
			};
			const athlete = entry.athlete;
			if (!athlete?.id) continue;
			const pick = (name: string): number => {
				const hit = asArray(entry.stats).find((s) => (s as { name?: string })?.name === name) as
					| { value?: unknown }
					| undefined;
				const n = Number(hit?.value);
				return Number.isFinite(n) ? n : 0;
			};
			rows.push({
				id: String(athlete.id),
				name: String(athlete.displayName ?? ""),
				shortName: String(athlete.shortName ?? athlete.displayName ?? ""),
				rank: pick("rank"),
				points: pick("championshipPts") || pick("points")
			});
		}
	}
	return rows.sort((a, b) => a.rank - b.rank);
}

/** The event a key should be showing: the one running now, else the next, else the last. */
export function currentEvent(events: SportEvent[], nowMs: number): SportEvent | undefined {
	const live = events.find((e) => e.state === "in");
	if (live) return live;
	const upcoming = events
		.filter((e) => e.state === "pre" && Date.parse(e.startIso) >= nowMs - 6 * 60 * 60_000)
		.sort((a, b) => Date.parse(a.startIso) - Date.parse(b.startIso));
	if (upcoming.length > 0) return upcoming[0];
	return [...events].sort((a, b) => Date.parse(b.startIso) - Date.parse(a.startIso))[0];
}
