import streamDeck from "@elgato/streamdeck";

import { CycleScreensavers } from "./actions/cycle";
import { NextScreensaver } from "./actions/next";
import { ScheduleScreensaver } from "./actions/schedule";
import { startScheduler } from "./scheduler";

streamDeck.logger.setLevel("info");

// Windows-only for v1: setActive() writes the SCRNSAVE.EXE registry value, which has no
// macOS equivalent. On any other platform the actions register but each press shows an
// alert rather than silently doing nothing.
if (process.platform !== "win32") {
	streamDeck.logger.warn("Screensaver Scheduler is Windows-only; actions will alert on this platform.");
}

streamDeck.actions.registerAction(new NextScreensaver());
streamDeck.actions.registerAction(new CycleScreensavers());
streamDeck.actions.registerAction(new ScheduleScreensaver());

if (process.platform === "win32") {
	startScheduler();
}

streamDeck.connect();
