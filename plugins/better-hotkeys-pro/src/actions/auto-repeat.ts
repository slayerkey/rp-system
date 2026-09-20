import {
	action,
	type DidReceiveSettingsEvent,
	type KeyDownEvent,
	SingletonAction,
	type WillAppearEvent,
	type WillDisappearEvent
} from "@elgato/streamdeck";

import { type RepeatSettings, resolvePoint } from "../mouse-settings";
import { clamp } from "../util";
import { keyEvent, mouseButtonEvent, mouseMoveTo, sendInputs } from "../input";

/**
 * Repeats a key tap or a click at a set rate while toggled on. Clickers, fishing,
 * farming, spam prevention.
 *
 * Each repeat is a complete down-then-up, so nothing is ever left held -- if the plugin
 * dies mid-run the timer dies with it and there's nothing to clean up. That's why this
 * doesn't touch the held-input journal.
 */
@action({ UUID: "com.packrat.betterhotkeyspro.autorepeat" })
export class AutoRepeat extends SingletonAction<RepeatSettings> {
	private readonly timers = new Map<string, { interval: NodeJS.Timeout; stop?: NodeJS.Timeout }>();

	override onWillAppear(ev: WillAppearEvent<RepeatSettings>): Promise<void> | void {
		// A reappearing action is never mid-run: the timers live only in this process.
		if (ev.action.isKey()) return ev.action.setState(this.timers.has(ev.action.id) ? 1 : 0);
	}

	override onWillDisappear(ev: WillDisappearEvent<RepeatSettings>): Promise<void> | void {
		this.halt(ev.action.id);
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<RepeatSettings>): Promise<void> {
		// Changing the rate or target mid-run would be surprising; stop cleanly instead.
		this.halt(ev.action.id);
		if (ev.action.isKey()) await ev.action.setState(0);
	}

	override async onKeyDown(ev: KeyDownEvent<RepeatSettings>): Promise<void> {
		const context = ev.action.id;

		if (this.timers.has(context)) {
			this.halt(context);
			if (ev.action.isKey()) await ev.action.setState(0);
			return;
		}

		const s = ev.payload.settings;
		const hz = clamp(s.hz ?? 10, 0.1, 50);
		const period = 1000 / hz;
		const fire = this.makeFire(s);

		fire(); // fire immediately, so a tap feels responsive rather than lagging one period
		const interval = setInterval(fire, period);

		let stop: NodeJS.Timeout | undefined;
		if (s.maxSeconds && s.maxSeconds > 0) {
			stop = setTimeout(() => {
				this.halt(context);
				void ev.action.setState(0);
			}, s.maxSeconds * 1000);
		}

		this.timers.set(context, { interval, stop });
		if (ev.action.isKey()) await ev.action.setState(1);
	}

	/** Builds the per-tick action once, so the hot path does no branching. */
	private makeFire(s: RepeatSettings): () => void {
		if ((s.what ?? "key") === "click") {
			const button = s.button ?? "left";
			return () => {
				try {
					const events: unknown[] = [];
					if (s.atPoint) {
						const { x, y } = resolvePoint(s);
						events.push(mouseMoveTo(x, y));
					}
					events.push(mouseButtonEvent(button, true), mouseButtonEvent(button, false));
					sendInputs(events);
				} catch {
					// A single dropped tick is not worth tearing the whole repeat down.
				}
			};
		}

		const vks = (s.keys ?? []).map((k) => k.vk).filter((vk) => Number.isInteger(vk) && vk > 0);
		return () => {
			if (vks.length === 0) return;
			try {
				sendInputs([
					...vks.map((vk) => keyEvent(vk, true)),
					...[...vks].reverse().map((vk) => keyEvent(vk, false))
				]);
			} catch {
				/* skip this tick */
			}
		};
	}

	private halt(context: string): void {
		const t = this.timers.get(context);
		if (!t) return;
		clearInterval(t.interval);
		if (t.stop) clearTimeout(t.stop);
		this.timers.delete(context);
	}
}
