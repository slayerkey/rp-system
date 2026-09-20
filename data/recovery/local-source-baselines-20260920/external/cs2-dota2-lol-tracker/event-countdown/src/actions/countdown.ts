import {
	action,
	SingletonAction,
	type KeyAction,
	type WillAppearEvent,
	type WillDisappearEvent,
	type DidReceiveSettingsEvent
} from "@elgato/streamdeck";
import { key, toImage, esc } from "../lib/svg";
import { THEME, breakdown, type Fmt } from "../lib/theme";
import { hourglass } from "../lib/hourglass";
import { resolveTarget, isAnnual, PRESET_NAMES, type PresetId } from "../lib/presets";

type Settings = {
	preset?: PresetId;
	eventName?: string;
	dateStr?: string; // custom date "MM/DD/YYYY"
	timeStr?: string; // custom time "3:00 PM"
	birthday?: string; // "MM/DD"
	format?: Fmt;
	spanMs?: number; // persisted for custom dates so the glass starts full
	targetIso?: string;
};

const WARN_MS = 24 * 3600 * 1000;
const URGENT_MS = 3600 * 1000;
const CELEBRATE_MS = 24 * 3600 * 1000;
const YEAR_MS = 365.25 * 24 * 3600 * 1000;

/**
 * Countdown — one independent countdown per key. A real hourglass drains from full to empty as the
 * event approaches (the top bulb is the time left; sand falls through the neck). Colour escalates
 * violet → amber (<24h) → pulsing red (<1h), then celebrates for 24h, then idles.
 */
@action({ UUID: "com.ratpack.eventcountdown.countdown" })
export class Countdown extends SingletonAction<Settings> {
	private tick?: ReturnType<typeof setInterval>;
	private readonly settings = new Map<string, Settings>();
	private readonly lastSig = new Map<string, string>();

	override onWillAppear(ev: WillAppearEvent<Settings>): void {
		this.settings.set(ev.action.id, ev.payload.settings);
		this.lastSig.delete(ev.action.id);
		if (ev.action.isKey()) void this.render(ev.action);
		this.ensureTick();
	}

	override onWillDisappear(ev: WillDisappearEvent<Settings>): void {
		this.settings.delete(ev.action.id);
		this.lastSig.delete(ev.action.id);
		if (this.actions[Symbol.iterator]().next().done) {
			clearInterval(this.tick);
			this.tick = undefined;
		}
	}

	override onDidReceiveSettings(ev: DidReceiveSettingsEvent<Settings>): void {
		this.settings.set(ev.action.id, ev.payload.settings);
		this.lastSig.delete(ev.action.id);
		if (ev.action.isKey()) void this.render(ev.action);
	}

	private ensureTick(): void {
		if (this.tick) return;
		this.tick = setInterval(() => {
			for (const a of this.actions) if (a.isKey()) void this.render(a);
		}, 500);
	}

	private async render(act: KeyAction<Settings>): Promise<void> {
		const s = this.settings.get(act.id) ?? {};
		const preset: PresetId = s.preset || "christmas";
		const occ = OCCASION[preset] ?? OCCASION.custom;
		const name = (s.eventName || PRESET_NAMES[preset]).toUpperCase().slice(0, 16);
		const fmt: Fmt = s.format || "d";
		const targetMs = resolveTarget(preset, { dateStr: s.dateStr, timeStr: s.timeStr, birthday: s.birthday });
		const anim = Math.floor(Date.now() / 500);

		let sig: string;
		let image: string;

		if (!Number.isFinite(targetMs)) {
			sig = "idle";
			image = idle();
		} else {
			const remaining = targetMs - Date.now();
			const span = isAnnual(preset) ? YEAR_MS : this.customSpan(act, s, remaining, targetMs);
			const frac = Math.max(0, Math.min(1, remaining / span));

			if (remaining > 0) {
				const { big, unit } = display(breakdown(remaining), fmt);
				if (remaining < URGENT_MS) {
					const on = anim % 2 === 0;
					sig = `u:${big}:${unit}:${on}`;
					image = frame(name, preset, occ, big, unit, "urgent", frac, anim, on);
				} else {
					const phase = remaining < WARN_MS ? "warn" : "normal";
					sig = `${phase}:${big}:${unit}:${frac.toFixed(3)}`;
					image = frame(name, preset, occ, big, unit, phase, frac, anim, false);
				}
			} else if (-remaining < CELEBRATE_MS) {
				sig = `celebrate:${anim % 8}`;
				image = fireworks(name, preset, occ, anim);
			} else {
				sig = "done";
				image = idle();
			}
		}

		if (this.lastSig.get(act.id) === sig) return;
		this.lastSig.set(act.id, sig);
		void act.setImage(image);
	}

