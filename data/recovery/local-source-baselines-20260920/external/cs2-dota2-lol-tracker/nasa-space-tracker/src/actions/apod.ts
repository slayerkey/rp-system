import streamDeck, {
	action,
	SingletonAction,
	type KeyDownEvent,
	type WillAppearEvent,
	type DidReceiveSettingsEvent
} from "@elgato/streamdeck";
import { keyImage } from "../lib/svg";
import { THEME } from "../lib/theme";
import { fetchApod, fetchImageDataUri, logError, type Apod as ApodData } from "../lib/api";

type Settings = { apiKey?: string };

/**
 * Astronomy Picture of the Day — shows NASA's daily photo on the key and opens it full-size on
 * press. NASA's API is flaky, so we retry hard, keep the last good image on screen through
 * outages, and quietly re-attempt until a picture loads.
 */
@action({ UUID: "com.ratpack.nasaspacetracker.apod" })
export class Apod extends SingletonAction<Settings> {
	private current?: ApodData;
	private image?: string; // last good image (or video card)
	private fetchedDate = "";
	private daily?: ReturnType<typeof setTimeout>;
	private soon?: ReturnType<typeof setTimeout>;
	private key = "";

	override async onWillAppear(ev: WillAppearEvent<Settings>): Promise<void> {
		this.key = ev.payload.settings.apiKey ?? "";
		if (ev.action.isKey()) ev.action.setImage(this.image ?? card("APOD", "LOADING…"));
		await this.refresh();
		this.scheduleDaily();
	}

	override onWillDisappear(): void {
		if (this.actions[Symbol.iterator]().next().done) {
			clearTimeout(this.daily);
			clearTimeout(this.soon);
			this.daily = this.soon = undefined;
		}
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<Settings>): Promise<void> {
		const newKey = ev.payload.settings.apiKey ?? "";
		if (newKey !== this.key) {
			this.key = newKey;
			this.fetchedDate = ""; // force a refetch with the new key
		}
		await this.refresh();
	}

	override onKeyDown(_ev: KeyDownEvent<Settings>): void {
		const url = this.current?.hdurl || this.current?.url;
		if (url) void streamDeck.system.openUrl(url);
	}

	private async refresh(): Promise<void> {
		try {
			const apod = await fetchApod(this.key);
			this.current = apod;
			if (apod.date === this.fetchedDate && this.image) {
				this.paint(this.image);
				return;
			}
			const img = apod.media_type === "image" ? await fetchImageDataUri(apod.url) : videoCard();
			this.image = img;
			this.fetchedDate = apod.date;
			clearTimeout(this.soon);
			this.soon = undefined;
			this.paint(img);
		} catch (err) {
			logError("APOD", err);
			if (this.image) {
				this.paint(this.image); // keep showing the last good picture through the outage
			} else {
				const badKey = /HTTP 403/.test(err instanceof Error ? err.message : "");
				this.paint(card("APOD", badKey ? "CHECK API KEY" : "RETRYING…", badKey ? THEME.nasaRed : THEME.grey));
				this.scheduleSoon();
			}
		}
	}

	private paint(img: string): void {
		for (const a of this.actions) if (a.isKey()) a.setImage(img);
	}

	/** When we have no image yet (NASA down / fresh key), try again soon until one loads. */
	private scheduleSoon(): void {
		if (this.soon) return;
		this.soon = setTimeout(() => {
			this.soon = undefined;
			void this.refresh();
		}, 25_000);
	}

	/** Re-fetch shortly after the next local 07:00 when a fresh APOD is reliably posted. */
	private scheduleDaily(): void {
		if (this.daily) return;
		const now = new Date();
		const next = new Date(now);
		next.setHours(7, 5, 0, 0);
		if (next <= now) next.setDate(next.getDate() + 1);
		this.daily = setTimeout(() => {
			this.daily = undefined;
			void this.refresh().then(() => this.scheduleDaily());
		}, next.getTime() - now.getTime());
	}
}

function card(big: string, sub: string, color: string = THEME.blueBright): string {
	return keyImage({
		bg: THEME.bg,
		bg2: "#03050c",
		border: "#15203c",
		raw: star(72, 44, 16, THEME.star),
		lines: [
			{ text: big, y: 92, size: 22, color: THEME.text, weight: 800, spacing: 2 },
			{ text: sub, y: 118, size: 13, color, weight: 700 }
		]
	});
}

/** Some days the APOD is a video — show a clean play card (tap opens it) instead of an image. */
function videoCard(): string {
	return keyImage({
		bg: "#0a1430",
		bg2: "#03050c",
		border: "#15203c",
		raw:
			`<circle cx="72" cy="50" r="22" fill="none" stroke="${THEME.blueBright}" stroke-width="3"/>` +
			`<polygon points="65,40 65,60 84,50" fill="${THEME.blueBright}"/>`,
		lines: [
			{ text: "VIDEO TODAY", y: 96, size: 18, color: THEME.text, weight: 800, spacing: 1 },
			{ text: "tap to watch", y: 120, size: 14, color: THEME.blueBright, weight: 700 }
		]
	});
}

function star(cx: number, cy: number, r: number, color: string): string {
	const pts: string[] = [];
	for (let i = 0; i < 10; i++) {
		const a = (-90 + i * 36) * (Math.PI / 180);
		const rad = i % 2 === 0 ? r : r * 0.45;
		pts.push(`${(cx + rad * Math.cos(a)).toFixed(1)},${(cy + rad * Math.sin(a)).toFixed(1)}`);
	}
	return `<polygon points="${pts.join(" ")}" fill="${color}"/>`;
}
