import { action, type KeyAction } from "@elgato/streamdeck";
import { ReactiveAction } from "../lib/reactive-action";
import { keyImage } from "../lib/svg";
import { THEME } from "../lib/theme";
import { kda } from "../lib/dota";
import type { GsiPayload } from "../lib/gsi-server";

type Settings = Record<string, never>;

/** KDA — live kills / deaths / assists. */
@action({ UUID: "com.ratpack.dota2reactivedeck.kda" })
export class KdaAction extends ReactiveAction<Settings> {
	protected draw(act: KeyAction<Settings>, _s: Settings, p: GsiPayload | null): void {
		const v = kda(p);
		if (!v) {
			act.setImage(idle());
			return;
		}
		// Coloured K / D / A built as positioned tspans so each number gets its own colour.
		const raw =
			`<text x="72" y="52" text-anchor="middle" font-size="18" font-weight="700" fill="${THEME.textDim}" letter-spacing="3">K / D / A</text>` +
			`<text x="72" y="104" text-anchor="middle" font-size="40" font-weight="800">` +
			`<tspan fill="${THEME.green}">${v.k}</tspan>` +
			`<tspan fill="${THEME.textDim}"> / </tspan>` +
			`<tspan fill="${THEME.red}">${v.d}</tspan>` +
			`<tspan fill="${THEME.textDim}"> / </tspan>` +
			`<tspan fill="${THEME.gold}">${v.a}</tspan>` +
			`</text>`;
		act.setImage(keyImage({ bg: THEME.bg, bg2: "#000000", raw }));
	}
}

function idle(): string {
	return keyImage({
		bg: THEME.bg,
		bg2: "#000000",
		border: "#2a1818",
		lines: [
			{ text: "K/D/A", y: 70, size: 26, color: THEME.grey, weight: 800 },
			{ text: "WAITING…", y: 106, size: 15, color: THEME.grey, weight: 700, spacing: 1 }
		]
	});
}
