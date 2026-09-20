import {
	action,
	SingletonAction,
	type KeyAction,
	type KeyDownEvent,
	type WillAppearEvent,
	type WillDisappearEvent
} from "@elgato/streamdeck";
import { keyImage, Pulse, type Imageable } from "../lib/svg";
import { THEME } from "../lib/theme";

type Settings = {
	/** Minutes after death when Roshan *can* respawn (window opens). */
	minWindow?: number;
	/** Minutes after death when Roshan is *guaranteed* back (hard respawn). */
	maxWindow?: number;
};

/**
 * Roshan Timer — Dota's player-side GSI does not expose Roshan's death time, so this is a
 * manual stopwatch: press when you kill Roshan and it counts up. It glows red once the
 * respawn window opens (default 8 min) and pulses bright red at the hard respawn (11 min).
 * Press again to reset.
 */
@action({ UUID: "com.ratpack.dota2reactivedeck.roshan" })
export class RoshanTimer extends SingletonAction<Settings> {
	/** Death timestamp (ms) per instance; absent = idle. */
	private readonly startedAt = new Map<string, number>();
	private readonly ticks = new Map<string, ReturnType<typeof setInterval>>();
	private readonly pulses = new Map<string, Pulse>();
	private readonly settings = new Map<string, Settings>();

	override onWillAppear(ev: WillAppearEvent<Settings>): void {
		this.settings.set(ev.action.id, ev.payload.settings);
		if (ev.action.isKey()) this.render(ev.action);
	}

	override onWillDisappear(ev: WillDisappearEvent<Settings>): void {
		this.cleanup(ev.action.id);
	}

	override onKeyDown(ev: KeyDownEvent<Settings>): void {
		if (!ev.action.isKey()) return;
		const id = ev.action.id;
		this.settings.set(id, ev.payload.settings);
		if (this.startedAt.has(id)) {
			// Running -> reset to idle.
			this.cleanupTimers(id);
			this.startedAt.delete(id);
			this.render(ev.action);
		} else {
			// Idle -> start counting.
			this.startedAt.set(id, Date.now());
			this.ticks.set(id, setInterval(() => this.render(ev.action), 1000));
			this.render(ev.action);
		}
	}

	private render(act: KeyAction<Settings>): void {
		const id = act.id;
		const start = this.startedAt.get(id);
		const s = this.settings.get(id) ?? {};
		const minW = (s.minWindow ?? 8) * 60;
		const maxW = (s.maxWindow ?? 11) * 60;

		if (start === undefined) {
			this.stopPulse(id);
			act.setImage(idle());
			return;
		}

		const elapsed = Math.floor((Date.now() - start) / 1000);

		if (elapsed >= maxW) {
			// Hard respawn — pulse bright red.
			this.runPulse(act, [frame(elapsed, THEME.crimsonBright, "RESPAWNED", 0.34), frame(elapsed, THEME.redDark, "RESPAWNED", 0.1)]);
			return;
		}
		this.stopPulse(id);
		if (elapsed >= minW) {
			act.setImage(frame(elapsed, THEME.red, "WINDOW OPEN", 0.22));
		} else {
			act.setImage(frame(elapsed, THEME.crimson, `${fmt(minW - elapsed)} TO WINDOW`, 0.16));
		}
	}

	private runPulse(act: KeyAction<Settings>, frames: string[]): void {
		this.stopPulse(act.id);
		const pulse = new Pulse(() => this.visible(act.id), frames, 420);
		this.pulses.set(act.id, pulse);
		pulse.start();
	}

	private stopPulse(id: string): void {
		this.pulses.get(id)?.stop();
		this.pulses.delete(id);
	}

	private *visible(id: string): Generator<Imageable> {
		for (const a of this.actions) if (a.id === id && a.isKey()) yield a;
	}

	private cleanupTimers(id: string): void {
		clearInterval(this.ticks.get(id));
		this.ticks.delete(id);
		this.stopPulse(id);
	}

	private cleanup(id: string): void {
		this.cleanupTimers(id);
		this.startedAt.delete(id);
		this.settings.delete(id);
	}
}

function fmt(totalSeconds: number): string {
	const s = Math.max(0, totalSeconds);
	const m = Math.floor(s / 60);
	const ss = s % 60;
	return `${m}:${String(ss).padStart(2, "0")}`;
}

function frame(elapsed: number, color: string, sub: string, fill: number): string {
	return keyImage({
		bg: THEME.bg,
		bg2: "#000000",
		glow: color,
		raw: `<rect x="14" y="16" width="116" height="56" rx="12" fill="${color}" opacity="${fill}"/>`,
		lines: [
			{ text: fmt(elapsed), y: 66, size: 48, color: "#ffffff", weight: 800 },
			{ text: sub, y: 110, size: 15, color, weight: 700, spacing: 1 },
			{ text: "ROSHAN", y: 132, size: 13, color: THEME.textDim, weight: 700, spacing: 2 }
		]
	});
}

function idle(): string {
	return keyImage({
		bg: THEME.bg,
		bg2: "#000000",
		border: "#2a1818",
		lines: [
			{ text: "ROSH", y: 60, size: 30, color: THEME.crimson, weight: 800, spacing: 1 },
			{ text: "PRESS ON", y: 96, size: 15, color: THEME.textDim, weight: 700, spacing: 1 },
			{ text: "KILL", y: 116, size: 15, color: THEME.textDim, weight: 700, spacing: 1 }
		]
	});
}
