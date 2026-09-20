import streamDeck from "@elgato/streamdeck";

import { listScreensavers } from "./screensaver";

/**
 * Answers the one question the property inspector can't answer itself: a PI is a browser
 * window with no access to the filesystem, so it can't enumerate the installed .scr files.
 *
 *   { probe: "list", folder? }  ->  { probe: "list", screensavers: [{ name, path }] }
 *
 * Replies go through streamDeck.ui, which only delivers while a PI is open -- exactly when
 * we're being asked.
 */
export async function handlePiProbe(payload: unknown): Promise<void> {
	const p = payload as { probe?: string; folder?: string };
	if (p?.probe === "list") {
		await streamDeck.ui.sendToPropertyInspector({ probe: "list", screensavers: listScreensavers(p.folder) });
	}
}
