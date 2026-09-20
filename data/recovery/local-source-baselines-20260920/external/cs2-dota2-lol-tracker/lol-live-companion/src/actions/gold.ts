import { action, type KeyAction } from "@elgato/streamdeck";
import { PollAction } from "../lib/poll-action";
import { keyImage } from "../lib/svg";
import { THEME, compact, gold, idleCard } from "../lib/theme";
import type { LiveData } from "../lib/lol-client";

type Settings = { flashColor?: string };

/** Gold Tracker — live gold, flashing gold-yellow whenever it increases. */
@action({ UUID: "com.ratpack.lollivecompanion.gold" })
export class GoldTracker extends PollAction<Settings> {
	private prev: number | null = null;
	private readonly flashing = new Set<string>();
	private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

	protected draw(act: KeyAction<Settings>, s: Settings, d: LiveData): void {
		const g = Math.round(gold(d) ?? 0);
		const flashColor = s.flashColor || THEME.goldBright;
		// currentGold is a float that ticks up passively; only flash on a meaningful gain.
		if (this.prev !== null && g - this.prev >= 20) {
			for (const a of this.actions) if (a.isKey()) this.flash(a, g, flashColor);
		}
		this.prev = g;
		if (this.flashing.has(act.id)) return;
		act.setImage(card(g, THEME.gold));
	}

	protected drawIdle(act: KeyAction<Settings>): void {
		this.prev = null;
		act.setImage(idleCard("GOLD"));
	}

	private flash(act: KeyAction<Settings>, g: number, color: string): void {
		this.flashing.add(act.id);
		act.setImage(cardFlash(g, color));
		clearTimeout(this.timers.get(act.id));
		this.timers.set(
			act.id,
			setTimeout(() => {
				this.flashing.delete(act.id);
				act.setImage(card(this.prev ?? g, THEME.gold));
			}, 900)
		);
	}

	protected override onGone(id: string): void {
		clearTimeout(this.timers.get(id));
		this.timers.delete(id);
		this.flashing.delete(id);
	}
}

function coin(cx: number, cy: number, r: number, color: string): string {
	return (
		`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"/>` +
		`<circle cx="${cx}" cy="${cy}" r="${r * 0.66}" fill="none" stroke="#0a1014" stroke-width="2"/>`
	);
}

function card(g: number, color: string): string {
	return keyImage({
		bg: THEME.bg,
		bg2: "#05080a",
		raw: coin(72, 40, 18, color),
		lines: [
			{ text: compact(g), y: 94, size: 42, color: "#ffffff", weight: 800 },
			{ text: "GOLD", y: 124, size: 16, color, weight: 700, spacing: 3 }
		]
	});
}

function cardFlash(g: number, color: string): string {
	return keyImage({
		bg: "#221b0c",
		bg2: "#11100a",
		glow: color,
		raw: coin(72, 36, 18, color),
		lines: [
			{ text: compact(g), y: 90, size: 42, color: "#ffffff", weight: 800 },
			{ text: "GOLD", y: 122, size: 16, color, weight: 800, spacing: 3 }
		]
	});
}

