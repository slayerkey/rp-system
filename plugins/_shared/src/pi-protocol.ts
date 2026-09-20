/**
 * The one message the property inspector cannot answer for itself: the team list.
 *
 * Same shape as plugins/screensaver-cycler/src/pi.ts, for the same reason. The PI is a plain
 * browser window with no access to the plugin's bundle, so it asks and the plugin answers.
 * Baking the list into the PI's own JS instead would mean maintaining two copies per sport.
 *
 *   { probe: "teams" }  ->  { probe: "teams", teams: [{ id, abbr, name, group }] }
 */
import streamDeck from "@elgato/streamdeck";

export type TeamOption = {
	id: string;
	abbr: string;
	name: string;
	/** Whatever the sport groups teams by: conference, tour, series. Used as an optgroup label. */
	group: string;
};

export async function handleTeamsProbe(payload: unknown, teams: TeamOption[]): Promise<void> {
	if ((payload as { probe?: string })?.probe !== "teams") return;
	await streamDeck.ui.sendToPropertyInspector({ probe: "teams", teams });
}