	/** For custom dates, remember the span on first sight so the glass starts full. */
	private customSpan(act: KeyAction<Settings>, s: Settings, remaining: number, targetMs: number): number {
		const tIso = new Date(targetMs).toISOString();
		if (s.targetIso !== tIso || !s.spanMs) {
			s.spanMs = Math.max(remaining, 60_000);
			s.targetIso = tIso;
			this.settings.set(act.id, s);
			void act.setSettings(s);
		}
		return s.spanMs;
	}
}

type OccTheme = { accent: string; accent2: string };

/** Per-occasion colour identity so each countdown feels like its holiday. */
const OCCASION: Record<PresetId, OccTheme> = {
	christmas: { accent: "#e8413c", accent2: "#3fbf6f" },
	newyear: { accent: "#ffd86b", accent2: "#c79bff" },
	nye: { accent: "#ffd86b", accent2: "#c79bff" },
	valentines: { accent: "#ff5d8f", accent2: "#ff9ec4" },
	halloween: { accent: "#ff8a2b", accent2: "#a974ff" },
	july4: { accent: "#ff5a5a", accent2: "#5b9bff" },
	thanksgiving: { accent: "#e0883c", accent2: "#b5632a" },
	mothersday: { accent: "#ff7eb3", accent2: "#ffd86b" },
	fathersday: { accent: "#5b9bff", accent2: "#7da9ff" },
	birthday: { accent: "#ffd86b", accent2: "#ff7eb3" },
	custom: { accent: THEME.violetBright, accent2: THEME.violet }
};

/** A small themed glyph drawn above the occasion name (no emoji — these render reliably on the deck). */
function occasionGlyph(preset: PresetId, cx: number, cy: number, accent: string): string {
	switch (preset) {
		case "christmas":
			return (
				`<polygon points="${cx},${cy - 9} ${cx - 6},${cy - 1} ${cx + 6},${cy - 1}" fill="#3fbf6f"/>` +
				`<polygon points="${cx},${cy - 4} ${cx - 8},${cy + 6} ${cx + 8},${cy + 6}" fill="#3fbf6f"/>` +
				`<rect x="${cx - 1.5}" y="${cy + 6}" width="3" height="3" fill="#8a5a2b"/>` +
				`<circle cx="${cx}" cy="${cy - 9}" r="1.8" fill="#ffd86b"/>`
			);
		case "valentines":
		case "mothersday":
			return (
				`<circle cx="${cx - 4}" cy="${cy - 2}" r="4" fill="${accent}"/>` +
				`<circle cx="${cx + 4}" cy="${cy - 2}" r="4" fill="${accent}"/>` +
				`<polygon points="${cx - 7.5},${cy - 1} ${cx + 7.5},${cy - 1} ${cx},${cy + 8}" fill="${accent}"/>`
			);
		case "halloween":
			return (
				`<ellipse cx="${cx}" cy="${cy + 1}" rx="9" ry="7" fill="#ff8a2b"/>` +
				`<rect x="${cx - 1.5}" y="${cy - 8}" width="3" height="4" fill="#3fbf6f"/>` +
				`<polygon points="${cx - 5},${cy - 1} ${cx - 2},${cy - 1} ${cx - 3.5},${cy + 2}" fill="#1a0a00"/>` +
				`<polygon points="${cx + 5},${cy - 1} ${cx + 2},${cy - 1} ${cx + 3.5},${cy + 2}" fill="#1a0a00"/>` +
				`<polygon points="${cx - 3},${cy + 3} ${cx + 3},${cy + 3} ${cx},${cy + 6}" fill="#1a0a00"/>`
			);
		case "birthday":
			return (
				`<rect x="${cx - 8}" y="${cy}" width="16" height="8" rx="2" fill="${accent}"/>` +
				`<rect x="${cx - 1}" y="${cy - 6}" width="2" height="6" fill="#ffe6a0"/>` +
				`<circle cx="${cx}" cy="${cy - 7}" r="2" fill="#ff8a2b"/>`
			);
		case "thanksgiving":
			return `<ellipse cx="${cx}" cy="${cy}" rx="5" ry="9" transform="rotate(45 ${cx} ${cy})" fill="${accent}"/><line x1="${cx}" y1="${cy - 6}" x2="${cx}" y2="${cy + 7}" stroke="#5a3a1a" stroke-width="1"/>`;
		case "fathersday":
			return `<polygon points="${cx - 3},${cy - 8} ${cx + 3},${cy - 8} ${cx + 2},${cy - 4} ${cx - 2},${cy - 4}" fill="${accent}"/><polygon points="${cx - 2},${cy - 4} ${cx + 2},${cy - 4} ${cx + 4},${cy + 6} ${cx},${cy + 9} ${cx - 4},${cy + 6}" fill="${accent}"/>`;
		case "newyear":
		case "nye":
		case "july4":
			return starPath(cx, cy, 9, accent);
		default:
			return "";
	}
}

