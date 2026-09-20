import {
	action,
	type DidReceiveSettingsEvent,
	type KeyDownEvent,
	type SendToPluginEvent,
	SingletonAction,
	type WillAppearEvent
} from "@elgato/streamdeck";
import type { JsonValue } from "@elgato/utils";

import { handlePiProbe } from "../pi";
import { getConfig, patchConfig } from "../scheduler";
import { resolveList } from "../screensaver";

type CycleSettings = {
	paths?: string[];
	intervalMin?: number;
	folder?: string;
};

/**
 * Toggle background cycling: press on to rotate the active screensaver through the
 * chosen list every N minutes, press again to stop. The rotation itself lives in the
 * global scheduler (scheduler.ts), so it keeps running no matter which Stream Deck page
 * is showing. This button only carries the on/off state and writes the cycle config.
 *
 * DisableAutomaticStates in the manifest keeps Stream Deck from advancing the icon on
 * its own; the icon is always derived from the real enabled flag so it can't lie.
 */
@action({ UUID: "com.packrat.screensavercycler.cycle" })
export class CycleScreensavers extends SingletonAction<CycleSettings> {
	override async onWillAppear(ev: WillAppearEvent<CycleSettings>): Promise<void> {
		const cfg = await getConfig();
		if (ev.action.isKey()) await ev.action.setState(cfg.cycle?.enabled ? 1 : 0);
	}

	override async onKeyDown(ev: KeyDownEvent<CycleSettings>): Promise<void> {
		if (process.platform !== "win32") {
			await ev.action.showAlert();
			return;
		}

		const s = ev.payload.settings;
		const paths = resolveList(s.paths, s.folder);
		const enabled = !(await getConfig()).cycle?.enabled;

		if (enabled && paths.length === 0) {
			await ev.action.showAlert();
			return;
		}

		await patchConfig({ cycle: { enabled, intervalMin: s.intervalMin ?? 5, paths } });
		if (ev.action.isKey()) await ev.action.setState(enabled ? 1 : 0);
		await ev.action.showOk();
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<CycleSettings>): Promise<void> {
		// Keep the live cycle in sync when the user edits interval or list while it's on.
		const cfg = await getConfig();
		if (!cfg.cycle?.enabled) return;
		const s = ev.payload.settings;
		await patchConfig({ cycle: { enabled: true, intervalMin: s.intervalMin ?? 5, paths: resolveList(s.paths, s.folder) } });
	}

	override onSendToPlugin(ev: SendToPluginEvent<JsonValue, CycleSettings>): Promise<void> {
		return handlePiProbe(ev.payload);
	}
}
