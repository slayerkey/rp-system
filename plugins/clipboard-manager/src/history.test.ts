/** History list rules. Run with: npm run test:history */
import { entryForSlot, type HistoryEntry, pushEntry, SLOTS } from "./history";

let failures = 0;
function check(label: string, actual: unknown, expected: unknown): void {
	const a = JSON.stringify(actual);
	const b = JSON.stringify(expected);
	const ok = a === b;
	if (!ok) failures++;
	console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  (got ${a}, expected ${b})`}`);
}

const at = (n: number) => n * 1000;
const build = (...texts: string[]): HistoryEntry[] => texts.map((text, i) => ({ text, copiedAt: at(i) }));
const texts = (h: HistoryEntry[] | null) => (h === null ? null : h.map((e) => e.text));

console.log("Clipboard history");

check("a copy lands at the front", texts(pushEntry([], "a", at(1))), ["a"]);
check("the newest copy pushes the rest along", texts(pushEntry(build("a"), "b", at(2))), ["b", "a"]);

// The edge case four identical slots would come from: copy pressed twice on one selection.
check("copying the same thing twice changes nothing", pushEntry(build("a"), "a", at(2)), null);
check("re-copying something older moves it to the front", texts(pushEntry(build("a", "b", "c"), "c", at(3))), ["c", "a", "b"]);

const full = build("a", "b", "c", "d");
check("the list never grows past the slot count", texts(pushEntry(full, "e", at(5)))?.length, SLOTS);
check("the oldest copy falls off the end", texts(pushEntry(full, "e", at(5))), ["e", "a", "b", "c"]);
check("a caller can reuse the ring with a deeper cap", texts(pushEntry(full, "e", at(5), 8)), ["e", "a", "b", "c", "d"]);

check("slot 1 is the most recent copy", entryForSlot(build("a", "b"), 1)?.text, "a");
check("slot 2 is the one before it", entryForSlot(build("a", "b"), 2)?.text, "b");
check("a slot past the end has nothing in it", entryForSlot(build("a"), 3), undefined);
check("every slot is empty on a cold start", entryForSlot([], 1), undefined);

console.log(failures === 0 ? "\nall passed" : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
