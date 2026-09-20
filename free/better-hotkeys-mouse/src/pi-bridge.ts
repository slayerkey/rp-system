import streamDeck from "@elgato/streamdeck";

import { arm, disarm } from "./capture";
import { monitors } from "./input";

/**
 * Answers questions the property inspector can't answer itself: a PI is a browser
 * window with no idea how many monitors exist, where the cursor is, or what mics exist.
 *
 * Messages:
 *   { probe: "monitors" }  -> the monitor list, for the picker
 *   { probe: "mics" }      -> the microphone list, for the picker
 *   { probe: "arm" }       -> start waiting for a deck-key press to capture
 *   { probe: "disarm" }    -> cancel that
 *
 * Replies go through streamDeck.ui, which only delivers while a property inspector is
 * visible -- precisely when we're being asked.
 */
export async function handlePiProbe(context: string, payload: unknown): Promise<void> {
	const probe = (payload as { probe?: string })?.probe;

	switch (probe) {
		case "monitors":
			await streamDeck.ui.sendToPropertyInspector({
				probe: "monitors",
				monitors: monitors().map((m, i) => ({
					index: i,
					label: `${m.primary ? "Primary" : `Monitor ${i + 1}`} — ${m.width}×${m.height}`
				}))
			});
			return;

		case "mics": {
			// Mic actions use Windows Core Audio (see src/win32/audio.ts) and have no
			// macOS equivalent yet -- imported dynamically so this module never loads
			// ole32.dll on a platform that doesn't have it.
			const mics = process.platform === "win32" ? (await import("./win32/audio")).listCaptureDevices() : [];
			await streamDeck.ui.sendToPropertyInspector({
				probe: "mics",
				mics: mics.map((d) => ({ id: d.id, label: d.isDefault ? `${d.name} (default)` : d.name }))
			});
			return;
		}

		case "arm": {
			const slot = (payload as { slot?: "point" | "from" | "to" }).slot ?? "point";
			arm(context, slot);
			await streamDeck.ui.sendToPropertyInspector({ probe: "armed", armed: true, slot });
			return;
		}

		case "disarm":
			disarm(context);
			await streamDeck.ui.sendToPropertyInspector({ probe: "armed", armed: false });
			return;
	}
}
