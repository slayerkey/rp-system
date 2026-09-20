import { action, type KeyAction, type KeyDownEvent } from "@elgato/streamdeck";
import { ReactiveAction } from "../lib/reactive-action";
import { keyImage, Pulse, type Imageable } from "../lib/svg";
import { THEME } from "../lib/theme";
import { roundPhase, type Phase } from "../lib/cs2";
import { gsi, type GsiPayload } from "../lib/gsi-server";

type Settings = {
	freezeColor?: string;
	liveColor?: string;
	bombColor?: string;
	overColor?: string;
};

const PREVIEW: Phase[] = ["freezetime", "live", "bomb", "over"];

/**
 * Round Phase — colour + label per phase: freezetime = blue, live = green,
 * bomb planted = pulsing orange, round over = grey. When no game is connected,
 * pressing the key cycles a preview of each phase.
 */
@action({ UUID: "com.ratpack.cs2reactivedeck.phase" })
export class RoundPhase extends ReactiveAction<Settings> {
	private readonly pulses = new Map<string, Pulse>();
	private readonly previewIdx = new Map<string, number>();

	protected draw(act: KeyAction<Settings>, s: Settings, p: GsiPayload | null): void {
		if (!gsi.isConnected()) {
			this.renderPhase(act, s, PREVIEW[this.previewIdx.get(act.id) ?? 0], true);
			return;
		}
		this.previewIdx.delete(act.id);
		this.renderPhase(act, s, roundPhase(p), false);
	}

	override onKeyDown(ev: KeyDownEvent<Settings>): void {
		if (gsi.isConnected() || !ev.action.isKey()) return;
		const next = ((this.previewIdx.get(ev.action.id) ?? 0) + 1) % PREVIEW.length;
		this.previewIdx.set(ev.action.id, next);
		this.renderPhase(ev.action, ev.payload.settings, PREVIEW[next], true);
	}

	private renderPhase(act: KeyAction<Settings>, s: Settings, phase: Phase, preview: boolean): void {
		const colors: Record<Phase, string> = {
			freezetime: s.freezeColor || THEME.blue,
			live: s.liveColor || THEME.green,
			bomb: s.bombColor || THEME.orangeBright,
			over: s.overColor || THEME.grey,
			unknown: THEME.grey
		};
		const color = colors[phase];

		if (phase === "bomb") {
			this.runPulse(act, [phaseFrame(phase, color, preview, 0.34), phaseFrame(phase, color, preview, 0.1)]);
			return;
		}
		this.stopPulse(act.id);
		act.setImage(phaseFrame(phase, color, preview, 0.16));
	}

	private runPulse(act: KeyAction<Settings>, frames: string[]): void {
		this.stopPulse(act.id);
		const pulse = new Pulse(() => this.visible(act.id), frames, 420);
		this.pulses.set(act.id, pulse);
		pulse.start();
	}

	private stopPulse(id: string): void {
		this.pulses.get(id)?.stop();
		this.pulses.delete(id);
	}

	private *visible(id: string): Generator<Imageable> {
		for (const a of this.actions) if (a.id === id && a.isKey()) yield a;
	}

	protected override onGone(id: string): void {
		this.stopPulse(id);
		this.previewIdx.delete(id);
	}
}

const LABELS: Record<Phase, { big: string; small: string; icon: string }> = {
	freezetime: { big: "FREEZE", small: "BUY", icon: "❄" },
	live: { big: "LIVE", small: "ROUND", icon: "▶" },
	bomb: { big: "BOMB", small: "PLANTED", icon: "✸" },
	over: { big: "OVER", small: "ROUND", icon: "■" },
	unknown: { big: "—", small: "WAITING", icon: "•" }
};

function phaseFrame(phase: Phase, color: string, preview: boolean, fill: number): string {
	const l = LABELS[phase];
	return keyImage({
		bg: THEME.bg,
		bg2: "#000000",
		glow: phase === "bomb" ? color : undefined,
		border: phase === "bomb" ? undefined : color,
		borderWidth: 3,
		raw: `<rect x="14" y="14" width="116" height="56" rx="12" fill="${color}" opacity="${fill}"/>` +
			`<text x="72" y="56" text-anchor="middle" font-size="34" fill="${color}">${l.icon}</text>`,
		lines: [
			{ text: l.big, y: 100, size: 30, color: "#ffffff", weight: 800, spacing: 1 },
			{ text: preview ? "PREVIEW" : l.small, y: 126, size: 15, color, weight: 700, spacing: 2 }
		]
	});
}
