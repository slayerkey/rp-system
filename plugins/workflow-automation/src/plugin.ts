import streamDeck, { action } from "@elgato/streamdeck";

import { RunSequenceBase } from "../../_wf/src/actions/run";
import { assertLayout } from "../../_wf/src/input";

/**
 * Free tier: launch, keystroke, wait and open a link, up to five steps.
 *
 * The tier is passed to the shared action rather than reimplemented here, so the paid plugin
 * runs the same code path with a different allowance.
 */
@action({ UUID: "com.packrat.workflow.run" })
class RunSequence extends RunSequenceBase {
	constructor() {
		super("lite");
	}
}

streamDeck.logger.setLevel("info");

assertLayout();
streamDeck.logger.info(`Input layer ready (node ${process.version}, ${process.platform}).`);

streamDeck.actions.registerAction(new RunSequence());

streamDeck.connect();
