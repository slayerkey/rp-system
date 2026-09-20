export type Session = "pre" | "regular" | "lunch" | "after" | "closed";

export type MarketState = {
	session: Session;
	label: string;
	nextLabel: string;
	secondsToNext: number;
	/** Seconds since local midnight in the exchange timezone (for candle timing). */
	secondOfDay: number;
};

type Segment = { type: Exclude<Session, "closed">; start: number; end: number };

export type Exchange = {
	id: string;
	label: string;
	tz: string;
	/** Ordered, non-overlapping trading segments in minutes after local midnight. */
	segments: Segment[];
	holidays?: Set<string>;
};

// Full-day holidays, hand-maintained for 2026 — verify against each exchange's official
// calendar annually. Half-days / early closes are not modelled. Exchanges with lunar or
// otherwise variable holidays (Euronext, TSE, HKEX, SGX) are best-effort: fixed-date and
// well-published holidays are included; some minor or variable-date closures may be missing.
const US_HOLIDAYS = new Set([
	"2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25",
	"2026-06-19", "2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25",
]);
const LSE_HOLIDAYS = new Set([
	"2026-01-01", "2026-04-03", "2026-04-06", "2026-05-04", "2026-05-25",
	"2026-08-31", "2026-12-25", "2026-12-28",
]);
const XETRA_HOLIDAYS = new Set([
	"2026-01-01", "2026-04-03", "2026-04-06", "2026-05-01",
	"2026-12-24", "2026-12-25", "2026-12-31",
]);
const EURONEXT_HOLIDAYS = new Set([
	"2026-01-01", "2026-04-03", "2026-04-06", "2026-05-01", "2026-12-25",
]);
const TSE_HOLIDAYS = new Set([
	"2026-01-01", "2026-01-02", "2026-01-03", "2026-01-12", "2026-02-11", "2026-02-23",
	"2026-03-20", "2026-04-29", "2026-05-04", "2026-05-05", "2026-05-06", "2026-07-20",
	"2026-08-11", "2026-09-21", "2026-09-22", "2026-09-23", "2026-10-12", "2026-11-03",
	"2026-11-23", "2026-12-31",
]);
const HKEX_HOLIDAYS = new Set([
	"2026-01-01", "2026-02-17", "2026-02-18", "2026-02-19", "2026-04-03", "2026-04-04",
	"2026-04-06", "2026-05-01", "2026-06-19", "2026-07-01", "2026-10-01", "2026-10-19",
	"2026-12-25", "2026-12-26",
]);
const SGX_HOLIDAYS = new Set([
	"2026-01-01", "2026-02-17", "2026-02-18", "2026-04-03", "2026-05-01",
	"2026-06-01", "2026-08-10", "2026-12-25",
]);
const ASX_HOLIDAYS = new Set([
	"2026-01-01", "2026-01-26", "2026-04-03", "2026-04-06", "2026-04-25",
	"2026-06-08", "2026-12-25", "2026-12-28",
]);
const TSX_HOLIDAYS = new Set([
	"2026-01-01", "2026-02-16", "2026-04-03", "2026-05-18", "2026-07-01",
	"2026-08-03", "2026-09-07", "2026-09-30", "2026-10-12", "2026-12-25", "2026-12-26",
]);

export const EXCHANGES: Record<string, Exchange> = {
	US: {
		id: "US", label: "US", tz: "America/New_York",
		segments: [
			{ type: "pre", start: 240, end: 570 },
			{ type: "regular", start: 570, end: 960 },
			{ type: "after", start: 960, end: 1200 },
		],
		holidays: US_HOLIDAYS,
	},
	LSE: { id: "LSE", label: "London", tz: "Europe/London", segments: [{ type: "regular", start: 480, end: 990 }], holidays: LSE_HOLIDAYS },
	XETRA: { id: "XETRA", label: "Frankfurt", tz: "Europe/Berlin", segments: [{ type: "regular", start: 540, end: 1050 }], holidays: XETRA_HOLIDAYS },
	EURONEXT: { id: "EURONEXT", label: "Paris", tz: "Europe/Paris", segments: [{ type: "regular", start: 540, end: 1050 }], holidays: EURONEXT_HOLIDAYS },
	TSE: {
		id: "TSE", label: "Tokyo", tz: "Asia/Tokyo",
		segments: [
			{ type: "regular", start: 540, end: 690 },
			{ type: "lunch", start: 690, end: 750 },
			{ type: "regular", start: 750, end: 930 },
		],
		holidays: TSE_HOLIDAYS,
	},
	HKEX: {
		id: "HKEX", label: "Hong Kong", tz: "Asia/Hong_Kong",
		segments: [
			{ type: "regular", start: 570, end: 720 },
			{ type: "lunch", start: 720, end: 780 },
			{ type: "regular", start: 780, end: 960 },
		],
		holidays: HKEX_HOLIDAYS,
	},
	SGX: {
		id: "SGX", label: "Singapore", tz: "Asia/Singapore",
		segments: [
			{ type: "regular", start: 540, end: 720 },
			{ type: "lunch", start: 720, end: 780 },
			{ type: "regular", start: 780, end: 1020 },
		],
		holidays: SGX_HOLIDAYS,
	},
	ASX: { id: "ASX", label: "Sydney", tz: "Australia/Sydney", segments: [{ type: "regular", start: 600, end: 960 }], holidays: ASX_HOLIDAYS },
	TSX: { id: "TSX", label: "Toronto", tz: "America/Toronto", segments: [{ type: "regular", start: 570, end: 960 }], holidays: TSX_HOLIDAYS },
};

