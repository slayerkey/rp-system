import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { MetricKey } from "../platforms/types";

export interface DailyPoint { date: string; value: number; }
export type MetricHistory = DailyPoint[];
export interface ChannelHistory { [metric: string]: MetricHistory; }

const HISTORY_DIR = join(homedir(), ".ratpack", "kick");
const MAX_DAYS = 30;

function historyPath(channelKey: string): string {
	return join(HISTORY_DIR, `${channelKey.replace(/[^a-z0-9_-]/gi, "_")}.json`);
}

export function loadHistory(channelKey: string): ChannelHistory {
	try { return JSON.parse(readFileSync(historyPath(channelKey), "utf8")) as ChannelHistory; }
	catch { return {}; }
}

export function recordHistory(channelKey: string, history: ChannelHistory, metric: MetricKey, value: number): void {
	if (!history[metric]) history[metric] = [];
	const today = todayKey();
	const arr = history[metric];
	const last = arr[arr.length - 1];
	if (last?.date === today) {
		last.value = value;
	} else {
		arr.push({ date: today, value });
		if (arr.length > MAX_DAYS) arr.splice(0, arr.length - MAX_DAYS);
	}
	try {
		mkdirSync(HISTORY_DIR, { recursive: true });
		writeFileSync(historyPath(channelKey), JSON.stringify(history));
	} catch { /**/ }
}

export function getMetricHistory(history: ChannelHistory, metric: MetricKey): DailyPoint[] {
	return history[metric] ?? [];
}

export function recentValues(history: ChannelHistory, metric: MetricKey, days = 14): number[] {
	return (history[metric] ?? []).slice(-days).map((p) => p.value);
}

export function todayKey(): string {
	return new Date().toISOString().slice(0, 10);
}

export function computeDelta(history: ChannelHistory, metric: MetricKey, daysBack = 1): number | undefined {
	const arr = history[metric] ?? [];
	if (arr.length < 2) return undefined;
	const current = arr[arr.length - 1].value;
	const past = arr[Math.max(0, arr.length - 1 - daysBack)].value;
	return current - past;
}
