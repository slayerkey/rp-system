/** Holiday + birthday presets and forgiving date parsing so users just type a date. */

export type PresetId =
	| "custom"
	| "christmas"
	| "newyear"
	| "nye"
	| "valentines"
	| "halloween"
	| "july4"
	| "thanksgiving"
	| "mothersday"
	| "fathersday"
	| "birthday";

export const PRESET_NAMES: Record<PresetId, string> = {
	custom: "Event",
	christmas: "Christmas",
	newyear: "New Year",
	nye: "New Year's Eve",
	valentines: "Valentine's Day",
	halloween: "Halloween",
	july4: "July 4th",
	thanksgiving: "Thanksgiving",
	mothersday: "Mother's Day",
	fathersday: "Father's Day",
	birthday: "Birthday"
};

/** True for occasions that recur every year (so the gauge spans one year). */
export function isAnnual(preset: PresetId): boolean {
	return preset !== "custom";
}

/** Next occurrence (local midnight) of a fixed month/day. month is 1-12. */
function nextFixed(month: number, day: number, now = new Date()): number {
	const y = now.getFullYear();
	let d = new Date(y, month - 1, day, 0, 0, 0, 0);
	if (d.getTime() <= now.getTime()) d = new Date(y + 1, month - 1, day, 0, 0, 0, 0);
	return d.getTime();
}

/** Next occurrence of the nth given weekday in a month. monthIndex 0-11, weekday 0=Sun, n=1.. */
function nextNthWeekday(monthIndex: number, weekday: number, n: number, now = new Date()): number {
	const compute = (year: number): number => {
		const first = new Date(year, monthIndex, 1, 0, 0, 0, 0);
		const offset = (7 + weekday - first.getDay()) % 7;
		return new Date(year, monthIndex, 1 + offset + (n - 1) * 7, 0, 0, 0, 0).getTime();
	};
	let t = compute(now.getFullYear());
	if (t <= now.getTime()) t = compute(now.getFullYear() + 1);
	return t;
}

/** Parse "MM/DD/YYYY" (US) or "YYYY-MM-DD" into a Date (no time). */
function parseDate(s: string): Date | null {
	let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
	if (m) {
		let yr = parseInt(m[3], 10);
		if (yr < 100) yr += 2000;
		return new Date(yr, parseInt(m[1], 10) - 1, parseInt(m[2], 10));
	}
	m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
	if (m) return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
	return null;
}

/** Parse "3:00 PM", "9 pm", or 24-hour "15:00" into hours/minutes. Empty => midnight. */
function parseTime(s: string | undefined): { h: number; m: number } {
	if (!s) return { h: 0, m: 0 };
	const t = s.trim();
	let m = t.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
	if (m) {
		let h = parseInt(m[1], 10);
		const mn = parseInt(m[2], 10);
		if (m[3]) {
			h = h % 12;
			if (/pm/i.test(m[3])) h += 12;
		}
		return { h, m: mn };
	}
	m = t.match(/^(\d{1,2})\s*(am|pm)$/i);
	if (m) {
		let h = parseInt(m[1], 10) % 12;
		if (/pm/i.test(m[2])) h += 12;
		return { h, m: 0 };
	}
	return { h: 0, m: 0 };
}

/** Birthday "MM/DD" -> next occurrence at local midnight. */
function birthdayTarget(s: string | undefined, now = new Date()): number {
	if (!s) return NaN;
	const m = s.trim().match(/^(\d{1,2})[/-](\d{1,2})$/);
	if (!m) return NaN;
	return nextFixed(parseInt(m[1], 10), parseInt(m[2], 10), now);
}

/** Resolve a preset (+ typed custom date/time or birthday) to a target epoch-ms, or NaN if unset. */
export function resolveTarget(
	preset: PresetId,
	opts: { dateStr?: string; timeStr?: string; birthday?: string } = {},
	now = new Date()
): number {
	switch (preset) {
		case "christmas":
			return nextFixed(12, 25, now);
		case "newyear":
			return nextFixed(1, 1, now);
		case "nye":
			return nextFixed(12, 31, now);
		case "valentines":
			return nextFixed(2, 14, now);
		case "halloween":
			return nextFixed(10, 31, now);
		case "july4":
			return nextFixed(7, 4, now);
		case "thanksgiving":
			return nextNthWeekday(10, 4, 4, now);
		case "mothersday":
			return nextNthWeekday(4, 0, 2, now);
		case "fathersday":
			return nextNthWeekday(5, 0, 3, now);
		case "birthday":
			return birthdayTarget(opts.birthday, now);
		case "custom":
		default: {
			if (!opts.dateStr) return NaN;
			const d = parseDate(opts.dateStr.trim());
			if (!d) return NaN;
			const t = parseTime(opts.timeStr);
			d.setHours(t.h, t.m, 0, 0);
			return d.getTime();
		}
	}
}
