import { action, type KeyAction } from "@elgato/streamdeck";
import { PollAction } from "../lib/poll-action";
import { keyImage } from "../lib/svg";
import { THEME, scores, idleCard } from "../lib/theme";
import type { LiveData } from "../lib/lol-client";

type Settings = { showCs?: boolean };

/** KDA Display — live kills / deaths / assists (and optional creep score). */
@action({ UUID: "com.ratpack.lollivecompanion.kda" })
export class KdaDisplay extends PollAction<Settings> {
	protected draw(act: KeyAction<Settings>, s: Settings, d: LiveData): void {
		const sc = scores(d);
		if (!sc) {
			act.setImage(idleCard("KDA"));
			return;
		}
		const showCs = s.showCs !== false;
		const raw =
			`<text x="72" y="46" text-anchor="middle" font-size="16" font-weight="700" fill="${THEME.textDim}" letter-spacing="3">K / D / A</text>` +
			`<text x="72" y="96" text-anchor="middle" font-size="38" font-weight="800">` +
			`<tspan fill="${THEME.green}">${sc.k}</tspan>` +
			`<tspan fill="${THEME.textDim}"> / </tspan>` +
			`<tspan fill="${THEME.red}">${sc.d}</tspan>` +
			`<tspan fill="${THEME.textDim}"> / </tspan>` +
			`<tspan fill="${THEME.gold}">${sc.a}</tspan>` +
			`</text>`;
		act.setImage(
			keyImage({
				bg: THEME.bg,
				bg2: "#05080a",
				raw,
				lines: showCs ? [{ text: `${sc.cs} CS`, y: 126, size: 16, color: THEME.teal, weight: 700, spacing: 1 }] : []
			})
		);
	}

	protected drawIdle(act: KeyAction<Settings>): void {
		act.setImage(idleCard("KDA"));
	}
}