/** Pick the headline number + unit word. Default ("d") shows days, switching to hours within a
 *  day and minutes within an hour. "dh"/"dhm" pack more into the headline. */
function display(r: { d: number; h: number; m: number; s: number }, fmt: Fmt): { big: string; unit: string } {
	if (fmt === "d") {
		if (r.d >= 1) return { big: `${r.d}`, unit: r.d === 1 ? "DAY" : "DAYS" };
		if (r.h >= 1) return { big: `${r.h}`, unit: r.h === 1 ? "HOUR" : "HOURS" };
		if (r.m >= 1) return { big: `${r.m}`, unit: r.m === 1 ? "MIN" : "MINS" };
		return { big: `${r.s}`, unit: "SEC" };
	}
	if (fmt === "dh") {
		if (r.d >= 1) return { big: `${r.d}d ${r.h}h`, unit: "" };
		if (r.h >= 1) return { big: `${r.h}h ${r.m}m`, unit: "" };
		return { big: `${r.m}m ${String(r.s).padStart(2, "0")}s`, unit: "" };
	}
	// dhm
	if (r.d >= 1) return { big: `${r.d}d`, unit: `${r.h}h ${r.m}m` };
	if (r.h >= 1) return { big: `${r.h}h ${r.m}m`, unit: `${r.s}s` };
	return { big: `${r.m}m ${String(r.s).padStart(2, "0")}s`, unit: "" };
}

/** Largest font size (within bounds) that keeps `text` inside `width` px. */
function fitSize(text: string, max: number, min: number, width: number): number {
	for (let s = max; s > min; s--) if (0.6 * s * text.length <= width) return s;
	return min;
}

/**
 * Centred occasion + big number. A faint background "drains" (unfills) as the event nears, and a
 * small even-ratio hourglass sits bottom-right as the motif. Day/occasion stay front-and-centre.
 */
