/**
 * Writes the key faces the listing art uses, straight from the shipping renderer.
 *
 * The slots draw their keys at runtime, so there is no static PNG on disk for the marketing
 * generator to pull the way it does for Better Hotkeys. Rendering them here keeps the listing
 * honest: every key in the art is a real badge from the real code path, with the same
 * truncation and the same empty states a buyer will actually see.
 *
 *   npx tsx plugins/clipboard-manager/scripts/marketing-keys.ts <outDir>
 *   node tools/art/svg_to_png.mjs <outDir> plugins
 *
 * The SVGs land in <outDir>/clipboard-manager/<name>.svg.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { emptySlotBadge, previewText, slotBadge } from "../src/badge";

const out = process.argv[2] ?? "marketing-keys";

/** The preview length the property inspector calls Normal, and the action's default. */
const N = 40;

const slot = (slotIndex: number, text: string, pasteMode: "direct" | "restore" = "direct") =>
	slotBadge({ slotIndex, preview: previewText(text, N), pasteMode });

const faces: Record<string, string> = {
	// The four slots as a row: the last four things somebody actually copied, newest first.
	slot1: slot(1, "Thanks, sending that over now"),
	slot2: slot(2, "hello@packrat.studio"),
	slot3: slot(3, "Q3 launch notes"),
	slot4: slot(4, "#2BE86A"),
	// A long copy, cut to fit the key. The press still pastes the whole thing.
	long: slot(1, "Invoice for March, please review and send it back by Friday"),
	// Restore mode, where a press puts the text back on the clipboard instead of typing it.
	restore: slot(2, "hello@packrat.studio", "restore"),
	// The two calm nothing-to-show faces.
	empty: emptySlotBadge({ slotIndex: 3, reason: "short" }),
	pick: emptySlotBadge({ slotIndex: 0, reason: "pick" })
};

const dir = path.join(out, "clipboard-manager");
mkdirSync(dir, { recursive: true });
for (const [name, svg] of Object.entries(faces)) {
	writeFileSync(path.join(dir, `${name}.svg`), svg, "utf-8");
}
console.log(`clipboard-manager: ${Object.keys(faces).length} key faces`);
