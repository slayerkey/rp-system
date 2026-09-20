/**
 * Dynamic key faces for the sport trackers.
 *
 * Stream Deck's setImage() accepts a raw SVG string, so a key face is just text, which means
 * no canvas dependency, no native binaries, and identical output on Windows and macOS. Every
 * function here is pure: give it data, get a string. That is what makes it testable without
 * a Stream Deck attached.
 *
 * Design rule for the whole tracker line: team colour plus abbreviation only. Never a logo,
 * crest, livery, wordmark or photo.
 *
 * Layout system, shared by every face so a deck of mixed sports reads as one product:
 *
 *   - A 6px team-colour spine down the left edge. It replaced a filled header band, which had to
 *     flip its text to black on the bright palettes, so a deck of fifteen keys looked like fifteen
 *     different products. The spine carries the same recognition and never fights the type.
 *   - One left margin at x=18 that everything aligns to, with the big numbers hanging off x=136.
 *   - Three zones: identity at the top, the answer in the middle at the largest size on the key,
 *     context on one line beneath a hairline. Every face answers exactly one question, and that
 *     answer is always the biggest thing on it.
 *   - Two type roles only: a wide-tracked 10px upper-case label, and the content itself. The
 *     contrast between those two is what carries the hierarchy.
 */

const W = 144;
/** The key ground. A slight vertical lift stops a grid of keys reading as flat black holes. */
const BG_TOP = "#0b0e15";
const BG_BOTTOM = "#06080d";
const TEXT = "#f5faf8";
const MUTED = "#c4cee0";
/** Labels and secondary context. Deliberately quiet so the answer is unambiguous. */
const DIM = "#7a8499";
/** A score that is behind. Present and readable, clearly not the headline. */
const TRAILING = "#78849c";
const LIVE = "#2be86a";
const STALE = "#f2b33d";
const HAIRLINE = "#ffffff";
const NEUTRAL_SPINE = "#2a2f3a";
const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";

/** Left margin every face aligns to, and the right edge the numbers hang from. */
const L = 18;
const R = 136;

export type ScoreBadge = {
	teamColor: string;
	teamAbbr: string;
	/** Blank for a game that has not started, so an upcoming key does not read "0". */
	teamScore: number | string;
	oppAbbr: string;
	oppScore: number | string;
	/** ESPN's short status line, already trimmed for the key: "Q3 5:32", "Final". */
	status: string;
	live?: boolean;
	stale?: boolean;
	/** How old the data is, shown only when stale: "12m", "3h". */
	staleAge?: string;
	/** Drawn for one refresh after the tracked team scores or the game tips off. */
	flash?: boolean;
	/** Game index and count, for the league scoreboard key: [2, 8] reads "2/8". */
	index?: [number, number];
	/**
	 * Local start time for a fixture that has not begun, drawn where the scores would be.
	 *
	 * The day is only worth the space when the game is not today. ESPN's default scoreboard
	 * returns the next slate when nothing is on, so out of season this key shows October fixtures
	 * and a bare "4:00 PM" would read as this afternoon. For a game later the same day the time
	 * already says everything, and a "TODAY" label is just noise.
	 */
	when?: { day?: string; time: string };
};

export type NextGameBadge = {
	teamColor: string;
	teamAbbr: string;
	oppAbbr: string;
	homeAway: "home" | "away";
	/** Two short lines: a countdown or date, then the local start time. */
	when: string;
	whenDetail?: string;
	/** True when `when` is a countdown, which is worth the accent colour. */
	imminent?: boolean;
	stale?: boolean;
	/** Position in a cycled list, for the key that walks every favourite: [2, 6] reads "2/6". */
	index?: [number, number];
};

