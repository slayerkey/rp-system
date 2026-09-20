import { read, write } from "../../clipboard-manager/src/clipboard/clipboard";
import { noteOwnWrite } from "../../clipboard-manager/src/clipboard/watcher";
import { ensureAccessibilityPermission, sendPasteChord } from "../../clipboard-manager/src/paste/input";

export type PasteMode = "direct" | "plain" | "restore";

export type PastePlan = {
	writeText: string | null;
	sendPaste: boolean;
};

export function planPaste(selectedText: string, currentText: string | null, mode: PasteMode): PastePlan {
	if (mode === "restore") return { writeText: selectedText, sendPaste: false };
	if (mode === "plain") return { writeText: selectedText, sendPaste: true };
	return { writeText: currentText === selectedText ? null : selectedText, sendPaste: true };
}

export async function pasteEntry(text: string, mode: PasteMode): Promise<void> {
	if (mode !== "restore" && !(await ensureAccessibilityPermission())) {
		throw new Error("Accessibility permission is required for direct paste.");
	}

	const plan = planPaste(text, await read(), mode);
	if (plan.writeText !== null) {
		if (!(await write(plan.writeText))) throw new Error("Another program is holding the clipboard open.");
		noteOwnWrite(plan.writeText);
	}
	if (plan.sendPaste) sendPasteChord();
}
