import {
	SingletonAction,
	action,
	type DidReceiveSettingsEvent,
	type WillAppearEvent,
	type WillDisappearEvent,
} from "@elgato/streamdeck";

import { ACTIONS, DEFAULTS } from "../config";
import { getNextEarnings } from "../data/earnings";
import { getFinnhubKey } from "../data/pollers";
import { buildEarningsImage, buildInfoImage } from "../render/renderer";
import { THEMES } from "../render/themes";
import type { EarningsSettings } from "../settings";

const POLL_MS = 5 * 60 * 1000;
const URGENT_DAYS = 3;

interface Renderable {
	id: string;
	setImage(image: string): Promise<void>;
}

const HOUR_LABEL: Record<string, string> = {
	bmo: "Before open",
	amc: "After close",
	dmh: "During hours",
};

/** Countdown to a company's next scheduled earnings report (Finnhub, opt-in key). */
@action({ UUID: ACTIONS.earnings })
export class EarningsAction extends SingletonAction<EarningsSettings> {
	private readonly timers = new Map<string, ReturnType<typeof setInterval>>();
	private readonly settings = new Map<string, EarningsSettings>();

	override onWillAppear(ev: WillAppearEvent<EarningsSettings>): void {
		this.settings.set(ev.action.id, ev.payload.settings);
		this.start(ev.action);
	}

	override onWillDisappear(ev: WillDisappearEvent<EarningsSettings>): void {
		const timer = this.timers.get(ev.action.id);
		if (timer) {
			clearInterval(timer);
		}
		this.timers.delete(ev.action.id);
		this.settings.delete(ev.action.id);
	}

	override onDidReceiveSettings(ev: DidReceiveSettingsEvent<EarningsSettings>): void {
		this.settings.set(ev.action.id, ev.payload.settings);
		void this.render(ev.action);
	}

	private start(action: Renderable): void {
		void this.render(action);
		const timer = setInterval(() => void this.render(action), POLL_MS);
		this.timers.set(action.id, timer);
	}

	private resolveSymbol(s: EarningsSettings): string {
		return (s.symbol?.trim() || s.preset?.trim() || DEFAULTS.earningsSymbol).toUpperCase();
	}

	private async render(action: Renderable): Promise<void> {
		const settings = this.settings.get(action.id) ?? {};
		const theme = THEMES[settings.theme ?? "dark"] ?? THEMES.dark;
		const symbol = this.resolveSymbol(settings);
		const key = getFinnhubKey();

		if (!key) {
			void action.setImage(buildInfoImage(symbol, "Add free API key", theme));
			return;
		}

		const next = await getNextEarnings(symbol, key);
		if (next === undefined) {
			void action.setImage(buildInfoImage(symbol, "Loading…", theme));
			return;
		}
		if (next === null) {
			void action.setImage(buildInfoImage(symbol, "No earnings scheduled", theme));
			return;
		}

		const days = daysUntil(next.date);
		const today = days <= 0;
		const urgent = !today && days <= URGENT_DAYS;
		const countdownText = today ? "TODAY" : days === 1 ? "1 DAY" : `${days} DAYS`;
		const dateText = formatDate(next.date);
		const sub = next.hour ? (HOUR_LABEL[next.hour] ?? "Next earnings") : "Next earnings";

		void action.setImage(
			buildEarningsImage({ ticker: symbol, dateText, countdownText, sub, theme, urgent, today }),
		);
	}
}

function daysUntil(isoDate: string): number {
	const target = new Date(`${isoDate}T00:00:00`);
	const now = new Date();
	const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	return Math.round((target.getTime() - startOfToday.getTime()) / 86_400_000);
}

function formatDate(isoDate: string): string {
	const d = new Date(`${isoDate}T00:00:00`);
	return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
