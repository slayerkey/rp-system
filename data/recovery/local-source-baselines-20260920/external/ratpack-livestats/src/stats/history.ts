// 30-day rolling daily history per metric per credential key.
// Persisted to Stream Deck global settings as a JSON blob.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { MetricKey, PlatformId } from "../platforms/types";

export interface DailyPoint {
	date: string; // "YYYY-MM-DD"
	value: number;
}

export type MetricHistory = DailyPoint[];

export interface ChannelHistory {
	[metric: string]: MetricHistory;
}

const HISTORY_DIR = join(homedir(), ".ratpack", "livestats");
const MAX_DAYS = 30;

function historyPath(channelKey: string): string {
	return join(HISTORY_DIR, `${channelKey.replace(/[^a-z0-9_-]/gi, "_")}.json`);
}

export function loadHistory(channelKey: string): ChannelHistory {
	try {
		const raw = readFileSync(historyPath(channelKey), "utf8");
		return JSON.parse(raw) as ChannelHistory;
	} catch {
		return {};
	}
}

export function recordHistory(
	channelKey: string,
	history: ChannelHistory,
	platform: PlatformId,
	metric: MetricKey,
	value: number,
): void {
	const key = `${platform}:${metric}`;
	if (!history[key]) history[key] = [];

	const today = todayKey();
	const arr = history[key];
	const last = arr[arr.length - 1];

	if (last?.date === today) {
		last.value = value; // update today's value
	} else {
		arr.push({ date: today, value });
		// Trim to 30 days
		if (arr.length > MAX_DAYS) arr.splice(0, arr.length - MAX_DAYS);
	}

	try {
		mkdirSync(HISTORY_DIR, { recursive: true });
		writeFileSync(historyPath(channelKey), JSON.stringify(history));
	} catch {
		// Non-fatal — history is best-effort
	}
}

export function getMetricHistory(history: ChannelHistory, platform: PlatformId, metric: MetricKey): DailyPoint[] {
	return history[`${platform}:${metric}`] ?? [];
}

/** Return the last N daily values as a number array (for sparkline). */
export function recentValues(history: ChannelHistory, platform: PlatformId, metric: MetricKey, days = 14): number[] {
	const arr = getMetricHistory(history, platform, metric);
	return arr.slice(-days).map((p) => p.value);
}

export function todayKey(): string {
	return new Date().toISOString().slice(0, 10);
}

/** Delta: today's value minus value N days ago, or undefined if not enough data. */
export function computeDelta(history: ChannelHistory, platform: PlatformId, metric: MetricKey, daysBack = 1): number | undefined {
	const arr = getMetricHistory(history, platform, metric);
	if (arr.length < 2) return undefined;
	const current = arr[arr.length - 1].value;
	const past = arr[Math.max(0, arr.length - 1 - daysBack)].value;
	return current - past;
}
