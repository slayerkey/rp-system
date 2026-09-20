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
import { getConfig, patchConfig, type ScheduleRule } from "../scheduler";

type ScheduleSettings = {
	rules?: ScheduleRule[];
	folder?: string;
};

/**
 * Toggle time-of-day scheduling: press on to have the global scheduler switch the active
 * screensaver whenever the clock hits one of the configured times, press again to stop.
 * Like the cycle button, the actual work lives in scheduler.ts so a time can fire even
 * while a different Stream Deck page is showing; this key only holds on/off + the rules.
 */
@action({ UUID: "com.packrat.screensavercycler.schedule" })
export class ScheduleScreensaver extends SingletonAction<ScheduleSettings> {
	override async onWillAppear(ev: WillAppearEvent<ScheduleSettings>): Promise<void> {
		const cfg = await getConfig();
		if (ev.action.isKey()) await ev.action.setState(cfg.schedule?.enabled ? 1 : 0);
	}

	override async onKeyDown(ev: KeyDownEvent<ScheduleSettings>): Promise<void> {
		if (process.platform !== "win32") {
			await ev.action.showAlert();
			return;
		}

		const rules = cleanRules(ev.payload.settings.rules);
		const enabled = !(await getConfig()).schedule?.enabled;

		if (enabled && rules.length === 0) {
			await ev.action.showAlert();
			return;
		}

		await patchConfig({ schedule: { enabled, rules } });
		if (ev.action.isKey()) await ev.action.setState(enabled ? 1 : 0);
		await ev.action.showOk();
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<ScheduleSettings>): Promise<void> {
		const cfg = await getConfig();
		if (!cfg.schedule?.enabled) return;
		await patchConfig({ schedule: { enabled: true, rules: cleanRules(ev.payload.settings.rules) } });
	}

	override onSendToPlugin(ev: SendToPluginEvent<JsonValue, ScheduleSettings>): Promise<void> {
		return handlePiProbe(ev.payload);
	}
}

/** Drop half-filled rows so the scheduler never tries to apply an empty rule. */
function cleanRules(rules: ScheduleRule[] | undefined): ScheduleRule[] {
	return (rules ?? []).filter((r) => /^\d{2}:\d{2}$/.test(r?.time ?? "") && !!r?.path);
}
