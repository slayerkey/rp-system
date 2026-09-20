import { action, type KeyAction } from "@elgato/streamdeck";
import { ReactiveAction } from "../lib/reactive-action";
import { keyImage, Pulse, type Imageable } from "../lib/svg";
import { THEME } from "../lib/theme";
import { health, armor } from "../lib/cs2";
import type { GsiPayload } from "../lib/gsi-server";

type Settings = {
	good?: string; // colour when HP > highCut
	mid?: string; // colour between cuts
	bad?: string; // colour when HP < lowCut
	highCut?: number;
	lowCut?: number;
	criticalCut?: number; // flashes below this
};

/**
 * Health Monitor — shows current HP. Background green > 80, yellow 50-80, red < 50,
 * and flashes red below 20. Colours/thresholds configurable in the property inspector.
 */
@action({ UUID: "com.ratpack.cs2reactivedeck.health" })
export class HealthMonitor extends ReactiveAction<Settings> {
	private readonly pulses = new Map<string, Pulse>();

	protected draw(act: KeyAction<Settings>, s: Settings, p: GsiPayload | null): void {
		const good = s.good || THEME.green;
		const mid = s.mid || THEME.yellow;
		const bad = s.bad || THEME.red;
		const highCut = s.highCut ?? 80;
		const lowCut = s.lowCut ?? 50;
		const critCut = s.criticalCut ?? 20;

		const hp = health(p);

		if (hp === null) {
			this.stopPulse(act.id);
			act.setImage(idle());
			return;
		}
		const arm = armor(p) ?? 0;

		// Critical: alternate bright/dim red.
		if (hp > 0 && hp < critCut) {
			this.runPulse(act, [face(hp, bad, false, arm), face(hp, THEME.redDark, false, arm)]);
			return;
		}
		this.stopPulse(act.id);

		const color = hp <= 0 ? THEME.grey : hp > highCut ? good : hp >= lowCut ? mid : bad;
		act.setImage(face(hp, color, hp <= 0, arm));
	}

	private runPulse(act: KeyAction<Settings>, frames: string[]): void {
		// Rebuild each time HP changes so the number stays current.
		this.stopPulse(act.id);
		const pulse = new Pulse(() => this.visible(act.id), frames, 380);
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

	protected override onGone(id: string): void {
		this.stopPulse(id);
	}
}

function face(hp: number, color: string, dead = false, arm = 0): string {
	return keyImage({
		bg: THEME.bg,
		bg2: "#000000",
		glow: color,
		raw:
			`<rect x="16" y="16" width="112" height="56" rx="12" fill="${color}" opacity="0.16"/>` +
			(arm > 0 ? `<text x="12" y="118" font-size="12" font-weight="700" fill="${THEME.blue}">AR ${arm}</text>` : ""),
		lines: [
			{ text: dead ? "DEAD" : String(hp), y: 62, size: dead ? 30 : 52, color: "#ffffff", weight: 800 },
			{ text: "HP", y: 90, size: 18, color, weight: 700, spacing: 3 }
		],
		bar: arm > 0 ? { pct: arm / 100, color: THEME.blue, track: "#1a2740", y: 124, h: 8 } : undefined
	});
}

function idle(): string {
	return keyImage({
		bg: THEME.bg,
		bg2: "#000000",
		border: "#23262d",
		lines: [
			{ text: "♥", y: 70, size: 44, color: THEME.grey, weight: 700 },
			{ text: "WAITING…", y: 112, size: 16, color: THEME.grey, weight: 700, spacing: 1 }
		]
	});
}
