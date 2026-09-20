import fs from "node:fs";
import path from "node:path";

import { keyImage, previewText, slotBadge } from "../../clipboard-manager/src/badge";
import { type HistoryEntry, pushEntry, SLOTS } from "../../clipboard-manager/src/history";
import {
	allEntries,
	normaliseState,
	pinEntry,
	PRO_HISTORY_LIMIT,
	searchEntries,
	type ProGlobalSettings,
	unpinEntry
} from "./history-pro";
import { planPaste } from "./paste-entry";

let failures = 0;
function check(label: string, actual: unknown, expected: unknown): void {
	const a = JSON.stringify(actual);
	const b = JSON.stringify(expected);
	const ok = a === b;
	if (!ok) failures++;
	console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  (got ${a}, expected ${b})`}`);
}

const entry = (text: string, copiedAt: number): HistoryEntry => ({ text, copiedAt });
const texts = (items: HistoryEntry[] | null | undefined) => items?.map((item) => item.text);

console.log("Clipboard Manager Pro");

let deep: HistoryEntry[] = [];
for (let i = 0; i < PRO_HISTORY_LIMIT + 7; i++) deep = pushEntry(deep, `copy ${i}`, i, PRO_HISTORY_LIMIT) ?? deep;
check("Lite keeps its four-slot default", pushEntry([entry("a", 1), entry("b", 2), entry("c", 3), entry("d", 4)], "e", 5)?.length, SLOTS);
check("Pro retains a deeper rolling history", deep.length, PRO_HISTORY_LIMIT);
check("rotation drops the oldest Pro entry", deep.some((item) => item.text === "copy 0"), false);
check("rotation keeps the newest Pro entry", deep[0].text, `copy ${PRO_HISTORY_LIMIT + 6}`);

let state: ProGlobalSettings = { history: deep };
const kept = deep[deep.length - 1];
state = pinEntry(state, kept);
for (let i = 100; i < 170; i++) state.history = pushEntry(state.history ?? [], `later ${i}`, i, PRO_HISTORY_LIMIT) ?? state.history;
check("a pin survives history rotation", allEntries(state).some((item) => item.text === kept.text), true);
const restarted = normaliseState(JSON.parse(JSON.stringify(state)) as ProGlobalSettings);
check("history survives restart serialization", restarted.history?.length, PRO_HISTORY_LIMIT);
check("pins survive restart serialization", texts(restarted.pinned), [kept.text]);
state = unpinEntry(restarted, kept, 999);
check("a pinned entry can be unpinned", state.pinned?.length, 0);
check("an unpinned entry returns to rolling history", state.history?.[0].text, kept.text);

const searchable: ProGlobalSettings = {
	pinned: [entry("Quarterly roadmap notes", 1)],
	history: [entry("Roadmap launch checklist", 2), entry("support reply", 3)]
};
check("search is case insensitive and matches every term", texts(searchEntries(searchable, "ROADMAP launch")), ["Roadmap launch checklist"]);
check("an empty search returns pinned entries first", texts(searchEntries(searchable, "")), ["Quarterly roadmap notes", "Roadmap launch checklist", "support reply"]);
check("duplicate text appears only once across pins and history", texts(allEntries({ pinned: [entry("same", 1)], history: [entry("same", 2)] })), ["same"]);

const long = "x".repeat(10000);
check("plain paste keeps the full underlying text", planPaste(long, long, "plain").writeText?.length, long.length);
check("plain paste always rewrites the clipboard to remove rich formats", planPaste("hello", "hello", "plain"), {
	writeText: "hello",
	sendPaste: true
});
check("standard paste can preserve current rich formats", planPaste("hello", "hello", "direct"), { writeText: null, sendPaste: true });
check("restore changes the clipboard without injecting paste", planPaste("hello", null, "restore"), { writeText: "hello", sendPaste: false });

const named = Buffer.from(
	keyImage(slotBadge({ slotIndex: 1, label: "Work Email", preview: previewText(long, 40), pasteMode: "plain" })).replace(
		"data:image/svg+xml;base64,",
		""
	),
	"base64"
).toString("utf8");
check("a custom slot name appears on the key", named.includes("Work Email"), true);
check("a long value is truncated only for display", previewText(long, 40).length, 40);

const root = path.resolve(import.meta.dirname, "..", "..");
const liteManifest = JSON.parse(fs.readFileSync(path.join(root, "clipboard-manager", "com.packrat.clipboard.sdPlugin", "manifest.json"), "utf8"));
const proManifest = JSON.parse(fs.readFileSync(path.join(root, "clipboard-manager-pro", "com.packrat.clipboardpro.sdPlugin", "manifest.json"), "utf8"));
check("Lite and Pro plugin UUIDs are isolated", liteManifest.UUID === proManifest.UUID, false);
check(
	"Lite and Pro action UUIDs do not collide",
	liteManifest.Actions.some((lite: { UUID: string }) => proManifest.Actions.some((pro: { UUID: string }) => pro.UUID === lite.UUID)),
	false
);
check("empty and invalid stored entries stay safe", normaliseState({ history: [entry("", 1), { text: "ok", copiedAt: Number.NaN }] }).history, []);

console.log(failures === 0 ? "\nall passed" : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
