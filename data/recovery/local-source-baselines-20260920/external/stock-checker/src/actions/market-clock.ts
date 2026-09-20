import {
	SingletonAction,
	action,
	type DidReceiveSettingsEvent,
	type WillAppearEvent,
	type WillDisappearEvent,
} from "@elgato/streamdeck";

import { ACTIONS } from "../config";
import { EXCHANGES, formatCountdown, getMarketState } from "../market/calendar";
import { buildClockImage } from "../render/renderer";
import { THEMES } from "../render/themes";
import type { ClockSettings } from "../settings";
import { toNumber } from "../render/format";

const AFTER_HOURS_BLUE = "#4F93FF";

interface Renderable {
	id: string;
	setImage(image: string): Promise<void>;
}

/** Market session + live countdown for a chosen exchange, with an optional candle band. */
@action({ UUID: ACTIONS.clock })
export class MarketClockAction extends SingletonAction<ClockSettings> {
	private readonly timers = new Map<string, ReturnType<typeof setInterval>>();

	override onWillAppear(ev: WillAppearEvent<ClockSettings>): void {
		this.startTimer(ev.action, ev.payload.settings);
	}

	override onWillDisappear(ev: WillDisappearEvent<ClockSettings>): void {
		this.clearTimer(ev.action.id);
	}

	override onDidReceiveSettings(ev: DidReceiveSettingsEvent<ClockSettings>): void {
		this.clearTimer(ev.action.id);
		this.startTimer(ev.action, ev.payload.settings);
	}

	private startTimer(action: Renderable, settings: ClockSettings): void {
		const render = () => void this.render(action, settings);
		render();
		this.timers.set(action.id, setInterval(render, 1000));
	}

	private clearTimer(id: string): void {
		const timer = this.timers.get(id);
		if (timer) {
			clearInterval(timer);
		}
		this.timers.delete(id);
	}

	private async render(action: Renderable, settings: ClockSettings): Promise<void> {
		const theme = THEMES[settings.theme ?? "dark"] ?? THEMES.dark;
		const exchangeId = settings.exchange ?? "US";
		const state = getMarketState(exchangeId);
		const color =
			state.session === "regular"
				? theme.up
				: state.session === "pre"
					? theme.extended
					: state.session === "after"
						? AFTER_HOURS_BLUE
						: theme.muted;

		// Candle band only makes sense while continuously trading (not pre/after/lunch/closed).
		const candleMinutes = toNumber(settings.candleMinutes) ?? 0;
		const band =
			candleMinutes > 0 && state.session === "regular"
				? (state.secondOfDay % (candleMinutes * 60)) / (candleMinutes * 60)
				: undefined;

		await action.setImage(
			buildClockImage({
				exchangeLabel: (EXCHANGES[exchangeId] ?? EXCHANGES.US).label,
				sessionLabel: state.label,
				countdown: formatCountdown(state.secondsToNext),
				sub: state.nextLabel,
				color,
				band,
				theme,
			}),
		);
	}
}
