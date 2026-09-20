import { todayKey } from "./history";

export interface StreakResult {
	days: number;
	lastUploadDate: string | null; // "YYYY-MM-DD"
	lastUploadAgo: string;
}

/**
 * Given a list of upload dates (ISO strings), compute the current consecutive
 * upload streak (ending today or yesterday is still active).
 */
export function computeStreak(uploadDates: string[]): StreakResult {
	if (uploadDates.length === 0) {
		return { days: 0, lastUploadDate: null, lastUploadAgo: "never" };
	}

	// Dedupe and sort descending
	const unique = [...new Set(uploadDates.map((d) => d.slice(0, 10)))].sort().reverse();
	const lastDate = unique[0];
	const lastUploadAgo = formatAgo(lastDate);

	const today = todayKey();
	const yesterday = offsetDay(today, -1);

	// Streak must start from today or yesterday
	if (unique[0] !== today && unique[0] !== yesterday) {
		return { days: 0, lastUploadDate: lastDate, lastUploadAgo };
	}

	let streak = 1;
	for (let i = 1; i < unique.length; i++) {
		const expected = offsetDay(unique[i - 1], -1);
		if (unique[i] === expected) {
			streak++;
		} else {
			break;
		}
	}

	return { days: streak, lastUploadDate: lastDate, lastUploadAgo };
}

function offsetDay(dateStr: string, delta: number): string {
	const d = new Date(`${dateStr}T12:00:00Z`);
	d.setUTCDate(d.getUTCDate() + delta);
	return d.toISOString().slice(0, 10);
}

function formatAgo(dateStr: string): string {
	const diffMs = Date.now() - new Date(`${dateStr}T12:00:00Z`).getTime();
	const diffDays = Math.floor(diffMs / 86_400_000);
	if (diffDays === 0) return "today";
	if (diffDays === 1) return "yesterday";
	return `${diffDays}d ago`;
}
