import { action, type KeyAction } from "@elgato/streamdeck";
import { PollAction } from "../lib/poll-action";
import { keyImage } from "../lib/svg";
import { THEME, pctColor, health, resource, idleCard } from "../lib/theme";
import type { LiveData } from "../lib/lol-client";

type Mode = "both" | "hp" | "mana";
type Settings = {
	good?: string;
	mid?: string;
	bad?: string;
	highCut?: number;
	lowCut?: number;
	mode?: Mode;
};

const MANA = "#2f8fff";
const MANA_TRACK = "#15315a";

/**
 * Health Display — champion HP and resource. Display mode is configurable: BOTH on one key, or
 * HP-only / MANA-only so you can put them on separate keys (like the Dota plugin). HP colour
 * shifts green → yellow → red; the blue bar tracks mana/energy (manaless champs show HP only).
 */
@action({ UUID: "com.ratpack.lollivecompanion.health" })
export class HealthDisplay extends PollAction<Settings> {
	protected draw(act: KeyAction<Settings>, s: Settings, d: LiveData): void {
		const mode: Mode = s.mode || "both";
		const v = health(d);
		if (!v) {
			act.setImage(idleCard(mode === "mana" ? "MANA" : "HP"));
			return;
		}
		const color = pctColor(v.pct, s.good || THEME.green, s.mid || THEME.yellow, s.bad || THEME.red, s.highCut ?? 60, s.lowCut ?? 30);
		const dead = v.hp <= 0;
		const r = resource(d);
		const hasMana = !!r && r.max > 0;

		if (mode === "mana") {
			if (!hasMana) {
				act.setImage(noMana(r?.type));
				return;
			}
			act.setImage(
				keyImage({
					bg: THEME.bg,
					bg2: "#05080a",
					raw: `<rect x="14" y="18" width="116" height="52" rx="12" fill="${MANA}" opacity="0.16"/>`,
					lines: [
						{ text: `${r!.pct}%`, y: 62, size: 46, color: "#ffffff", weight: 800 },
						{ text: `${Math.round(r!.val)} ${shortType(r!.type)}`, y: 92, size: 16, color: THEME.textDim, weight: 700 }
					],
					bar: { pct: r!.pct / 100, color: MANA, track: MANA_TRACK, y: 124, h: 10 }
				})
			);
			return;
		}

		if (mode === "hp") {
			act.setImage(
				keyImage({
					bg: THEME.bg,
					bg2: "#05080a",
					glow: !dead && v.pct < (s.lowCut ?? 30) ? color : undefined,
					raw: `<rect x="14" y="18" width="116" height="52" rx="12" fill="${dead ? THEME.grey : color}" opacity="0.16"/>`,
					lines: [
						{ text: dead ? "DEAD" : `${v.pct}%`, y: 62, size: dead ? 30 : 46, color: "#ffffff", weight: 800 },
						{ text: dead ? "" : `${Math.round(v.hp)} HP`, y: 92, size: 16, color: THEME.textDim, weight: 700 }
					],
					bar: { pct: v.pct / 100, color: dead ? THEME.grey : color, track: "#16242a", y: 124, h: 10 }
				})
			);
			return;
		}

		// both — HP big with its bar, plus a mana value + blue bar underneath
		act.setImage(
			keyImage({
				bg: THEME.bg,
				bg2: "#05080a",
				glow: !dead && v.pct < (s.lowCut ?? 30) ? color : undefined,
				raw: `<rect x="14" y="12" width="116" height="46" rx="11" fill="${dead ? THEME.grey : color}" opacity="0.16"/>`,
				lines: [
					{ text: dead ? "DEAD" : `${v.pct}%`, y: 52, size: dead ? 28 : 42, color: "#ffffff", weight: 800 },
					{ text: "HP", y: 74, size: 14, color, weight: 700, spacing: 2 },
					...(hasMana ? [{ text: `${Math.round(r!.val)}`, y: 112, size: 22, color: MANA, weight: 800 } as const] : [])
				],
				bar: hasMana ? { pct: r!.pct / 100, color: MANA, track: MANA_TRACK, y: 126, h: 8 } : { pct: v.pct / 100, color: dead ? THEME.grey : color, track: "#16242a", y: 126, h: 8 }
			})
		);
	}

	protected drawIdle(act: KeyAction<Settings>, s: Settings): void {
		act.setImage(idleCard((s.mode || "both") === "mana" ? "MANA" : "HP"));
	}
}

function shortType(type: string): string {
	const t = type.toUpperCase();
	if (t.includes("ENERGY")) return "EN";
	if (t.includes("RAGE") || t.includes("FURY")) return "RAGE";
	if (t.includes("HEAT")) return "HEAT";
	if (t.includes("SHIELD")) return "SHLD";
	return "MP";
}

function noMana(type?: string): string {
	return keyImage({
		bg: THEME.bg,
		bg2: "#05080a",
		border: "#16242a",
		lines: [
			{ text: "—", y: 60, size: 40, color: THEME.grey, weight: 800 },
			{ text: type && type.toUpperCase().includes("NONE") ? "MANALESS" : "NO MANA", y: 100, size: 14, color: THEME.grey, weight: 700, spacing: 1 }
		]
	});
}
