import { action, type KeyAction } from "@elgato/streamdeck";
import { ReactiveAction } from "../lib/reactive-action";
import { keyImage } from "../lib/svg";
import { THEME, compact } from "../lib/theme";
import { gold } from "../lib/dota";
import type { GsiPayload } from "../lib/gsi-server";

type Settings = {
	flashColor?: string;
	/** Minimum jump (in one update) that counts as a "kill/bounty" worth flashing. */
	jump?: number;
};

/**
 * Gold Counter — live gold, flashing yellow when it jumps (a kill or bounty rune),
 * rather than on passive trickle. The jump threshold is configurable.
 */
@action({ UUID: "com.ratpack.dota2reactivedeck.gold" })
export class GoldCounter extends ReactiveAction<Settings> {
	private prevGold: number | null = null;
	private readonly flashTimers = new Map<string, ReturnType<typeof setTimeout>>();
	private readonly flashing = new Set<string>();

	protected draw(act: KeyAction<Settings>, s: Settings, p: GsiPayload | null): void {
		const g = gold(p);
		if (g === null) {
			this.prevGold = null;
			act.setImage(idle());
			return;
		}

		const jump = s.jump ?? 90;
		const flashColor = s.flashColor || THEME.goldBright;
		const delta = this.prevGold !== null ? g - this.prevGold : 0;
		this.prevGold = g;

		if (delta >= jump) {
			for (const a of this.actions) if (a.isKey()) this.flash(a, g, delta, flashColor);
		}

		if (this.flashing.has(act.id)) return; // keep the flash frame up
		act.setImage(card(g, THEME.gold));
	}

	private flash(act: KeyAction<Settings>, g: number, delta: number, color: string): void {
		this.flashing.add(act.id);
		act.setImage(cardFlash(g, color, `+${compact(delta)}`));
		clearTimeout(this.flashTimers.get(act.id));
		this.flashTimers.set(
			act.id,
			setTimeout(() => {
				this.flashing.delete(act.id);
				act.setImage(card(this.prevGold ?? g, THEME.gold));
			}, 1200)
		);
	}

	protected override onGone(id: string): void {
		clearTimeout(this.flashTimers.get(id));
		this.flashTimers.delete(id);
		this.flashing.delete(id);
	}
}

function card(g: number, color: string): string {
	return keyImage({
		bg: THEME.bg,
		bg2: "#000000",
		raw: coin(54, 22, color),
		lines: [
			{ text: compact(g), y: 92, size: 40, color: "#ffffff", weight: 800 },
			{ text: "GOLD", y: 124, size: 16, color, weight: 700, spacing: 3 }
		]
	});
}

function cardFlash(g: number, color: string, delta: string): string {
	return keyImage({
		bg: "#2a2208",
		bg2: "#14100a",
		glow: color,
		raw: coin(54, 16, color),
		lines: [
			{ text: compact(g), y: 86, size: 38, color: "#ffffff", weight: 800 },
			{ text: delta, y: 120, size: 22, color, weight: 800, spacing: 1 }
		]
	});
}

function coin(x: number, y: number, color: string): string {
	return (
		`<circle cx="${x + 18}" cy="${y + 18}" r="18" fill="${color}"/>` +
		`<circle cx="${x + 18}" cy="${y + 18}" r="12" fill="none" stroke="#12100a" stroke-width="2"/>` +
		`<text x="${x + 18}" y="${y + 25}" text-anchor="middle" font-size="20" font-weight="800" fill="#12100a">$</text>`
	);
}

function idle(): string {
	return keyImage({
		bg: THEME.bg,
		bg2: "#000000",
		border: "#2a1818",
		lines: [
			{ text: "GOLD", y: 70, size: 24, color: THEME.grey, weight: 800 },
			{ text: "WAITING…", y: 106, size: 15, color: THEME.grey, weight: 700, spacing: 1 }
		]
	});
}