export type StandingsBadge = {
	teamColor: string;
	teamAbbr: string;
	/** "EAST" or "ATLANTIC", whichever view the key is showing. */
	groupLabel: string;
	seed: number;
	wins: number;
	losses: number;
	/** ESPN's games-behind display value; "-" for the leader. */
	gamesBehind: string;
	/** Replaces the games-behind line for leagues that rank on points, e.g. "42 PTS". */
	note?: string;
	/** Recent form as ESPN reports it: "W2", "L1". */
	streak?: string;
	stale?: boolean;
};

export type MessageBadge = {
	title: string;
	detail?: string;
	stale?: boolean;
};

export type EventBadge = {
	accent: string;
	/** Short label for the series or promotion: "UFC", "CUP SERIES". */
	kicker: string;
	/** The headline: a main event, or a race name. */
	title: string;
	subtitle?: string;
	/** Countdown or date line. */
	when: string;
	imminent?: boolean;
	live?: boolean;
	stale?: boolean;
};

export type EntryBadge = {
	accent: string;
	kicker: string;
	primary: string;
	secondary: string;
	/** Position in the list being cycled: [3, 14] reads "3/14". */
	index?: [number, number];
	settled?: boolean;
	stale?: boolean;
};

// --- primitives ------------------------------------------------------------

