import {
	action,
	type KeyDownEvent,
	type SendToPluginEvent,
	SingletonAction,
	type WillAppearEvent
} from "@elgato/streamdeck";
import type { JsonValue } from "@elgato/utils";

import { handlePiProbe } from "../pi";
import { advanceIndex, preview, resolveList, setActive } from "../screensaver";

type NextSettings = {
	paths?: string[];
	index?: number;
	preview?: boolean;
	folder?: string;
};

/**
 * One press = show the next screensaver. Sets it as the active one (so it also sticks
 * for the next idle) and, unless the user turned it off, launches it full-screen right
 * now so the press does something visible instead of waiting out an idle timer.
 *
 * With nothing configured it cycles every system screensaver, so the button works the
 * moment it is dropped on the deck.
 */
@action({ UUID: "com.packrat.screensavercycler.next" })
export class NextScreensaver extends SingletonAction<NextSettings> {
	override onWillAppear(ev: WillAppearEvent<NextSettings>): Promise<void> | void {
		if (ev.action.isKey()) return ev.action.setTitle("");
	}

	override async onKeyDown(ev: KeyDownEvent<NextSettings>): Promise<void> {
		if (process.platform !== "win32") {
			await ev.action.showAlert();
			return;
		}

		const s = ev.payload.settings;
		const paths = resolveList(s.paths, s.folder);
		if (paths.length === 0) {
			await ev.action.showAlert();
			return;
		}

		const index = advanceIndex(paths.length, s.index);
		try {
			setActive(paths[index]);
			if (s.preview !== false) preview(paths[index]);
			await ev.action.setSettings({ ...s, index });
			await ev.action.showOk();
		} catch (error) {
			await ev.action.showAlert();
			throw error;
		}
	}

	override onSendToPlugin(ev: SendToPluginEvent<JsonValue, NextSettings>): Promise<void> {
		return handlePiProbe(ev.payload);
	}
}
