import { action, type KeyAction } from "@elgato/streamdeck";
import { ReactiveAction } from "../lib/reactive-action";
import { keyImage, fitSize } from "../lib/svg";
import { THEME } from "../lib/theme";
import { money } from "../lib/cs2";
import type { GsiPayload } from "../lib/gsi-server";

type Settings = { fullBuy?: number };

/**
 * Economy — your current money. Colours by buying power (red = eco, yellow = partial, green = can
 * full-buy) and briefly flashes green when your cash jumps (round reward / kill).
 */
@action({ UUID: "com.ratpack.cs2reactivedeck.money" })
export class Economy extends ReactiveAction<Settings> {
	private prev: number | null = null;
	private readonly flashTimers = new Map<string, ReturnType<typeof setTimeout>>();
	private readonly flashing = new Set<string>();

	protected draw(act: KeyAction<Settings>, s: Settings, p: GsiPayload | null): void {
		const m = money(p);
		if (m === null) {
			this.prev = null;
			act.setImage(idle());
			return;
		}
		const full = s.fullBuy ?? 4000;
		const color = m >= full ? THEME.green : m >= 1500 ? THEME.yellow : THEME.red;

		if (this.prev !== null && m - this.prev >= 300) {
			for (const a of this.actions) if (a.isKey()) this.flash(a, m - this.prev);
		}
		this.prev = m;

		if (this.flashing.has(act.id)) return;
		act.setImage(card(m, color, false));
	}

	private flash(act: KeyAction<Settings>, delta: number): void {
		this.flashing.add(act.id);
		act.setImage(card(this.prev ?? 0, THEME.greenBright, true, `+$${delta}`));
		clearTimeout(this.flashTimers.get(act.id));
		this.flashTimers.set(
			act.id,
			setTimeout(() => {
				this.flashing.delete(act.id);
				const m = this.prev ?? 0;
				act.setImage(card(m, m >= 4000 ? THEME.green : m >= 1500 ? THEME.yellow : THEME.red, false));
			}, 1100)
		);
	}

	protected override onGone(id: string): void {
		clearTimeout(this.flashTimers.get(id));
		this.flashTimers.delete(id);
		this.flashing.delete(id);
	}
}

function card(m: number, color: string, flash: boolean, delta?: string): string {
	return keyImage({
		bg: flash ? "#0a2a16" : THEME.bg,
		bg2: "#000000",
		glow: flash ? THEME.greenBright : undefined,
		raw: `<rect x="16" y="18" width="112" height="56" rx="12" fill="${color}" opacity="0.14"/>`,
		lines: [
			{ text: `$${m}`, y: 66, size: fitSize(`$${m}`, 104, 46), color: "#ffffff", weight: 800 },
			{ text: delta ?? "MONEY", y: 116, size: delta ? 22 : 18, color, weight: 800, spacing: delta ? 1 : 3 }
		]
	});
}

function idle(): string {
	return keyImage({
		bg: THEME.bg,
		bg2: "#000000",
		border: "#23262d",
		lines: [
			{ text: "$", y: 68, size: 44, color: THEME.grey, weight: 800 },
			{ text: "WAITING…", y: 110, size: 16, color: THEME.grey, weight: 700, spacing: 1 }
		]
	});
}
