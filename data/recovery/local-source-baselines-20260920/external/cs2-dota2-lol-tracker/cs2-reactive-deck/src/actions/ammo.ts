import { action, type KeyAction } from "@elgato/streamdeck";
import { ReactiveAction } from "../lib/reactive-action";
import { keyImage, Pulse, type Imageable } from "../lib/svg";
import { THEME } from "../lib/theme";
import { activeWeapon } from "../lib/cs2";
import type { GsiPayload } from "../lib/gsi-server";

type Settings = {
	accent?: string;
	emptyColor?: string;
};

/**
 * Ammo Counter — clip / reserve for the active weapon, with a fill bar.
 * Pulses orange when the clip hits zero (reload reminder).
 */
@action({ UUID: "com.ratpack.cs2reactivedeck.ammo" })
export class AmmoCounter extends ReactiveAction<Settings> {
	private readonly pulses = new Map<string, Pulse>();

	protected draw(act: KeyAction<Settings>, s: Settings, p: GsiPayload | null): void {
		const accent = s.accent || THEME.orange;
		const empty = s.emptyColor || THEME.orangeBright;
		const w = activeWeapon(p);

		if (!w || w.clip < 0) {
			this.stopPulse(act.id);
			act.setImage(idle(w?.type === "Knife" || w?.type === "Grenade"));
			return;
		}

		const pct = w.clipMax > 0 ? w.clip / w.clipMax : 1;

		// Mid-reload, or an empty clip: pulse the reload prompt instead of going idle.
		if (w.reloading || w.clip === 0) {
			this.runPulse(act, [card(w.clip, w.reserve, empty, pct, true), card(w.clip, w.reserve, "#3a230a", pct, true)]);
			return;
		}
		this.stopPulse(act.id);
		const barColor = pct <= 0.34 ? THEME.red : pct <= 0.67 ? THEME.yellow : accent;
		act.setImage(card(w.clip, w.reserve, accent, pct, false, barColor));
	}

	private runPulse(act: KeyAction<Settings>, frames: string[]): void {
		this.stopPulse(act.id);
		const pulse = new Pulse(() => this.visible(act.id), frames, 360);
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

function card(clip: number, reserve: number, accent: string, pct: number, reload: boolean, barColor = accent): string {
	return keyImage({
		bg: THEME.bg,
		bg2: "#000000",
		glow: reload ? accent : undefined,
		lines: [
			{ text: reload ? "RELOAD" : String(clip), y: reload ? 54 : 66, size: reload ? 26 : 58, color: reload ? accent : "#ffffff", weight: 800 },
			{ text: reload ? `${clip} / ${reserve}` : `/ ${reserve}`, y: reload ? 86 : 96, size: 22, color: THEME.textDim, weight: 700 }
		],
		bar: { pct, color: barColor, y: 120, h: 10 }
	});
}

function idle(melee = false): string {
	return keyImage({
		bg: THEME.bg,
		bg2: "#000000",
		border: "#23262d",
		lines: [
			{ text: melee ? "—" : "AMMO", y: 70, size: melee ? 44 : 26, color: THEME.grey, weight: 800 },
			{ text: melee ? "MELEE" : "WAITING…", y: 108, size: 16, color: THEME.grey, weight: 700, spacing: 1 }
		]
	});
}
