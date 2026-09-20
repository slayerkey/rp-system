import { action, type KeyAction } from "@elgato/streamdeck";
import { PollAction } from "../lib/poll-action";
import { keyImage } from "../lib/svg";
import { THEME, scores, gameTime, idleCard } from "../lib/theme";
import type { LiveData } from "../lib/lol-client";

type Settings = Record<string, never>;

/** CS — creep score with CS-per-minute, the core farming metric. */
@action({ UUID: "com.ratpack.lollivecompanion.cs" })
export class CsDisplay extends PollAction<Settings> {
	protected draw(act: KeyAction<Settings>, _s: Settings, d: LiveData): void {
		const sc = scores(d);
		if (!sc) {
			act.setImage(idleCard("CS"));
			return;
		}
		const t = gameTime(d);
		const perMin = t > 30 ? sc.cs / (t / 60) : 0;
		// Good farming is roughly 8+ CS/min; colour the rate accordingly.
		const rateColor = perMin >= 8 ? THEME.green : perMin >= 5 ? THEME.gold : THEME.textDim;
		act.setImage(
			keyImage({
				bg: THEME.bg,
				bg2: "#05080a",
				raw: `<rect x="16" y="16" width="112" height="56" rx="12" fill="${THEME.teal}" opacity="0.14"/>`,
				lines: [
					{ text: `${sc.cs}`, y: 66, size: 50, color: "#ffffff", weight: 800 },
					{ text: "CS", y: 92, size: 16, color: THEME.teal, weight: 700, spacing: 3 },
					{ text: perMin > 0 ? `${perMin.toFixed(1)} / min` : "—", y: 122, size: 16, color: rateColor, weight: 700 }
				]
			})
		);
	}

	protected drawIdle(act: KeyAction<Settings>): void {
		act.setImage(idleCard("CS"));
	}
}
