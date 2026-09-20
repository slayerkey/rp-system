import streamDeck from "@elgato/streamdeck";

import { normaliseState, type ProGlobalSettings } from "./history-pro";

export async function readState(): Promise<ProGlobalSettings> {
	return normaliseState(await streamDeck.settings.getGlobalSettings<ProGlobalSettings>());
}

export async function writeState(state: ProGlobalSettings): Promise<void> {
	await streamDeck.settings.setGlobalSettings(normaliseState(state));
}
