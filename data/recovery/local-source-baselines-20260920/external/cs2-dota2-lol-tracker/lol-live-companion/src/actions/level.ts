import { action, type KeyAction } from "@elgato/streamdeck";
import { PollAction } from "../lib/poll-action";
import { keyImage } from "../lib/svg";
import { THEME, level, idleCard } from "../lib/theme";
import type { LiveData } from "../lib/lol-client";

type Settings = Record<string, never>;

/** Level — your champion's current level (1–18). */
@action({ UUID: "com.ratpack.lollivecompanion.level" })
export class LevelDisplay extends PollAction<Settings> {
	protected draw(act: KeyAction<Settings>, _s: Settings, d: LiveData): void {
		const l = level(d);
		if (l === null) {
			act.setImage(idleCard("LVL"));
			return;
		}
		const maxed = l >= 18;
		act.setImage(
			keyImage({
				bg: THEME.bg,
				bg2: "#05080a",
				glow: maxed ? THEME.gold : undefined,
				raw: `<rect x="20" y="16" width="104" height="60" rx="14" fill="${maxed ? THEME.gold : THEME.teal}" opacity="0.16"/>`,
				lines: [
					{ text: `${l}`, y: 78, size: 62, color: "#ffffff", weight: 800 },
					{ text: maxed ? "MAX LEVEL" : "LEVEL", y: 118, size: 16, color: maxed ? THEME.gold : THEME.teal, weight: 700, spacing: 3 }
				]
			})
		);
	}

	protected drawIdle(act: KeyAction<Settings>): void {
		act.setImage(idleCard("LVL"));
	}
}
