import type { DailyPoint } from "./history";
import { nextMilestone } from "../render/svg";

export { nextMilestone };

/**
 * Linear regression on the last 7 daily points to estimate daily growth.
 * Returns days until `target` is reached, or null if < 3 points available.
 */
export function estimateDaysToMilestone(current: number, target: number, history: DailyPoint[]): number | null {
	if (target <= current) return 0;
	const recent = history.slice(-7);
	if (recent.length < 3) return null;

	// Simple: average daily change over the available window
	const oldest = recent[0].value;
	const newest = recent[recent.length - 1].value;
	const days = recent.length - 1;
	const dailyGrowth = (newest - oldest) / days;

	if (dailyGrowth <= 0) return null; // Not growing — can't estimate
	return (target - current) / dailyGrowth;
}

/** Given a current value, return a human-readable milestone context. */
export function milestoneContext(current: number, target: number): string {
	const pct = Math.round((current / target) * 100);
	const away = target - current;
	if (away <= 0) return "reached!";
	if (pct >= 99) return "so close!";
	if (pct >= 90) return "almost there";
	if (pct >= 75) return "75% there";
	if (pct >= 50) return "halfway";
	return `${pct}% there`;
}
