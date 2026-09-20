import type { DailyPoint } from "./history";

export function nextMilestone(n: number): number {
	const thresholds = [
		100, 250, 500, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000,
		100_000, 250_000, 500_000, 1_000_000, 2_500_000, 5_000_000, 10_000_000,
	];
	return thresholds.find((t) => t > n) ?? Math.ceil(n / 1_000_000) * 1_000_000 + 1_000_000;
}

export function estimateDaysToMilestone(current: number, target: number, history: DailyPoint[]): number | null {
	if (history.length < 3) return null;
	const recent = history.slice(-7);
	if (recent.length < 2) return null;
	const first = recent[0].value;
	const last = recent[recent.length - 1].value;
	const days = recent.length - 1;
	const dailyGrowth = (last - first) / days;
	if (dailyGrowth <= 0) return null;
	return (target - current) / dailyGrowth;
}
