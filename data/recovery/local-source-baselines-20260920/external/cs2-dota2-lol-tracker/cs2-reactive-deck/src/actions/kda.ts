import { action, type KeyAction } from "@elgato/streamdeck";
import { ReactiveAction } from "../lib/reactive-action";
import { keyImage, fitSize } from "../lib/svg";
import { THEME } from "../lib/theme";
import { matchStats } from "../lib/cs2";
import type { GsiPayload } from "../lib/gsi-server";

type Settings = Record<string, never>;

/** Match KDA — kills / deaths / assists for the whole match, plus MVP stars. */
@action({ UUID: "com.ratpack.cs2reactivedeck.kda" })
export class MatchKda extends ReactiveAction<Settings> {
	protected draw(act: KeyAction<Settings>, _s: Settings, p: GsiPayload | null): void {
		const ms = matchStats(p);
		if (!ms) {
			act.setImage(idle());
			return;
		}
		const size = fitSize(`${ms.kills} / ${ms.deaths} / ${ms.assists}`, 132, 40);
		const raw =
			`<text x="72" y="44" text-anchor="middle" font-size="16" font-weight="700" fill="${THEME.textDim}" letter-spacing="3">K / D / A</text>` +
			`<text x="72" y="96" text-anchor="middle" font-size="${size}" font-weight="800">` +
			`<tspan fill="${THEME.green}">${ms.kills}</tspan>` +
			`<tspan fill="${THEME.textDim}"> / </tspan>` +
			`<tspan fill="${THEME.red}">${ms.deaths}</tspan>` +
			`<tspan fill="${THEME.textDim}"> / </tspan>` +
			`<tspan fill="${THEME.orange}">${ms.assists}</tspan>` +
			`</text>`;
		act.setImage(
			keyImage({
				bg: THEME.bg,
				bg2: "#000000",
				raw,
				lines: ms.mvps > 0 ? [{ text: `★ ${ms.mvps} MVP`, y: 126, size: 15, color: THEME.yellow, weight: 700, spacing: 1 }] : []
			})
		);
	}
}

function idle(): string {
	return keyImage({
		bg: THEME.bg,
		bg2: "#000000",
		border: "#23262d",
		lines: [
			{ text: "K/D/A", y: 70, size: 26, color: THEME.grey, weight: 800 },
			{ text: "WAITING…", y: 106, size: 15, color: THEME.grey, weight: 700, spacing: 1 }
		]
	});
}
