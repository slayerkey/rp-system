import { action, type KeyAction } from "@elgato/streamdeck";
import { PollAction } from "../lib/poll-action";
import { keyImage, Pulse, type Imageable } from "../lib/svg";
import { THEME, compact, gold, idleCard } from "../lib/theme";
import type { LiveData } from "../lib/lol-client";

type Settings = {
	/** Target item cost in gold. */
	target?: number;
	itemName?: string;
	affordColor?: string;
};

/**
 * Item Afford Alert — you set a target gold cost; the button glows bright green and pulses
 * when your current gold reaches it, otherwise it shows how much more you need.
 */
@action({ UUID: "com.ratpack.lollivecompanion.afford" })
export class AffordAlert extends PollAction<Settings> {
	private readonly pulses = new Map<string, Pulse>();

	protected draw(act: KeyAction<Settings>, s: Settings, d: LiveData): void {
		const target = Number(s.target) || 3000;
		const name = (s.itemName || "ITEM").toUpperCase().slice(0, 8);
		const color = s.affordColor || THEME.green;
		const g = Math.round(gold(d) ?? 0);

		if (g >= target) {
			this.startPulse(act, [affordable(name, g, color, 0.34), affordable(name, g, color, 0.12)]);
			return;
		}
		this.stopPulse(act.id);
		const need = target - g;
		act.setImage(saving(name, g, target, need));
	}

	protected drawIdle(act: KeyAction<Settings>): void {
		this.stopPulse(act.id);
		act.setImage(idleCard("BUY"));
	}

	private startPulse(act: KeyAction<Settings>, frames: string[]): void {
		this.stopPulse(act.id);
		const pulse = new Pulse(() => this.visible(act.id), frames, 460);
		this.pulses.set(act.id, pulse);
		pulse.start();
	}

	private *visible(id: string): Generator<Imageable> {
		for (const a of this.actions) if (a.id === id && a.isKey()) yield a;
	}

	private stopPulse(id: string): void {
		this.pulses.get(id)?.stop();
		this.pulses.delete(id);
	}

	protected override onGone(id: string): void {
		this.stopPulse(id);
	}
}

function affordable(name: string, g: number, color: string, fill: number): string {
	return keyImage({
		bg: "#0a1a10",
		bg2: "#05100a",
		glow: color,
		raw: `<rect x="10" y="12" width="124" height="58" rx="13" fill="${color}" opacity="${fill}"/>` +
			`<text x="72" y="52" text-anchor="middle" font-size="30" fill="${color}">✓</text>`,
		lines: [
			{ text: "AFFORD", y: 92, size: 24, color: "#ffffff", weight: 800, spacing: 1 },
			{ text: name, y: 120, size: 18, color, weight: 800, spacing: 1 }
		]
	});
}

function saving(name: string, g: number, target: number, need: number): string {
	return keyImage({
		bg: THEME.bg,
		bg2: "#05080a",
		lines: [
			{ text: name, y: 34, size: 16, color: THEME.gold, weight: 800, spacing: 2 },
			{ text: compact(g), y: 78, size: 40, color: "#ffffff", weight: 800 },
			{ text: `need ${compact(need)}`, y: 104, size: 16, color: THEME.textDim, weight: 700 }
		],
		bar: { pct: Math.min(1, g / target), color: THEME.gold, track: "#16242a", y: 124, h: 10 }
	});
}