function frame(name: string, preset: PresetId, occ: OccTheme, big: string, unit: string, phase: "normal" | "warn" | "urgent", frac: number, anim: number, pulseOn: boolean): string {
	// Keep the occasion's colour through normal + warn; only the final hour goes universal red.
	const accent = phase === "urgent" ? THEME.red : occ.accent;
	const bg = phase === "urgent" ? (pulseOn ? "#2a0e0c" : "#140a14") : phase === "warn" ? "#181014" : THEME.bg;
	const drainOp = phase === "warn" ? 0.24 : 0.16;
	void anim;

	// Background drain: full when far, empty when near (clipped to the rounded key).
	const fillTop = 144 * (1 - frac);
	const drain =
		`<defs><clipPath id="r"><rect width="144" height="144" rx="18"/></clipPath></defs>` +
		`<g clip-path="url(#r)">` +
		`<rect x="0" y="${fillTop.toFixed(1)}" width="144" height="${(144 - fillTop).toFixed(1)}" fill="${accent}" opacity="${drainOp}"/>` +
		`<rect x="0" y="${fillTop.toFixed(1)}" width="144" height="2" fill="${accent}" opacity="0.75"/>` +
		`</g>`;

	const glyph = occasionGlyph(preset, 72, 16, accent);
	const nameY = preset === "custom" ? 34 : 42;
	const nameSize = fitSize(name, 16, 10, 132);
	const bigSize = big.length <= 2 ? 60 : big.length === 3 ? 52 : big.length <= 5 ? 38 : 30;
	const text =
		glyph +
		`<text x="72" y="${nameY}" text-anchor="middle" font-family="'Segoe UI',Arial,sans-serif" font-size="${nameSize}" font-weight="800" fill="${accent}" letter-spacing="0.5">${esc(name)}</text>` +
		`<text x="72" y="100" text-anchor="middle" font-family="'Segoe UI',Arial,sans-serif" font-size="${bigSize}" font-weight="800" fill="#ffffff">${esc(big)}</text>` +
		(unit ? `<text x="72" y="126" text-anchor="middle" font-family="'Segoe UI',Arial,sans-serif" font-size="16" font-weight="700" fill="${accent}" letter-spacing="1">${esc(unit)}</text>` : "");

	return toImage(
		key({
			bg,
			bg2: "#08050f",
			glow: phase === "urgent" && pulseOn ? THEME.red : undefined,
			border: phase === "warn" ? accent : undefined,
			borderWidth: 2,
			raw: drain + text,
			lines: []
		})
	);
}

/** Animated fireworks for the day-of celebration, in the occasion's colours. Driven by `anim`. */
function fireworks(name: string, preset: PresetId, occ: OccTheme, anim: number): string {
	const colors = [occ.accent, occ.accent2, "#ffffff", THEME.gold];
	const bursts: Array<[number, number]> = [
		[40, 40],
		[104, 34],
		[72, 60]
	];
	const period = 7;
	let raw = "";
	bursts.forEach((b, bi) => {
		const phase = (anim + bi * 3) % period;
		const t = phase / period;
		const R = 8 + t * 30;
		const op = (1 - t).toFixed(2);
		const col = colors[(bi + Math.floor((anim + bi * 3) / period)) % colors.length];
		const N = 11;
		for (let i = 0; i < N; i++) {
			const a = (i / N) * 2 * Math.PI;
			const x2 = b[0] + R * Math.cos(a);
			const y2 = b[1] + R * Math.sin(a);
			raw += `<line x1="${b[0]}" y1="${b[1]}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${col}" stroke-width="2" opacity="${op}" stroke-linecap="round"/>`;
			raw += `<circle cx="${x2.toFixed(1)}" cy="${y2.toFixed(1)}" r="1.7" fill="${col}" opacity="${op}"/>`;
		}
	});
	raw += occasionGlyph(preset, 72, 92, occ.accent);
	const nameSize = fitSize(name, 16, 10, 132);
	return toImage(
		key({
			bg: "#0c0820",
			bg2: "#06040f",
			glow: occ.accent,
			raw,
			lines: [
				{ text: name, y: 116, size: nameSize, color: occ.accent, weight: 800, spacing: 1 },
				{ text: "IT'S HERE!", y: 138, size: 16, color: THEME.gold, weight: 800, spacing: 1 }
			]
		})
	);
}

function idle(): string {
	const hg = hourglass({ cx: 72, top: 28, bottom: 104, halfWidth: 22, frac: 0.5, phase: 0, frame: "#6a5d86", sand: THEME.violet });
	return toImage(
		key({
			bg: THEME.bg,
			bg2: "#08050f",
			border: "#241a36",
			raw: hg,
			lines: [
				{ text: "PICK A DATE", y: 122, size: 14, color: THEME.textDim, weight: 700, spacing: 1 },
				{ text: "in settings", y: 138, size: 11, color: THEME.grey, weight: 600 }
			]
		})
	);
}

function starPath(cx: number, cy: number, r: number, color: string): string {
	const pts: string[] = [];
	for (let i = 0; i < 10; i++) {
		const a = (-90 + i * 36) * (Math.PI / 180);
		const rad = i % 2 === 0 ? r : r * 0.45;
		pts.push(`${(cx + rad * Math.cos(a)).toFixed(1)},${(cy + rad * Math.sin(a)).toFixed(1)}`);
	}
	return `<polygon points="${pts.join(" ")}" fill="${color}"/>`;
}
