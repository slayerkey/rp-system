import { action, type KeyAction } from "@elgato/streamdeck";
import { ReactiveAction } from "../lib/reactive-action";
import { keyImage, Pulse, type Imageable } from "../lib/svg";
import { THEME } from "../lib/theme";
import { respawn } from "../lib/dota";
import type { GsiPayload } from "../lib/gsi-server";

type Settings = Record<string, never>;

/**
 * Respawn Timer — auto-detected from GSI (no button press). Shows "ALIVE" while you're up, and a
 * red countdown of seconds until you respawn while you're dead.
 */
@action({ UUID: "com.ratpack.dota2reactivedeck.respawn" })
export class RespawnTimer extends ReactiveAction<Settings> {
	private readonly pulses = new Map<string, Pulse>();

	protected draw(act: KeyAction<Settings>, _s: Settings, p: GsiPayload | null): void {
		const r = respawn(p);
		if (!r) {
			this.stopPulse(act.id);
			act.setImage(idle());
			return;
		}
		if (r.alive || r.seconds <= 0) {
			this.stopPulse(act.id);
			act.setImage(alive());
			return;
		}
		this.runPulse(act, [dead(r.seconds, THEME.crimsonBright, 0.28), dead(r.seconds, THEME.redDark, 0.1)]);
	}

	private runPulse(act: KeyAction<Settings>, frames: string[]): void {
		this.stopPulse(act.id);
		const pulse = new Pulse(() => this.visible(act.id), frames, 460);
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

function dead(seconds: number, color: string, fill: number): string {
	return keyImage({
		bg: THEME.bg,
		bg2: "#000000",
		glow: color,
		raw: `<rect x="16" y="16" width="112" height="58" rx="12" fill="${color}" opacity="${fill}"/>`,
		lines: [
			{ text: `${seconds}`, y: 64, size: 52, color: "#ffffff", weight: 800 },
			{ text: "RESPAWN", y: 110, size: 16, color, weight: 800, spacing: 2 }
		]
	});
}

function alive(): string {
	return keyImage({
		bg: THEME.bg,
		bg2: "#000000",
		raw: `<rect x="16" y="26" width="112" height="52" rx="12" fill="${THEME.green}" opacity="0.14"/>`,
		lines: [
			{ text: "ALIVE", y: 66, size: 34, color: THEME.green, weight: 800, spacing: 1 },
			{ text: "in the fight", y: 104, size: 14, color: THEME.textDim, weight: 600 }
		]
	});
}

function idle(): string {
	return keyImage({
		bg: THEME.bg,
		bg2: "#000000",
		border: "#2a1818",
		lines: [
			{ text: "RESPAWN", y: 64, size: 22, color: THEME.grey, weight: 800, spacing: 1 },
			{ text: "WAITING…", y: 104, size: 15, color: THEME.grey, weight: 700, spacing: 1 }
		]
	});
}
