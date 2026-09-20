import { action, type KeyAction } from "@elgato/streamdeck";
import { ReactiveAction } from "../lib/reactive-action";
import { keyImage } from "../lib/svg";
import { THEME, pctColor } from "../lib/theme";
import { heroVitals } from "../lib/dota";
import type { GsiPayload } from "../lib/gsi-server";

type Mode = "both" | "hp" | "mana";
type Settings = {
	good?: string;
	mid?: string;
	bad?: string;
	highCut?: number;
	lowCut?: number;
	mode?: Mode;
};

/**
 * Hero Vitals — shows HP and mana. The display mode is configurable: BOTH on one key, or HP-only /
 * MANA-only so you can put them on separate keys. HP colour shifts green → yellow → red.
 */
@action({ UUID: "com.ratpack.dota2reactivedeck.hpmana" })
export class HeroVitalsAction extends ReactiveAction<Settings> {
	protected draw(act: KeyAction<Settings>, s: Settings, p: GsiPayload | null): void {
		const mode: Mode = s.mode || "both";
		const v = heroVitals(p);
		if (!v) {
			act.setImage(idle(mode));
			return;
		}
		const hpColor = v.alive
			? pctColor(v.hpPct, s.good || THEME.green, s.mid || THEME.yellow, s.bad || THEME.red, s.highCut ?? 60, s.lowCut ?? 30)
			: THEME.grey;

		if (mode === "mana") {
			act.setImage(
				keyImage({
					bg: THEME.bg,
					bg2: "#000000",
					raw: `<rect x="14" y="18" width="116" height="52" rx="12" fill="${THEME.mana}" opacity="0.16"/>`,
					lines: [
						{ text: String(v.mp), y: 62, size: 46, color: "#ffffff", weight: 800 },
						{ text: "MANA", y: 92, size: 16, color: THEME.mana, weight: 700, spacing: 2 }
					],
					bar: { pct: v.mpPct / 100, color: THEME.mana, track: THEME.manaTrack, y: 122, h: 10 }
				})
			);
			return;
		}

		if (mode === "hp") {
			act.setImage(
				keyImage({
					bg: THEME.bg,
					bg2: "#000000",
					glow: v.alive && v.hpPct < (s.lowCut ?? 30) ? THEME.red : undefined,
					raw: `<rect x="14" y="18" width="116" height="52" rx="12" fill="${hpColor}" opacity="0.16"/>`,
					lines: [
						{ text: v.alive ? String(v.hp) : "DEAD", y: 62, size: v.alive ? 46 : 30, color: v.alive ? "#ffffff" : THEME.grey, weight: 800 },
						{ text: "HP", y: 92, size: 16, color: hpColor, weight: 700, spacing: 2 }
					],
					bar: { pct: v.hpPct / 100, color: hpColor, track: "#3a1414", y: 122, h: 10 }
				})
			);
			return;
		}

		// both
		act.setImage(
			keyImage({
				bg: THEME.bg,
				bg2: "#000000",
				glow: v.alive && v.hpPct < (s.lowCut ?? 30) ? THEME.red : undefined,
				raw: `<rect x="14" y="14" width="116" height="52" rx="12" fill="${hpColor}" opacity="0.16"/>`,
				lines: [
					{ text: v.alive ? String(v.hp) : "DEAD", y: 58, size: v.alive ? 46 : 30, color: v.alive ? "#ffffff" : THEME.grey, weight: 800 },
					{ text: "HP", y: 82, size: 16, color: hpColor, weight: 700, spacing: 2 },
					{ text: String(v.mp), y: 116, size: 26, color: THEME.mana, weight: 800 }
				],
				bar: { pct: v.mpPct / 100, color: THEME.mana, track: THEME.manaTrack, y: 130, h: 8 }
			})
		);
	}
}

function idle(mode: Mode): string {
	const label = mode === "mana" ? "MANA" : "HP";
	return keyImage({
		bg: THEME.bg,
		bg2: "#000000",
		border: "#2a1818",
		lines: [
			{ text: label, y: 64, size: 30, color: THEME.grey, weight: 800 },
			{ text: "WAITING…", y: 104, size: 15, color: THEME.grey, weight: 700, spacing: 1 }
		]
	});
}
