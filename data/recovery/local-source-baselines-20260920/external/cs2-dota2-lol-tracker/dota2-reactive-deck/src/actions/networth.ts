import { action, type KeyAction } from "@elgato/streamdeck";
import { ReactiveAction } from "../lib/reactive-action";
import { keyImage } from "../lib/svg";
import { THEME, compact } from "../lib/theme";
import { netWorth } from "../lib/dota";
import type { GsiPayload } from "../lib/gsi-server";

type Settings = Record<string, never>;

/** Net Worth — your total gold + item value, the headline "how fed am I" number. */
@action({ UUID: "com.ratpack.dota2reactivedeck.networth" })
export class NetWorthAction extends ReactiveAction<Settings> {
	protected draw(act: KeyAction<Settings>, _s: Settings, p: GsiPayload | null): void {
		const n = netWorth(p);
		if (n === null) {
			act.setImage(idle());
			return;
		}
		act.setImage(
			keyImage({
				bg: THEME.bg,
				bg2: "#000000",
				raw:
					`<circle cx="72" cy="40" r="16" fill="${THEME.gold}"/>` +
					`<circle cx="72" cy="40" r="10" fill="none" stroke="#12100a" stroke-width="2"/>` +
					`<text x="72" y="47" text-anchor="middle" font-size="17" font-weight="800" fill="#12100a">$</text>`,
				lines: [
					{ text: compact(n), y: 92, size: 38, color: "#ffffff", weight: 800 },
					{ text: "NET WORTH", y: 122, size: 14, color: THEME.gold, weight: 700, spacing: 2 }
				]
			})
		);
	}
}

function idle(): string {
	return keyImage({
		bg: THEME.bg,
		bg2: "#000000",
		border: "#2a1818",
		lines: [
			{ text: "WORTH", y: 64, size: 24, color: THEME.grey, weight: 800 },
			{ text: "WAITING…", y: 104, size: 15, color: THEME.grey, weight: 700, spacing: 1 }
		]
	});
}
