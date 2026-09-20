import {
	action,
	SingletonAction,
	type KeyAction,
	type KeyDownEvent,
	type WillAppearEvent,
	type WillDisappearEvent
} from "@elgato/streamdeck";
import { keyImage } from "../lib/svg";
import { THEME } from "../lib/theme";
import { fetchLaunches, logError, type Launch } from "../lib/api";

type Settings = Record<string, never>;

const HOUR = 3_600_000;

/**
 * Next Launch — counts down to upcoming orbital launches. Data is fetched hourly (the public
 * API is rate-limited) and the countdown ticks every second. Press to cycle the next three.
 */
@action({ UUID: "com.ratpack.nasaspacetracker.launch" })
export class NextLaunch extends SingletonAction<Settings> {
	private launches: Launch[] = [];
	private lastFetch = 0;
	private tick?: ReturnType<typeof setInterval>;
	/** Which of the upcoming launches each key is showing. */
	private readonly idx = new Map<string, number>();

	override async onWillAppear(ev: WillAppearEvent<Settings>): Promise<void> {
		this.idx.set(ev.action.id, 0);
		await this.refreshIfStale();
		if (ev.action.isKey()) this.render(ev.action);
		this.ensureTick();
	}

	override onWillDisappear(ev: WillDisappearEvent<Settings>): void {
		this.idx.delete(ev.action.id);
		if (this.actions[Symbol.iterator]().next().done) {
			clearInterval(this.tick);
			this.tick = undefined;
		}
	}

	override onKeyDown(ev: KeyDownEvent<Settings>): void {
		if (!ev.action.isKey()) return;
		const max = Math.min(3, this.launches.length) || 1;
		this.idx.set(ev.action.id, ((this.idx.get(ev.action.id) ?? 0) + 1) % max);
		this.render(ev.action);
	}

	private ensureTick(): void {
		if (this.tick) return;
		this.tick = setInterval(() => {
			void this.refreshIfStale();
			for (const a of this.actions) if (a.isKey()) this.render(a);
		}, 1000);
	}

	private async refreshIfStale(): Promise<void> {
		if (this.launches.length && Date.now() - this.lastFetch < HOUR) return;
		try {
			this.launches = await fetchLaunches(5);
			this.lastFetch = Date.now();
		} catch (err) {
			logError("Launches", err);
		}
	}

	private render(act: KeyAction<Settings>): void {
		if (!this.launches.length) {
			act.setImage(card("LAUNCH", "LOADING…", THEME.grey));
			return;
		}
		const i = this.idx.get(act.id) ?? 0;
		const total = Math.min(3, this.launches.length);
		const l = this.launches[Math.min(i, this.launches.length - 1)];
		const ms = new Date(l.net).getTime() - Date.now();
		const mission = fit(l.name || "TBD", 16);
		const rocket = fit(l.rocket || "", 18);
		const tlabel = total > 1 ? `T-MINUS  ${i + 1}/${total}` : "T-MINUS";
		const cd = countdown(ms);
		const cdSize = cd.length > 6 ? 26 : cd.length > 5 ? 30 : 34;

		act.setImage(
			keyImage({
				bg: THEME.bg,
				bg2: "#03050c",
				raw:
					// Rocket to the LEFT of a centred T-MINUS label.
					rocketGlyph(30, 20, THEME.nasaRed) +
					`<text x="88" y="24" text-anchor="middle" font-family="'Segoe UI',Arial,sans-serif" font-size="13" font-weight="800" fill="${THEME.nasaRed}" letter-spacing="0.5">${tlabel}</text>`,
				lines: [
					{ text: cd, y: 70, size: cdSize, color: ms < 3_600_000 && ms > 0 ? THEME.nasaRed : THEME.white, weight: 800 },
					{ text: mission, y: 100, size: 15, color: THEME.blueBright, weight: 700 },
					{ text: rocket, y: 124, size: 13, color: THEME.textDim, weight: 600 }
				]
			})
		);
	}
}

/** Truncate with an ellipsis so long mission/rocket names stay inside the key. */
function fit(text: string, maxChars: number): string {
	const t = text.trim();
	return t.length > maxChars ? t.slice(0, maxChars - 1).trimEnd() + "…" : t;
}

/** A small upright rocket glyph centred at (cx, cy). */
function rocketGlyph(cx: number, cy: number, color: string): string {
	return (
		`<polygon points="${cx},${cy - 12} ${cx - 5},${cy - 3} ${cx + 5},${cy - 3}" fill="${color}"/>` + // nose
		`<rect x="${cx - 5}" y="${cy - 3}" width="10" height="12" rx="4" fill="#e9edf5"/>` + // body
		`<polygon points="${cx - 5},${cy + 4} ${cx - 9},${cy + 10} ${cx - 5},${cy + 9}" fill="${color}"/>` + // left fin
		`<polygon points="${cx + 5},${cy + 4} ${cx + 9},${cy + 10} ${cx + 5},${cy + 9}" fill="${color}"/>` + // right fin
		`<circle cx="${cx}" cy="${cy + 1}" r="2.3" fill="${THEME.blue}"/>` + // window
		`<polygon points="${cx - 3},${cy + 9} ${cx + 3},${cy + 9} ${cx},${cy + 15}" fill="${THEME.star}"/>` // flame
	);
}

function countdown(ms: number): string {
	if (ms <= 0) return "LIFTOFF";
	const s = Math.floor(ms / 1000);
	const d = Math.floor(s / 86400);
	const h = Math.floor((s % 86400) / 3600);
	const m = Math.floor((s % 3600) / 60);
	const ss = s % 60;
	if (d > 0) return `${d}d ${h}h`; // multi-day: minutes are noise
	if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
	return `${m}:${String(ss).padStart(2, "0")}`;
}

function card(big: string, sub: string, color: string): string {
	return keyImage({
		bg: THEME.bg,
		bg2: "#03050c",
		border: "#15203c",
		lines: [
			{ text: big, y: 72, size: 26, color, weight: 800, spacing: 1 },
			{ text: sub, y: 104, size: 14, color: THEME.textDim, weight: 700, spacing: 1 }
		]
	});
}
