import {
	action,
	SingletonAction,
	type WillAppearEvent,
	type WillDisappearEvent,
	type KeyDownEvent,
	type KeyUpEvent,
	type DidReceiveSettingsEvent,
} from "@elgato/streamdeck";
import { poller, type UsageState } from "../usage/poller";
import { onChange, resolveAccountToken, getEnabledProviders } from "../usage/token";
import { dayKey } from "../usage/history";
import {
	renderKey,
	renderDual,
	renderMessage,
	renderRollup,
	type KeyData,
	type RenderOpts,
	type HeatCell,
	type RollupCell,
} from "../render/svg";
import { STYLE_ORDER, type StyleName, type ThemeName, cycle } from "../render/themes";
import { BUILD, IS_COMBINED, PROVIDER_IDS, PROVIDER_SHORT, providerById } from "../providers/active";
import type { WindowData } from "../providers/types";

const OVERVIEW = "overview";
/** Sentinel provider id meaning "every switched-on provider on this one key". */
export const ALL = "__all__";
const PACKRAT_GREEN = "#2BE86A";

type UsageSettings = {
	provider?: string; // provider id, or ALL. Absent on single-provider builds.
	account?: string; // which named account this key shows; blank = default (first)
	window?: string;
	style?: StyleName;
	theme?: ThemeName;
	showRemaining?: boolean; // default off → show used %
	label?: string;
};

const LONG_PRESS_MS = 500;

/** Minimal shape we need from a Stream Deck action handle. */
type Keyish = { setImage(image: string): unknown };

/** A key's provider selection: the combined build defaults to the rollup, singles to their own provider. */
function selectedProvider(s: UsageSettings): string {
	return s.provider ?? (IS_COMBINED ? ALL : BUILD.id);
}

/** Providers the rollup should show: the user's picks, or all of them before they have chosen. */
function rollupTargets(): string[] {
	const enabled = getEnabledProviders().filter((id) => PROVIDER_IDS.includes(id));
	return enabled.length ? enabled : PROVIDER_IDS;
}

function windowCycleFor(providerId: string): string[] {
	return [...providerById(providerId).windows.filter((w) => w.cyclable).map((w) => w.key), OVERVIEW];
}

@action({ UUID: BUILD.actionUuid })
export class UsageAction extends SingletonAction<UsageSettings> {
	private readonly handles = new Map<string, Keyish>();
	private readonly settings = new Map<string, UsageSettings>();
	private readonly tokenOff = new Map<string, () => void>();
	private readonly pressAt = new Map<string, number>();
	/** Per key: the provider+token pairs it is subscribed to, and the newest state for each. */
	private readonly pairs = new Map<string, Array<[string, string]>>();
	private readonly states = new Map<string, Map<string, UsageState>>();
	private readonly pollOff = new Map<string, Array<() => void>>();
	private readonly sig = new Map<string, string>();

	override onWillAppear(ev: WillAppearEvent<UsageSettings>): void {
		const id = ev.action.id;
		this.handles.set(id, ev.action);
		this.settings.set(id, ev.payload.settings);
		this.tokenOff.get(id)?.();
		this.tokenOff.set(id, onChange(() => this.resolve(id)));
	}

	override onWillDisappear(ev: WillDisappearEvent<UsageSettings>): void {
		const id = ev.action.id;
		this.tokenOff.get(id)?.();
		for (const off of this.pollOff.get(id) ?? []) off();
		for (const m of [this.handles, this.settings, this.tokenOff, this.pressAt, this.pairs, this.states, this.pollOff, this.sig]) {
			m.delete(id);
		}
	}

	override onDidReceiveSettings(ev: DidReceiveSettingsEvent<UsageSettings>): void {
		const id = ev.action.id;
		this.settings.set(id, ev.payload.settings);
		this.resolve(id);
		this.render(id);
	}

	override onKeyDown(ev: KeyDownEvent<UsageSettings>): void {
		this.pressAt.set(ev.action.id, Date.now());
	}

	override onKeyUp(ev: KeyUpEvent<UsageSettings>): void {
		const id = ev.action.id;
		const dwell = Date.now() - (this.pressAt.get(id) ?? Date.now());
		const s: UsageSettings = { ...(this.settings.get(id) ?? ev.payload.settings) };
		const pid = selectedProvider(s);

		// The rollup already shows every provider at once, so there is no window to cycle
		// through and style-switching it would only make it harder to read. Press refreshes.
		if (pid !== ALL) {
			if (dwell >= LONG_PRESS_MS) {
				const cycleKeys = windowCycleFor(pid);
				const from = s.window && cycleKeys.includes(s.window) ? s.window : providerById(pid).defaultWindow;
				s.window = cycle(cycleKeys, from);
			} else {
				s.style = cycle(STYLE_ORDER, s.style ?? "ring");
			}
			this.settings.set(id, s);
			void ev.action.setSettings(s);
			this.render(id);
		}

		for (const [provider, token] of this.pairs.get(id) ?? []) poller.refresh(provider, token);
	}

