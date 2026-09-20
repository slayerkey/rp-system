import streamDeck from "@elgato/streamdeck";

import { ClickMouse } from "./actions/click-mouse";
import { HoldKey } from "./actions/hold-key";
import { ToggleKey } from "./actions/toggle-key";
import { ToggleMouse } from "./actions/toggle-mouse";
import { installSafetyNets, recover, releaseAll } from "./held-keys";
import { assertLayout, ensureAccessibilityPermission, inputSize } from "./input";

streamDeck.logger.setLevel("trace");

// Fail loudly if the native layer doesn't work rather than quietly corrupting the
// input stream. Logged explicitly because "did the native layer load?" is the first
// question worth answering in any support report.
assertLayout();
streamDeck.logger.info(`Native input layer ready (node ${process.version}, ${process.platform}, diag size ${inputSize()} bytes).`);

if (process.platform === "darwin") {
	const trusted = await ensureAccessibilityPermission();
	if (!trusted) {
		streamDeck.logger.warn(
			"Accessibility permission not granted yet. Key and mouse actions will not reach other apps " +
				"until you enable Stream Deck in System Settings > Privacy & Security > Accessibility."
		);
	}
}

// A previous run may have died holding keys down; the OS will not have released them.
const recovered = recover();
if (recovered > 0) {
	streamDeck.logger.warn(`Released ${recovered} key(s) left held by a previous run.`);
}

installSafetyNets();
streamDeck.system.onSystemDidWakeUp(() => releaseAll());

streamDeck.actions.registerAction(new HoldKey());
streamDeck.actions.registerAction(new ToggleKey());
streamDeck.actions.registerAction(new ClickMouse());
streamDeck.actions.registerAction(new ToggleMouse());

streamDeck.connect();
