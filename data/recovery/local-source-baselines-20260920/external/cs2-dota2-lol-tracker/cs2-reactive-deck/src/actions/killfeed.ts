import { action, type KeyAction, type KeyDownEvent } from "@elgato/streamdeck";
import { ReactiveAction } from "../lib/reactive-action";
import { keyImage } from "../lib/svg";
import { THEME } from "../lib/theme";
import { matchStats, roundHsKills } from "../lib/cs2";
import type { GsiPayload } from "../lib/gsi-server";

type Settings = {
	flashColor?: string;
};

/** Consecutive kills within this window build a multi-kill streak (DOUBLE/TRIPLE/...). */
const STREAK_WINDOW_MS = 4500;

/**
 * Kill Feed — shows your **match** kills (so they don't reset when you respawn in deathmatch),
 * flashes on every kill, announces multi-kill streaks (DOUBLE → ACE) and headshots, and throws a
 * gold ACE celebration. Press to reset the displayed count to zero.
 */
@action({ UUID: "com.ratpack.cs2reactivedeck.killfeed" })
export class KillFeed extends ReactiveAction<Settings> {
	// Player-wide truth (shared across instances).
	private prevKills = 0;
	private prevDeaths = 0;
	private prevHs = 0;
	private streak = 0;
	private lastKillAt = 0;

	// Per-instance.
	private readonly baseline = new Map<string, number>();
	private readonly flashUntil = new Map<string, number>();
	private readonly flashTimers = new Map<string, ReturnType<typeof setTimeout>>();
	private readonly flashImg = new Map<string, string>();

	protected draw(act: KeyAction<Settings>, s: Settings, p: GsiPayload | null): void {
		const flashColor = s.flashColor || THEME.greenBright;
		const ms = matchStats(p);
		if (!ms) {
			act.setImage(idle());
			return;
		}
		const kills = ms.kills;
		const hs = roundHsKills(p);

		// Death breaks the current streak.
		if (ms.deaths > this.prevDeaths) {
			this.streak = 0;
			this.lastKillAt = 0;
		}

		// New kill(s): update streak by time window, detect headshot, flash everyone.
		if (kills > this.prevKills) {
			const now = Date.now();
			this.streak = now - this.lastKillAt < STREAK_WINDOW_MS ? this.streak + 1 : 1;
			this.lastKillAt = now;
			const headshot = hs > this.prevHs;
			for (const a of this.actions) if (a.isKey()) this.flash(a, kills, this.streak, headshot, flashColor);
		}

		this.prevKills = kills;
		this.prevDeaths = ms.deaths;
		this.prevHs = hs;

		// Keep the flash frame up while active.
		if ((this.flashUntil.get(act.id) ?? 0) > Date.now()) {
			const img = this.flashImg.get(act.id);
			if (img) {
				act.setImage(img);
				return;
			}
		}
		act.setImage(normal(Math.max(0, kills - (this.baseline.get(act.id) ?? 0))));
	}

	override onKeyDown(ev: KeyDownEvent<Settings>): void {
		this.baseline.set(ev.action.id, this.prevKills);
		if (ev.action.isKey()) ev.action.setImage(normal(0));
	}

	private flash(act: KeyAction<Settings>, kills: number, streak: number, headshot: boolean, color: string): void {
		const shown = Math.max(0, kills - (this.baseline.get(act.id) ?? 0));
		const ace = streak >= 5;
		const img = ace ? aceFrame(shown) : flashFrame(shown, color, label(streak, headshot), streak >= 2, headshot);
		this.flashImg.set(act.id, img);
		this.flashUntil.set(act.id, Date.now() + (ace ? 3000 : 1800));
		act.setImage(img);

		clearTimeout(this.flashTimers.get(act.id));
		this.flashTimers.set(
			act.id,
			setTimeout(() => {
				this.flashUntil.delete(act.id);
				this.flashImg.delete(act.id);
				act.setImage(normal(Math.max(0, this.prevKills - (this.baseline.get(act.id) ?? 0))));
			}, ace ? 3000 : 1800)
		);
	}

	protected override onGone(id: string): void {
		clearTimeout(this.flashTimers.get(id));
		this.flashTimers.delete(id);
		this.flashUntil.delete(id);
		this.flashImg.delete(id);
	}
}

function label(streak: number, headshot: boolean): string {
	if (streak >= 4) return "QUAD!";
	if (streak === 3) return "TRIPLE";
	if (streak === 2) return "DOUBLE";
	return headshot ? "HEADSHOT" : "KILL!";
}

function normal(kills: number): string {
	return keyImage({
		bg: THEME.bg,
		bg2: "#000000",
		raw: `<rect x="16" y="18" width="112" height="58" rx="12" fill="${THEME.green}" opacity="0.12"/>`,
		lines: [
			{ text: String(kills), y: 70, size: 60, color: "#ffffff", weight: 800 },
			{ text: "KILLS", y: 116, size: 20, color: THEME.green, weight: 700, spacing: 3 }
		]
	});
}

function flashFrame(kills: number, color: string, tier: string, big: boolean, headshot: boolean): string {
	const hsMark = headshot
		? `<circle cx="118" cy="26" r="13" fill="none" stroke="${color}" stroke-width="2.5"/>` +
			`<line x1="118" y1="15" x2="118" y2="22" stroke="${color}" stroke-width="2.5"/>` +
			`<line x1="118" y1="30" x2="118" y2="37" stroke="${color}" stroke-width="2.5"/>` +
			`<line x1="107" y1="26" x2="114" y2="26" stroke="${color}" stroke-width="2.5"/>` +
			`<line x1="122" y1="26" x2="129" y2="26" stroke="${color}" stroke-width="2.5"/>`
		: "";
	return keyImage({
		bg: "#0a2a16",
		bg2: "#06160c",
		glow: color,
		raw: `<rect x="10" y="10" width="124" height="80" rx="14" fill="${color}" opacity="0.30"/>${hsMark}`,
		lines: [
			{ text: String(kills), y: 70, size: 58, color: "#ffffff", weight: 800 },
			{ text: tier, y: 118, size: big || tier.length > 5 ? 24 : 22, color, weight: 800, spacing: big ? 1 : 2 }
		]
	});
}

/** The big one — a gold full-key ACE celebration. */
function aceFrame(kills: number): string {
	const rays = Array.from({ length: 12 }, (_, i) => {
		const a = (i * 30) * (Math.PI / 180);
		const x1 = 72 + 18 * Math.cos(a), y1 = 50 + 18 * Math.sin(a);
		const x2 = 72 + 70 * Math.cos(a), y2 = 50 + 70 * Math.sin(a);
		return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${THEME.yellow}" stroke-width="3" opacity="0.55"/>`;
	}).join("");
	return keyImage({
		bg: "#3a2c05",
		bg2: "#171005",
		glow: THEME.yellow,
		raw: rays,
		lines: [
			{ text: "ACE", y: 64, size: 50, color: "#ffffff", weight: 800, spacing: 2 },
			{ text: `${kills} KILLS`, y: 112, size: 22, color: THEME.yellow, weight: 800, spacing: 2 }
		]
	});
}

function idle(): string {
	return keyImage({
		bg: THEME.bg,
		bg2: "#000000",
		border: "#23262d",
		lines: [
			{ text: "0", y: 70, size: 48, color: THEME.grey, weight: 800 },
			{ text: "WAITING…", y: 112, size: 16, color: THEME.grey, weight: 700, spacing: 1 }
		]
	});
}
