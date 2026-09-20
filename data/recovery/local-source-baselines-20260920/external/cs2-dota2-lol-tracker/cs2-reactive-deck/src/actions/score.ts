import { action, type KeyAction } from "@elgato/streamdeck";
import { ReactiveAction } from "../lib/reactive-action";
import { keyImage } from "../lib/svg";
import { THEME } from "../lib/theme";
import { roundScore } from "../lib/cs2";
import type { GsiPayload } from "../lib/gsi-server";

type Settings = Record<string, never>;

const CT = "#5b9bd5";
const T = "#e0a93b";

/** Round Score — CT vs T, with your side highlighted. */
@action({ UUID: "com.ratpack.cs2reactivedeck.score" })
export class RoundScoreAction extends ReactiveAction<Settings> {
	protected draw(act: KeyAction<Settings>, _s: Settings, p: GsiPayload | null): void {
		const sc = roundScore(p);
		if (!sc) {
			act.setImage(idle());
			return;
		}
		const youCt = sc.side === "CT";
		const youT = sc.side === "T";
		const raw =
			// highlight the player's side
			(youCt ? `<rect x="8" y="20" width="58" height="92" rx="10" fill="${CT}" opacity="0.14"/>` : "") +
			(youT ? `<rect x="78" y="20" width="58" height="92" rx="10" fill="${T}" opacity="0.14"/>` : "") +
			`<text x="37" y="44" text-anchor="middle" font-size="15" font-weight="800" fill="${CT}" letter-spacing="1">CT</text>` +
			`<text x="107" y="44" text-anchor="middle" font-size="15" font-weight="800" fill="${T}" letter-spacing="1">T</text>` +
			`<text x="37" y="96" text-anchor="middle" font-size="46" font-weight="800" fill="#ffffff">${sc.ct}</text>` +
			`<text x="107" y="96" text-anchor="middle" font-size="46" font-weight="800" fill="#ffffff">${sc.t}</text>` +
			`<text x="72" y="92" text-anchor="middle" font-size="22" font-weight="700" fill="${THEME.textDim}">-</text>`;
		act.setImage(keyImage({ bg: THEME.bg, bg2: "#000000", raw }));
	}
}

function idle(): string {
	return keyImage({
		bg: THEME.bg,
		bg2: "#000000",
		border: "#23262d",
		lines: [
			{ text: "SCORE", y: 64, size: 24, color: THEME.grey, weight: 800, spacing: 1 },
			{ text: "WAITING…", y: 104, size: 15, color: THEME.grey, weight: 700, spacing: 1 }
		]
	});
}