type LocalParts = { weekday: string; date: string; hour: number; minute: number; second: number };

function localParts(d: Date, tz: string): LocalParts {
	const fmt = new Intl.DateTimeFormat("en-US", {
		timeZone: tz,
		hour12: false,
		weekday: "short",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});
	const p: Record<string, string> = {};
	for (const part of fmt.formatToParts(d)) {
		p[part.type] = part.value;
	}
	let hour = parseInt(p.hour, 10);
	if (hour === 24) {
		hour = 0;
	}
	return {
		weekday: p.weekday,
		date: `${p.year}-${p.month}-${p.day}`,
		hour,
		minute: parseInt(p.minute, 10),
		second: parseInt(p.second, 10),
	};
}

function isTradingDay(ex: Exchange, weekday: string, date: string): boolean {
	return weekday !== "Sat" && weekday !== "Sun" && !ex.holidays?.has(date);
}

const SESSION_LABEL: Record<Session, string> = {
	pre: "PRE-MKT",
	regular: "OPEN",
	lunch: "LUNCH",
	after: "AFTER-HRS",
	closed: "CLOSED",
};

function nextLabelFor(ex: Exchange, seg: Segment): string {
	if (seg.type === "pre") {
		return "Opens in";
	}
	if (seg.type === "lunch") {
		return "Resumes in";
	}
	if (seg.type === "after") {
		return "Closes in";
	}
	// regular: if a lunch segment immediately follows, this is a break, not the close.
	const idx = ex.segments.indexOf(seg);
	const next = ex.segments[idx + 1];
	return next && next.type === "lunch" && next.start === seg.end ? "Break in" : "Closes in";
}

export function getMarketState(exchangeId = "US", now: Date = new Date()): MarketState {
	const ex = EXCHANGES[exchangeId] ?? EXCHANGES.US;
	const p = localParts(now, ex.tz);
	const minutes = p.hour * 60 + p.minute;
	const secondOfDay = p.hour * 3600 + p.minute * 60 + p.second;
	const trading = isTradingDay(ex, p.weekday, p.date);

	if (trading) {
		const seg = ex.segments.find((s) => minutes >= s.start && minutes < s.end);
		if (seg) {
			return {
				session: seg.type,
				label: SESSION_LABEL[seg.type],
				nextLabel: nextLabelFor(ex, seg),
				secondsToNext: Math.max(0, seg.end * 60 - secondOfDay),
				secondOfDay,
			};
		}
		const nextToday = ex.segments.find((s) => s.start > minutes);
		if (nextToday) {
			return {
				session: "closed",
				label: SESSION_LABEL.closed,
				nextLabel: "Opens in",
				secondsToNext: Math.max(0, nextToday.start * 60 - secondOfDay),
				secondOfDay,
			};
		}
	}

	return {
		session: "closed",
		label: SESSION_LABEL.closed,
		nextLabel: "Opens in",
		secondsToNext: secondsUntilNextOpen(ex, now, secondOfDay),
		secondOfDay,
	};
}

function secondsUntilNextOpen(ex: Exchange, now: Date, secondOfDay: number): number {
	let day = 0;
	for (; day <= 10; day++) {
		const probe = localParts(new Date(now.getTime() + day * 86_400_000), ex.tz);
		if (isTradingDay(ex, probe.weekday, probe.date)) {
			break;
		}
	}
	const firstOpen = ex.segments[0].start;
	const secondsToMidnight = 86_400 - secondOfDay;
	return day === 0 ? Math.max(0, firstOpen * 60 - secondOfDay) : secondsToMidnight + (day - 1) * 86_400 + firstOpen * 60;
}

export function formatCountdown(total: number): string {
	if (total >= 86_400) {
		const days = Math.floor(total / 86_400);
		const hours = Math.floor((total % 86_400) / 3600);
		return `${days}d ${hours}h`;
	}
	const hours = Math.floor(total / 3600);
	const minutes = Math.floor((total % 3600) / 60);
	const seconds = total % 60;
	if (hours > 0) {
		return `${hours}:${pad(minutes)}:${pad(seconds)}`;
	}
	return `${minutes}:${pad(seconds)}`;
}

function pad(n: number): string {
	return String(n).padStart(2, "0");
}
