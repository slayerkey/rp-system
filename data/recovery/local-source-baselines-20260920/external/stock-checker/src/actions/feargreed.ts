import {
	SingletonAction,
	action,
	type DialAction,
	type DidReceiveSettingsEvent,
	type KeyAction,
	type WillAppearEvent,
	type WillDisappearEvent,
} from "@elgato/streamdeck";

import { ACTIONS } from "../config";
import { getFearGreed } from "../data/feargreed";
import { buildGaugeImage } from "../render/renderer";
import { THEMES } from "../render/themes";
import type { FearGreedSettings } from "../settings";

const POLL_MS = 60_000;

type AnyAction = KeyAction<FearGreedSettings> | DialAction<FearGreedSettings>;

/** Crypto Fear & Greed Index as a speedometer gauge. Keyless, market-wide, updates ~daily. */
@action({ UUID: ACTIONS.feargreed })
export class FearGreedAction extends SingletonAction<FearGreedSettings> {
	private readonly timers = new Map<string, ReturnType<typeof setInterval>>();
	private readonly settings = new Map<string, FearGreedSettings>();

	override onWillAppear(ev: WillAppearEvent<FearGreedSettings>): void {
		this.settings.set(ev.action.id, ev.payload.settings);
		this.start(ev.action);
	}

	override onWillDisappear(ev: WillDisappearEvent<FearGreedSettings>): void {
		const timer = this.timers.get(ev.action.id);
		if (timer) {
			clearInterval(timer);
		}
		this.timers.delete(ev.action.id);
		this.settings.delete(ev.action.id);
	}

	override onDidReceiveSettings(ev: DidReceiveSettingsEvent<FearGreedSettings>): void {
		this.settings.set(ev.action.id, ev.payload.settings);
		void this.render(ev.action);
	}

	private start(action: AnyAction): void {
		void this.render(action);
		const timer = setInterval(() => void this.render(action), POLL_MS);
		this.timers.set(action.id, timer);
	}

	private async render(action: AnyAction): Promise<void> {
		const settings = this.settings.get(action.id) ?? {};
		const theme = THEMES[settings.theme ?? "dark"] ?? THEMES.dark;
		const fg = await getFearGreed();

		if (!fg) {
			if (action.isDial()) {
				void action.setFeedback({ title: "Fear & Greed", value: "Loading…" });
			} else {
				void action.setImage(buildGaugeImage({ value: 50, label: "Loading…", theme, stale: true }));
			}
			return;
		}

		if (action.isDial()) {
			void action.setFeedback({ title: fg.label, value: `${fg.value}`, indicator: fg.value });
		} else {
			void action.setImage(buildGaugeImage({ value: fg.value, label: fg.label, theme }));
		}
	}
}
