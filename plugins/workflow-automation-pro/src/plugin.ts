import streamDeck, { action } from "@elgato/streamdeck";

import { RunSequenceBase } from "../../_wf/src/actions/run";
import { assertLayout } from "../../_wf/src/input";

/**
 * Paid tier: every free step type plus conditions and web requests, up to twenty five steps.
 *
 * Its own UUID namespace, action namespace and settings, following the precedent
 * better-hotkeys-pro set, so both tiers can be installed at once without colliding.
 */
@action({ UUID: "com.packrat.workflowpro.run" })
class RunSequence extends RunSequenceBase {
	constructor() {
		super("pro");
	}
}

streamDeck.logger.setLevel("info");

assertLayout();
streamDeck.logger.info(`Input layer ready (node ${process.version}, ${process.platform}).`);

streamDeck.actions.registerAction(new RunSequence());

streamDeck.connect();