export function escapeXml(s: string): string {
	return String(s).replace(
		/[&<>"']/g,
		(c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c] as string
	);
}

/** Perceived luminance 0..1, or null when the string is not a usable hex colour. */
export function luminance(color: string): number | null {
	const m = /^#?([0-9a-f]{6})$/i.exec(color.trim());
	if (!m) return null;
	const n = parseInt(m[1], 16);
	const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
	return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/**
 * Picks black or white text for a filled team colour. Perceived luminance, not a naive average,
 * because several team palettes (gold, cyan) are bright enough to swallow white text.
 *
 * The spine layout puts no text on a filled colour, so no face calls this today. It stays because
 * it is the right answer to a question any future filled surface asks again.
 */
export function readableOn(color: string): string {
	const l = luminance(color);
	return l !== null && l > 0.6 ? "#0b0d12" : TEXT;
}

/**
 * Some official palettes are effectively black (Brooklyn, San Antonio), which would leave the
 * spine invisible against the key ground. Fall back to the team's alternate colour, then to a
 * neutral slate, so every team still reads as a colour.
 */
export function displayColor(color: string, altColor?: string): string {
	const FLOOR = 0.1;
	const primary = luminance(color);
	if (primary !== null && primary >= FLOOR) return color;
	const alt = altColor === undefined ? null : luminance(altColor);
	if (alt !== null && alt >= FLOOR) return altColor as string;
	return NEUTRAL_SPINE;
}

/**
 * Mixes a colour toward white.
 *
 * The team abbreviation is set in the team's own colour, which is what makes a key identifiable
 * across a room with no crest on it. Straight from ESPN, many of those colours are deep navies
 * and maroons that sit too close to the ground to read as text, so they get lifted while keeping
 * their hue.
 */
export function lift(color: string, amount = 0.42): string {
	const m = /^#?([0-9a-f]{6})$/i.exec(color.trim());
	if (!m) return MUTED;
	const n = parseInt(m[1], 16);
	const mix = (c: number): number => Math.round(c + (255 - c) * amount);
	const [r, g, b] = [mix((n >> 16) & 255), mix((n >> 8) & 255), mix(n & 255)];
	return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

type TextOpts = {
	x: number;
	y: number;
	size: number;
	fill: string;
	anchor?: "start" | "middle" | "end";
	weight?: number;
	/** Letter spacing in px. The wide setting is what makes a 10px label read as a label. */
	track?: number;
};

function text(value: string, o: TextOpts): string {
	return (
		`<text x="${o.x}" y="${o.y}" font-family="${FONT}" font-size="${o.size}" font-weight="${o.weight ?? 700}" ` +
		`fill="${o.fill}" text-anchor="${o.anchor ?? "start"}" letter-spacing="${o.track ?? 0.5}">${escapeXml(value)}</text>`
	);
}

/**
 * The wide-tracked upper-case label. One of only two type roles on any face.
 *
 * Truncated on measured width because the group names come from ESPN and vary wildly by sport:
 * "EAST" costs nothing, "FBS INDEPENDENTS" does not fit, and the tracking makes a label far wider
 * than its character count suggests.
 */
function label(value: string, y: number, fill = DIM): string {
	const TRACK = 2.4;
	let out = value.toUpperCase();
	while (out.length > 1 && measure(out, 10, TRACK) > R - L) out = out.slice(0, -1);
	return text(out.trimEnd(), { x: L, y, size: 10, fill, weight: 700, track: TRACK });
}

/** Separates the answer from its context. Barely there on purpose. */
function rule(y: number): string {
	return `<rect x="${L}" y="${y}" width="${R - L}" height="1" fill="${HAIRLINE}" opacity="0.1" />`;
}

/** The team-colour spine. Recognition at a glance, with no text sitting on the colour. */
function spine(color: string): string {
	return (
		`<rect width="6" height="${W}" fill="${color}" />` +
		`<rect x="6" width="1" height="${W}" fill="${HAIRLINE}" opacity="0.07" />`
	);
}

/**
 * Live marker: one dot in the top left corner, still readable on the smallest key.
 *
 * Left rather than right because the right edge is where the scores hang, and a three digit score
 * reaches within a few pixels of the corner. On the left the dot sits on the same margin as every
 * other element, clear above the identity line.
 */
function liveDot(on: boolean | undefined): string {
	// Offset by its own radius so the dot's left edge lands on the text margin, not its centre.
	return on ? `<circle cx="${L + 4}" cy="14" r="4" fill="${LIVE}" />` : "";
}

/**
 * Stale marker: a bar along the bottom edge rather than a corner dot, which used to sit on top
 * of a three digit score. The bottom strip is the one part of every badge that stays empty.
 */
function staleBar(on: boolean | undefined): string {
	return on ? `<rect y="${W - 5}" width="${W}" height="5" fill="${STALE}" />` : "";
}

/**
 * Wraps finished SVG markup in the form setImage() actually accepts: a base64 data URI.
 *
 * Raw markup does not render, and a plain-text data URI is worse than useless here because every
 * colour in a badge starts with '#', which a URI parser reads as the start of a fragment and
 * throws the rest of the document away. Base64 sidesteps the escaping question entirely.
 */
export function keyImage(markup: string): string {
	return `data:image/svg+xml;base64,${Buffer.from(markup, "utf-8").toString("base64")}`;
}

/**
 * The "something just happened" frame: drawn for one refresh after the tracked team scores or
 * the game tips off, so a glance at the deck catches it. Stream Deck has no animation channel
 * for a plugin-set image, so a frame that appears and then goes away on the next paint is the
 * honest version of an alert.
 */
function flashFrame(on: boolean | undefined): string {
	return on ? `<rect x="2" y="2" width="${W - 4}" height="${W - 4}" fill="none" stroke="${LIVE}" stroke-width="4" />` : "";
}

function svg(body: string): string {
	return (
		`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}" viewBox="0 0 ${W} ${W}">` +
		// Namespaced id: these faces get inlined next to each other in the marketing renderer, and
		// a bare id like "g" would collide with whatever else is on that page.
		`<defs><linearGradient id="pk-key-bg" x1="0" y1="0" x2="0" y2="1">` +
		`<stop offset="0" stop-color="${BG_TOP}" /><stop offset="1" stop-color="${BG_BOTTOM}" />` +
		`</linearGradient></defs>` +
		`<rect width="${W}" height="${W}" fill="url(#pk-key-bg)" />${body}</svg>`
	);
}

/** Keeps a status line from overflowing the key. ESPN pads some of them out. */
export function fitStatus(status: string, max = 14): string {
	const clean = status.replace(/\s*-\s*/g, " ").replace(/\s+/g, " ").trim();
	return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
}

/**
 * Approximate advance width of one character, in em.
 *
 * Counting characters is not good enough for the event faces, whose entire content is names:
 * "William Byron" and "Gaethje vs" are the same length and nowhere near the same width. These
 * are Helvetica's rough proportions, which is all that is needed to decide where a line breaks.
 */
function advance(ch: string): number {
	if (" .,:;'`!|iIjlt".includes(ch)) return 0.28;
	if ("fr()[]/\\-".includes(ch)) return 0.36;
	if ("mMWw@".includes(ch)) return 0.85;
	if (ch >= "A" && ch <= "Z") return 0.7;
	if (ch >= "0" && ch <= "9") return 0.56;
	return 0.55;
}

/** Rendered width of a string in pixels, near enough to lay a 144px key out against. */
export function measure(value: string, size: number, track = 0): number {
	let em = 0;
	for (const ch of value) em += advance(ch);
	return em * size + Math.max(value.length - 1, 0) * track;
}

// --- badges ----------------------------------------------------------------

/**
 * The score. Two rows, each an abbreviation against its number, and the number is the answer.
 *
 * The side that is ahead is set in full white and the side behind is dimmed, so who is winning
 * registers before either number is actually read. Scores are blank before tip-off, which is the
 * one case where neither side leads and both stay white.
 */
export function scoreBadge(b: ScoreBadge): string {
	const own = Number(b.teamScore);
	const opp = Number(b.oppScore);
	const comparable =
		String(b.teamScore) !== "" && String(b.oppScore) !== "" && Number.isFinite(own) && Number.isFinite(opp);
	const ownFill = !comparable || own >= opp ? TEXT : TRAILING;
	const oppFill = !comparable || opp >= own ? TEXT : TRAILING;
	const accent = displayColor(b.teamColor);

	// The index and the stale age share the bottom right corner. A board key always has an index,
	// and its stale bar already carries the warning, so the index wins the slot.
	const corner = b.index
		? text(`${b.index[0]}/${b.index[1]}`, { x: R, y: 130, size: 11, fill: DIM, anchor: "end", weight: 500 })
		: b.stale && b.staleAge
			? text(b.staleAge, { x: R, y: 130, size: 11, fill: STALE, anchor: "end", weight: 500 })
			: "";
	// The status shares its line with that corner, so it gets less room when one is present.
	const status = fitStatus(b.status, corner ? 11 : 14);

	// Before a game starts there are no scores to draw, so the right hand column carries the
	// kick-off instead of sitting empty: the time alone for a game today, the date above it
	// otherwise. With no date to stack under, the time centres against the matchup and grows.
	const scheduled = b.when
		? b.when.day
			? text(ellipsize(b.when.day, 13, 74), { x: R, y: 46, size: 13, fill: DIM, anchor: "end", weight: 500 }) +
				text(b.when.time, { x: R, y: 90, size: 16, fill: TEXT, anchor: "end", weight: 700 })
			: text(b.when.time, { x: R, y: 76, size: 21, fill: TEXT, anchor: "end", weight: 700 })
		: text(String(b.teamScore), { x: R, y: 48, size: 38, fill: ownFill, anchor: "end", track: 0 }) +
			text(String(b.oppScore), { x: R, y: 92, size: 38, fill: oppFill, anchor: "end", track: 0 });

	return svg(
		spine(accent) +
			liveDot(b.live) +
			text(b.teamAbbr, { x: L, y: 48, size: 16, fill: lift(accent), track: 1.6 }) +
			text(b.oppAbbr, { x: L, y: 92, size: 16, fill: MUTED, track: 1.6 }) +
			scheduled +
			rule(108) +
			// The status line would only repeat the time a scheduled game already shows above.
			(b.when
				? ""
				: text(status, {
						x: L,
						y: 130,
						size: 14,
						fill: b.live ? LIVE : MUTED,
						weight: b.live ? 700 : 500,
						track: 0.6
					})) +
			corner +
			staleBar(b.stale) +
			flashFrame(b.flash)
	);
}

/** Who is next and when. The opponent is the answer; the clock is the context under it. */
export function nextGameBadge(b: NextGameBadge): string {
	const versus = `${b.homeAway === "home" ? "vs" : "@"} ${b.oppAbbr}`;
	const accent = displayColor(b.teamColor);
	// Two questions, in order: who, then when. The opponent stays the headline, but the time is
	// the second thing anyone wants off this key, so it is set as content rather than as a caption.
	// The two time lines stack rather than flank: "IN 2H 15M" beside "7:30 PM" collided on the
	// exact case this key exists for, which is a game close enough to be counting down.
	return svg(
		spine(accent) +
			text(b.teamAbbr, { x: L, y: 34, size: 16, fill: lift(accent), track: 1.6 }) +
			label("Next", 53) +
			text(versus, { x: L, y: 88, size: 28, fill: TEXT, track: 0.2 }) +
			rule(100) +
			text(b.when, {
				x: L,
				y: 121,
				size: 17,
				fill: b.imminent ? LIVE : TEXT,
				weight: 700,
				track: 0.4
			}) +
			(b.whenDetail ? text(b.whenDetail, { x: L, y: 137, size: 11, fill: DIM, weight: 500 }) : "") +
			(b.index
				? text(`${b.index[0]}/${b.index[1]}`, { x: R, y: 121, size: 11, fill: DIM, anchor: "end", weight: 500 })
				: "") +
			staleBar(b.stale)
	);
}

/** Where they sit. The seed is the answer; the record and form are the context. */
export function standingsBadge(b: StandingsBadge): string {
	const seed = b.seed > 0 ? `#${b.seed}` : "--";
	const gb = b.note ?? (b.gamesBehind && b.gamesBehind !== "-" ? `GB ${b.gamesBehind}` : "LEADER");
	const accent = displayColor(b.teamColor);
	return svg(
		spine(accent) +
			text(b.teamAbbr, { x: L, y: 40, size: 16, fill: lift(accent), track: 1.6 }) +
			label(b.groupLabel, 62) +
			text(seed, { x: L, y: 106, size: 40, fill: TEXT, track: 0 }) +
			text(gb, { x: R, y: 106, size: 13, fill: MUTED, anchor: "end", weight: 500 }) +
			rule(118) +
			text(`${b.wins}-${b.losses}`, { x: L, y: 137, size: 13, fill: MUTED, weight: 500 }) +
			(b.streak ? text(b.streak, { x: R, y: 137, size: 13, fill: streakColor(b.streak), anchor: "end" }) : "") +
			staleBar(b.stale)
	);
}

/** Won last time out reads green, lost reads muted. Nothing else needs colour here. */
function streakColor(streak: string): string {
	return streak.trim().toUpperCase().startsWith("W") ? LIVE : MUTED;
}

/**
 * Size for a name that has to share the key with a label and a context line.
 *
 * These faces carry the widest range of content in the product: "Gaethje vs Pimblett" needs two
 * lines, "L. Norris" needs one, "Kyle Larson" sits between them. Laying all three out for two
 * lines left short names small above an empty line, so the type is fitted to the name instead:
 * the largest size that still keeps it on one line, and only a name that cannot fit even at the
 * smallest size wraps.
 */
const NAME_MAX = 27;
const NAME_MIN = 20;

function nameLayout(value: string): { size: number; lines: 1 | 2 } {
	for (let size = NAME_MAX; size >= NAME_MIN; size--) {
		if (measure(value, size) <= R - L) return { size, lines: 1 };
	}
	return { size: 19, lines: 2 };
}

/**
 * An event rather than a game: a fight card, a race weekend. The title takes one line when it
 * fits and two when it does not.
 */
export function eventBadge(b: EventBadge): string {
	const accent = displayColor(b.accent);
	const title = nameLayout(b.title);
	const one = title.lines === 1;
	return svg(
		spine(accent) +
			liveDot(b.live) +
			label(b.kicker, one ? 34 : 32, lift(accent)) +
			wrapped(b.title, { y: one ? 76 : 64, size: title.size, fill: TEXT, lines: title.lines }) +
			rule(one ? 92 : 104) +
			text(b.when, {
				x: L,
				y: one ? 118 : 124,
				size: one ? 17 : 14,
				fill: b.live || b.imminent ? LIVE : TEXT,
				weight: 700,
				track: 0.5
			}) +
			(b.subtitle
				? text(fitStatus(b.subtitle, 20), { x: L, y: one ? 136 : 138, size: 11, fill: DIM, weight: 500 })
				: "") +
			staleBar(b.stale)
	);
}

/** One row of a card or a finishing order, for a key that cycles through the field. */
export function entryBadge(b: EntryBadge): string {
	const accent = displayColor(b.accent);
	const primary = nameLayout(b.primary);
	const one = primary.lines === 1;
	return svg(
		spine(accent) +
			label(b.kicker, one ? 34 : 32, lift(accent)) +
			wrapped(b.primary, { y: one ? 78 : 64, size: primary.size, fill: TEXT, lines: primary.lines }) +
			rule(one ? 94 : 104) +
			// Capped tighter than it looks: this line shares its row with the index on the right.
			text(fitStatus(b.secondary, b.index ? 12 : 16), {
				x: L,
				y: one ? 122 : 126,
				size: one ? 18 : 14,
				fill: b.settled ? LIVE : TEXT,
				weight: 700,
				track: 0.5
			}) +
			(b.index
				? text(`${b.index[0]}/${b.index[1]}`, {
						x: R,
						y: one ? 122 : 126,
						size: 11,
						fill: DIM,
						anchor: "end",
						weight: 500
					})
				: "") +
			staleBar(b.stale)
	);
}

/** Drops characters off the end until the string fits, then marks the cut. */
function ellipsize(value: string, size: number, maxPx: number): string {
	if (measure(value, size) <= maxPx) return value;
	let out = value;
	while (out.length > 1 && measure(`${out}…`, size) > maxPx) out = out.slice(0, -1);
	return `${out.trimEnd()}…`;
}

/**
 * Sets a long name over one or two lines, on the same left margin as everything else. Event names
 * do not fit on a key, and cutting them mid word reads worse than dropping the tail.
 *
 * Breaks on measured width rather than character count, because these lines are people's names.
 */
function wrapped(value: string, o: { y: number; size: number; fill: string; lines: number }): string {
	const maxPx = R - L;
	const words = value.split(/\s+/).filter(Boolean);
	const rows: string[] = [];
	let row = "";
	for (const word of words) {
		const candidate = row ? `${row} ${word}` : word;
		if (measure(candidate, o.size) <= maxPx || row === "") row = candidate;
		else {
			rows.push(row);
			row = word;
		}
		if (rows.length === o.lines) break;
	}
	if (rows.length < o.lines && row) rows.push(row);
	return rows
		.slice(0, o.lines)
		.map((line, i) =>
			text(ellipsize(line, o.size, maxPx), {
				x: L,
				y: o.y + i * (o.size + 4),
				size: o.size,
				fill: o.fill,
				track: 0.2
			})
		)
		.join("");
}

/** Fallback face: no team picked yet, offseason, or a data source that has gone quiet. */
export function messageBadge(b: MessageBadge): string {
	return svg(
		spine(NEUTRAL_SPINE) +
			text(b.title, { x: L, y: 74, size: 19, fill: TEXT, track: 0.6 }) +
			(b.detail ? text(b.detail, { x: L, y: 98, size: 13, fill: DIM, weight: 500 }) : "") +
			staleBar(b.stale)
	);
}
