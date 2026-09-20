import { action, type KeyAction } from "@elgato/streamdeck";
import { ReactiveAction } from "../lib/reactive-action";
import { keyImage } from "../lib/svg";
import { THEME } from "../lib/theme";
import { matchClock } from "../lib/dota";
import type { GsiPayload } from "../lib/gsi-server";

type Settings = Record<string, never>;

/** Match Timer — the game clock, with a sun/moon marker for Dota's day-night cycle. */
@action({ UUID: "com.ratpack.dota2reactivedeck.matchtimer" })
export class MatchTimer extends ReactiveAction<Settings> {
	protected draw(act: KeyAction<Settings>, _s: Settings, p: GsiPayload | null): void {
		const m = matchClock(p);
		if (!m) {
			act.setImage(idle());
			return;
		}
		const neg = m.clock < 0;
		const t = Math.abs(m.clock);
		const clock = `${neg ? "-" : ""}${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
		const mark = m.day
			? `<circle cx="72" cy="34" r="11" fill="${THEME.gold}"/>`
			: `<path d="M78 34 A11 11 0 1 1 67 25 A8 8 0 0 0 78 34 Z" fill="#cdd6e6"/>`;

		act.setImage(
			keyImage({
				bg: THEME.bg,
				bg2: "#000000",
				raw: mark,
				lines: [
					{ text: clock, y: 86, size: 40, color: "#ffffff", weight: 800 },
					{ text: m.day ? "DAY" : "NIGHT", y: 114, size: 14, color: m.day ? THEME.gold : "#9fb0cc", weight: 700, spacing: 2 }
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
			{ text: "TIME", y: 64, size: 26, color: THEME.grey, weight: 800 },
			{ text: "WAITING…", y: 104, size: 15, color: THEME.grey, weight: 700, spacing: 1 }
		]
	});
}