	/** Point this key at the provider(s) and token(s) its settings now call for. */
	private resolve(id: string): void {
		const s = this.settings.get(id) ?? {};
		const pid = selectedProvider(s);
		const targets = pid === ALL ? rollupTargets() : [pid];
		// A rollup spans providers, so the per-key account choice does not apply to it.
		const pairs = targets.map((p) => [p, resolveAccountToken(p, pid === ALL ? undefined : s.account)] as [string, string]);

		const signature = pairs.map(([p, t]) => `${p}:${t}`).join("|");
		if (this.sig.get(id) === signature) return;
		this.sig.set(id, signature);

		for (const off of this.pollOff.get(id) ?? []) off();
		const states = new Map<string, UsageState>();
		this.states.set(id, states);
		this.pairs.set(id, pairs);
		this.pollOff.set(
			id,
			pairs.map(([provider, token]) =>
				poller.subscribe(provider, token, (state) => {
					states.set(provider, state);
					this.render(id);
				}),
			),
		);
	}

	private render(id: string): void {
		const handle = this.handles.get(id);
		if (!handle) return;
		const s = this.settings.get(id) ?? {};
		const opts: RenderOpts = {
			style: s.style ?? "ring",
			theme: s.theme ?? "oled",
			showRemaining: s.showRemaining ?? false,
		};
		void handle.setImage(this.image(id, s, opts));
	}

	private image(id: string, s: UsageSettings, opts: RenderOpts): string {
		const pid = selectedProvider(s);
		const states = this.states.get(id) ?? new Map<string, UsageState>();
		if (pid === ALL) return this.rollupImage(id, states, opts);

		const provider = providerById(pid);
		const theme = opts.theme;
		const msg = (title: string, lines: string[]): string => renderMessage(title, lines, theme, provider.brand);
		const state = states.get(pid);
		if (!state || state.status === "loading") return msg(provider.displayName, ["loading…"]);
		if (state.status === "no-token") return msg("Connect", ["paste session", "key in settings"]);
		if (state.status === "auth") return msg("Expired", ["re-paste your", "session key"]);
		if (!state.usage) {
			if (state.status === "rate-limited") return msg("Rate", ["limited,", "retrying"]);
			if (state.status === "blocked") return msg("Blocked", ["retrying…"]);
			return msg("Offline", ["retrying…"]);
		}

		const windows = state.usage.windows;
		const win = s.window ?? provider.defaultWindow;
		if (opts.style === "heatmap") return renderKey({ label: "", used: 0 }, opts, undefined, heatCells(state.daily));
		if (win === OVERVIEW) {
			return renderDual(toKey(windows[0]) ?? { label: "--", used: 0 }, toKey(windows[1]) ?? { label: "--", used: 0 }, opts);
		}

		const wd = windows.find((w) => w.key === win);
		if (!wd) {
			const def = provider.windows.find((w) => w.key === win);
			return msg(def?.label ?? win.toUpperCase(), def?.naLines ?? ["not", "available"]);
		}
		const kd = toKey(wd)!;
		if (s.label) kd.label = s.label.toUpperCase();

		let series: number[] | undefined;
		if (opts.style === "sparkline" && state.samples) {
			series = state.samples.map((sample) => sample[win]).filter((v): v is number => typeof v === "number");
		}
		return renderKey(kd, opts, series);
	}

	/**
	 * One provider going dark must not take the panel with it: a provider with no usable
	 * reading contributes a dimmed cell and every other provider keeps its number.
	 */
	private rollupImage(id: string, states: Map<string, UsageState>, opts: RenderOpts): string {
		const targets = (this.pairs.get(id) ?? []).map(([p]) => p);
		if (targets.length === 0) return renderMessage("Set up", ["pick your providers", "in settings"], opts.theme, PACKRAT_GREEN);

		const cells: RollupCell[] = targets.map((p) => {
			const primary = states.get(p)?.usage?.windows[0];
			return { label: PROVIDER_SHORT[p] ?? providerById(p).displayName.toUpperCase(), used: primary ? primary.utilization : null };
		});
		if (cells.every((c) => c.used === null)) {
			const anyLoading = targets.some((p) => (states.get(p)?.status ?? "loading") === "loading");
			return anyLoading
				? renderMessage("AI Usage", ["loading…"], opts.theme, PACKRAT_GREEN)
				: renderMessage("Connect", ["add your tokens", "in settings"], opts.theme, PACKRAT_GREEN);
		}
		return renderRollup(cells, opts);
	}
}

function toKey(w: WindowData | undefined): KeyData | null {
	return w ? { label: w.label, used: w.utilization, resetsAt: w.resetsAt, count: w.count, unlimited: w.unlimited } : null;
}

const WEEKDAY = ["S", "M", "T", "W", "T", "F", "S"];
function heatCells(daily?: Record<string, number>): HeatCell[] {
	const out: HeatCell[] = [];
	for (let i = 6; i >= 0; i--) {
		const t = Date.now() - i * 86_400_000;
		out.push({ letter: WEEKDAY[new Date(t).getDay()], v: daily?.[dayKey(t)] ?? null });
	}
	return out;
}
